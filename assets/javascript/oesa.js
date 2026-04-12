// ==========================
// OESA-INSPIRED GENERATIVE ART
// ==========================

// position + movement
let x, y;
let angle = 0;

// visual controls
let stepSize = 3;
let turnAngle = 0.2;
let speed = 10;
let opacity = 15;

// emotion state (for later use)
let currentEmotion = "neutral";

// ==========================
function setup() {
    createCanvas(600, 600);
    background(240);

    x = width / 2;
    y = height / 2;

    // future connection point (safe to leave here)
    window.applyEmotionFromBackend = function (emotions) {
        if (!emotions || emotions.length === 0) return;

        const top = emotions[0].label.toLowerCase();
        applyEmotion(top);
    };
}

// ==========================
function draw() {

    // fade trail effect
    fill(240, opacity);
    noStroke();
    rect(0, 0, width, height);

    for (let i = 0; i < speed; i++) {

        let newX = x + cos(angle) * stepSize;
        let newY = y + sin(angle) * stepSize;

        stroke(0);
        line(x, y, newX, newY);

        x = newX;
        y = newY;

        // rotation
        angle += turnAngle;

        // reset if out of bounds
        if (x < 0 || x > width || y < 0 || y > height) {
            resetSketch();
        }
    }
}

// ==========================
// RESET FUNCTION
// ==========================
function resetSketch() {
    background(240);
    x = width / 2;
    y = height / 2;
    angle = 0;
}

// ==========================
// EMOTION → VISUAL CONTROL
// ==========================
function applyEmotion(emotion) {

    currentEmotion = emotion;

    switch (emotion) {

        case "joy":
            stepSize = 4;
            turnAngle = 0.15;
            speed = 20;
            opacity = 5;
            break;

        case "sadness":
            stepSize = 2;
            turnAngle = 0.05;
            speed = 5;
            opacity = 25;
            break;

        case "anger":
            stepSize = 3;
            turnAngle = 0.8;
            speed = 30;
            opacity = 10;
            break;

        case "fear":
            stepSize = 2.5;
            turnAngle = random(-1, 1);
            speed = 15;
            opacity = 15;
            break;

        case "surprise":
            stepSize = random(2, 6);
            turnAngle = random(-PI, PI);
            speed = 25;
            opacity = 5;
            break;

        default:
            stepSize = 3;
            turnAngle = 0.2;
            speed = 10;
            opacity = 15;
    }

    resetSketch();
}