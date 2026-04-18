"""
EmotionArt — Flask application server.

Serves the single-page themed art pages, handles emotion analysis requests
via the HuggingFace transformer pipeline, and manages a local gallery of
saved artwork (PNG images + JSON metadata).

Key libraries:
  - Flask          — lightweight WSGI web framework (routing, templates, static files)
  - Flask-CORS     — enables Cross-Origin Resource Sharing for fetch() calls from the browser
  - transformers   — HuggingFace library used in emotion_classifier.py to run the
                     j-hartmann emotion classification models (DistilRoBERTa-base / RoBERTa-large)
"""

from flask import Flask, request, jsonify, render_template, redirect, url_for, send_from_directory, abort
from flask_cors import CORS
from emotion_classifier import (
    ModelLoadingError,
    analyse_emotion,
    ensure_classifier_loading,
    get_model_status,
)
from pathlib import Path
from datetime import datetime
import base64
import json
import re

# Create the Flask app.
# template_folder='pages'  — Jinja2 looks in ./pages/ for HTML templates.
# static_folder='assets'   — CSS, JS, and images are served from ./assets/.
# static_url_path='/assets' — browser-accessible URL prefix for static files.
app = Flask(__name__, template_folder='pages', static_folder='assets', static_url_path='/assets')

# Allow all origins so the front-end JS can POST to /analyse from any host.
CORS(app)

# Kick off background download of the smaller (base) emotion model at startup.
# This means the first user request doesn't have to wait for the download.
ensure_classifier_loading('base')

# Resolve the project root and ensure a gallery/ directory exists for saved artwork.
BASE_DIR = Path(__file__).resolve().parent
GALLERY_DIR = BASE_DIR / 'gallery'
GALLERY_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def slugify(value):
    """Convert a human-readable title to a filesystem-safe slug.

    e.g. 'My Flower Pots Art 3' → 'my-flower-pots-art-3'
    """
    slug = re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')
    return slug or 'artwork'


def page_display_name(page_name):
    """Map an internal page identifier (e.g. 'flower_pots') to its
    human-readable display name used in filenames and the UI.
    Falls back to replacing underscores with spaces and uppercasing.
    """
    mapping = {
        'flower_pots': 'FLOWER POTS',
        'anamorphic_resonance': 'ANAMORPHIC RESONANCE',
        'bubbles': 'BUBBLES',
        'purple_live': 'PURPLE LIVE',
        'flow_field': 'FLOW FIELD',
        'geometric_grid': 'GEOMETRIC GRID',
    }
    return mapping.get(page_name, page_name.replace('_', ' ').upper())


def render_filename_pattern(pattern, page_name, number):
    """Expand a user-defined filename pattern with placeholder tokens.

    Tokens:
      [PAGE_NAME] — replaced with the theme's display name
      [NUMBER]    — replaced with the next sequential artwork number
    """
    safe_pattern = (pattern or 'MY [PAGE_NAME] ART [NUMBER]').strip()
    safe_pattern = safe_pattern or 'MY [PAGE_NAME] ART [NUMBER]'
    return (
        safe_pattern
        .replace('[PAGE_NAME]', page_display_name(page_name))
        .replace('[NUMBER]', str(number))
    )


def next_art_number(page_name):
    """Scan existing gallery metadata to find the next sequential number
    for a given theme page. Each page has its own independent counter.
    """
    highest = 0
    for meta_path in GALLERY_DIR.glob('*.json'):
        try:
            payload = json.loads(meta_path.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, OSError):
            continue

        if payload.get('page_name') != page_name:
            continue

        highest = max(highest, int(payload.get('number', 0)))
    return highest + 1


def metadata_path(stem):
    """Return the Path for a gallery item's JSON metadata file."""
    return GALLERY_DIR / f'{stem}.json'


def image_path(stem):
    """Return the Path for a gallery item's PNG image file."""
    return GALLERY_DIR / f'{stem}.png'


def load_gallery_items():
    """Load every valid gallery item (metadata + corresponding PNG) and
    return them sorted newest-first by creation timestamp.
    """
    items = []
    for meta_file in GALLERY_DIR.glob('*.json'):
        try:
            payload = json.loads(meta_file.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, OSError):
            continue

        png_name = payload.get('file_name')
        if not png_name:
            continue

        png_path = GALLERY_DIR / png_name
        if not png_path.exists():
            continue

        items.append(payload)

    items.sort(key=lambda item: item.get('created_at', ''), reverse=True)
    return items


