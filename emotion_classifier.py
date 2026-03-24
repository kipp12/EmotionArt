from transformers import pipeline


classifier = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    top_k=None,
)


def analyse_emotion(text):
    if not text or not text.strip():
        return None

    results = classifier(text)

    if isinstance(results[0], dict):
        scores = results
    else:
        scores = results[0]

    return sorted(scores, key=lambda item: item["score"], reverse=True)
