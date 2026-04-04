from transformers import pipeline


MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"
_classifier = None


def get_classifier():
    global _classifier

    if _classifier is None:
        _classifier = pipeline(
            "text-classification",
            model=MODEL_NAME,
            top_k=None,
        )

    return _classifier


def analyse_emotion(text):
    if not text or not text.strip():
        return None

    results = get_classifier()(text)

    if isinstance(results[0], dict):
        scores = results
    else:
        scores = results[0]

    return sorted(scores, key=lambda item: item["score"], reverse=True)