# ---------------------------------------------------------------------------
# Page routes — each art theme gets its own template
# ---------------------------------------------------------------------------

@app.route('/')
def home():
    """Theme picker — the landing page showing all available art themes."""
    return render_template('index.html')


@app.route('/gallery')
def gallery():
    """Display all saved artwork from every theme, newest first."""
    return render_template('gallery.html', gallery_items=load_gallery_items())


@app.route('/settings')
def settings():
    """User preferences: model selection, appearance, gallery management."""
    return render_template('settings.html')


@app.route('/favourites')
def favourites():
    """Filtered gallery showing only items the user has starred."""
    favorite_items = [item for item in load_gallery_items() if item.get('favorite')]
    return render_template('favourites.html', gallery_items=favorite_items)


@app.route('/gallery/view/<path:filename>')
def gallery_view(filename):
    """Full-screen viewer for a single gallery artwork.
    Loads the item's metadata (title, emotions, transcript) alongside the image.
    """
    # Reject path-traversal attempts
    if '/' in filename or '\\' in filename:
        abort(404)

    file_path = GALLERY_DIR / filename
    if not file_path.exists():
        abort(404)

    meta_file = metadata_path(Path(filename).stem)
    item = None
    if meta_file.exists():
        try:
            item = json.loads(meta_file.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, OSError):
            item = None

    return render_template('gallery_view.html', item=item, filename=filename)


@app.route('/gallery/file/<path:filename>')
def gallery_file(filename):
    """Serve a gallery image file directly (used by <img> tags)."""
    if '/' in filename or '\\' in filename:
        abort(404)
    return send_from_directory(GALLERY_DIR, filename)


@app.route('/gallery/download/<path:filename>')
def gallery_download(filename):
    """Trigger a browser download of a gallery image (Content-Disposition: attachment)."""
    if '/' in filename or '\\' in filename:
        abort(404)
    return send_from_directory(GALLERY_DIR, filename, as_attachment=True)


# --- Art theme pages ---
# Each route renders a Jinja2 template that loads the theme's CSS, JS sketch,
# and app controller. The HTML structure follows a consistent pattern:
#   sidebar | page-header | visual-stage (canvas) + overlay-panel (controls)

@app.route('/anamorphic-resonance')
def anamorphic_resonance():
    """WebGL fragment shader + 2D particle overlay driven by emotion scores."""
    return render_template('anamorphic_resonance.html')


@app.route('/waves')
def waves_redirect():
    """Legacy URL — redirects to the renamed Anamorphic Resonance theme."""
    return redirect(url_for('anamorphic_resonance'))


@app.route('/bubbles')
def bubbles():
    """Gray-Scott reaction-diffusion simulation rendered via WebGL2.
    Emotion scores control the feed/kill rates and colour palette.
    """
    return render_template('bubbles.html')


@app.route('/bubbles-original')
def bubbles_original():
    """Original (pre-refactor) bubbles page, kept for comparison.
    Supports ?embed=1 query param to strip the sidebar for iframe embedding.
    """
    return render_template('bubbles_original.html', embed_mode=request.args.get('embed') == '1')


@app.route('/purple-live')
def purple_live():
    return render_template('purple_live.html')


@app.route('/flower-pots')
def flower_pots():
    """Zen Pots — dot-art ceramic pots with emotion-driven plant accents.
    Uses p5.js with layered off-screen graphics (back / mid / front).
    """
    return render_template('flower_pots.html')


@app.route('/zen-pots')
def zen_pots_redirect():
    """Legacy URL — redirects to the renamed Flower Pots theme."""
    return redirect(url_for('flower_pots'))

@app.route('/flow-field')
def flow_field():
    """Perlin-noise flow field where particle colour, speed, and density
    are driven by live emotion scores. Uses p5.js.
    """
    return render_template('flow_field.html')


@app.route('/geometric-grid')
def geometric_grid():
    """Brazilian geometric grid — emotion scores control grid density,
    shape distribution, animation speed, recursion depth, and colour palette.
    Uses p5.js.
    """
    return render_template('geometric_grid.html')


# ---------------------------------------------------------------------------
# API: Emotion analysis
# ---------------------------------------------------------------------------

