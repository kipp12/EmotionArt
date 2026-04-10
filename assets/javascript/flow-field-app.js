// Flow Field — EmotionArt theme
// Perlin noise flow field where particle colour, speed, density and
// behaviour are all driven by live emotion scores from the classifier.

// ---------------------------------------------------------------------------
// Emotion state
// ---------------------------------------------------------------------------

const EMOTION_COLOURS = {
    anger:    [255,  80,  40],
    fear:     [200, 130, 255],
    sadness:  [100, 150, 255],
    joy:      [255, 220,  80],
    disgust:  [140, 200,  90],
    surprise: [255, 255, 200],
    neutral:  [190, 190, 200],
};

const DEFAULT_EMOTIONS = {
    anger: 0, disgust: 0, fear: 0,
    joy: 0, neutral: 1, sadness: 0, surprise: 0,
};

let currentEmotions = { ...DEFAULT_EMOTIONS };
let targetEmotions  = { ...DEFAULT_EMOTIONS };

// ---------------------------------------------------------------------------
// Particle + scene state
// ---------------------------------------------------------------------------

let particles = [];
let settings  = {};
let numParticles = 1800;

// ---------------------------------------------------------------------------
// p5 lifecycle
// ---------------------------------------------------------------------------

let p5Ready = false;

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

function windowResized() {
    const holder = document.getElementById('p5-holder');
    resizeCanvas(holder.clientWidth, holder.clientHeight);
    background(settings.bg[0], settings.bg[1], settings.bg[2]);
    initParticles();
}

function draw() {
    // Smooth emotion interpolation every frame
    if (!p5Ready || !settings.bg) return;
    let changed = false;
    Object.keys(targetEmotions).forEach(k => {
        const prev = currentEmotions[k];
        currentEmotions[k] += (targetEmotions[k] - currentEmotions[k]) * 0.03;
        if (Math.abs(currentEmotions[k] - prev) > 0.001) changed = true;
    });
    if (changed) refreshSettings(currentEmotions);

    fill(settings.bg[0], settings.bg[1], settings.bg[2], settings.trailAlpha);
    rect(0, 0, width, height);

    for (let p of particles) {
        p.run();
    }
}

function fmap(value, start1, stop1, start2, stop2) {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

function fclamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
}

// ---------------------------------------------------------------------------
// Emotion → settings
// ---------------------------------------------------------------------------

function applyEmotions(e) {
    targetEmotions = { ...DEFAULT_EMOTIONS, ...e };
    currentEmotions = { ...targetEmotions };
    if (!p5Ready) return; 
    refreshSettings(e);
    initParticles();
}

function refreshSettings(e) {
    const intensity = e.anger + e.fear + e.joy + e.surprise + e.sadness + e.disgust;
    numParticles = numParticles = Math.floor(fclamp(fmap(intensity, 0.2, 1.0, 900, 2600), 900, 2600));

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

function chooseBackground(e) {
    if (e.anger   > 0.5) return [20,  5,  0];
    if (e.fear    > 0.5) return [ 5,  0, 10];
    if (e.sadness > 0.5) return [ 8, 12, 25];
    if (e.joy     > 0.5) return [20, 15,  5];
    if (e.disgust > 0.3) return [14, 16,  8];
    return [10, 10, 12];
}

// Multi-colour: blend all emotion colours weighted by score
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

function initParticles() {
    if (!settings.bg) return;
    particles = [];
    background(settings.bg[0], settings.bg[1], settings.bg[2]);

    for (let i = 0; i < numParticles; i++) {
        let x = random(width);
        let y = random(height);

        if (random() < settings.clusterBias) {
            x = random(width  * 0.3, width  * 0.7);
            y = random(height * 0.3, height * 0.7);
        }

        const loc   = createVector(x, y);
        const dir   = p5.Vector.random2D();
        const speed = random(settings.speedMin, settings.speedMax);
        const col   = pickParticleColour(currentEmotions);

        particles.push(new Particle(loc, dir, speed, col));
    }
}

// ---------------------------------------------------------------------------
// Particle class
// ---------------------------------------------------------------------------

class Particle {
    constructor(loc, dir, speed, col) {
        this.loc   = loc;
        this.dir   = dir;
        this.speed = speed;
        this.col   = col;
    }

    run() {
        this.move();
        this.checkEdges();
        this.draw();
    }

    move() {
        const angle = noise(
            this.loc.x / settings.noiseScale,
            this.loc.y / settings.noiseScale,
            frameCount  / settings.noiseScale
        ) * TWO_PI * settings.noiseStrength;

        this.dir.x = cos(angle) + random(-settings.jitter, settings.jitter) * 0.05;
        this.dir.y = sin(angle) + random(-settings.jitter, settings.jitter) * 0.05;

        const vel = this.dir.copy();
        vel.mult(this.speed * settings.drift);
        this.loc.add(vel);
    }

    checkEdges() {
        if (this.loc.x < 0 || this.loc.x > width ||
            this.loc.y < 0 || this.loc.y > height) {
            this.loc.x = random(width);
            this.loc.y = random(height);
            // Re-roll colour on respawn so the field gradually shifts hue
            this.col = pickParticleColour(currentEmotions);
        }
    }

    draw() {
        fill(this.col[0], this.col[1], this.col[2], 120);
        ellipse(this.loc.x, this.loc.y, settings.particleSize);
    }
}

// ---------------------------------------------------------------------------
// Expose stage API (used by gallery-save.js and the page script below)
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
// UI — mic, text input, analyse, save
// ---------------------------------------------------------------------------

const button     = document.getElementById('mic-toggle');
const textInput  = document.getElementById('text-input');
const textSubmit = document.getElementById('text-submit');
const saveButton = document.getElementById('save-output');

let isListening        = false;
let recognition        = null;
let committedTranscript = '';
let liveTranscript     = '';
let shouldAnalyseOnStop = false;
let lastEmotions       = [];
let lastTranscriptText = '';

function getAppSettings() {
    return window.getEmotionArtSettings
        ? window.getEmotionArtSettings()
        : { audio_default_mic: 'manual', audio_transcript_persistence: 'keep' };
}

function updateTranscript(text) {
    const el = document.getElementById('transcript');
    if (el) el.textContent = text || 'Waiting for speech or text...';
}

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

        // Build emotion map from payload array
        const emotionMap = { ...DEFAULT_EMOTIONS };
        payload.emotions.forEach(e => {
            if (Object.prototype.hasOwnProperty.call(emotionMap, e.label)) {
                emotionMap[e.label] = e.score;
            }
        });

        applyEmotions(emotionMap);

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

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous     = true;
    recognition.interimResults = true;

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

if (window.saveArtwork) {
    window.saveArtwork({
        pageName:     'flow_field',
        captureImage: window.FlowFieldStage.captureImage,
        getEmotions:  () => lastEmotions,
        getTranscript: () => lastTranscriptText,
    });
}
