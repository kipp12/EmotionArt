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

app = Flask(__name__, template_folder='pages', static_folder='assets', static_url_path='/assets')
CORS(app)

# Warm the fast model in the background during app startup so first use feels immediate.
ensure_classifier_loading('base')

BASE_DIR = Path(__file__).resolve().parent
GALLERY_DIR = BASE_DIR / 'gallery'
GALLERY_DIR.mkdir(exist_ok=True)


def slugify(value):
    slug = re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')
    return slug or 'artwork'


def page_display_name(page_name):
    mapping = {
        'flower_pots': 'FLOWER POTS',
        'anamorphic_resonance': 'ANAMORPHIC RESONANCE',
        'bubbles': 'BUBBLES',
        'purple_live': 'PURPLE LIVE',
        'geometric_grid': 'GEOMETRIC GRID',
    }
    return mapping.get(page_name, page_name.replace('_', ' ').upper())


def render_filename_pattern(pattern, page_name, number):
    safe_pattern = (pattern or 'MY [PAGE_NAME] ART [NUMBER]').strip()
    safe_pattern = safe_pattern or 'MY [PAGE_NAME] ART [NUMBER]'
    return (
        safe_pattern
        .replace('[PAGE_NAME]', page_display_name(page_name))
        .replace('[NUMBER]', str(number))
    )


def next_art_number(page_name):
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
    return GALLERY_DIR / f'{stem}.json'


def image_path(stem):
    return GALLERY_DIR / f'{stem}.png'


def load_gallery_items():
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


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/gallery')
def gallery():
    return render_template('gallery.html', gallery_items=load_gallery_items())


@app.route('/settings')
def settings():
    return render_template('settings.html')


@app.route('/favourites')
def favourites():
    favorite_items = [item for item in load_gallery_items() if item.get('favorite')]
    return render_template('favourites.html', gallery_items=favorite_items)


@app.route('/gallery/view/<path:filename>')
def gallery_view(filename):
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
    if '/' in filename or '\\' in filename:
        abort(404)
    return send_from_directory(GALLERY_DIR, filename)


@app.route('/gallery/download/<path:filename>')
def gallery_download(filename):
    if '/' in filename or '\\' in filename:
        abort(404)
    return send_from_directory(GALLERY_DIR, filename, as_attachment=True)


@app.route('/anamorphic-resonance')
def anamorphic_resonance():
    return render_template('anamorphic_resonance.html')


@app.route('/waves')
def waves_redirect():
    return redirect(url_for('anamorphic_resonance'))


@app.route('/bubbles')
def bubbles():
    return render_template('bubbles.html')


@app.route('/bubbles-original')
def bubbles_original():
    return render_template('bubbles_original.html', embed_mode=request.args.get('embed') == '1')


@app.route('/purple-live')
def purple_live():
    return render_template('purple_live.html')
  
  
@app.route('/flower-pots')
def flower_pots():
    return render_template('flower_pots.html')


@app.route('/zen-pots')
def zen_pots_redirect():
    return redirect(url_for('flower_pots'))


@app.route('/geometric-grid')
def geometric_grid():
    return render_template('geometric_grid.html')


@app.route('/analyse', methods=['POST'])
def analyse():
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
        status = get_model_status(model_size)
        return jsonify({
            'error': str(exc),
            'details': f"{model_size.title()} model status: {status['state']}.",
            'loading': True,
            'model': model_size,
        }), 503
    except Exception as exc:
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


@app.route('/api/settings/model-status')
def model_status():
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


@app.route('/api/gallery/save', methods=['POST'])
def save_gallery_item():
    data = request.get_json(silent=True) or {}
    image_data = data.get('image_data', '')
    page_name = data.get('page_name', '')
    transcript = data.get('transcript', '')
    emotions = data.get('emotions', [])
    filename_pattern = data.get('filename_pattern', '')

    if not image_data or not page_name:
        return jsonify({'error': 'Missing image data or page name'}), 400

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
    for path in GALLERY_DIR.glob('*'):
        if path.is_file():
            path.unlink()
    return jsonify({'message': 'Gallery cleared'})


@app.route('/api/settings/clear-metadata', methods=['POST'])
def clear_metadata():
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


if __name__ == '__main__':
    app.run(debug=True, port=5000)