@app.route('/analyse', methods=['POST'])
def analyse():
    """Classify the emotional content of a text string.

    Request body (JSON):
      { "text": "...", "model": "base" | "large" }

    Response (JSON):
      { "text": "...", "emotions": [{ "label": "joy", "score": 0.82 }, ...], "model": "base" }

    The emotions array is sorted descending by score. All 7 Ekman emotions are
    always present: anger, disgust, fear, joy, neutral, sadness, surprise.
    """
    data = request.get_json(silent=True) or {}
    text = data.get('text', '')
    model_size = str(data.get('model', 'base')).strip().lower()

    print("ANALYSE REQUEST DATA:", data)
    print("MODEL SIZE RECEIVED:", model_size)

    if not text or not text.strip():
        return jsonify({'error': 'No text provided'}), 400

    if model_size not in ['base', 'large']:
        return jsonify({'error': 'Invalid model selection'}), 400

    try:
        emotions = analyse_emotion(text, model_size=model_size)
    except ModelLoadingError as exc:
        # Model is still downloading — tell the client to retry later
        status = get_model_status(model_size)
        return jsonify({
            'error': str(exc),
            'details': f"{model_size.title()} model status: {status['state']}.",
            'loading': True,
            'model': model_size,
        }), 503
    except Exception as exc:
        # Unexpected failure — attempt to restart the model loading
        ensure_classifier_loading(model_size)
        return jsonify({
            'error': 'Emotion model is unavailable. Please retry after the model download completes.',
            'details': str(exc),
        }), 503

    if emotions is None:
        return jsonify({'error': 'No text provided'}), 400

    return jsonify({
        'text': text,
        'emotions': emotions,
        'model': model_size
    })


# ---------------------------------------------------------------------------
# API: Model management (settings page)
# ---------------------------------------------------------------------------

@app.route('/api/settings/model-status')
def model_status():
    """Check the current state of a model: idle, loading, ready, or error.
    Used by the settings page to poll download progress.
    """
    model_size = str(request.args.get('model', 'base')).strip().lower()

    if model_size not in ['base', 'large']:
        return jsonify({'error': 'Invalid model selection'}), 400

    status = get_model_status(model_size)
    return jsonify({
        'model': model_size,
        'state': status['state'],
        'details': status['error'],
        'model_name': status['model_name'],
    })


@app.route('/api/settings/model-preload', methods=['POST'])
def model_preload():
    """Trigger background download of a model if it isn't already loaded.
    Called when the user selects 'large' in the settings dropdown.
    """
    data = request.get_json(silent=True) or {}
    model_size = str(data.get('model', 'base')).strip().lower()

    if model_size not in ['base', 'large']:
        return jsonify({'error': 'Invalid model selection'}), 400

    state = ensure_classifier_loading(model_size)
    status = get_model_status(model_size)
    return jsonify({
        'model': model_size,
        'state': status['state'] if status['state'] != 'idle' else state,
        'details': status['error'],
        'model_name': status['model_name'],
    })


# ---------------------------------------------------------------------------
# API: Gallery CRUD
# ---------------------------------------------------------------------------

@app.route('/api/gallery/save', methods=['POST'])
def save_gallery_item():
    """Save a new artwork to the gallery.

    The front-end sends a base64-encoded PNG data-URL captured from the
    theme's canvas, along with the transcript, emotion scores, and
    the user's filename pattern from settings.

    Creates two files in gallery/:
      - <slug>.png  — the artwork image
      - <slug>.json — metadata (title, page, number, timestamp, emotions, transcript)
    """
    data = request.get_json(silent=True) or {}
    image_data = data.get('image_data', '')
    page_name = data.get('page_name', '')
    transcript = data.get('transcript', '')
    emotions = data.get('emotions', [])
    filename_pattern = data.get('filename_pattern', '')

    if not image_data or not page_name:
        return jsonify({'error': 'Missing image data or page name'}), 400

    # Expect format: "data:image/png;base64,<encoded>"
    if ',' not in image_data:
        return jsonify({'error': 'Invalid image payload'}), 400

    _, encoded = image_data.split(',', 1)

    try:
        image_bytes = base64.b64decode(encoded)
    except (ValueError, base64.binascii.Error):
        return jsonify({'error': 'Unable to decode image'}), 400

    number = next_art_number(page_name)
    title = render_filename_pattern(filename_pattern, page_name, number)
    stem = slugify(title)
    png_file = image_path(stem)
    json_file = metadata_path(stem)
    created_at = datetime.utcnow().isoformat(timespec='seconds') + 'Z'

    png_file.write_bytes(image_bytes)
    metadata = {
        'title': title,
        'page_name': page_name,
        'number': number,
        'created_at': created_at,
        'file_name': png_file.name,
        'transcript': transcript,
        'emotions': emotions,
    }
    json_file.write_text(json.dumps(metadata, indent=2), encoding='utf-8')

    return jsonify({
        'message': 'Saved successfully',
        'item': metadata,
    })


