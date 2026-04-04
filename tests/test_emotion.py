from emotion_classifier import analyse_emotion

tests = [
    "I'm pissed off",
    "I am so angry",
    "I want to kill myself",
    "I am so happy",
]

for text in tests:
    print(f"\n>>> {text}")
    for r in analyse_emotion(text):
        bar = "█" * int(r["score"] * 30)
        print(f"  {r['label']:<10} {r['score']:.2f}  {bar}")
