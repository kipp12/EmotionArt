import sys
from transformers import pipeline

classifier = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    top_k=None
)

def analyse_emotion(text):
    if not text or not text.strip():
        return None
    
    results = classifier(text)
    
    if isinstance(results[0], dict):
        scores = results
    else:
        scores = results[0]
    
    return sorted(scores, key=lambda x: x['score'], reverse=True)

if __name__ == '__main__':
    text = ' '.join(sys.argv[1:])
    
    if not text:
        print("Usage: python test_model.py <your text here>")
        sys.exit(1)
    
    emotions = analyse_emotion(text)
    
    print(f"\nText: '{text}'\n")
    for e in emotions:
        bar = '█' * int(e['score'] * 20)
        print(f"  {e['label']:<10} {e['score']:.3f}  {bar}")