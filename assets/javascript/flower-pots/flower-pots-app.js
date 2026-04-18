/**
 * Flower-pots app controller — wires up the page UI to the zen-pots scene.
 *
 * Credit — inspired by the original "Zen Pots" concept by newyellow.
 *
 * Responsibilities:
 *   1. p5.js lifecycle hooks (`setup`, `draw`, `windowResized`) — p5 finds
 *      these by name in the global scope.
 *   2. Mic capture via Web Speech API (`SpeechRecognition`) with interim/final
 *      transcript handling.
 *   3. Free-text input fallback.
 *   4. POSTing text to `/analyse` and applying the returned emotion map.
 *   5. Palette switcher (light/dark theme) and gallery save integration.
 */

/**
 * Replace the active scene with a new one driven by `map`.
 * The scene paints progressively on subsequent `draw()` frames.
 */
function buildAndStartScene(map) {
    zenState.current = { ...map };
    zenState.scene = buildScene(map);
}

/**
 * Measure the container `#p5-holder` so the canvas fills its parent.
 * Falls back to window size if the holder isn't rendered yet.
 */
function getStageSize() {
    const holder = document.getElementById('p5-holder');
    if (!holder) {
        return { width: window.innerWidth, height: window.innerHeight };
    }

    return {
        width: holder.clientWidth || window.innerWidth,
        height: holder.clientHeight || window.innerHeight,
    };
}

/**
 * p5.js lifecycle — runs once on load.
 * Creates the canvas, sets HSB colour mode, and kicks off the first scene
 * using whatever `zenState.current` was initialised to in flower-pots-data.js.
 */
function setup() {
    const stageSize = getStageSize();
    const canvas = createCanvas(stageSize.width, stageSize.height);
    canvas.parent('p5-holder');
    colorMode(HSB, 360, 100, 100, 1);
    noStroke();
    buildAndStartScene(zenState.current);
}

/**
 * p5.js lifecycle — runs every frame (~60 fps).
 * Consumes up to `stepsPerFrame` commands from the scene queue, then
 * composites the three layers to the main canvas.
 */
function draw() {
    if (!zenState.scene) return;

    const scene = zenState.scene;
    for (let i = 0; i < scene.stepsPerFrame && scene.queueIndex < scene.queue.length; i++) {
        drawQueueStep(scene, scene.queue[scene.queueIndex]);
        scene.queueIndex += 1;
    }

    if (scene.queueIndex >= scene.queue.length) {
        scene.completed = true;
    }

    compositeScene(scene);
}

/**
 * p5.js lifecycle — rebuilds the scene when the window changes size.
 * We rebuild (rather than stretch) because pot positions depend on
 * width/height, and stretched dot-art looks blurry.
 */
function windowResized() {
    const stageSize = getStageSize();
    resizeCanvas(stageSize.width, stageSize.height);
    if (zenState.current) {
        buildAndStartScene(zenState.current);
    }
}

/**
 * POST text to /analyse, parse the emotions payload, and rebuild the scene.
 * Also renders the top-5 emotion scores to the sidebar.
 *
 * Uses `getAppSettings().model_classifier` so the user's choice of base/large
 * model (set on the settings page) travels with the request.
 */
async function analyseText(text) {
    const status = document.getElementById('status');
    const transcript = document.getElementById('transcript');
    status.textContent = 'ANALYSING';
    lastTranscriptText = text;
    if (transcript) transcript.textContent = text;

    try {
        const response = await fetch('/analyse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                model: getAppSettings().model_classifier || 'base',
            }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || payload.details || 'Analyse request failed');
        }
        lastEmotions = payload.emotions;
        const map = emotionMapFromPayload(payload.emotions);

        buildAndStartScene(map);
        // Render the top-5 emotion scores as a small bar list in the sidebar.
        document.getElementById('output').innerHTML = payload.emotions
            .slice(0, 5)
            .map(entry => `
                <div class="score-row">
                    <span class="score-label">${entry.label.toUpperCase()}</span>
                    <span class="score-value">${Math.round(entry.score * 100)}%</span>
                </div>
            `)
            .join('');

        status.textContent = isListening ? 'LISTENING' : 'READY';
        if (saveButton) saveButton.disabled = false;
        // Optionally clear the transcript after analysis (user setting).
        if (getAppSettings().audio_transcript_persistence === 'clear') {
            updateTranscript('');
        }
    } catch (error) {
        console.error(error);
        document.getElementById('output').textContent = error.message || 'Analysis failed.';
        status.textContent = 'MODEL ERROR';
    }
}

// --- DOM references grabbed once on load.
const button = document.getElementById('mic-toggle');
const paletteSelect = document.getElementById('palette-select');
const paletteValue = document.getElementById('palette-value');
const textInput = document.getElementById('text-input');
const textSubmit = document.getElementById('text-submit');
const saveButton = document.getElementById('save-output');
// Web Speech API — prefer standard, fall back to WebKit prefix (Chrome/Safari).
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let isListening = false;
let recognition = null;
let committedTranscript = '';  // text already marked final by the recognizer
let liveTranscript = '';       // committed + current interim chunk (live display)
let shouldAnalyseOnStop = false;
let lastEmotions = [];
let lastTranscriptText = '';

