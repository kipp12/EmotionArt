/**
 * Anamorphic Resonance — WebGL shader renderer + 2D particle overlay.
 *
 * This is the rendering engine for the Anamorphic Resonance theme. It combines:
 *   1. A full-screen WebGL fragment shader that generates a kaleidoscopic,
 *      fractal-like pattern. Emotion scores are passed as uniforms and control
 *      symmetry, iteration depth, wave frequency, colour, and energy.
 *   2. A 2D canvas overlay with emotion-specific particle effects (explosions,
 *      rain, sparks, etc.) spawned on each analysis.
 *
 * The shader code itself lives as inline <script> tags in the HTML template
 * (anamorphic_resonance.html) because GLSL can't be loaded as an external file
 * without a fetch() step. The vertex shader is trivial (pass-through); the
 * fragment shader does all the visual work.
 *
 * Libraries / APIs:
 *   - WebGL 1.0 (gl = canvas.getContext('webgl')) — GPU-accelerated rendering
 *   - requestAnimationFrame — 60fps render loop
 *   - Canvas 2D (particleCanvas) — for the particle overlay layer
 *
 * Key concepts:
 *   - Uniforms: CPU→GPU variables set per frame. We pass time, resolution,
 *     and all 7 emotion scores as floats so the shader can react in real-time.
 *   - Smoothing: emotion values are interpolated (95% old + 5% target) each
 *     frame to avoid jarring visual jumps between analyses.
 *   - Emotion history: the last 8 analyses are blended with exponential decay
 *     (weight = 0.6^age) to create smooth transitions over time.
 */

// ---------------------------------------------------------------------------
// WebGL setup
// ---------------------------------------------------------------------------

// Get the two canvas elements from the HTML
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });

// Current (smoothed) and target emotion values.
// Keys match the classifier output: anger, disgust, fear, joy, neutral, sadness, surprise.
let cur = { anger:0, disgust:0, fear:0, joy:0, neutral:0.5, sadness:0, surprise:0 };
let tar = { anger:0, disgust:0, fear:0, joy:0, neutral:0.5, sadness:0, surprise:0 };
let lastEmotions = [];  // Raw emotion array from the last analysis (for gallery save)

/**
 * Compile a GLSL shader from source text.
 * @param {WebGLRenderingContext} gl   — The GL context
 * @param {number}                type — gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @param {string}                source — GLSL source code
 * @returns {WebGLShader}
 */
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

// Create and link the shader program.
// Vertex shader (id="vs") and fragment shader (id="fs") are in the HTML.
const program = gl.createProgram();
gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, document.getElementById('vs').text));
gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, document.getElementById('fs').text));
gl.linkProgram(program);
gl.useProgram(program);

// Create a full-screen quad (two triangles covering [-1,-1] to [1,1]).
// The fragment shader runs for every pixel on this quad.
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

// Bind the vertex position attribute (a_pos) to the buffer.
const posLoc = gl.getAttribLocation(program, 'a_pos');
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

// Look up all uniform locations. These are the CPU→GPU bridges:
// u_time     — elapsed time in seconds (drives animation)
// u_macro    — macro cycle (0-1 over 10 seconds, creates slow structural shifts)
// u_res      — canvas resolution in pixels (for aspect-ratio correction)
// u_center   — slowly drifting centre point (creates gentle camera movement)
// u_<emotion> — each emotion's smoothed score (0-1)
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

// ---------------------------------------------------------------------------
// Emotion history — blends recent analyses for smooth visual transitions
// ---------------------------------------------------------------------------

const HISTORY_SIZE = 8;      // Keep the last 8 emotion analyses
const emotionHistory = [];   // Array of emotion-map objects

// Colour mapping for the history bar dots shown in the overlay panel
const EMOTION_COLORS = {
    anger: '#ff2200', disgust: '#22dd22', fear: '#9900ff',
    joy: '#ffcc00', sadness: '#0066ff', surprise: '#ffffff', neutral: '#44aacc'
};

/**
 * Add a new emotion analysis to the history ring buffer.
 * Then re-render the history bar and re-blend the target values.
 *
 * @param {Array} emotions — [{label: "joy", score: 0.82}, ...]
 */
function pushHistory(emotions) {
    // Convert the array into a flat object {anger: 0.1, joy: 0.82, ...}
    const entry = { anger:0, disgust:0, fear:0, joy:0, neutral:0, sadness:0, surprise:0 };
    emotions.forEach(e => { if (entry.hasOwnProperty(e.label)) entry[e.label] = e.score; });
    emotionHistory.push(entry);
    if (emotionHistory.length > HISTORY_SIZE) emotionHistory.shift();
    renderHistoryBar();
    blendHistoryIntoTarget();
}

