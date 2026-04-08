// Anamorphic Resonance - WebGL shader renderer + particle overlay.

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });

let cur = { anger:0, disgust:0, fear:0, joy:0, neutral:0.5, sadness:0, surprise:0 };
let tar = { anger:0, disgust:0, fear:0, joy:0, neutral:0.5, sadness:0, surprise:0 };
let lastEmotions = [];

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

const program = gl.createProgram();
gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, document.getElementById('vs').text));
gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, document.getElementById('fs').text));
gl.linkProgram(program);
gl.useProgram(program);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

const posLoc = gl.getAttribLocation(program, 'a_pos');
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

const loc = {
    t: gl.getUniformLocation(program, 'u_time'),
    macro: gl.getUniformLocation(program, 'u_macro'),
    res: gl.getUniformLocation(program, 'u_res'),
    center: gl.getUniformLocation(program, 'u_center'),
    anger: gl.getUniformLocation(program, 'u_anger'),
    disgust: gl.getUniformLocation(program, 'u_disgust'),
    fear: gl.getUniformLocation(program, 'u_fear'),
    joy: gl.getUniformLocation(program, 'u_joy'),
    neutral: gl.getUniformLocation(program, 'u_neutral'),
    sadness: gl.getUniformLocation(program, 'u_sadness'),
    surprise: gl.getUniformLocation(program, 'u_surprise'),
};

const HISTORY_SIZE = 8;
const emotionHistory = [];
const EMOTION_COLORS = {
    anger: '#ff2200', disgust: '#22dd22', fear: '#9900ff',
    joy: '#ffcc00', sadness: '#0066ff', surprise: '#ffffff', neutral: '#44aacc'
};

function pushHistory(emotions) {
    const entry = { anger:0, disgust:0, fear:0, joy:0, neutral:0, sadness:0, surprise:0 };
    emotions.forEach(e => { if (entry.hasOwnProperty(e.label)) entry[e.label] = e.score; });
    emotionHistory.push(entry);
    if (emotionHistory.length > HISTORY_SIZE) emotionHistory.shift();
    renderHistoryBar();
    blendHistoryIntoTarget();
}

function renderHistoryBar() {
    const bar = document.getElementById('history-bar');
    if (!bar) return;
    bar.innerHTML = '';
    emotionHistory.forEach(entry => {
        const dominant = Object.entries(entry).sort((a, b) => b[1] - a[1])[0];
        const dot = document.createElement('div');
        dot.className = 'history-dot';
        dot.style.background = EMOTION_COLORS[dominant[0]] || '#fff';
        dot.title = dominant[0];
        bar.appendChild(dot);
    });
}

function blendHistoryIntoTarget() {
    const blended = { anger:0, disgust:0, fear:0, joy:0, neutral:0, sadness:0, surprise:0 };
    let totalWeight = 0;
    emotionHistory.forEach((entry, i) => {
        const age = emotionHistory.length - 1 - i;
        const weight = Math.pow(0.6, age);
        Object.keys(blended).forEach(key => blended[key] += entry[key] * weight);
        totalWeight += weight;
    });
    Object.keys(blended).forEach(key => tar[key] = blended[key] / totalWeight);
}

const pCanvas = document.getElementById('particleCanvas');
const pCtx = pCanvas.getContext('2d');
const particles = [];
const MAX_PARTICLES = 350;

