@app.route('/analyse', methods=['POST'])
def analyse():
    data = request.get_json()
    text = data.get('text', '')
    
    emotions = analyse_emotion(text)
    
    if emotions is None:
        return jsonify({'error': 'No text provided'}), 400
    
    return jsonify({
        'text': text,
        'emotions': emotions
    })