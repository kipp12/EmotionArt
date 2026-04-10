// Anamorphic Resonance - app controller (mic, text input, analyse, save).

const button = document.getElementById('mic-toggle');
const textInput = document.getElementById('text-input');
const textSubmit = document.getElementById('text-submit');
const saveButton = document.getElementById('save-output');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let isListening = false;
let recognition = null;
let committedTranscript = '';
let liveTranscript = '';
let shouldAnalyseOnStop = false;
let lastTranscriptText = '';

function getAppSettings() {
    return window.getEmotionArtSettings ? window.getEmotionArtSettings() : {
        audio_default_mic: 'manual',
        audio_transcript_persistence: 'keep',
        model_classifier: 'base',
    };
}

function updateTranscript(text) {
    const transcript = document.getElementById('transcript');
    if (!transcript) return;
    transcript.textContent = text || 'Waiting for speech or text...';
}

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

        lastEmotions = payload.emotions;
        const raw = { anger:0, disgust:0, fear:0, joy:0, neutral:0, sadness:0, surprise:0 };
        payload.emotions.forEach(e => { if (raw.hasOwnProperty(e.label)) raw[e.label] = e.score; });
        spawnParticles(raw);
        pushHistory(payload.emotions);

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
        document.getElementById('classification-output').textContent = err.message || 'Analysis failed.';
        document.getElementById('recording-status').textContent = 'Model error';
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

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

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
            document.getElementById('recording-status').textContent = 'Mic error';
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

if (window.saveArtwork) {
    window.saveArtwork({
        pageName: 'anamorphic_resonance',
        captureImage: () => {
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