@app.route('/api/gallery/rename', methods=['POST'])
def rename_gallery_item():
    """Rename a gallery item — updates the title, slug, and filenames.
    Handles collision by appending a numeric suffix.
    """
    data = request.get_json(silent=True) or {}
    filename = data.get('filename', '')
    new_title = (data.get('title') or '').strip()

    if not filename or not new_title or '/' in filename or '\\' in filename:
        return jsonify({'error': 'Invalid rename request'}), 400

    old_png = GALLERY_DIR / filename
    if not old_png.exists():
        return jsonify({'error': 'Image not found'}), 404

    old_stem = old_png.stem
    old_json = metadata_path(old_stem)
    if not old_json.exists():
        return jsonify({'error': 'Metadata not found'}), 404

    try:
        metadata = json.loads(old_json.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError):
        return jsonify({'error': 'Metadata is invalid'}), 500

    new_stem = slugify(new_title)
    new_png = image_path(new_stem)
    new_json = metadata_path(new_stem)

    # Avoid clobbering existing files with the same slug
    suffix = 2
    while (new_png.exists() or new_json.exists()) and new_png.name != old_png.name:
        new_stem = f"{slugify(new_title)}-{suffix}"
        new_png = image_path(new_stem)
        new_json = metadata_path(new_stem)
        suffix += 1

    old_png.rename(new_png)
    old_json.rename(new_json)

    metadata['title'] = new_title
    metadata['file_name'] = new_png.name
    new_json.write_text(json.dumps(metadata, indent=2), encoding='utf-8')

    return jsonify({'message': 'Renamed successfully', 'item': metadata})


@app.route('/api/gallery/favorite', methods=['POST'])
def favorite_gallery_item():
    """Toggle the 'favorite' flag on a gallery item's metadata."""
    data = request.get_json(silent=True) or {}
    filename = data.get('filename', '')
    favorite = bool(data.get('favorite'))

    if not filename or '/' in filename or '\\' in filename:
        return jsonify({'error': 'Invalid favorite request'}), 400

    json_file = metadata_path(Path(filename).stem)
    if not json_file.exists():
        return jsonify({'error': 'Metadata not found'}), 404

    try:
        metadata = json.loads(json_file.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError):
        return jsonify({'error': 'Metadata is invalid'}), 500

    metadata['favorite'] = favorite
    json_file.write_text(json.dumps(metadata, indent=2), encoding='utf-8')

    return jsonify({'message': 'Favorite updated', 'item': metadata})


@app.route('/api/settings/clear-gallery', methods=['POST'])
def clear_gallery():
    """Delete every file (images + metadata) in the gallery directory."""
    for path in GALLERY_DIR.glob('*'):
        if path.is_file():
            path.unlink()
    return jsonify({'message': 'Gallery cleared'})


@app.route('/api/settings/clear-metadata', methods=['POST'])
def clear_metadata():
    """Reset transcript, emotions, and favourite flag on every gallery item
    without deleting the images themselves.
    """
    for json_file in GALLERY_DIR.glob('*.json'):
        try:
            metadata = json.loads(json_file.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, OSError):
            continue

        metadata['transcript'] = ''
        metadata['emotions'] = []
        metadata['favorite'] = False
        json_file.write_text(json.dumps(metadata, indent=2), encoding='utf-8')

    return jsonify({'message': 'Metadata cleared'})


@app.route('/api/gallery/delete', methods=['POST'])
def delete_gallery_item():
    """Permanently delete a single gallery item (PNG + metadata JSON)."""
    data = request.get_json(silent=True) or {}
    filename = data.get('filename', '')

    if not filename or '/' in filename or '\\' in filename:
        return jsonify({'error': 'Invalid delete request'}), 400

    png_file = GALLERY_DIR / filename
    json_file = metadata_path(Path(filename).stem)

    if not png_file.exists():
        return jsonify({'error': 'Image not found'}), 404

    try:
        png_file.unlink()
        if json_file.exists():
            json_file.unlink()
    except OSError:
        return jsonify({'error': 'Unable to delete artwork'}), 500

    return jsonify({'message': 'Deleted successfully'})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    app.run(debug=True, port=5000)