/**
 * Render coloured dots in the history bar (one dot per analysis).
 * Each dot is coloured by the dominant emotion of that analysis.
 */
function renderHistoryBar() {
    const bar = document.getElementById('history-bar');
    if (!bar) return;
    bar.innerHTML = '';
    emotionHistory.forEach(entry => {
        // Find the dominant emotion (highest score)
        const dominant = Object.entries(entry).sort((a, b) => b[1] - a[1])[0];
        const dot = document.createElement('div');
        dot.className = 'history-dot';
        dot.style.background = EMOTION_COLORS[dominant[0]] || '#fff';
        dot.title = dominant[0];
        bar.appendChild(dot);
    });
}

/**
 * Blend all history entries into a single target emotion map.
 *
 * Uses exponential decay: most recent entry has weight 1.0,
 * each older entry is weighted by 0.6^age. This creates a smooth
 * transition where recent emotions dominate but old ones linger.
 */
function blendHistoryIntoTarget() {
    const blended = { anger:0, disgust:0, fear:0, joy:0, neutral:0, sadness:0, surprise:0 };
    let totalWeight = 0;
    emotionHistory.forEach((entry, i) => {
        const age = emotionHistory.length - 1 - i;
        const weight = Math.pow(0.6, age);  // Exponential decay
        Object.keys(blended).forEach(key => blended[key] += entry[key] * weight);
        totalWeight += weight;
    });
    // Normalise by total weight to get weighted average
    Object.keys(blended).forEach(key => tar[key] = blended[key] / totalWeight);
}

// ---------------------------------------------------------------------------
// 2D Particle system (overlaid on top of the WebGL shader)
// ---------------------------------------------------------------------------

const pCanvas = document.getElementById('particleCanvas');
const pCtx = pCanvas.getContext('2d');
const particles = [];
const MAX_PARTICLES = 350;

/**
 * Spawn emotion-specific particles on a new analysis.
 *
 * Each emotion creates a different visual effect:
 *   - Anger:    explosive outward bursts, red/orange, fast, high drag
 *   - Joy:      upward-floating warm particles with negative gravity
 *   - Sadness:  falling rain drops from the top, blue, slow, long-lived
 *   - Fear:     erratic purple particles with random direction changes
 *   - Surprise: radial burst from centre, evenly spaced around a circle
 *   - Disgust:  wavy upward-moving green particles with sinusoidal x-motion
 *
 * @param {Object} e — Flat emotion map {anger: 0.1, joy: 0.8, ...}
 */
function spawnParticles(e) {
    const cx = pCanvas.width / 2;
    const cy = pCanvas.height / 2;

    // Anger: explosive outward bursts from a ring around centre
    for (let i = 0; i < Math.floor(e.anger * 20); i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 120;
        particles.push({
            x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.5) * 9,
            life: 35 + Math.random() * 25, maxLife: 60,
            color: `hsl(${Math.random() * 30},100%,60%)`,  // Red-orange range
            size: 2.5, gravity: 0, drag: 0.95,
        });
    }

    // Joy: upward-floating particles with slight negative gravity
    for (let i = 0; i < Math.floor(e.joy * 18); i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 2.5;
        particles.push({
            x: cx + (Math.random() - 0.5) * 60, y: cy + (Math.random() - 0.5) * 60,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
            life: 70 + Math.random() * 40, maxLife: 110,
            color: `hsl(${45 + Math.random() * 20},100%,${60 + Math.random() * 20}%)`, // Warm gold
            size: 2, gravity: -0.04, drag: 0.99,
        });
    }

    // Sadness: slow falling rain from the top edge
    for (let i = 0; i < Math.floor(e.sadness * 12); i++) {
        particles.push({
            x: cx + (Math.random() - 0.5) * pCanvas.width * 0.8,
            y: -10,  // Start above the canvas
            vx: (Math.random() - 0.5) * 0.5, vy: 0.8 + Math.random() * 1.2,
            life: 130 + Math.random() * 60, maxLife: 190,
            color: `hsl(${210 + Math.random() * 20},80%,55%)`,  // Blue range
            size: 2.5, gravity: 0.02, drag: 0.995,
        });
    }

    // Fear: erratic particles that change direction randomly
    for (let i = 0; i < Math.floor(e.fear * 16); i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
            x: cx + Math.cos(angle) * (50 + Math.random() * 150),
            y: cy + Math.sin(angle) * (50 + Math.random() * 150),
            vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
            life: 25 + Math.random() * 25, maxLife: 50,
            color: `hsl(${270 + Math.random() * 30},90%,60%)`,  // Purple range
            size: 1.8, gravity: 0, drag: 0.93, erratic: true,   // erratic flag triggers random nudges
        });
    }

    // Surprise: radial burst evenly spaced around a circle from centre
    const surCount = Math.floor(e.surprise * 25);
    for (let i = 0; i < surCount; i++) {
        const angle = (i / Math.max(surCount, 1)) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 3 + Math.random() * 5;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: 45 + Math.random() * 30, maxLife: 75,
            color: `hsl(${180 + Math.random() * 40},100%,85%)`,  // Cyan-white
            size: 2, gravity: 0, drag: 0.97,
        });
    }

    // Disgust: wavy upward-moving particles with sinusoidal x-motion
    for (let i = 0; i < Math.floor(e.disgust * 14); i++) {
        particles.push({
            x: cx + (Math.random() - 0.5) * pCanvas.width * 0.6,
            y: cy + (Math.random() - 0.5) * pCanvas.height * 0.4,
            vx: 0, vy: -1 - Math.random(),
            life: 90 + Math.random() * 40, maxLife: 130,
            color: `hsl(${100 + Math.random() * 40},75%,50%)`,  // Green range
            size: 2, gravity: 0, drag: 0.985,
            phase: Math.random() * Math.PI * 2,  // phase drives sinusoidal x-wobble
        });
    }
}

