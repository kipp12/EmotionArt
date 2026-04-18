/**
 * Flow Field — EmotionArt theme (all-in-one sketch + controller).
 *
 * A Perlin-noise flow field where thousands of particles drift through
 * a smoothly changing vector field. Emotion scores drive every visual
 * property — particle colour, count, speed, jitter, background, drift.
 *
 * This file is self-contained (unlike the other themes which split the
 * p5 sketch and the app controller into two files). p5.js globals such as
 * setup(), draw(), windowResized(), noise(), createVector(), etc. are all
 * referenced directly.
 *
 * Key techniques:
 *   - Perlin noise (p5's noise() function) — smooth 3D noise, sampled at
 *     (x/scale, y/scale, frame/scale) to get a continuously rotating angle
 *     field. Each particle reads its local angle and moves in that direction.
 *   - Weighted colour blending — all 7 emotion colours are mixed by their
 *     scores to get a single particle colour, plus per-particle hue jitter.
 *   - Smooth emotion interpolation — targets are approached at 3% per frame
 *     so the scene doesn't snap between states.
 *   - Trail fade — drawing a semi-transparent background each frame leaves
 *     long particle trails instead of clearing the canvas completely.
 *
 * Library: p5.js — createCanvas, noise, createVector, p5.Vector.random2D,
 *   fill, rect, ellipse, random, TWO_PI, cos/sin, etc.
 */

// ---------------------------------------------------------------------------
// Emotion state
// ---------------------------------------------------------------------------

// RGB anchor colours for each emotion. Particles take a weighted blend of these
// based on the current emotion scores, plus per-particle hue jitter.
const EMOTION_COLOURS = {
    anger:    [255,  80,  40],  // Fiery red-orange
    fear:     [200, 130, 255],  // Lavender purple
    sadness:  [100, 150, 255],  // Cold blue
    joy:      [255, 220,  80],  // Warm gold
    disgust:  [140, 200,  90],  // Sickly green
    surprise: [255, 255, 200],  // Pale yellow-white
    neutral:  [190, 190, 200],  // Cool grey
};

// Default emotion map (neutral dominates).
const DEFAULT_EMOTIONS = {
    anger: 0, disgust: 0, fear: 0,
    joy: 0, neutral: 1, sadness: 0, surprise: 0,
};

// Current (smoothed) and target emotion maps — interpolated in draw().
let currentEmotions = { ...DEFAULT_EMOTIONS };
let targetEmotions  = { ...DEFAULT_EMOTIONS };

// ---------------------------------------------------------------------------
// Particle + scene state
// ---------------------------------------------------------------------------

let particles = [];       // Array of Particle instances
let settings  = {};       // Current scene settings (noiseScale, speed, etc.)
let numParticles = 1800;  // Target particle count (recomputed from emotions)

// ---------------------------------------------------------------------------
// p5 lifecycle
// ---------------------------------------------------------------------------

let p5Ready = false;  // Flag set once createCanvas has been called

/**
 * p5 setup — called once when the sketch loads.
 * Creates the canvas at the holder's size and kicks off the initial scene.
 */
function setup() {
    const holder = document.getElementById('p5-holder');
    const w = holder.clientWidth  || window.innerWidth;
    const h = holder.clientHeight || window.innerHeight;
    const canvas = createCanvas(w, h);
    canvas.parent('p5-holder');
    noStroke();
    p5Ready = true;
    applyEmotions(currentEmotions);  // safe to call now
}

/** p5 windowResized — resize the canvas and restart particles. */
function windowResized() {
    const holder = document.getElementById('p5-holder');
    resizeCanvas(holder.clientWidth, holder.clientHeight);
    background(settings.bg[0], settings.bg[1], settings.bg[2]);
    initParticles();
}

/**
 * p5 draw — called every frame (~60fps).
 *
 *   1. Interpolate current emotions toward target (3% per frame)
 *   2. If any emotion moved meaningfully, refresh scene settings
 *   3. Draw a semi-transparent background (creates the trail fade effect)
 *   4. Update and draw every particle
 */
function draw() {
    if (!p5Ready || !settings.bg) return;

    // Smooth interpolation toward targets
    let changed = false;
    Object.keys(targetEmotions).forEach(k => {
        const prev = currentEmotions[k];
        currentEmotions[k] += (targetEmotions[k] - currentEmotions[k]) * 0.03;
        if (Math.abs(currentEmotions[k] - prev) > 0.001) changed = true;
    });
    if (changed) refreshSettings(currentEmotions);

    // Semi-transparent background — creates motion trails
    fill(settings.bg[0], settings.bg[1], settings.bg[2], settings.trailAlpha);
    rect(0, 0, width, height);

    // Update and render every particle
    for (let p of particles) {
        p.run();
    }
}

