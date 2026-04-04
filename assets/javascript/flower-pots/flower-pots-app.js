// Credit - Inspired by the original Zen Pots concept by newyellow.

function buildAndStartScene(map) {
    zenState.current = { ...map };
    zenState.scene = buildScene(map);
}

function setup() {
    const canvas = createCanvas(window.innerWidth, window.innerHeight);
    canvas.parent('p5-holder');
    colorMode(HSB, 360, 100, 100, 1);
    noStroke();
    buildAndStartScene(zenState.current);
}

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

function windowResized() {
    resizeCanvas(window.innerWidth, window.innerHeight);
    if (zenState.current) {
        buildAndStartScene(zenState.current);
    }
}

async function analyseText(text) {
    const status = document.getElementById('status');
    const transcript = document.getElementById('transcript');
    status.textContent = 'ANALYSING...';
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
        const map = emotionMapFromPayload(payload.emotions);

        buildAndStartScene(map);
        document.getElementById('output').textContent = payload.emotions
            .slice(0, 5)
            .map(entry => `${entry.label.toUpperCase()}: ${Math.round(entry.score * 100)}%`)
            .join('\n');

        status.textContent = isListening ? 'LISTENING...' : 'READY';
    } catch (error) {
        console.error(error);
        document.getElementById('output').textContent = error.message || 'Analysis failed.';
        status.textContent = 'MODEL ERROR';
    }
}

const button = document.getElementById('mic-toggle');
const paletteSelect = document.getElementById('palette-select');
const paletteValue = document.getElementById('palette-value');
const textInput = document.getElementById('text-input');
const textSubmit = document.getElementById('text-submit');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let isListening = false;

function syncPaletteSelect() {
    if (paletteSelect) {
        paletteSelect.value = zenState.themeMode;
    }
    if (paletteValue) {
        paletteValue.textContent = zenState.themeMode === 'dark'
            ? 'Sombre Neon (Dark)'
            : 'Soft Pastel (Light)';
    }
    document.body.dataset.uiTheme = zenState.themeMode;
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

if (paletteSelect) {
    paletteSelect.addEventListener('change', () => {
        zenState.themeMode = paletteSelect.value;
        syncPaletteSelect();
        buildAndStartScene(zenState.current);
    });
}

syncPaletteSelect();

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.interimResults = false;

    recognition.addEventListener('result', async event => {
        await analyseText(event.results[0][0].transcript);
    });

    recognition.addEventListener('end', () => {
        if (isListening) recognition.start();
    });

    recognition.addEventListener('error', event => {
        if (event.error !== 'no-speech') {
            isListening = false;
            button.textContent = 'Resume Listening';
            button.classList.remove('active');
            document.getElementById('status').textContent = 'MIC ERROR';
        }
    });

    button.addEventListener('click', () => {
        if (isListening) {
            isListening = false;
            recognition.stop();
            button.textContent = 'Resume Listening';
            button.classList.remove('active');
            document.getElementById('status').textContent = 'PAUSED';
        } else {
            isListening = true;
            recognition.start();
            button.textContent = 'Pause Listening';
            button.classList.add('active');
            document.getElementById('status').textContent = 'LISTENING...';
        }
    });

    isListening = true;
    recognition.start();
    button.classList.add('active');
} else {
    button.disabled = true;
    button.textContent = 'Mic Unsupported';
    document.getElementById('status').textContent = 'MIC UNAVAILABLE';
}
