/**
 * Spiral — p5.js generative art driven by a keyword-based mood analyser.
 *
 * This sketch is self-contained (not wired to the /analyse backend).
 * It analyses the user's typed text for mood keywords, builds a
 * "visualDNA" object describing the scene (colour palette, spiral
 * geometry, background), then endlessly animates spirals whose
 * trajectories follow a Collatz-style rule:
 *   even → n/2    (rotate by +evenAngle)
 *   odd  → 3n+1   (rotate by +oddAngle)
 * This produces the characteristic branching/looping shapes.
 *
 * Libraries used:
 *   - p5.js globals: `createCanvas`, `color`, `red/green/blue`,
 *     `lerpColor`, `cos`, `sin`, `random`, `windowWidth/Height`.
 *   - Plain DOM: `document.getElementById` for the text input,
 *     Generate button, and centre-text overlay.
 */

// ==============================
// VISUAL DNA — initial defaults.
// Mutated by buildDNA() when the user generates a new scene.
// ==============================
let visualDNA = {
    evenAngle: 0.24,       // rotation delta when the Collatz step is "even"
    oddAngle: -0.47,       // rotation delta when the Collatz step is "odd"
    length: 2.0,           // step length multiplier (bigger = longer segments)
    velocity: 12,          // Collatz iterations per spiral per frame
    opacity: 25,           // (unused right now) reserved for trail fade
    palette: ["#ffffff"],  // colours to pick from when drawing strokes
    colorVariation: 0.35,
    bgColor: "#000000"
};

// ==============================
// GLOBALS
// ==============================

let spirals = [];  // active spiral agents — each has its own Collatz state

// ==============================
// MOOD + KEYWORD ANALYSIS
// Simple keyword counter — maps each category to a count of matching
// words in the input. Not a real NLP pipeline; it's fast and enough
// for a demo. Words are lowercased and stripped of punctuation.
// ==============================

function analyzeMood(text) {

    text = (text || "").toLowerCase();
    text = text.replace(/[^a-z\s]/g, " ");

    const score = {
        calm: 0,
        chaos: 0,
        sad: 0,
        happy: 0,
        fear: 0,
        greed: 0,
        nature: 0,
        love: 0,
        anger: 0,
        hope: 0,
        dream: 0,
        void: 0
    };

    const words = text.split(/\s+/).filter(w => w.length > 0);

    // For each word, bump every matching category. A word can only
    // fall in one category here — no weighting.
    for (const w of words) {

        if (["calm", "peace", "still", "soft", "quiet"].includes(w)) score.calm++;
        if (["anger", "rage", "fire", "storm", "fury"].includes(w)) score.chaos++;
        if (["sad", "lonely", "empty", "lost", "cry"].includes(w)) score.sad++;
        if (["happy", "joy", "bright", "smile", "laugh"].includes(w)) score.happy++;
        if (["love", "heart", "romance", "kiss"].includes(w)) score.love++;
        if (["fear", "scared", "dark", "unknown", "terror"].includes(w)) score.fear++;
        if (["greed", "money", "gold", "rich", "power"].includes(w)) score.greed++;
        if (["tree", "forest", "river", "wind", "earth", "nature"].includes(w)) score.nature++;

        if (["hope", "light", "future", "rise"].includes(w)) score.hope++;
        if (["dream", "sleep", "vision", "imagine"].includes(w)) score.dream++;
        if (["void", "nothing", "silence", "black"].includes(w)) score.void++;
    }

    return score;
}

// ==============================
// PALETTE
// Concatenate the colour families of every non-zero mood category.
// Multiple moods → richer palette. Falls back to a hash-of-text colour
// or a neutral grey if nothing matched.
// ==============================