/** Local map() replacement (used instead of p5's map() where scalar math is clearer). */
function fmap(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

/** Local clamp utility. */
function fclamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
}

// ---------------------------------------------------------------------------
// Emotion → scene settings
// ---------------------------------------------------------------------------

/**
 * Apply a new emotion map to the scene.
 * Called by analyseText() after the classifier returns.
 *
 * @param {Object} e — {anger: 0.1, joy: 0.8, ...} (all 7 emotions)
 */
function applyEmotions(e) {
    targetEmotions = { ...DEFAULT_EMOTIONS, ...e };
    currentEmotions = { ...targetEmotions };  // Snap immediately (then smooth in draw)
    if (!p5Ready) return;
    refreshSettings(e);
    initParticles();
}

/**
 * Recompute every scene parameter from the current emotion scores.
 *
 * Each parameter is mapped from a combination of emotions to a meaningful
 * visual property:
 *   noiseScale    — smaller = more chaotic; larger = smoother
 *   noiseStrength — how strongly the noise rotates particle velocity
 *   speedMin/Max  — particle velocity range (anger+fear = fast)
 *   trailAlpha    — how quickly old frames fade (sadness = slow fade)
 *   particleSize  — dot radius (neutral+sadness = larger, calmer)
 *   jitter        — random velocity noise (fear+anger = jittery)
 *   clusterBias   — chance to spawn in a central cluster (disgust+fear)
 */
function refreshSettings(e) {
    // Total emotional intensity drives overall particle count
    const intensity = e.anger + e.fear + e.joy + e.surprise + e.sadness + e.disgust;
    numParticles = Math.floor(fclamp(fmap(intensity, 0.2, 1.0, 900, 2600), 900, 2600));

    settings = {
        noiseScale:    fclamp(fmap(e.neutral, 0, 1, 60, 180), 60, 180),
        noiseStrength: fclamp(fmap(e.fear + e.surprise, 0, 1, 0.8, 2.4), 0.8, 2.4),
        speedMin:      fclamp(fmap(e.sadness + e.neutral, 0, 1, 0.4, 1.8), 0.4, 1.8),
        speedMax:      fclamp(fmap(e.anger + e.fear, 0, 1, 1.5, 6.5), 1.5, 6.5),
        drift:         fclamp(fmap(e.joy + e.neutral, 0, 1, 0.8, 1.5), 0.8, 1.5),
        trailAlpha:    fclamp(fmap(e.sadness, 0, 1, 20, 6), 6, 20),
        particleSize:  fclamp(fmap(e.neutral + e.sadness, 0, 1, 1.5, 3.5), 1.5, 3.5),
        jitter:        fclamp(fmap(e.fear + e.anger, 0, 1, 0.1, 1.8), 0.1, 1.8),
        clusterBias:   fclamp(fmap(e.disgust + e.fear, 0, 1, 0.0, 0.35), 0.0, 0.35),
        bg:            chooseBackground(e),
    };
}

/**
 * Pick a background colour based on the dominant emotion.
 * Each emotion has a tinted near-black that reinforces its mood.
 */
function chooseBackground(e) {
    if (e.anger   > 0.5) return [20,  5,  0];   // Warm reddish black
    if (e.fear    > 0.5) return [ 5,  0, 10];   // Cold purple black
    if (e.sadness > 0.5) return [ 8, 12, 25];   // Deep blue black
    if (e.joy     > 0.5) return [20, 15,  5];   // Warm amber black
    if (e.disgust > 0.3) return [14, 16,  8];   // Olive black
    return [10, 10, 12];                         // Neutral dark grey
}

/**
 * Compute a particle colour from the emotion scores.
 * Weighted average of EMOTION_COLOURS by the emotion scores,
 * plus ±15 per-channel jitter so particles aren't uniformly coloured.
 */
function pickParticleColour(e) {
    let r = 0, g = 0, b = 0, total = 0;
    Object.entries(EMOTION_COLOURS).forEach(([emotion, col]) => {
        const w = e[emotion] || 0;
        r += col[0] * w;
        g += col[1] * w;
        b += col[2] * w;
        total += w;
    });
    if (total < 0.001) return EMOTION_COLOURS.neutral;
    // Add per-particle hue variation: ±15 on each channel
    const jitter = () => Math.floor((Math.random() - 0.5) * 30);
    return [
        Math.min(255, Math.max(0, Math.round(r / total) + jitter())),
        Math.min(255, Math.max(0, Math.round(g / total) + jitter())),
        Math.min(255, Math.max(0, Math.round(b / total) + jitter())),
    ];
}

