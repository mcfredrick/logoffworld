import difflib
import json
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import httpx

from model_selector import get_best_model, build_candidate_list

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "../public/data"
USED_PROMPTS_FILE = SCRIPT_DIR / "used_prompts.json"
USED_PHRASES_FILE = SCRIPT_DIR / "used_phrases.json"
PROMPTS_FILE = DATA_DIR / "prompts.json"
PHRASES_FILE = DATA_DIR / "phrases.json"

BANNED_WORDS = {"kill", "die", "hate", "war", "violence", "sex", "drug"}
TODAY = date.today().isoformat()
DEDUP_CUTOFF_DAYS = 90
DEDUP_THRESHOLD = 0.7

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

PROMPT_SYSTEM = (
    'You generate daily prompts for a mindfulness website called "Log Off". '
    "Each prompt is exactly one sentence. Prompts invite people to have fun, be playful, and delight in the world around them. "
    "They focus on nature, human connection, presence, spontaneity, and joyful engagement with other people. "
    "They are whimsical, warm, lighthearted, non-preachy, non-political, and non-toxic. "
    "They do not mention productivity, optimization, goals, streaks, or scores. "
    'Examples: "Wave at a stranger and mean it.", '
    '"Find the silliest cloud in the sky and tell someone about it.", '
    '"Ask the next person you see what made them smile this week."'
)

CONNECTION_SYSTEM = (
    'You generate short first-person phrases for a website called "Log Off". '
    "Connection phrases are what a user says after completing today's daily prompt — they signal 'I did the thing, I showed up.' "
    "They are 3-10 words, warm, a little playful, and human — they should feel like a satisfied nod to the prompt. "
    'Examples: "I showed up for today", "I did the thing today", '
    '"I played along today", "I took the leap today"'
)

REBEL_SYSTEM = (
    'You generate short first-person phrases for a website called "Log Off". '
    "Rebel phrases are what a user says when they skipped today's prompt and found their own joyful way to engage with the world. "
    "They signal 'I did my own thing instead — and it was great.' They are 3-10 words, playful, self-assured, and positive. "
    'Examples: "I made my own magic today", "I wrote my own prompt", '
    '"I went off-script and loved it", "I found my own adventure"'
)

SHARE_SYSTEM = (
    'You write ironic social media share copy for "Log Off" — a site that exists in direct opposition to social media. '
    "Each prompt invites people to be present, connect with humans, or engage with the physical world. "
    "The share copy is short (under 180 characters), dry, and lightly contemptuous of the platforms it will be shared on. "
    "Connection copy: the user completed the prompt and felt something real. "
    "Rebel copy: the user skipped the prompt and did their own thing — equally valid, equally human. "
    "Both variants must end by encouraging the reader to share this, then abandon the platform and go do something real. "
    "Do not include a URL. Do not use hashtags. Do not use exclamation marks. Write in plain, unhurried prose."
)


def load_json(path):
    with open(path) as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def prune_used(entries):
    cutoff = (datetime.today() - timedelta(days=DEDUP_CUTOFF_DAYS)).date().isoformat()
    return [e for e in entries if e.get("date", "") >= cutoff]


def is_duplicate(text, used_texts):
    for existing in used_texts:
        ratio = difflib.SequenceMatcher(None, text.lower(), existing.lower()).ratio()
        if ratio > DEDUP_THRESHOLD:
            return True
    return False


def is_valid_prompt(text):
    words = text.split()
    if len(words) < 5 or len(words) > 20:
        return False, f"word count {len(words)} out of range"
    lower = text.lower()
    for word in BANNED_WORDS:
        if word in lower:
            return False, f"contains banned word '{word}'"
    return True, None


def is_valid_phrase(text):
    words = text.split()
    if len(words) < 3 or len(words) > 12:
        return False, f"word count {len(words)} out of range"
    return True, None


def _parse_json_array(text: str) -> list:
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON array found in response: {text[:200]}")
    return json.loads(text[start:end])


