/**
 * Anamorphic Resonance — app controller (mic, text input, analyse, save).
 *
 * Handles user interaction for the Anamorphic Resonance theme:
 *   1. Microphone input via Web Speech API (SpeechRecognition)
 *   2. Text input via the text box
 *   3. POST to /analyse for emotion classification
 *   4. Passes results to spawnParticles() and pushHistory() (in the scene file)
 *   5. Displays scores and transcript in the overlay panel
 *   6. Gallery save with composited WebGL + particle canvas
 *
 * The scene file (anamorphic-resonance-scene.js) exposes:
 *   - spawnParticles(emotionMap) — create 2D particles on the overlay canvas
 *   - pushHistory(emotions)     — add to the emotion history for shader blending
 *   - canvas / pCanvas          — the two canvas elements for compositing on save
 *   - lastEmotions              — updated here, read by the save function
 */

// DOM references
const button = document.getElementById('mic-toggle');
const textInput = document.getElementById('text-input');
const textSubmit = document.getElementById('text-submit');
const saveButton = document.getElementById('save-output');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Mic state
let isListening = false;
let recognition = null;
let committedTranscript = '';
let liveTranscript = '';
let shouldAnalyseOnStop = false;
let lastTranscriptText = '';

/** Read user settings from localStorage (model choice, mic prefs). */
function getAppSettings() {
    return window.getEmotionArtSettings ? window.getEmotionArtSettings() : {
        audio_default_mic: 'manual',
        audio_transcript_persistence: 'keep',
        model_classifier: 'base',
    };
}

/** Update the transcript display in the overlay panel. */
function updateTranscript(text) {
    const transcript = document.getElementById('transcript');
    if (!transcript) return;
    transcript.textContent = text || 'Waiting for speech or text...';
}

/**
 * Send text to the /analyse endpoint, then update the visualization.
 *
 * On success:
 *   1. Converts the emotion array to a flat map and spawns particles
 *   2. Pushes the analysis into the emotion history (for shader blending)
 *   3. Updates the score display in the overlay panel
 */
async function analyseText(text) {
    document.getElementById('recording-status').textContent = 'Analysing';
    const transcript = document.getElementById('transcript');
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

        // Store for gallery save
        lastEmotions = payload.emotions;

        // Convert [{label, score}] array to flat {emotion: score} map
        const raw = { anger:0, disgust:0, fear:0, joy:0, neutral:0, sadness:0, surprise:0 };
        payload.emotions.forEach(e => { if (raw.hasOwnProperty(e.label)) raw[e.label] = e.score; });

        // Trigger particle effects and update the shader's emotion history
        spawnParticles(raw);
        pushHistory(payload.emotions);

        // Display top-5 scores in the overlay panel
        document.getElementById('classification-output').innerHTML =
            payload.emotions.slice(0, 5).map(e => `
                <div class="score-row">
                    <span class="score-label">${e.label.toUpperCase()}</span>
                    <span class="score-value">${Math.round(e.score * 100)}%</span>
                </div>
            `).join('');

        document.getElementById('recording-status').textContent = isListening ? 'Listening' : 'Ready';
        if (saveButton) saveButton.disabled = false;
        if (getAppSettings().audio_transcript_persistence === 'clear') {
            updateTranscript('');
        }
    } catch (err) {
        console.error(err);
        document.getElementById('classification-output').textContent =
            'The emotion model isn\u2019t ready. Please try again, or switch to the Fast Model in Settings.';
        document.getElementById('recording-status').textContent = 'Model error';
    }
}

/** Read text input and trigger analysis. */
async function submitText() {
    const text = textInput.value.trim();
    if (!text) return;
    textInput.value = '';
    await analyseText(text);
}

// Wire up text input
textSubmit.addEventListener('click', submitText);
textInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitText();
});

// ---------------------------------------------------------------------------
// Speech Recognition
// ---------------------------------------------------------------------------

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    // Accumulate speech results (both interim and final)
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

    // Auto-restart while listening; analyse on intentional stop
    recognition.addEventListener('end', () => {
        if (isListening) {
            recognition.start();
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
                document.getElementById('recording-status').textContent = 'Ready';
            }
        }
    });

    recognition.addEventListener('error', e => {
        if (e.error !== 'no-speech') {
            isListening = false;
            button.textContent = 'START LISTENING';
            button.classList.remove('secondary');
            button.classList.add('passive');
            document.getElementById('recording-status').textContent =
                e.error === 'not-allowed' ? 'Mic blocked' : 'Mic error';
            if (e.error === 'not-allowed') {
                document.getElementById('classification-output').textContent =
                    'Microphone access was denied. Click the lock icon in your browser\u2019s address bar and allow microphone access, then try again.';
            }
        }
    });

    // Mic toggle button
    button.addEventListener('click', () => {
        if (isListening) {
            isListening = false;
            shouldAnalyseOnStop = true;
            recognition.stop();
            button.textContent = 'START LISTENING';
            button.classList.remove('secondary');
            button.classList.add('passive');
            document.getElementById('recording-status').textContent = 'Analysing';
        } else {
            committedTranscript = '';
            liveTranscript = '';
            shouldAnalyseOnStop = false;
            isListening = true;
            updateTranscript('');
            button.textContent = 'END LISTENING';
            button.classList.remove('passive');
            button.classList.add('secondary');
            document.getElementById('recording-status').textContent = 'Listening';
            recognition.start();
        }
    });
    button.textContent = 'START LISTENING';
    button.classList.add('passive');
    document.getElementById('recording-status').textContent = 'Ready';
    if (getAppSettings().audio_default_mic === 'auto') {
        button.click();
    }
} else {
    button.textContent = 'No Mic API';
    button.disabled = true;
    button.classList.add('passive');
}

// ---------------------------------------------------------------------------
// Gallery save — composites both canvases into a single image
// ---------------------------------------------------------------------------

if (window.saveArtwork) {
    window.saveArtwork({
        pageName: 'anamorphic_resonance',
        captureImage: () => {
            // Create a temporary canvas and draw both layers onto it:
            // 1. The WebGL shader canvas (background)
            // 2. The 2D particle canvas (overlay)
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = canvas.width;
            exportCanvas.height = canvas.height;
            const exportCtx = exportCanvas.getContext('2d');
            exportCtx.drawImage(canvas, 0, 0);
            exportCtx.drawImage(pCanvas, 0, 0);
            return exportCanvas.toDataURL('image/png');
        },
        getEmotions: () => lastEmotions,
        getTranscript: () => lastTranscriptText,
    });
}