/**
 * Update and render all particles on the 2D overlay canvas.
 *
 * Called every frame from the render() loop. Each particle has:
 *   - Position (x, y) + velocity (vx, vy)
 *   - Drag (velocity multiplier each frame, < 1 = slows down)
 *   - Gravity (added to vy each frame, can be negative for upward float)
 *   - Life/maxLife (alpha fades out as life decreases)
 *   - Optional: erratic (random velocity nudges), phase (sinusoidal x-wobble)
 */
function updateParticles() {
    // Sync the 2D canvas size with its CSS dimensions
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

        // Fear: random velocity nudges (30% chance per frame)
        if (p.erratic && Math.random() < 0.3) {
            p.vx += (Math.random() - 0.5) * 2;
            p.vy += (Math.random() - 0.5) * 2;
        }
        // Disgust: sinusoidal x-wobble using the particle's phase
        if (p.phase !== undefined) p.vx = Math.sin(p.phase + p.life * 0.1) * 1.5;

        // Apply physics
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;

        // Draw the particle with fading alpha
        const alpha = p.life / p.maxLife;
        pCtx.globalAlpha = alpha;
        pCtx.fillStyle = p.color;
        pCtx.shadowBlur = 6;          // Soft glow effect
        pCtx.shadowColor = p.color;
        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        pCtx.fill();
    }
    // Reset shadow/alpha for clean state
    pCtx.shadowBlur = 0;
    pCtx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Main render loop
// ---------------------------------------------------------------------------

/**
 * The main animation loop, called every frame via requestAnimationFrame.
 *
 * Each frame:
 *   1. Sync canvas size with CSS (handles window resizes)
 *   2. Compute the macro cycle (0-1 over 10 seconds)
 *   3. Smooth emotion values toward their targets (95% old + 5% new)
 *   4. Upload all uniforms to the GPU
 *   5. Draw the full-screen quad (triggers the fragment shader)
 *   6. Update and render the 2D particle overlay
 *
 * @param {number} time — timestamp in milliseconds from requestAnimationFrame
 */
function render(time) {
    // Sync WebGL canvas size with its CSS layout size
    if (canvas.width !== canvas.clientWidth) canvas.width = canvas.clientWidth;
    if (canvas.height !== canvas.clientHeight) canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Macro cycle: a slow 10-second loop that creates structural variation
    const macroCycle = (time % 10000) / 10000;

    // Smooth emotion interpolation: 95% current + 5% target each frame.
    // At 60fps this reaches ~87% of the target after 1 second.
    Object.keys(tar).forEach(key => cur[key] = cur[key] * 0.95 + tar[key] * 0.05);

    // Upload uniforms to the shader
    gl.uniform1f(loc.t, time * 0.001);        // Time in seconds
    gl.uniform1f(loc.macro, macroCycle);       // 0-1 slow cycle
    gl.uniform2f(loc.res, canvas.width, canvas.height);
    // Slowly drifting centre point for gentle camera movement
    gl.uniform2f(loc.center, Math.sin(time * 0.0006) * 0.3, Math.cos(time * 0.0004) * 0.2);
    // Pass each smoothed emotion score as its own uniform
    Object.keys(cur).forEach(key => gl.uniform1f(loc[key], cur[key]));

    // Draw the full-screen quad — this triggers the fragment shader for every pixel
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Update the 2D particle overlay
    updateParticles();

    requestAnimationFrame(render);
}
requestAnimationFrame(render);
