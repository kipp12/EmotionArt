/**
 * Geometric Grid — app controller (mic, text input, analyse, save).
 *
 * This is the user-interaction layer for the Geometric Grid theme. It handles:
 *   1. Microphone input via the Web Speech API (SpeechRecognition)
 *   2. Text input via the text box
 *   3. Sending text to the Flask /analyse endpoint for emotion classification
 *   4. Passing the returned emotion scores to applyEmotionPalette() (defined in
 *      geometric-grid-sketch.js) to update the grid's structure and colours
 *   5. Displaying emotion scores and transcript in the overlay panel
 *   6. Wiring up the Save button via gallery-save.js
 *
 * This file follows the same app-controller pattern as all other themes
 * (anamorphic-resonance-app.js, flow-field-app.js, flower-pots-app.js).
 *
 * Libraries used:
 *   - Web Speech API (SpeechRecognition) — browser-native speech-to-text
 *   - fetch() — for POST /analyse requests to the Flask backend
 *   - gallery-save.js — for the saveArtwork() function
 *   - settings.js — for getEmotionArtSettings() (model selection, mic prefs)
 */

// DOM element references
const button = document.getElementById('mic-toggle');
const textInput = document.getElementById('text-input');
const textSubmit = document.getElementById('text-submit');
const saveButton = document.getElementById('save-output');

// Check for browser SpeechRecognition support (Chrome: webkitSpeechRecognition)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Microphone state
let isListening = false;        // Whether the mic is currently active
let recognition = null;         // SpeechRecognition instance
let committedTranscript = '';   // Finalised speech chunks
let liveTranscript = '';        // Finalised + in-progress speech
let shouldAnalyseOnStop = false; // Flag: analyse the transcript when mic stops

// Last analysis results — used by gallery-save to attach to saved artwork
let lastEmotions = [];
let lastTranscriptText = '';

/**
 * Read the user's settings (model selection, mic preference, etc.)
 * from localStorage via the global settings.js helper.
 */
function getAppSettings() {
    return window.getEmotionArtSettings ? window.getEmotionArtSettings() : {
        audio_default_mic: 'manual',
        audio_transcript_persistence: 'keep',
        model_classifier: 'base',
    };
}

/**
 * Update the transcript display in the overlay panel.
 */
function updateTranscript(text) {
    const transcript = document.getElementById('transcript');
    if (!transcript) return;
    transcript.textContent = text || 'Waiting for speech or text...';
}

/**
 * Send text to the Flask /analyse endpoint for emotion classification,
 * then apply the results to the grid visualization.
 *
 * The /analyse endpoint returns:
 *   { emotions: [{label: "joy", score: 0.82}, ...], text: "...", model: "base" }
 *
 * We pass emotions directly to applyEmotionPalette() which is defined in
 * geometric-grid-sketch.js and controls the grid's structure and colours.
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

        // Apply emotion scores to the geometric grid visualization
        applyEmotionPalette(payload.emotions);

        // Display the top-5 emotion scores in the overlay panel
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

        // If the user has 'clear transcript after analysis' enabled
        if (getAppSettings().audio_transcript_persistence === 'clear') {
            updateTranscript('');
        }
    } catch (error) {
        console.error(error);
        document.getElementById('output').textContent =
            'The emotion model isn\u2019t ready. Please try again, or switch to the Fast Model in Settings.';
        status.textContent = 'MODEL ERROR';
    }
}

/**
 * Read text from the input box and send it for analysis.
 */
async function submitText() {
    const text = textInput.value.trim();
    if (!text) return;
    textInput.value = '';
    await analyseText(text);
}

// Wire up the text input: button click and Enter key
textSubmit.addEventListener('click', submitText);
textInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') submitText();
});

// ---------------------------------------------------------------------------
// Speech Recognition setup
// ---------------------------------------------------------------------------

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;      // Don't stop after one sentence
    recognition.interimResults = true;  // Stream partial results as the user speaks

    // Handle incoming speech results — both interim (in-progress) and final (committed)
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

    // When recognition ends: either restart (if still listening) or analyse the result
    recognition.addEventListener('end', () => {
        if (isListening) {
            // User is still listening — restart (Chrome stops after ~60s of silence)
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
                document.getElementById('status').textContent = 'READY';
            }
        }
    });

    // Handle microphone errors (permission denied, hardware issues, etc.)
    recognition.addEventListener('error', event => {
        if (event.error !== 'no-speech') {
            isListening = false;
            button.textContent = 'START LISTENING';
            button.classList.remove('active');
            document.getElementById('status').textContent =
                event.error === 'not-allowed' ? 'MIC BLOCKED' : 'MIC ERROR';
            if (event.error === 'not-allowed') {
                document.getElementById('output').textContent =
                    'Microphone access was denied. Click the lock icon in your browser\u2019s address bar and allow microphone access, then try again.';
            }
        }
    });

    // Toggle mic on/off when the button is clicked
    button.addEventListener('click', () => {
        if (isListening) {
            // Stop listening — trigger analysis of accumulated transcript
            isListening = false;
            shouldAnalyseOnStop = true;
            recognition.stop();
            button.textContent = 'START LISTENING';
            button.classList.remove('active');
            document.getElementById('status').textContent = 'ANALYSING';
        } else {
            // Start listening — clear previous transcript
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

    // Initial button state
    button.textContent = 'START LISTENING';
    button.classList.remove('active');
    document.getElementById('status').textContent = 'READY';

    // If the user has 'auto-start mic' enabled in settings, click immediately
    if (getAppSettings().audio_default_mic === 'auto') {
        button.click();
    }
} else {
    // Browser doesn't support SpeechRecognition
    button.disabled = true;
    button.textContent = 'Mic Unsupported';
    document.getElementById('status').textContent = 'MIC UNAVAILABLE';
}

// ---------------------------------------------------------------------------
// Gallery save integration
// ---------------------------------------------------------------------------

if (window.saveArtwork) {
    window.saveArtwork({
        pageName: 'geometric_grid',
        captureImage: () => {
            // Grab the p5.js canvas from within the holder div
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
