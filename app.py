from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_cors import CORS
from emotion_classifier import analyse_emotion

app = Flask(__name__, template_folder='pages', static_folder='assets', static_url_path='/assets')
CORS(app)


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/bubbles')
def bubbles():
    return render_template('bubbles.html')


@app.route('/purple-live')
def purple_live():
    return render_template('purple_live.html')
  
  
@app.route('/flower-pots')
def flower_pots():
    return render_template('flower_pots.html')


@app.route('/zen-pots')
def zen_pots_redirect():
    return redirect(url_for('flower_pots'))


@app.route('/analyse', methods=['POST'])
def analyse():
    data = request.get_json(silent=True) or {}
    text = data.get('text', '')

    try:
        emotions = analyse_emotion(text)
    except Exception as exc:
        return jsonify({
            'error': 'Emotion model is unavailable. Please retry after the model download completes.',
            'details': str(exc),
        }), 503

    if emotions is None:
        return jsonify({'error': 'No text provided'}), 400

    return jsonify({
        'text': text,
        'emotions': emotions
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
