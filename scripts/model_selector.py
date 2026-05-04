import requests

PREFERRED_MODELS = [
    "mistralai/mistral-7b-instruct:free",
    "google/gemma-2-9b-it:free",
    "meta-llama/llama-3-8b-instruct:free",
]


def get_best_model(api_key: str) -> str:
    response = requests.get(
        "https://openrouter.ai/api/v1/models",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=15,
    )
    response.raise_for_status()

    models = response.json().get("data", [])
    free_ids = {m["id"] for m in models if m["id"].endswith(":free")}

    for model_id in PREFERRED_MODELS:
        if model_id in free_ids:
            return model_id

    if free_ids:
        return next(iter(free_ids))

    raise RuntimeError("No free models available on OpenRouter")