// ---------------------------------------------------------------------------
// Particle initialisation
// ---------------------------------------------------------------------------

/**
 * Spawn a fresh batch of particles.
 * Each particle gets a random position, direction, speed, and colour.
 * clusterBias determines what fraction spawn near the centre vs. edges.
 */
function initParticles() {
    if (!settings.bg) return;
    particles = [];
    background(settings.bg[0], settings.bg[1], settings.bg[2]);

    for (let i = 0; i < numParticles; i++) {
        let x = random(width);
        let y = random(height);

        // Some particles spawn in the central 30-70% region (clustered)
        if (random() < settings.clusterBias) {
            x = random(width  * 0.3, width  * 0.7);
            y = random(height * 0.3, height * 0.7);
        }

        const loc   = createVector(x, y);
        const dir   = p5.Vector.random2D();  // Random unit vector
        const speed = random(settings.speedMin, settings.speedMax);
        const col   = pickParticleColour(currentEmotions);

        particles.push(new Particle(loc, dir, speed, col));
    }
}

// ---------------------------------------------------------------------------
// Particle class
// ---------------------------------------------------------------------------

/**
 * A single particle in the flow field.
 *
 * Each frame:
 *   1. Sample Perlin noise at its current position to get a rotation angle
 *   2. Set its direction to that angle (plus a tiny random jitter)
 *   3. Move in that direction at its speed
 *   4. Respawn at a random location if it leaves the canvas
 *   5. Draw itself as a small semi-transparent dot
 */
class Particle {
    constructor(loc, dir, speed, col) {
        this.loc   = loc;    // p5.Vector position
        this.dir   = dir;    // p5.Vector direction (unit vector)
        this.speed = speed;
        this.col   = col;
    }

    run() {
        this.move();
        this.checkEdges();
        this.draw();
    }

    move() {
        // Sample 3D Perlin noise: (x, y, time). noise() returns 0-1.
        // Multiply by TWO_PI to get a rotation angle, then by noiseStrength
        // to amplify how strongly the field rotates.
        const angle = noise(
            this.loc.x / settings.noiseScale,
            this.loc.y / settings.noiseScale,
            frameCount  / settings.noiseScale
        ) * TWO_PI * settings.noiseStrength;

        // Direction = cos/sin of the angle, plus a tiny random nudge
        this.dir.x = cos(angle) + random(-settings.jitter, settings.jitter) * 0.05;
        this.dir.y = sin(angle) + random(-settings.jitter, settings.jitter) * 0.05;

        // Step forward by speed * drift
        const vel = this.dir.copy();
        vel.mult(this.speed * settings.drift);
        this.loc.add(vel);
    }

    checkEdges() {
        // Wrap/respawn when leaving the canvas
        if (this.loc.x < 0 || this.loc.x > width ||
            this.loc.y < 0 || this.loc.y > height) {
            this.loc.x = random(width);
            this.loc.y = random(height);
            // Re-roll colour on respawn so the field gradually shifts hue
            this.col = pickParticleColour(currentEmotions);
        }
    }

    draw() {
        fill(this.col[0], this.col[1], this.col[2], 120); // semi-transparent
        ellipse(this.loc.x, this.loc.y, settings.particleSize);
    }
}

// ---------------------------------------------------------------------------
// Expose stage API (used by gallery-save.js)
// ---------------------------------------------------------------------------

window.FlowFieldStage = {
    applyEmotions,
    captureImage: () => {
        const holderCanvas = document.querySelector('#p5-holder canvas');
        if (!holderCanvas) throw new Error('No artwork canvas available to save.');
        return holderCanvas.toDataURL('image/png');
    },
};

// ---------------------------------------------------------------------------
// UI controller — mic, text input, analyse, save
// ---------------------------------------------------------------------------

const button     = document.getElementById('mic-toggle');
const textInput  = document.getElementById('text-input');
const textSubmit = document.getElementById('text-submit');
const saveButton = document.getElementById('save-output');

// Mic state
let isListening        = false;
let recognition        = null;
let committedTranscript = '';
let liveTranscript     = '';
let shouldAnalyseOnStop = false;

// Last analysis result (for gallery save)
let lastEmotions       = [];
let lastTranscriptText = '';

/** Read user settings from localStorage (model choice, mic prefs). */
function getAppSettings() {
    return window.getEmotionArtSettings
        ? window.getEmotionArtSettings()
        : { audio_default_mic: 'manual', audio_transcript_persistence: 'keep' };
}

/** Update the transcript display in the overlay panel. */
function updateTranscript(text) {
    const el = document.getElementById('transcript');
    if (el) el.textContent = text || 'Waiting for speech or text...';
}

/**
 * Send text to /analyse, then apply the resulting emotion scores
 * to the flow field visualization.
 */
