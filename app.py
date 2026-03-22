from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/analyse', methods=['POST'])
def analyse():
    data = request.get_json()
    text = data.get('text', '')
    
    # emotion model will go here
    
    return jsonify({
        'text': text,
        'emotions': []
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)