"""
Emotion Classifier — background-loading wrapper around HuggingFace transformers.

Uses the j-hartmann emotion classification models:
  - BASE:  j-hartmann/emotion-english-distilroberta-base  (~250 MB, fast)
  - LARGE: j-hartmann/emotion-english-roberta-large       (~1.3 GB, more accurate)

Both models classify text into 7 Ekman emotions:
  anger, disgust, fear, joy, neutral, sadness, surprise

Models are downloaded and loaded in a background thread so the Flask server
can start immediately. The first analysis request may receive a 503 while
the download is still in progress.

Key library:
  transformers.pipeline("text-classification", ..., top_k=None)
    - Runs the tokenizer + model forward pass + softmax in one call.
    - top_k=None returns scores for ALL labels (all 7 emotions), not just the top-1.
    - Returns a list of dicts: [{"label": "joy", "score": 0.82}, ...]
"""

from threading import Lock, Thread

from transformers import pipeline

# HuggingFace model identifiers — downloaded automatically on first use.
MODEL_NAME_BASE = "j-hartmann/emotion-english-distilroberta-base"
MODEL_NAME_LARGE = "j-hartmann/emotion-english-roberta-large"

MODEL_NAMES = {
    "base": MODEL_NAME_BASE,
    "large": MODEL_NAME_LARGE,
}

# Thread-safe state for each model variant.
# _classifiers: the loaded pipeline object (None until download completes).
# _loading_threads: reference to the background thread doing the download.
# _load_errors: stores the error string if download/loading failed.
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
    """Raised when an analysis is attempted while the model is still loading."""
    pass


def _load_classifier(model_size):
    """Background worker — downloads and initialises a transformer pipeline.

    Called in a daemon thread by ensure_classifier_loading(). On success, stores
    the pipeline in _classifiers[model_size]. On failure, stores the error
    message in _load_errors[model_size].
    """
    try:
        # pipeline() handles: download model weights + tokenizer from HuggingFace Hub,
        # load into memory, and prepare for inference.
        classifier = pipeline(
            "text-classification",
            model=MODEL_NAMES[model_size],
            top_k=None,  # Return scores for all 7 emotion labels
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
    """Start downloading a model in the background if it isn't already loaded.

    Returns the current state: "ready" if already loaded, "loading" if a
    download thread is running or was just started.
    """
    if model_size not in MODEL_NAMES:
        raise ValueError("model_size must be 'base' or 'large'")

    with _state_lock:
        # Already loaded — nothing to do.
        if _classifiers[model_size] is not None:
            return "ready"

        # A download is already in progress.
        thread = _loading_threads[model_size]
        if thread is not None and thread.is_alive():
            return "loading"

        # Start a new background download.
        _load_errors[model_size] = None
        thread = Thread(target=_load_classifier, args=(model_size,), daemon=True)
        _loading_threads[model_size] = thread
        thread.start()
        return "loading"


def get_model_status(model_size="base"):
    """Return a dict describing the current state of a model variant.

    Possible states:
      "ready"   — model is loaded and inference-ready
      "loading" — background download is in progress
      "error"   — download failed (error details included)
      "idle"    — no download attempted yet
    """
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
    """Return the loaded pipeline, or raise ModelLoadingError if unavailable.

    If the model hasn't been requested yet, kicks off a background download.
    """
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
    """Sort the raw pipeline output by score descending.

    The pipeline returns either a flat list of dicts or a nested list
    (depending on batch size). Handles both cases.
    """
    if isinstance(results[0], dict):
        scores = results
    else:
        scores = results[0]

    return sorted(scores, key=lambda item: item["score"], reverse=True)


def analyse_emotion(text, model_size="base"):
    """Classify a text string and return emotion scores sorted by strength.

    Returns a list of 7 dicts: [{"label": "joy", "score": 0.82}, ...]
    sorted descending by score. Returns None if the input is empty.
    """
    if not text or not text.strip():
        return None

    print("ANALYSE_EMOTION USING MODEL:", model_size)
    results = get_classifier(model_size)(text)
    return _sort_results(results)