async function analyseText(text) {
    const status = document.getElementById('status');
    status.textContent = 'ANALYSING';
    lastTranscriptText = text;
    updateTranscript(text);

    try {
        const appSettings = getAppSettings();
        const response = await fetch('/analyse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, model: appSettings.model_classifier || 'base' }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.details || payload.error || 'Analyse request failed');

        lastEmotions = payload.emotions;

        // Build flat emotion map from the payload array
        const emotionMap = { ...DEFAULT_EMOTIONS };
        payload.emotions.forEach(e => {
            if (Object.prototype.hasOwnProperty.call(emotionMap, e.label)) {
                emotionMap[e.label] = e.score;
            }
        });

        // Apply to the flow field
        applyEmotions(emotionMap);

        // Display top-5 scores in the overlay panel
        document.getElementById('output').innerHTML = payload.emotions
            .slice(0, 5)
            .map(e => `
                <div class="score-row">
                    <span class="score-label">${e.label.toUpperCase()}</span>
                    <span class="score-value">${Math.round(e.score * 100)}%</span>
                </div>
            `).join('');

        status.textContent = isListening ? 'LISTENING' : 'READY';
        if (saveButton) saveButton.disabled = false;

        if (getAppSettings().audio_transcript_persistence === 'clear') {
            updateTranscript('');
        }
    } catch (error) {
        console.error(error);
        document.getElementById('output').textContent = error.message || 'Analysis failed.';
        document.getElementById('status').textContent = 'MODEL ERROR';
    }
}

/** Submit text from the input box. */
async function submitText() {
    const text = textInput.value.trim();
    if (!text) return;
    textInput.value = '';
    await analyseText(text);
}

textSubmit.addEventListener('click', submitText);
textInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitText();
});

// ---------------------------------------------------------------------------
// Speech Recognition
// ---------------------------------------------------------------------------

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous     = true;
    recognition.interimResults = true;

    // Accumulate speech results
    recognition.addEventListener('result', event => {
        const finalChunks  = [];
        const interimChunks = [];
        for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            const text   = result[0].transcript.trim();
            if (!text) continue;
            if (result.isFinal) finalChunks.push(text);
            else interimChunks.push(text);
        }
        committedTranscript = finalChunks.join(' ').trim();
        liveTranscript = `${committedTranscript} ${interimChunks.join(' ').trim()}`.trim();
        updateTranscript(liveTranscript);
    });

    // Restart while listening; analyse on stop
    recognition.addEventListener('end', () => {
        if (isListening) { recognition.start(); return; }
        if (shouldAnalyseOnStop) {
            shouldAnalyseOnStop = false;
            const finalTranscript = (liveTranscript || committedTranscript).trim();
            committedTranscript = '';
            liveTranscript = '';
            updateTranscript(finalTranscript);
            if (finalTranscript) analyseText(finalTranscript);
            else document.getElementById('status').textContent = 'READY';
        }
    });

    recognition.addEventListener('error', event => {
        if (event.error !== 'no-speech') {
            isListening = false;
            button.textContent = 'START LISTENING';
            button.classList.remove('secondary');
            button.classList.add('passive');
            document.getElementById('status').textContent = 'MIC ERROR';
        }
    });

    button.addEventListener('click', () => {
        if (isListening) {
            isListening = false;
            shouldAnalyseOnStop = true;
            recognition.stop();
            button.textContent = 'START LISTENING';
            button.classList.remove('secondary');
            button.classList.add('passive');
            document.getElementById('status').textContent = 'ANALYSING';
        } else {
            committedTranscript = '';
            liveTranscript = '';
            shouldAnalyseOnStop = false;
            isListening = true;
            updateTranscript('');
            button.textContent = 'END LISTENING';
            button.classList.remove('passive');
            button.classList.add('secondary');
            document.getElementById('status').textContent = 'LISTENING';
            recognition.start();
        }
    });

    button.textContent = 'START LISTENING';
    button.classList.add('passive');
    document.getElementById('status').textContent = 'READY';

    if (getAppSettings().audio_default_mic === 'auto') button.click();
} else {
    button.disabled = true;
    button.textContent = 'MIC UNSUPPORTED';
    button.classList.add('passive');
    document.getElementById('status').textContent = 'MIC UNAVAILABLE';
}

// ---------------------------------------------------------------------------
// Gallery save
// ---------------------------------------------------------------------------

if (window.saveArtwork) {
    window.saveArtwork({
        pageName:     'flow_field',
        captureImage: window.FlowFieldStage.captureImage,
        getEmotions:  () => lastEmotions,
        getTranscript: () => lastTranscriptText,
    });
}