def _post_with_retry(headers, payload, max_retries=3):
    waits = [15, 45, 90]
    response = httpx.post(OPENROUTER_URL, headers=headers, json=payload, timeout=30)
    for i in range(max_retries):
        if response.status_code != 429:
            break
        wait = waits[min(i, len(waits) - 1)]
        print(f"WARNING: rate limited on {payload['model']}, retrying in {wait}s (attempt {i + 1}/{max_retries})")
        time.sleep(wait)
        response = httpx.post(OPENROUTER_URL, headers=headers, json=payload, timeout=30)
    return response


def call_api(api_key, candidates, system_message, user_message):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://logoff.world",
        "X-Title": "Log Off",
    }

    for candidate in candidates:
        for messages in [
            [{"role": "system", "content": system_message}, {"role": "user", "content": user_message}],
            [{"role": "user", "content": f"{system_message}\n\n{user_message}"}],
        ]:
            response = _post_with_retry(headers, {"model": candidate, "messages": messages})
            if response.status_code == 400:
                continue
            if response.status_code == 429:
                print(f"WARNING: {candidate} still rate limited after retries, trying next model")
                break
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"].strip()
            return _parse_json_array(content)

    raise RuntimeError("All candidate models failed")


def next_id(prefix, existing_ids):
    nums = []
    for id_ in existing_ids:
        if id_.startswith(prefix):
            try:
                nums.append(int(id_[len(prefix):]))
            except ValueError:
                pass
    return max(nums, default=0) + 1


def generate_prompts(api_key, candidates, used_prompts):
    try:
        raw = call_api(
            api_key,
            candidates,
            PROMPT_SYSTEM,
            "Generate 5 new daily prompts. Return ONLY a JSON array of strings, no explanation. Example: [\"prompt 1\", \"prompt 2\"]",
        )
    except Exception as e:
        print(f"WARNING: prompt generation failed: {e}")
        return [], []

    used_texts = [e["text"] for e in used_prompts]
    accepted, rejected = [], []

    for text in raw:
        valid, reason = is_valid_prompt(text)
        if not valid:
            rejected.append((text, reason))
            continue
        if is_duplicate(text, used_texts):
            rejected.append((text, "duplicate"))
            continue
        accepted.append(text)
        used_texts.append(text)

    return accepted, rejected


def generate_share_copy(api_key, candidates, prompt_texts):
    if not prompt_texts:
        return []
    numbered = "\n".join(f'{i + 1}. "{t}"' for i, t in enumerate(prompt_texts))
    user_msg = (
        f"Here are {len(prompt_texts)} prompts. For each, write share copy — one connection variant and one rebel variant.\n\n"
        "Return ONLY a JSON array of objects with \"connection_share\" and \"rebel_share\" keys, "
        f"one object per prompt in the same order.\n\nPrompts:\n{numbered}"
    )
    try:
        raw = call_api(api_key, candidates, SHARE_SYSTEM, user_msg)
    except Exception as e:
        print(f"WARNING: share copy generation failed: {e}")
        return [{}] * len(prompt_texts)

    if not isinstance(raw, list) or len(raw) != len(prompt_texts):
        print(f"WARNING: share copy count mismatch — got {len(raw) if isinstance(raw, list) else type(raw)}, expected {len(prompt_texts)}")
        return [{}] * len(prompt_texts)

    result = []
    for item in raw:
        conn = item.get("connection_share", "") if isinstance(item, dict) else ""
        reb = item.get("rebel_share", "") if isinstance(item, dict) else ""
        result.append({"connection_share": conn[:250], "rebel_share": reb[:250]})
    return result