function spawnParticles(e) {
    const cx = pCanvas.width / 2;
    const cy = pCanvas.height / 2;

    for (let i = 0; i < Math.floor(e.anger * 20); i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 120;
        particles.push({
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.5) * 9,
            life: 35 + Math.random() * 25, maxLife: 60,
            color: `hsl(${Math.random() * 30},100%,60%)`,
            size: 2.5, gravity: 0, drag: 0.95,
        });
    }

    for (let i = 0; i < Math.floor(e.joy * 18); i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 2.5;
        particles.push({
            x: cx + (Math.random() - 0.5) * 60, y: cy + (Math.random() - 0.5) * 60,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
            life: 70 + Math.random() * 40, maxLife: 110,
            color: `hsl(${45 + Math.random() * 20},100%,${60 + Math.random() * 20}%)`,
            size: 2, gravity: -0.04, drag: 0.99,
        });
    }

    for (let i = 0; i < Math.floor(e.sadness * 12); i++) {
        particles.push({
            x: cx + (Math.random() - 0.5) * pCanvas.width * 0.8,
            y: -10,
            vx: (Math.random() - 0.5) * 0.5, vy: 0.8 + Math.random() * 1.2,
            life: 130 + Math.random() * 60, maxLife: 190,
            color: `hsl(${210 + Math.random() * 20},80%,55%)`,
            size: 2.5, gravity: 0.02, drag: 0.995,
        });
    }

    for (let i = 0; i < Math.floor(e.fear * 16); i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
            x: cx + Math.cos(angle) * (50 + Math.random() * 150),
            y: cy + Math.sin(angle) * (50 + Math.random() * 150),
            vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
            life: 25 + Math.random() * 25, maxLife: 50,
            color: `hsl(${270 + Math.random() * 30},90%,60%)`,
            size: 1.8, gravity: 0, drag: 0.93, erratic: true,
        });
    }

    const surCount = Math.floor(e.surprise * 25);
    for (let i = 0; i < surCount; i++) {
        const angle = (i / Math.max(surCount, 1)) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 3 + Math.random() * 5;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: 45 + Math.random() * 30, maxLife: 75,
            color: `hsl(${180 + Math.random() * 40},100%,85%)`,
            size: 2, gravity: 0, drag: 0.97,
        });
    }

    for (let i = 0; i < Math.floor(e.disgust * 14); i++) {
        particles.push({
            x: cx + (Math.random() - 0.5) * pCanvas.width * 0.6,
            y: cy + (Math.random() - 0.5) * pCanvas.height * 0.4,
            vx: 0, vy: -1 - Math.random(),
            life: 90 + Math.random() * 40, maxLife: 130,
            color: `hsl(${100 + Math.random() * 40},75%,50%)`,
            size: 2, gravity: 0, drag: 0.985, phase: Math.random() * Math.PI * 2,
        });
    }
}

function updateParticles() {
    if (pCanvas.width !== pCanvas.clientWidth) pCanvas.width = pCanvas.clientWidth;
    if (pCanvas.height !== pCanvas.clientHeight) pCanvas.height = pCanvas.clientHeight;
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life--;
        if (p.life <= 0 || particles.length > MAX_PARTICLES) {
            particles.splice(i, 1);
            continue;
        }

        if (p.erratic && Math.random() < 0.3) {
            p.vx += (Math.random() - 0.5) * 2;
            p.vy += (Math.random() - 0.5) * 2;
        }
        if (p.phase !== undefined) p.vx = Math.sin(p.phase + p.life * 0.1) * 1.5;

        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;

        const alpha = p.life / p.maxLife;
        pCtx.globalAlpha = alpha;
        pCtx.fillStyle = p.color;
        pCtx.shadowBlur = 6;
        pCtx.shadowColor = p.color;
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        pCtx.fill();
    }
    pCtx.shadowBlur = 0;
    pCtx.globalAlpha = 1;
}

function render(time) {
    if (canvas.width !== canvas.clientWidth) canvas.width = canvas.clientWidth;
    if (canvas.height !== canvas.clientHeight) canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const macroCycle = (time % 10000) / 10000;
    Object.keys(tar).forEach(key => cur[key] = cur[key] * 0.95 + tar[key] * 0.05);

    gl.uniform1f(loc.t, time * 0.001);
    gl.uniform1f(loc.macro, macroCycle);
    gl.uniform2f(loc.res, canvas.width, canvas.height);
    gl.uniform2f(loc.center, Math.sin(time * 0.0006) * 0.3, Math.cos(time * 0.0004) * 0.2);
    Object.keys(cur).forEach(key => gl.uniform1f(loc[key], cur[key]));

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    updateParticles();
    requestAnimationFrame(render);
}
requestAnimationFrame(render);
