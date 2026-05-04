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
    'You generate daily prompts for a mindfulness website called "People Over Tech". '
    "Each prompt is exactly one sentence. Prompts are actionable or observational. "
    "They focus on nature, human connection, presence, slowing down, or resisting technology addiction. "
    "They are warm, non-preachy, non-political, and non-toxic. "
    "They do not mention productivity, optimization, goals, streaks, or scores. "
    'Examples: "Go outside and consider a cloud.", '
    '"Call someone you haven\'t spoken to in over a year.", '
    '"Eat one meal today without looking at a screen."'
)

CONNECTION_SYSTEM = (
    'You generate short first-person phrases for a website called "People Over Tech". '
    "Connection phrases express that the user felt empathy, nature, bonds, or shared humanity. "
    "They are 3-10 words, poetic, calm, and human. "
    'Examples: "I found my sky today", "I listened to the wind", '
    '"I felt part of something old", "I belonged somewhere today"'
)

REBEL_SYSTEM = (
    'You generate short first-person phrases for a website called "People Over Tech". '
    "Rebel phrases express autonomy, individuality, or calm resistance to technology and algorithms. "
    "They are 3-10 words, defiant but peaceful. "
    'Examples: "I marched to my own drum", "I refused the scroll", '
    '"I put the algorithm down", "I was unreachable and fine"'
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


def call_api(api_key, candidates, system_message, user_message):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://peopleovertech.pages.dev",
        "X-Title": "People Over Tech",
    }

    for candidate in candidates:
        for messages in [
            [{"role": "system", "content": system_message}, {"role": "user", "content": user_message}],
            [{"role": "user", "content": f"{system_message}\n\n{user_message}"}],
        ]:
            response = httpx.post(
                OPENROUTER_URL,
                headers=headers,
                json={"model": candidate, "messages": messages},
                timeout=30,
            )
            if response.status_code == 400:
                continue
            if response.status_code == 429:
                print(f"WARNING: rate limited on {candidate}, trying next")
                time.sleep(5)
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
    new_connection, rejected_connection = generate_phrases(api_key, candidates, "connection", CONNECTION_SYSTEM, used_connection)
    time.sleep(3)
    new_rebel, rejected_rebel = generate_phrases(api_key, candidates, "rebel", REBEL_SYSTEM, used_rebel)

    prompts_data = load_json(PROMPTS_FILE)
    next_p = next_id("p", [p["id"] for p in prompts_data])
    for i, text in enumerate(new_prompts):
        prompts_data.append({"id": f"p{next_p + i:03d}", "text": text, "date_added": TODAY})
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