def generate_phrases(api_key, candidates, category, system_msg, used_phrases):
    try:
        raw = call_api(
            api_key,
            candidates,
            system_msg,
            f"Generate 5 new {category} phrases. Return ONLY a JSON array of strings, no explanation.",
        )
    except Exception as e:
        print(f"WARNING: {category} phrase generation failed: {e}")
        return [], []

    used_texts = [e["text"] for e in used_phrases]
    accepted, rejected = [], []

    for text in raw:
        valid, reason = is_valid_phrase(text)
        if not valid:
            rejected.append((text, reason))
            continue
        if is_duplicate(text, used_texts):
            rejected.append((text, "duplicate"))
            continue
        accepted.append(text)
        used_texts.append(text)

    return accepted, rejected


def main():
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("ERROR: OPENROUTER_API_KEY not set")
        sys.exit(1)

    try:
        model = get_best_model()
        candidates = build_candidate_list(model)
        print(f"Using model: {model} ({len(candidates)} candidates)")
    except Exception as e:
        print(f"ERROR: could not select model: {e}")
        sys.exit(1)

    used_prompts = prune_used(load_json(USED_PROMPTS_FILE))
    used_phrases_data = load_json(USED_PHRASES_FILE)
    used_connection = prune_used(used_phrases_data["connection"])
    used_rebel = prune_used(used_phrases_data["rebel"])

    new_prompts, rejected_prompts = generate_prompts(api_key, candidates, used_prompts)
    time.sleep(3)
    share_copies = generate_share_copy(api_key, candidates, new_prompts)
    time.sleep(3)
    new_connection, rejected_connection = generate_phrases(api_key, candidates, "connection", CONNECTION_SYSTEM, used_connection)
    time.sleep(3)
    new_rebel, rejected_rebel = generate_phrases(api_key, candidates, "rebel", REBEL_SYSTEM, used_rebel)

    prompts_data = load_json(PROMPTS_FILE)
    next_p = next_id("p", [p["id"] for p in prompts_data])
    for i, text in enumerate(new_prompts):
        entry = {"id": f"p{next_p + i:03d}", "text": text, "date_added": TODAY}
        if i < len(share_copies) and share_copies[i]:
            entry.update(share_copies[i])
        prompts_data.append(entry)
    save_json(PROMPTS_FILE, prompts_data)

    phrases_data = load_json(PHRASES_FILE)
    next_c = next_id("c", [p["id"] for p in phrases_data["connection"]])
    for i, text in enumerate(new_connection):
        phrases_data["connection"].append({"id": f"c{next_c + i:03d}", "text": text})

    next_r = next_id("r", [p["id"] for p in phrases_data["rebel"]])
    for i, text in enumerate(new_rebel):
        phrases_data["rebel"].append({"id": f"r{next_r + i:03d}", "text": text})
    save_json(PHRASES_FILE, phrases_data)

    for text in new_prompts:
        used_prompts.append({"text": text, "date": TODAY})
    save_json(USED_PROMPTS_FILE, used_prompts)

    for text in new_connection:
        used_connection.append({"text": text, "date": TODAY})
    for text in new_rebel:
        used_rebel.append({"text": text, "date": TODAY})
    save_json(USED_PHRASES_FILE, {"connection": used_connection, "rebel": used_rebel})

    print(f"\nPrompts:    generated=5, accepted={len(new_prompts)}, rejected={len(rejected_prompts)}, total={len(prompts_data)}")
    for text, reason in rejected_prompts:
        print(f"  REJECTED ({reason}): {text}")

    print(f"Connection: generated=5, accepted={len(new_connection)}, rejected={len(rejected_connection)}, total={len(phrases_data['connection'])}")
    for text, reason in rejected_connection:
        print(f"  REJECTED ({reason}): {text}")

    print(f"Rebel:      generated=5, accepted={len(new_rebel)}, rejected={len(rejected_rebel)}, total={len(phrases_data['rebel'])}")
    for text, reason in rejected_rebel:
        print(f"  REJECTED ({reason}): {text}")

    if len(new_prompts) < 2 or len(new_connection) < 2 or len(new_rebel) < 2:
        print("\nERROR: insufficient content accepted — not committing")
        sys.exit(1)

    print("\nContent generation complete.")


if __name__ == "__main__":
    main()
