from threading import Lock, Thread

from transformers import pipeline

MODEL_NAME_BASE = "j-hartmann/emotion-english-distilroberta-base"
MODEL_NAME_LARGE = "j-hartmann/emotion-english-roberta-large"

MODEL_NAMES = {
    "base": MODEL_NAME_BASE,
    "large": MODEL_NAME_LARGE,
}

_state_lock = Lock()
_classifiers = {
    "base": None,
    "large": None,
}
_loading_threads = {
    "base": None,
    "large": None,
}
_load_errors = {
    "base": None,
    "large": None,
}


class ModelLoadingError(RuntimeError):
    pass


def _load_classifier(model_size):
    try:
        classifier = pipeline(
            "text-classification",
            model=MODEL_NAMES[model_size],
            top_k=None,
        )
    except Exception as exc:
        with _state_lock:
            _load_errors[model_size] = str(exc)
            _loading_threads[model_size] = None
        return

    with _state_lock:
        _classifiers[model_size] = classifier
        _load_errors[model_size] = None
        _loading_threads[model_size] = None


def ensure_classifier_loading(model_size="base"):
    if model_size not in MODEL_NAMES:
        raise ValueError("model_size must be 'base' or 'large'")

    with _state_lock:
        if _classifiers[model_size] is not None:
            return "ready"

        thread = _loading_threads[model_size]
        if thread is not None and thread.is_alive():
            return "loading"

        _load_errors[model_size] = None
        thread = Thread(target=_load_classifier, args=(model_size,), daemon=True)
        _loading_threads[model_size] = thread
        thread.start()
        return "loading"


def get_model_status(model_size="base"):
    if model_size not in MODEL_NAMES:
        raise ValueError("model_size must be 'base' or 'large'")

    with _state_lock:
        if _classifiers[model_size] is not None:
            return {
                "state": "ready",
                "error": None,
                "model_name": MODEL_NAMES[model_size],
            }

        thread = _loading_threads[model_size]
        if thread is not None and thread.is_alive():
            return {
                "state": "loading",
                "error": None,
                "model_name": MODEL_NAMES[model_size],
            }

        if _load_errors[model_size]:
            return {
                "state": "error",
                "error": _load_errors[model_size],
                "model_name": MODEL_NAMES[model_size],
            }

        return {
            "state": "idle",
            "error": None,
            "model_name": MODEL_NAMES[model_size],
        }


def get_classifier(model_size="base"):
    if model_size not in MODEL_NAMES:
        raise ValueError("model_size must be 'base' or 'large'")

    status = get_model_status(model_size)
    if status["state"] != "ready":
        ensure_classifier_loading(model_size)
        raise ModelLoadingError(
            f"The {model_size} emotion model is still loading. Please wait a moment and try again."
        )

    with _state_lock:
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

    print("ANALYSE_EMOTION USING MODEL:", model_size)
    results = get_classifier(model_size)(text)
    return _sort_results(results)
