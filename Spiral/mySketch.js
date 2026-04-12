 // ==============================
// VISUAL DNA SYSTEM
// ==============================

let visualDNA = {
    evenAngle: 0.24,
    oddAngle: -0.47,
    length: 2.0,
    velocity: 12,
    opacity: 25,
    palette: ["#ffffff"],
    colorVariation: 0.35,
    bgColor: "#000000"
};

// ==============================
// GLOBALS
// ==============================

let spirals = [];

// ==============================
// MOOD + KEYWORD ANALYSIS
// ==============================

function analyzeMood(text) {

    text = (text || "").toLowerCase();
    text = text.replace(/[^a-z\s]/g, " ");

    let score = {
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

    let words = text.split(/\s+/).filter(w => w.length > 0);

    for (let w of words) {

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
// ==============================

function buildPalette(m, rawText = "") {

    let palette = [];

    let push = (arr) => palette.push(...arr);

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

    if (palette.length === 0 && rawText.length > 0) {
        palette.push(hashToColor(rawText));
    }

    if (palette.length === 0) palette.push("#cfcfcf");

    return palette;
}

// ==============================
// 🌤️ BACKGROUND (BRIGHTENED)
// ==============================

function brighten(hex, amount) {
    let c = color(hex);
    return color(
        red(c) + amount,
        green(c) + amount,
        blue(c) + amount
    );
}

function buildBackground(m) {

    let base;

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
// ==============================

function buildDNA(m, rawText = "") {

    let intensity =
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

        // 🌌 NEW: store text for UI
        rawText: rawText
    };
}

// ==============================
// HASH → COLOR
// ==============================

function hashToColor(str) {

    str = str || "default";

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    let r = (hash >> 0) & 255;
    let g = (hash >> 8) & 255;
    let b = (hash >> 16) & 255;

    return `rgb(${r},${g},${b})`;
}

// ==============================
// SETUP
// ==============================

function setup() {
    createCanvas(windowWidth, windowHeight);
    generateSpirals();
}

// ==============================
// SPIRALS
// ==============================

function generateSpirals() {

    spirals = [];

    let count = int(random(8, 12));

    for (let i = 0; i < count; i++) {

        let n = int(random(80, 200));

        spirals.push({
            hailA: n,
            hailB: n,
            angleA: 0,
            angleB: 0,
            posX: random(width),
            posY: random(height),
            start: true,
            scale: random(1.5, 3),
            color: "#ffffff"
        });
    }
}

// ==============================
// DRAW
// ==============================

function draw() {

    let bgCol = visualDNA.bgColor || "#000000";

    fill(bgCol);
    noStroke();
    rect(0, 0, width, height);

    for (let s of spirals) {

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
                s.hailA = int(random(80, 200));
                s.hailB = s.hailA;
                s.start = true;
                continue;
            }

            stroke(lerpColor(color(s.color), color(255), 0.2));
            strokeWeight(1.2 * s.scale);

            line(s.posX, s.posY, s.posX + stepX, s.posY + stepY);

            s.posX += stepX;
            s.posY += stepY;
        }
    }

    // CENTER TEXT UPDATE (NEW FEATURE)
    let el = document.getElementById("centerText");
    if (el && visualDNA.rawText !== undefined) {
        el.innerText = visualDNA.rawText;
        el.style.color = random(visualDNA.palette);
        el.style.boxShadow = "0 0 20px rgba(255,255,255,0.1)";
    }
}

// ==============================
// RESIZE
// ==============================

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    generateSpirals();
}

// ==============================
//  INPUT
// ==============================

window.onload = function () {

    let btn = document.getElementById("generateBtn");

    if (btn) {
        btn.addEventListener("click", function () {

            let val = document.getElementById("textInput").value;

            let mood = analyzeMood(val);

            visualDNA = buildDNA(mood, val);

            generateSpirals();
        });
    }
};