function buildPalette(m, rawText = "") {

    const palette = [];
    const push = arr => palette.push(...arr);

    if (m.love > 0) push(["#ff4d6d", "#ff8fa3", "#ffc2d1"]);
    if (m.calm > 0) push(["#7bdff2", "#b2f7ef", "#eff7f6"]);
    if (m.chaos > 0) push(["#ff2e2e", "#8b0000", "#ff6b6b"]);
    if (m.sad > 0) push(["#1b2a41", "#324a5f", "#4f6d7a"]);
    if (m.happy > 0) push(["#ffbe0b", "#fb5607", "#ff006e"]);
    if (m.fear > 0) push(["#3c096c", "#10002b", "#240046"]);
    if (m.greed > 0) push(["#556b2f", "#6b8e23", "#3d4f1b"]);
    if (m.nature > 0) push(["#2a9d8f", "#264653", "#8ecae6"]);

    if (m.hope > 0) push(["#b8f2e6", "#a0c4ff", "#d0f4de"]);
    if (m.dream > 0) push(["#cdb4db", "#ffc8dd", "#bde0fe"]);
    if (m.void > 0) push(["#0b0c10", "#1f2833", "#3a3f4b"]);

    // Fallbacks: if no categories matched, generate a colour from the
    // text itself so empty/unknown input still has *some* colour.
    if (palette.length === 0 && rawText.length > 0) {
        palette.push(hashToColor(rawText));
    }

    if (palette.length === 0) palette.push("#cfcfcf");

    return palette;
}

// ==============================
// BACKGROUND
// Pick a dark base hue tinted by the dominant mood, then lighten it
// by +25 on each RGB channel so strokes remain readable.
// ==============================

function brighten(hex, amount) {
    const c = color(hex);
    return color(
        red(c) + amount,
        green(c) + amount,
        blue(c) + amount
    );
}

function buildBackground(m) {

    let base;

    // First-match wins — priority order: love, chaos, sad, fear, happy…
    if (m.love > 0) base = "#2a0f18";
    else if (m.chaos > 0) base = "#1a0505";
    else if (m.sad > 0) base = "#0f1c2a";
    else if (m.fear > 0) base = "#120a2a";
    else if (m.happy > 0) base = "#2a1f0a";
    else if (m.greed > 0) base = "#1a2410";
    else if (m.nature > 0) base = "#0f2a1e";
    else if (m.calm > 0) base = "#0f1f2a";
    else if (m.void > 0) base = "#101014";
    else base = "#101010";

    return brighten(base, 25);
}

// ==============================
// DNA
// Combine mood counts into the parameter bundle that drives the sketch.
// `intensity` = total keyword matches → grows velocity/length with
// richer descriptions. Chaos steepens the even-step angle, fear
// steepens the odd-step angle.
// ==============================

function buildDNA(m, rawText = "") {

    const intensity =
        m.calm + m.chaos + m.sad + m.happy + m.fear +
        m.greed + m.nature + m.love + m.hope + m.dream + m.void;

    return {
        evenAngle: 0.24 + (m.chaos * 0.05),
        oddAngle: -0.47 - (m.fear * 0.04),

        length: 2.0 + intensity * 0.08,
        velocity: floor(10 + intensity * 1.2),

        palette: buildPalette(m, rawText),
        colorVariation: 0.4,

        bgColor: buildBackground(m),

        // Stored so the centre-text overlay can show the user's input.
        rawText: rawText
    };
}

// ==============================
// HASH → COLOR
// Tiny DJBX33A-style string hash; returns the low 24 bits split into
// R/G/B for a deterministic colour from an arbitrary string.
// ==============================

function hashToColor(str) {

    str = str || "default";

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const r = (hash >> 0) & 255;
    const g = (hash >> 8) & 255;
    const b = (hash >> 16) & 255;

    return `rgb(${r},${g},${b})`;
}

// ==============================
// SETUP — p5.js lifecycle. Full-window canvas, spawn initial spirals.
// ==============================

function setup() {
    createCanvas(windowWidth, windowHeight);
    generateSpirals();
}

// ==============================
// SPIRALS
// Spawn 8-12 spiral agents at random positions. Each starts with a
// random Collatz seed `n` (80-200) that drives how many iterations
// it runs before resetting.
// ==============================

function generateSpirals() {

    spirals = [];

    const count = int(random(8, 12));

    for (let i = 0; i < count; i++) {

        const n = int(random(80, 200));

        spirals.push({
            hailA: n,            // Collatz state for the forward arm
            hailB: n,            // Collatz state for the backward arm
            angleA: 0,           // current heading of forward arm
            angleB: 0,           // current heading of backward arm
            posX: random(width),
            posY: random(height),
            start: true,         // flag to (re)initialise on next draw
            scale: random(1.5, 3),
            color: "#ffffff"
        });
    }
}

