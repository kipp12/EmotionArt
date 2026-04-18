"""
Quick manual sanity check for the emotion classifier.

Runs a handful of short phrases through `emotion_classifier.analyse_emotion`
and prints a bar chart of the returned scores so the output is readable
at a glance. Not a pytest suite — just a throwaway smoke test.

Usage:
    python test_emotion.py

Each row prints: emotion label, score (0-1), and a Unicode block bar
scaled to the score (max 30 blocks = score of 1.0).
"""
from emotion_classifier import analyse_emotion

# --- Probe phrases covering the extremes of the emotion space:
#     anger (2 phrasings), sadness/self-harm, and joy.
tests = [
    "I'm pissed off",
    "I am so angry",
    "I want to kill myself",
    "I am so happy",
]

for text in tests:
    print(f"\n>>> {text}")
    for r in analyse_emotion(text):
        # 30-block bar — `score * 30` rounded down gives 0-30 filled blocks.
        bar = "█" * int(r["score"] * 30)
        print(f"  {r['label']:<10} {r['score']:.2f}  {bar}")
