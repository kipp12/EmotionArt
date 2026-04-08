// Geometric Grid - app controller (mic, text input, analyse, save).

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
let lastEmotions = [];
let lastTranscriptText = '';

function getAppSettings() {
    return window.getEmotionArtSettings ? window.getEmotionArtSettings() : {
        audio_default_mic: 'manual',
        audio_transcript_persistence: 'keep',
    };
}

function updateTranscript(text) {
    const transcript = document.getElementById('transcript');
    if (!transcript) return;
    transcript.textContent = text || 'Waiting for speech or text...';
}

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
            body: JSON.stringify({ text }),
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.details || payload.error || 'Analyse request failed');
        }
        lastEmotions = payload.emotions;

        applyEmotionPalette(payload.emotions);

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
        if (getAppSettings().audio_transcript_persistence === 'clear') {
            updateTranscript('');
        }
    } catch (error) {
        console.error(error);
        document.getElementById('output').textContent = error.message || 'Analysis failed.';
        status.textContent = 'MODEL ERROR';
    }
}

async function submitText() {
    const text = textInput.value.trim();
    if (!text) return;
    textInput.value = '';
    await analyseText(text);
}

textSubmit.addEventListener('click', submitText);
textInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') submitText();
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
                document.getElementById('status').textContent = 'READY';
            }
        }
    });

    recognition.addEventListener('error', event => {
        if (event.error !== 'no-speech') {
            isListening = false;
            button.textContent = 'START LISTENING';
            button.classList.remove('active');
            document.getElementById('status').textContent = 'MIC ERROR';
        }
    });

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
    if (getAppSettings().audio_default_mic === 'auto') {
        button.click();
    }
} else {
    button.disabled = true;
    button.textContent = 'Mic Unsupported';
    document.getElementById('status').textContent = 'MIC UNAVAILABLE';
}

if (window.saveArtwork) {
    window.saveArtwork({
        pageName: 'geometric_grid',
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