// ==============================
// DRAW — p5.js lifecycle, runs every frame.
// For each spiral:
//   1. If `start`, pick a new seed, position, and palette colour.
//   2. Run `velocity` Collatz-hailstone iterations:
//        even → n/=2  (rotate by +evenAngle)
//        odd  → n=3n+1 (rotate by +oddAngle)
//      Each iteration draws one line segment along `(cos, sin) * length`.
//   3. The "B" arm mirrors behind once the "A" arm reaches n=1, so
//      each spiral draws two interlocking trails.
//   4. When both arms finish (n<=1 on both), flag `start=true` to
//      respawn on the next frame.
// ==============================

function draw() {

    const bgCol = visualDNA.bgColor || "#000000";

    // Full-opacity background each frame → no trail persistence; every
    // frame shows the spirals' "current" state. (Trail fade would use
    // a semi-transparent rect — not done here because the Collatz
    // trajectory is the whole image, not a moving agent.)
    fill(bgCol);
    noStroke();
    rect(0, 0, width, height);

    for (const s of spirals) {

        for (let i = 0; i < visualDNA.velocity; i++) {

            if (s.start) {

                s.hailA = int(random(80, 200));
                s.hailB = s.hailA;

                s.angleA = 0;
                s.angleB = 0;

                s.posX = random(width);
                s.posY = random(height);

                s.start = false;
                s.color = random(visualDNA.palette);
            }

            let stepX = 0;
            let stepY = 0;

            if (s.hailA > 1) {
                // Collatz step on arm A — shrink or grow, rotate accordingly.
                if (s.hailA % 2 === 0) {
                    s.hailA *= 0.5;
                    s.angleA += visualDNA.evenAngle;
                } else {
                    s.hailA = 3 * s.hailA + 1;
                    s.angleA += visualDNA.oddAngle;
                }

                stepX = cos(s.angleA) * visualDNA.length * s.scale;
                stepY = sin(s.angleA) * visualDNA.length * s.scale;
            }

            else if (s.hailB > 1) {
                // A is done — now run arm B in the opposite direction
                // (angle subtracted, step negated) to draw the mirror.
                if (s.hailB % 2 === 0) {
                    s.hailB *= 0.5;
                    s.angleB -= visualDNA.evenAngle;
                } else {
                    s.hailB = 3 * s.hailB + 1;
                    s.angleB -= visualDNA.oddAngle;
                }

                stepX = -cos(s.angleB) * visualDNA.length * s.scale;
                stepY = -sin(s.angleB) * visualDNA.length * s.scale;
            }

            else {
                // Both arms finished — respawn this spiral on the next loop.
                s.hailA = int(random(80, 200));
                s.hailB = s.hailA;
                s.start = true;
                continue;
            }

            // Blend stroke colour 20% toward white for a soft glow.
            stroke(lerpColor(color(s.color), color(255), 0.2));
            strokeWeight(1.2 * s.scale);

            line(s.posX, s.posY, s.posX + stepX, s.posY + stepY);

            s.posX += stepX;
            s.posY += stepY;
        }
    }

    // Overlay: update the centre text element with the user's input.
    // Colour pulled from the palette every frame so it shifts with the mood.
    const el = document.getElementById("centerText");
    if (el && visualDNA.rawText !== undefined) {
        el.innerText = visualDNA.rawText;
        el.style.color = random(visualDNA.palette);
        el.style.boxShadow = "0 0 20px rgba(255,255,255,0.1)";
    }
}

// ==============================
// RESIZE — p5.js lifecycle, re-fits the canvas and respawns spirals
// so positions stay valid.
// ==============================

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    generateSpirals();
}

// ==============================
// INPUT — wire the Generate button to rebuild visualDNA from the
// textbox contents. Runs once on page load.
// ==============================

window.onload = function () {

    const btn = document.getElementById("generateBtn");

    if (btn) {
        btn.addEventListener("click", function () {

            const val = document.getElementById("textInput").value;

            const mood = analyzeMood(val);

            visualDNA = buildDNA(mood, val);

            generateSpirals();
        });
    }
};
