# in app.py route do scores = analyse_emotion(user_text, model_size="base") if model is base
# or scores = analyse_emotion(user_text, model_size="large") if model is large
#
#
#
#

from transformers import pipeline

MODEL_NAME_BASE = "j-hartmann/emotion-english-distilroberta-base"
MODEL_NAME_LARGE = "j-hartmann/emotion-english-roberta-large"

_classifiers = {
    "base": None,
    "large": None,
}

MODEL_NAMES = {
    "base": MODEL_NAME_BASE,
    "large": MODEL_NAME_LARGE,
}


def get_classifier(model_size="base"):
    if model_size not in MODEL_NAMES:
        raise ValueError("model_size must be 'base' or 'large'")

    global _classifiers

    if _classifiers[model_size] is None:
        _classifiers[model_size] = pipeline(
            "text-classification",
            model=MODEL_NAMES[model_size],
            top_k=None,
        )

    return _classifiers[model_size]


def _sort_results(results):
    if isinstance(results[0], dict):
        scores = results
    else:
        scores = results[0]

    return sorted(scores, key=lambda item: item["score"], reverse=True)


def analyse_emotion(text, model_size="base"):
    if not text or not text.strip():
        return None

    results = get_classifier(model_size)(text)
    return _sort_results(results)