from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from emotion_classifier import analyse_emotion

app = Flask(__name__)
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
  
  
@app.route('/zen-pots')
def zen_pots():
    return render_template('zen_pots.html')


@app.route('/analyse', methods=['POST'])
def analyse():
    data = request.get_json(silent=True) or {}
    text = data.get('text', '')
    emotions = analyse_emotion(text)

    if emotions is None:
        return jsonify({'error': 'No text provided'}), 400

    return jsonify({
        'text': text,
        'emotions': emotions
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