/**
 * Safe accessor for global user settings (model choice, mic auto-start, etc.).
 * Returns sane defaults if `settings.js` didn't load for some reason.
 */
function getAppSettings() {
    return window.getEmotionArtSettings ? window.getEmotionArtSettings() : {
        audio_default_mic: 'manual',
        audio_transcript_persistence: 'keep',
        model_classifier: 'base',
    };
}

/**
 * Sync the palette dropdown UI to `zenState.themeMode`.
 * Keeps the visible label in step with the selected theme.
 */
function syncPaletteSelect() {
    if (paletteSelect) {
        paletteSelect.value = zenState.themeMode;
    }
    if (paletteValue) {
        paletteValue.textContent = zenState.themeMode === 'dark'
            ? 'Sombre Neon (Dark)'
            : 'Soft Pastel (Light)';
    }
}

/** Submit the text box contents for analysis, clearing the field afterwards. */
async function submitText() {
    const text = textInput.value.trim();
    if (!text) return;
    textInput.value = '';
    await analyseText(text);
}

/** Update the on-screen transcript display with placeholder when empty. */
function updateTranscript(text) {
    const transcript = document.getElementById('transcript');
    if (!transcript) return;
    transcript.textContent = text || 'Waiting for speech or text...';
}

// --- Text input event wiring (click Submit or press Enter).
textSubmit.addEventListener('click', submitText);
textInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') submitText();
});

// --- Palette (light/dark) switcher. Rebuilds the scene on change.
if (paletteSelect) {
    paletteSelect.addEventListener('change', () => {
        zenState.themeMode = paletteSelect.value;
        syncPaletteSelect();
        buildAndStartScene(zenState.current);
    });
}

syncPaletteSelect();

// --- Mic/speech recognition setup (only if browser supports it).
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;       // keep listening until stopped
    recognition.interimResults = true;   // show words as they're spoken

    // Aggregate interim/final chunks into live + committed transcripts.
    recognition.addEventListener('result', event => {
        const finalChunks = [];
        const interimChunks = [];

        for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            const text = result[0].transcript.trim();
            if (!text) continue;

            if (result.isFinal) {
                finalChunks.push(text);
            } else {
                interimChunks.push(text);
            }
        }

        committedTranscript = finalChunks.join(' ').trim();
        liveTranscript = `${committedTranscript} ${interimChunks.join(' ').trim()}`.trim();
        updateTranscript(liveTranscript);
    });

    // When recognition ends: auto-restart if still listening, or analyse on stop.
    recognition.addEventListener('end', () => {
        if (isListening) {
            recognition.start();  // browsers time recognition out ~60s; restart
            return;
        }

        if (shouldAnalyseOnStop) {
            shouldAnalyseOnStop = false;
            const finalTranscript = (liveTranscript || committedTranscript).trim();
            committedTranscript = '';
            liveTranscript = '';
            updateTranscript(finalTranscript);

            if (finalTranscript) {
                analyseText(finalTranscript);
            } else {
                document.getElementById('status').textContent = 'READY';
            }
        }
    });

    // 'no-speech' is common (user paused); don't treat it as an error.
    recognition.addEventListener('error', event => {
        if (event.error !== 'no-speech') {
            isListening = false;
            button.textContent = 'Start Listening';
            button.classList.remove('active');
            document.getElementById('status').textContent = 'MIC ERROR';
        }
    });

    // Mic toggle — start listening, or stop and analyse the accumulated transcript.
    button.addEventListener('click', () => {
        if (isListening) {
            isListening = false;
            shouldAnalyseOnStop = true;
            recognition.stop();
            button.textContent = 'START LISTENING';
            button.classList.remove('active');
            document.getElementById('status').textContent = 'ANALYSING';
        } else {
            committedTranscript = '';
            liveTranscript = '';
            shouldAnalyseOnStop = false;
            isListening = true;
            updateTranscript('');
            button.textContent = 'END LISTENING';
            button.classList.add('active');
            document.getElementById('status').textContent = 'LISTENING';
            recognition.start();
        }
    });
    button.textContent = 'START LISTENING';
    button.classList.remove('active');
    document.getElementById('status').textContent = 'READY';
    // If user set "auto-start mic" in settings, click the button programmatically.
    if (getAppSettings().audio_default_mic === 'auto') {
        button.click();
    }
} else {
    // Browser lacks Web Speech API (Firefox, older browsers) — disable mic UI.
    button.disabled = true;
    button.textContent = 'Mic Unsupported';
    document.getElementById('status').textContent = 'MIC UNAVAILABLE';
}

// --- Gallery save — exposes a "Save to gallery" handler for this page.
// The shared helper (`gallery-save.js`) captures the canvas as a PNG data URL
// and POSTs it to /gallery along with the emotions and transcript that made it.
if (window.saveArtwork) {
    window.saveArtwork({
        pageName: 'flower_pots',
        captureImage: () => {
            const holderCanvas = document.querySelector('#p5-holder canvas');
            if (!holderCanvas) {
                throw new Error('No artwork canvas available to save.');
            }
            return holderCanvas.toDataURL('image/png');
        },
        getEmotions: () => lastEmotions,
        getTranscript: () => lastTranscriptText,
    });
}
