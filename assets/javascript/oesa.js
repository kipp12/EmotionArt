/**
 * OESA-inspired generative art — a simple turtle-graphics sketch.
 *
 * A p5.js sketch that walks a single "turtle" around the canvas,
 * turning by `turnAngle` and stepping by `stepSize` each iteration.
 * The trail is preserved by painting a semi-transparent rectangle
 * each frame rather than fully clearing the background, so old
 * strokes slowly fade to the background colour.
 *
 * The interesting maths here is the polar step:
 *   x' = x + cos(angle) * stepSize
 *   y' = y + sin(angle) * stepSize
 *   angle += turnAngle
 * A constant `turnAngle` traces a circle; a random `turnAngle` gives
 * Brownian-looking scribbles; very small angles produce lissajous-like
 * curves. Each emotion tunes these four knobs.
 *
 * p5.js globals used: `createCanvas`, `background`, `cos`, `sin`,
 * `stroke`, `line`, `fill`, `rect`, `noStroke`, `random`, `PI`.
 */

// --- Turtle position and heading.
let x, y;
let angle = 0;

// --- Visual controls (mutated by `applyEmotion`).
let stepSize = 3;    // pixels per step
let turnAngle = 0.2; // radians to rotate per step
let speed = 10;      // steps per frame — bigger = faster trail growth
let opacity = 15;    // alpha of the fade rectangle — bigger = faster trail decay

// --- Current emotion (stored for reference; behaviour lives in the switch).
let currentEmotion = "neutral";

/**
 * p5.js lifecycle — runs once on page load.
 * Sets up the canvas and exposes the emotion hook for the backend.
 */
function setup() {
    createCanvas(600, 600);
    background(240);

    x = width / 2;
    y = height / 2;

    // Entry point for the analyse() callback — other pages call this
    // to forward the top-scoring emotion label into the sketch.
    window.applyEmotionFromBackend = function (emotions) {
        if (!emotions || emotions.length === 0) return;

        const top = emotions[0].label.toLowerCase();
        applyEmotion(top);
    };
}

/**
 * p5.js lifecycle — runs every frame.
 * Each frame:
 *   1. Paint a translucent rectangle to fade old strokes.
 *   2. Take `speed` turtle steps, drawing a line segment each.
 *   3. Reset when the turtle walks off the canvas.
 */
function draw() {

    // Trail fade — a semi-transparent fill over the whole canvas
    // blends the previous frame towards the background colour.
    fill(240, opacity);
    noStroke();
    rect(0, 0, width, height);

    for (let i = 0; i < speed; i++) {

        const newX = x + cos(angle) * stepSize;
        const newY = y + sin(angle) * stepSize;

        stroke(0);
        line(x, y, newX, newY);

        x = newX;
        y = newY;

        // Advance the heading by turnAngle (may be random per-step for fear/surprise).
        angle += turnAngle;

        // Keep the turtle on-canvas — if it escapes, recentre and clear.
        if (x < 0 || x > width || y < 0 || y > height) {
            resetSketch();
        }
    }
}

/**
 * Re-centre the turtle and clear the canvas.
 * Called when the turtle walks off-screen or an emotion is reapplied,
 * so each emotion starts with a clean slate.
 */
function resetSketch() {
    background(240);
    x = width / 2;
    y = height / 2;
    angle = 0;
}

/**
 * Map an emotion label to a set of turtle parameters.
 *
 * Design per emotion:
 *   joy     — fast, gentle curves, low trail persistence (airy feel)
 *   sadness — slow, barely-turning, dense trail (heavy, lingering)
 *   anger   — tight sharp turns, high speed (chaotic scribble)
 *   fear    — random turn each step (erratic, can't settle)
 *   surprise— fully random step AND angle (explosive)
 *   default — balanced, calm turtle walk
 */
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
            turnAngle = random(-1, 1);  // new random turn each apply
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
