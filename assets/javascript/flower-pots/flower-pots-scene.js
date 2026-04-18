/**
 * Flower-pots scene — rendering engine for the Zen Pots art theme.
 *
 * Credit — inspired by the original "Zen Pots" concept by newyellow.
 *
 * Rendering approach:
 *   1. `buildScene()` creates three off-screen p5 `createGraphics()` layers
 *      (back / mid / front) and fills a command `queue` describing every
 *      dot, line, stem, and flower to draw.
 *   2. The main app (`flower-pots-app.js`) calls `drawQueueStep()` N times
 *      per frame so the scene paints in progressively — it looks like the
 *      pots are being drawn by hand over 1–2 seconds rather than appearing
 *      instantly. `stepsPerFrame` auto-scales with queue length.
 *   3. When the queue finishes, `compositeScene()` stacks the three layers
 *      onto the main canvas: back (background dots + back-facing pot dots),
 *      mid (sticks + plant accents), front (front-facing pot dots).
 *
 * Libraries used:
 *   - p5.js (globals): `createGraphics`, `randomSeed`, `noiseSeed`, `noise`,
 *     `lerp`, `dist`, `sin`, `cos`, `radians`, `atan2`, etc.
 *   - p5's HSB colour mode — `colorMode(HSB, 360, 100, 100, 1)` on each layer.
 *
 * Data contracts:
 *   - Depends on `flower-pots-data.js` for: `buildColorSet`, `dominantEntry`,
 *     `buildPotEmotionSequence`, `buildPlantEmotionMix`, `chooseEmotionFromMix`,
 *     `branchCountForEmotion`, `flowerDensityForMap`, `PotData`, `StickObj`,
 *     `CURVES_IN`, `CURVES_OUT`, `dotDensity`, `lineDensity`, `stickDotDensity`,
 *     `zenState`.
 */

/**
 * Build a fresh scene object for the given emotion map.
 * The scene is static data — no drawing happens here. `drawQueueStep()`
 * consumes `scene.queue` over subsequent frames.
 *
 * @param {object} map  emotion map `{anger, disgust, fear, joy, neutral, sadness, surprise}`
 * @returns {object}    scene descriptor consumed by the app controller
 */
function buildScene(map) {
    // Seed p5's random/noise so a scene is deterministic given the seed —
    // this is stored so the gallery can optionally re-render the same scene.
    const seed = Math.floor(Math.random() * 1000000000);
    randomSeed(seed);
    noiseSeed(seed);

    const colorSet = buildColorSet(map);
    const dominant = dominantEntry(map)[0];

    // Three layered off-screen canvases. Drawing into layers (rather than
    // straight to the main canvas) lets us control z-order cheaply and
    // "freeze" finished work while the queue progressively adds more.
    const backLayer = createGraphics(width, height);
    const midLayer = createGraphics(width, height);
    const frontLayer = createGraphics(width, height);

    // Each layer needs its own HSB colour mode; p5 doesn't inherit it.
    backLayer.colorMode(HSB, 360, 100, 100, 1);
    midLayer.colorMode(HSB, 360, 100, 100, 1);
    frontLayer.colorMode(HSB, 360, 100, 100, 1);
    backLayer.background(colorSet.bgColor.h, colorSet.bgColor.s, colorSet.bgColor.b);

    // Pots sit on an imaginary shelf at 63% of canvas height.
    const baseHeight = height * 0.63;
    const queue = [];
    paintBackgroundDots(backLayer, colorSet, baseHeight);

    // Pot count scales with viewport width. Clamp to [9,12] to keep the
    // composition readable on both phones and desktops.
    const potCount = min(12, max(9, floor(width / 110)));
    // Decide which emotion each pot will render as (dominant/secondary mix).
    const potKeys = buildPotEmotionSequence(map, potCount);
    const plantMix = buildPlantEmotionMix(map);
    const clusterWidth = min(width * 0.78, 980);
    const potWidth = clusterWidth / potCount;
    const overlap = 0.7;  // pots overlap horizontally by 30% for a packed shelf feel
    const occupiedWidth = potWidth * ((potCount - 1) * overlap + 1);
    const clusterStart = (width - occupiedWidth) * 0.5; // centre the cluster horizontally

    const pots = potKeys.map((emotionKey, index) => {
        const influence = map[emotionKey];
        const potX = clusterStart + potWidth * 0.5 + index * potWidth * overlap;
        // Tiny vertical jitter so pots don't look like they're on a perfect line.
        // `sin(index*0.9)` adds a gentle wave that varies with pot index.
        const baseOffset = random(-height * 0.006, height * 0.008) + sin(index * 0.9) * height * 0.002;
        const potY = baseHeight + baseOffset;
        // Pot height scales with: base random × sadness (taller when sad) × joy (shorter when joyful)
        // × dominant emotion influence.
        const potHeight = random(0.62, 1.04) * potWidth * (1 + map.sadness * 0.18 - map.joy * 0.08 + influence * 0.08);
        const potData = new PotData(potX, potY, potWidth * 0.225, potHeight, emotionKey, map, 100 + index * 37);
        const edgeCurves = buildEdgeCurves(potData, emotionKey);
        const potMeta = { plantMix, influence };
        queuePotCommands(queue, potData, edgeCurves, colorSet, potMeta);
        return { potData, edgeCurves, potMeta };
    });

    return {
        seed,
        colorSet,
        dominant,
        themeLabel: colorSet.label,
        baseHeight,
        backLayer,
        midLayer,
        frontLayer,
        queue,
        queueIndex: 0,
        completed: false,
        // Aim for ~90 frames to fully paint the scene (≈1.5s at 60fps).
        // Clamp so tiny scenes still feel progressive and huge ones don't stall.
        stepsPerFrame: constrain(floor(queue.length / 90), 36, 110),
        pots,
    };
}

/**
 * Sprinkle small dots above the pot shelf to suggest a hazy textured wall.
 * Uses `tan(random(TWO_PI))` to bias density near the baseline — tan is
 * near-zero for most angles but shoots up near ±π/2, creating clustered
 * stipples without uniform grid artefacts.
 */
function paintBackgroundDots(layer, colorSet, baseHeight) {
    const bgHeight = 0.16 * height;
    const xCount = floor(width * 0.58);
    // Dark theme uses lower-alpha dots so they read as "neon haze" rather than strong stipples.
    const dotAlpha = colorSet.darkTheme ? 0.42 : 0.95;

    for (let x = 0; x < xCount; x++) {
        const yDotCount = floor(bgHeight * dotDensity * 0.42);
        for (let y = 0; y < yDotCount; y++) {
            const nowX = x * (width / max(1, xCount - 1));
            const nowY = baseHeight - bgHeight * tan(random(TWO_PI)) - 0.26 * height;
            layer.noFill();
            layer.stroke(colorSet.bgDotColor.h, colorSet.bgDotColor.s, colorSet.bgDotColor.b, dotAlpha);
            layer.circle(nowX, nowY, random(0.2, 2.4));
        }
    }
}

/**
 * Pick an easing curve for each consecutive pair of edge points on a pot.
 * Joy/anger/surprise use outward-bulging curves (bold silhouettes),
 * others use inward-pinching curves (softer silhouettes). Alternates
 * in/out on each segment to avoid flat-bellied silhouettes.
 */
function buildEdgeCurves(potData, emotionKey) {
    const edgeCurves = [];
    let isOutCurve = emotionKey === 'joy' || emotionKey === 'anger' || emotionKey === 'surprise';

    for (let i = 0; i < potData.edgePoints.length - 1; i++) {
        const pool = isOutCurve ? CURVES_OUT : CURVES_IN;
        edgeCurves.push(pool[int(random(pool.length))]);
        isOutCurve = !isOutCurve;
    }

    return edgeCurves;
}

/**
 * Walk the pot's silhouette points and push draw commands onto the queue:
 *   - One `curve-line` + matching `curve-line-dots` per edge segment.
 *   - After the silhouette, push the plant/stick commands.
 */
function queuePotCommands(queue, potData, edgeCurves, colorSet, potMeta) {
    for (let i = 0; i < potData.edgePoints.length - 1; i++) {
        const nowPoint = potData.edgePoints[i];
        const nextPoint = potData.edgePoints[i + 1];
        queueEdgeSegment(queue, potData.x, potData.y - nowPoint.y, nowPoint.x, potData.x, potData.y - nextPoint.y, nextPoint.x, edgeCurves[i], colorSet);
        queueSegmentDots(queue, potData.x, potData.y - nowPoint.y, nowPoint.x, potData.x, potData.y - nextPoint.y, nextPoint.x, edgeCurves[i], colorSet);
    }

    queuePlant(queue, potData, colorSet, potMeta.plantMix, potMeta.influence);
}

/**
 * Queue a series of horizontal "rings" (as curved lines) between two
 * silhouette points. Each ring is later rendered as a ring of dots,
 * simulating the cross-section of the pot at that height.
 *
 * Two commands are pushed per line — one with a wide stroke (outer skin)
 * and one with a thin stroke (inner highlight) so the pot gets a
 * glazed/porcelain look.
 */
function queueEdgeSegment(queue, fromX, fromY, fromDist, toX, toY, toDist, curveFunc, colorSet) {
    const lineCount = max(8, floor(lineDensity * dist(fromX, fromY, toX, toY)));
    for (let i = 0; i < lineCount; i++) {
        const t = i / lineCount;
        const centerX = lerp(fromX, toX, t);
        const centerY = lerp(fromY, toY, t);
        // `curveFunc(t)` eases the radius along the segment so the pot
        // silhouette curves in/out rather than interpolating linearly.
        const nowDist = lerp(fromDist, toDist, curveFunc(t));
        const leftX = centerX - nowDist;
        const rightX = centerX + nowDist;
        const curveHeight = abs(leftX - rightX) * 0.24;

        queue.push(
            { type: 'curve-line', leftX, leftY: centerY, rightX, rightY: centerY, curveHeight, color: colorSet.potStrokeColorA, thickness: 12 },
            { type: 'curve-line', leftX, leftY: centerY, rightX, rightY: centerY, curveHeight, color: colorSet.potInsideColorA, thickness: 3 }
        );
    }
}

/**
 * Queue the "rim highlight" dots — small bright specks along the pot rim
 * that catch the light. Rendered on top of the edge rings.
 */
function queueSegmentDots(queue, fromX, fromY, fromDist, toX, toY, toDist, curveFunc, colorSet) {
    const lineCount = max(8, floor(lineDensity * dist(fromX, fromY, toX, toY)));
    for (let i = 0; i < lineCount; i++) {
        const t = i / lineCount;
        const centerX = lerp(fromX, toX, t);
        const centerY = lerp(fromY, toY, t);
        const nowDist = lerp(fromDist, toDist, curveFunc(t));

        queue.push({
            type: 'curve-line-dots',
            leftX: centerX - nowDist,
            leftY: centerY,
            rightX: centerX + nowDist,
            rightY: centerY,
            curveHeight: abs(nowDist * 2) * 0.24,
            color: colorSet.potEdgeDotColor,
            thickness: 1,
        });
    }
}

/**
 * Queue the plant(s) sticking out of a pot: 1–N branches, each branch
 * is a multi-segment "stick" (from StickObj) whose nodes each potentially
 * carry a flower/plant accent.
 *
 * Each branch picks its own emotion from the plant mix so a single pot
 * can sprout flowers of several emotions (e.g., one sad, one joyful),
 * giving mixed moods visual variety.
 */
function queuePlant(queue, potData, colorSet, plantMix, fallbackInfluence) {
    const flowerDensity = flowerDensityForMap(zenState.current);
    // Use the most branch-heavy emotion in the mix as branch count —
    // keeps pots with joyful/surprised elements busy, sad-only pots sparse.
    const branchCount = max(1, ...plantMix.map(entry => branchCountForEmotion(entry.key)));
    const baseRadius = potData.edgePoints[0].x;
    const endRadius = potData.edgePoints[potData.edgePoints.length - 1].x;
    const endYOffset = potData.edgePoints[potData.edgePoints.length - 1].y;

    for (let branchIndex = 0; branchIndex < branchCount; branchIndex++) {
        const plantType = chooseEmotionFromMix(plantMix);
        const branchInfluence = zenState.current[plantType] || fallbackInfluence;
        // `baseAngleT` ∈ [0.58, 0.82] → base of the branch on the upper half of the pot rim.
        const baseAngleT = random(0.58, 0.82);
        // End angle biased left or right so branches lean, don't always point up.
        const endAngleT = random() < 0.5 ? random(0.18, 0.38) : random(0.62, 0.84);
        const angleSpread = branchCount > 1 ? map(branchIndex, 0, branchCount - 1, -0.12, 0.12) : 0;
        const startX = potData.x + baseRadius * sin(radians(lerp(90, 270, baseAngleT + angleSpread)));
        const startY = potData.y + baseRadius * 0.24 * -cos(radians(lerp(90, 270, baseAngleT + angleSpread)));
        const endX = potData.x + endRadius * sin(radians(lerp(90, 270, endAngleT + angleSpread)));
        const endY = potData.y - endYOffset + endRadius * 0.24 * -cos(radians(lerp(90, 270, endAngleT + angleSpread)));
        const stickX = lerp(startX, endX, 0.9);
        const stickY = lerp(startY, endY, 0.9);
        const stickAngle = getAngle(startX, startY, endX, endY);
        // Joy/surprise grow tall plants; others are shorter.
        const lengthScale = plantType === 'joy' || plantType === 'surprise' ? random(1.55, 2.9) : random(0.95, 1.8);
        const stickLength = lengthScale * endYOffset * (0.82 + branchInfluence * 0.28);
        const stickObj = new StickObj(stickX, stickY, stickAngle, stickLength);

        stickObj.nodes.forEach(node => queuePlantNode(queue, node, colorSet, plantType, flowerDensity, branchInfluence));
    }
}

/**
 * Queue the draw commands for one node of a plant stick:
 *   1. The stem segment itself (`stick-branch`).
 *   2. Optionally 0..N flower accents (`plant-accent`) based on emotion
 *      and depth — deeper/further-from-root nodes are more likely to bloom.
 *
 * Sad plants bloom rarely; angry/disgust plants get extra density.
 */
function queuePlantNode(queue, node, colorSet, plantType, flowerDensity, branchInfluence) {
    queue.push({
        type: 'stick-branch',
        x1: node.x1,
        y1: node.y1,
        x2: node.x2,
        y2: node.y2,
        thickness: node.nodeDepth <= 2 ? 2 : 3,
        color: colorSet.stickColor,
    });

    const sparseMood = plantType === 'sadness';
    // Density booster per emotion — anger/disgust get aggressive accent counts.
    const densityBoost = plantType === 'anger'
        ? 1.85
        : plantType === 'disgust'
            ? 1.8
            : plantType === 'fear'
                ? 1.35
                : plantType === 'neutral'
                    ? 1.28
                    : 1;

    // Probability of this node getting any accents at all.
    const accentChance = sparseMood
        ? constrain(0.01 + branchInfluence * 0.05 + flowerDensity * 0.08 - node.nodeDepth * 0.1, 0.005, 0.08)
        : constrain(0.16 + branchInfluence * 0.22 + flowerDensity * 0.72 - node.nodeDepth * 0.05, 0.1, 0.88);

    // Bail early if node is too deep or roll fails.
    if (node.nodeDepth > 3 || random() >= constrain(accentChance * densityBoost, 0.005, 0.95)) {
        return;
    }

    // How many accent "bursts" to place on this node.
    const accentBursts = sparseMood
        ? 1
        : max(
            1,
            floor(
                lerp(1, 5, flowerDensity)
                + (plantType === 'joy' || plantType === 'surprise' ? 1 : 0)
                + (plantType === 'anger' || plantType === 'disgust' ? 1 : 0)
            )
        );

    for (let i = 0; i < accentBursts; i++) {
        queue.push({
            type: 'plant-accent',
            plantType,
            x1: node.x1,
            y1: node.y1,
            x2: node.x2,
            y2: node.y2,
            color: colorSet.flowerColor,
            glow: colorSet.glowColor,
        });
    }
}

/**
 * Dispatch one command from the queue to the appropriate draw function.
 * Called repeatedly per frame by the app controller until `queueIndex`
 * reaches `queue.length`.
 */
function drawQueueStep(scene, step) {
    if (step.type === 'curve-line') {
        drawCurveLine(scene, step.leftX, step.leftY, step.rightX, step.rightY, step.curveHeight, step.color, step.thickness);
        return;
    }
    if (step.type === 'curve-line-dots') {
        drawCurveLineDots(scene, step.leftX, step.leftY, step.rightX, step.rightY, step.curveHeight, step.color, step.thickness);
        return;
    }
    if (step.type === 'stick-branch') {
        drawStickBranch(scene.midLayer, step.x1, step.y1, step.x2, step.y2, step.thickness, step.color);
        return;
    }
    if (step.type === 'plant-accent') {
        drawPlantAccent(scene, step);
    }
}

/**
 * Draw one elliptical ring of dots representing a pot cross-section.
 * Front-facing dots (angles 90°-270°) go to `frontLayer` so they paint
 * over plants/sticks; back-facing dots go to `backLayer`. This gives
 * the illusion of 3D depth without actual 3D maths.
 *
 * `ellipseRadius` is Ramanujan's approximation for an ellipse perimeter
 * (2π√((r1²+r2²)/2)) — used to size the dot count to the ring's length.
 */
function drawCurveLine(scene, x1, y1, x2, y2, curveHeight, dotColor, thickness) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const r1 = abs(x2 - x1) / 2;
    const r2 = curveHeight;
    const ellipseRadius = 2 * PI * sqrt((r1 * r1 + r2 * r2) / 2);
    const dotCount = max(8, int(ellipseRadius * dotDensity * 0.72));

    for (let i = 0; i < dotCount; i++) {
        const t = i / max(1, dotCount - 1);
        const nowAngle = lerp(0, 360, t);
        const x = centerX + r1 * sin(radians(nowAngle));
        const y = centerY + r2 * -cos(radians(nowAngle));
        // Brightness pulse — dots in the front-middle get lighter (fake highlight).
        const briAddRatio = sin(radians(lerp(0, 180, t)));
        const dotSize = noise(centerX * 0.01, centerY * 0.01, nowAngle * 0.04) * (thickness * 0.72) + 1.2;
        const targetLayer = nowAngle > 90 && nowAngle < 270 ? scene.frontLayer : scene.backLayer;
        targetLayer.noStroke();
        targetLayer.fill(dotColor.h, dotColor.s, constrain(dotColor.b + briAddRatio * 18, 0, 100), 0.95);
        targetLayer.circle(x, y, dotSize);
    }
}

/**
 * Draw the rim highlights along the front-facing half of a ring.
 * `random(random(random()))` biases distribution towards 0 (most dots
 * near the middle of the rim), giving a natural-looking spark spread.
 */
function drawCurveLineDots(scene, x1, y1, x2, y2, curveHeight, dotColor, thickness) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const r1 = abs(x2 - x1) / 2;
    const r2 = curveHeight;

    for (let i = 0; i < 44; i++) {
        const nowAngle = lerp(90, 270, 1 - random(random(random())));
        const x = centerX + r1 * sin(radians(nowAngle));
        const y = centerY + r2 * -cos(radians(nowAngle));
        const dotSize = noise(centerX * 0.01, centerY * 0.01, nowAngle * 0.04) * thickness + 0.8;
        scene.frontLayer.noStroke();
        scene.frontLayer.fill(dotColor.h, dotColor.s, dotColor.b, 0.9);
        scene.frontLayer.circle(x, y, dotSize);
    }
}

/**
 * Paint a plant stem segment as a trail of dots along the line,
 * with tiny Perlin-noise offsets perpendicular to the line so the
 * stem looks hand-drawn rather than mechanical.
 */
function drawStickBranch(layer, x1, y1, x2, y2, thickness, colorValue) {
    const dotCount = max(6, dist(x1, y1, x2, y2) * stickDotDensity);
    layer.noStroke();
    layer.fill(colorValue.h, colorValue.s, colorValue.b, 0.94);

    for (let i = 0; i < dotCount; i++) {
        const t = i / max(1, dotCount - 1);
        let nowX = lerp(x1, x2, t);
        let nowY = lerp(y1, y2, t);
        // Perpendicular jitter using the line's normal angle (+90° from direction).
        const normalAngle = getAngle(x1, y1, x2, y2) + 90;
        nowX += sin(radians(normalAngle)) * noise(nowX * 0.1, nowY * 0.1, 666) * thickness;
        nowY -= cos(radians(normalAngle)) * noise(nowX * 0.1, nowY * 0.1, 999) * thickness;
        layer.circle(nowX, nowY, noise(nowX * 0.6, nowY * 0.6) * thickness + thickness * 0.35);
    }
}

/**
 * Dispatch plant accent drawing based on the plant's emotion.
 * Each emotion has its own distinctive visual vocabulary:
 *   - joy: blooming flower with petals and a bright centre
 *   - sadness: a single droopy elongated droplet
 *   - anger: ember / flare bursts
 *   - fear: erratic thin lines pointing outwards
 *   - disgust: lumpy spiral curves
 *   - surprise: starburst with central bead
 *   - neutral: plain soft ellipse
 */
function drawPlantAccent(scene, step) {
    const xPos = lerp(step.x1, step.x2, random(0.45, 1));
    const yPos = lerp(step.y1, step.y2, random(0.1, 0.9));
    const layer = scene.midLayer;
    // Pre-compute jittered base/glow HSB so each accent is unique.
    const baseHue = (step.color.h + random(-8, 8) + 360) % 360;
    const baseSat = constrain(step.color.s + random(-8, 8), 0, 100);
    const baseBri = constrain(step.color.b + random(-8, 8), 0, 100);
    const glowHue = (step.glow.h + random(-10, 10) + 360) % 360;
    const glowSat = constrain(step.glow.s + random(-8, 8), 0, 100);
    const glowBri = constrain(step.glow.b + random(-6, 6), 0, 100);

    if (step.plantType === 'joy') {
        drawJoyAccent(layer, xPos, yPos, step.color, baseSat, baseBri, glowHue, glowSat, glowBri);
        return;
    }
    if (step.plantType === 'sadness') {
        layer.noStroke();
        layer.fill(baseHue, constrain(baseSat - 12, 0, 100), baseBri, 0.88);
        layer.ellipse(xPos, yPos + 5, 6, 14); // tall thin droplet pointing down
        return;
    }
    if (step.plantType === 'anger') {
        drawAngerAccent(layer, xPos, yPos);
        return;
    }
    if (step.plantType === 'fear') {
        // Thin jagged lines shooting out at noise-driven angles.
        layer.stroke(glowHue, constrain(glowSat - 12, 0, 100), glowBri, 0.9);
        layer.strokeWeight(1);
        for (let i = 0; i < 4; i++) {
            const dx = noise(xPos * 0.02, yPos * 0.02, i * 0.2) * 12 - 6;
            const dy = 8 + noise(xPos * 0.01, yPos * 0.01, i * 0.4) * 8;
            layer.line(xPos, yPos, xPos + dx, yPos - dy);
        }
        return;
    }
    if (step.plantType === 'disgust') {
        // Inward spiral curve — lumpy, twisted organic shape.
        layer.noFill();
        layer.stroke(baseHue, constrain(baseSat - 8, 0, 100), constrain(baseBri - 4, 0, 100), 0.9);
        layer.strokeWeight(1.3);
        layer.beginShape();
        for (let i = 0; i < 14; i++) {
            const t = i / 13;
            const angle = t * TWO_PI * 1.2;
            const r = 1 + t * 7;
            layer.curveVertex(xPos + cos(angle) * r, yPos + sin(angle) * r);
        }
        layer.endShape();
        return;
    }
    if (step.plantType === 'surprise') {
        // 8-pointed starburst with central bead — like a spark going off.
        layer.stroke(glowHue, glowSat, glowBri, 0.92);
        layer.strokeWeight(1);
        for (let i = 0; i < 8; i++) {
            const angle = TWO_PI * (i / 8);
            layer.line(xPos, yPos, xPos + cos(angle) * 10, yPos + sin(angle) * 10);
        }
        layer.noStroke();
        layer.fill(baseHue, baseSat, baseBri, 0.94);
        layer.circle(xPos, yPos, 5);
        return;
    }

    // Neutral fallback — a plain soft ellipse.
    layer.noStroke();
    layer.fill(baseHue, constrain(baseSat - 18, 0, 100), constrain(baseBri - 6, 0, 100), 0.9);
    layer.ellipse(xPos, yPos, 9, 5);
}

/**
 * Draw a joy bloom — picks one of four flower archetypes at random:
 *   0: star flower — 6-9 petals around a centre
 *   1: daisy — 8-12 petals with hue-shift sweep
 *   2: cluster — 3 overlapping buds
 *   3: 5-petal starburst with halo
 *
 * Each type is HSB-jittered per render so no two joy flowers are identical.
 */
function drawJoyAccent(layer, xPos, yPos, colorValue, baseSat, baseBri, glowHue, glowSat, glowBri) {
    const joyAccentChoices = [
        { h: colorValue.h, s: colorValue.s - 10, b: colorValue.b + 4 },
        { h: 34, s: 42, b: 100 },
        { h: 18, s: 34, b: 100 },
    ];
    const joyChoice = random(joyAccentChoices);
    const joyHue = (joyChoice.h + random(-3, 3) + 360) % 360;
    const joySat = constrain(joyChoice.s + random(-5, 5), 0, 100);
    const joyBri = constrain(joyChoice.b + random(-4, 3), 0, 100);
    const joyCenterHue = (joyHue + random(-2, 2) + 360) % 360;
    const bloomType = floor(random(4));
    layer.noStroke();

    if (bloomType === 0) {
        const petals = floor(random(6, 9));
        const radius = random(4.5, 7);
        for (let i = 0; i < petals; i++) {
            const angle = TWO_PI * (i / petals);
            layer.fill((joyHue + random(-6, 6) + 360) % 360, joySat, joyBri, 0.92);
            layer.ellipse(xPos + cos(angle) * radius, yPos + sin(angle) * radius, 8.5, 4.4);
        }
        layer.fill(joyCenterHue, constrain(baseSat + 8, 0, 100), constrain(baseBri - 8, 0, 100), 0.96);
        layer.circle(xPos, yPos, 5.5);
        return;
    }

    if (bloomType === 1) {
        const petals = floor(random(8, 12));
        for (let i = 0; i < petals; i++) {
            const angle = TWO_PI * (i / petals);
            const petalLength = random(6, 10);
            // Hue sweeps around the bloom (i * 1.5-3.5°) giving a rainbow petal look.
            layer.fill((joyHue + i * random(1.5, 3.5) + 360) % 360, constrain(joySat + 4, 0, 100), joyBri, 0.9);
            layer.ellipse(xPos + cos(angle) * (petalLength * 0.55), yPos + sin(angle) * (petalLength * 0.55), petalLength, 3.2);
        }
        layer.fill((glowHue + random(-8, 8) + 360) % 360, constrain(glowSat - 6, 0, 100), glowBri, 0.95);
        layer.circle(xPos, yPos, 4.2);
        return;
    }

    if (bloomType === 2) {
        for (let i = 0; i < 3; i++) {
            const budAngle = random(-1.3, 1.3);
            const budRadius = random(4, 8);
            layer.fill((joyHue + random(-10, 10) + 360) % 360, joySat, joyBri, 0.9);
            layer.circle(xPos + cos(budAngle) * budRadius, yPos + sin(budAngle) * budRadius, random(4, 7));
        }
        layer.fill((joyCenterHue + 12) % 360, constrain(baseSat - 6, 0, 100), constrain(baseBri + 2, 0, 100), 0.94);
        layer.circle(xPos, yPos, 4.8);
        return;
    }

    // Default: 5-petal starburst with 3 glow speckles around the centre.
    for (let i = 0; i < 5; i++) {
        const angle = TWO_PI * (i / 5) + random(-0.12, 0.12);
        layer.fill((joyHue + random(-6, 6) + 360) % 360, joySat, joyBri, 0.92);
        layer.ellipse(xPos + cos(angle) * 5.5, yPos + sin(angle) * 5.5, 7.2, 3.8);
    }
    for (let i = 0; i < 3; i++) {
        layer.fill((glowHue + random(-8, 8) + 360) % 360, constrain(glowSat - 10, 0, 100), constrain(glowBri + 2, 0, 100), 0.85);
        layer.circle(xPos + random(-3, 3), yPos + random(-3, 3), random(2.5, 4.5));
    }
    layer.fill(joyCenterHue, constrain(baseSat + 2, 0, 100), constrain(baseBri - 6, 0, 100), 0.95);
    layer.circle(xPos, yPos, 4.6);
}

/**
 * Draw an anger ember — a small burning spark.
 *   - Flare lines spray upward from the centre in an arc.
 *   - Three concentric ember circles (soft halo → core → bright speckle)
 *     give the feeling of glowing coals.
 */
function drawAngerAccent(layer, xPos, yPos) {
    const emberHue = (16 + random(-4, 3) + 360) % 360;
    const emberSat = 72 + random(-5, 5);
    const emberBri = 64 + random(-5, 5);
    const flareCount = floor(random(3, 5));
    const flareRadius = random(5, 8);

    // Flare lines — directed upward (-HALF_PI) with a small angle spread.
    layer.stroke(emberHue, emberSat, constrain(emberBri - 10, 0, 100), 0.95);
    layer.strokeWeight(1.1);
    for (let i = 0; i < flareCount; i++) {
        const angle = -HALF_PI + map(i, 0, max(1, flareCount - 1), -0.75, 0.75) + random(-0.12, 0.12);
        layer.line(xPos, yPos, xPos + cos(angle) * flareRadius, yPos + sin(angle) * flareRadius);
    }

    // Ember body: soft halo → bright core → hot speckle slightly off-centre.
    layer.noStroke();
    layer.fill(emberHue, constrain(emberSat + 6, 0, 100), constrain(emberBri + 10, 0, 100), 0.55);
    layer.circle(xPos, yPos, 8);
    layer.fill(emberHue, constrain(emberSat + 10, 0, 100), constrain(emberBri + 14, 0, 100), 0.95);
    layer.circle(xPos, yPos, 5);
    layer.fill((emberHue + 6) % 360, constrain(emberSat - 8, 0, 100), constrain(emberBri + 22, 0, 100), 0.95);
    layer.circle(xPos + random(-0.8, 0.8), yPos + random(-0.8, 0.8), 2.6);
}

/**
 * Recursive stick generator — builds a branching polyline starting at (x, y).
 * Each call draws one segment then optionally recurses 1 or 2 child segments
 * at slight angle deviations, decrementing `maxNodeDepth` until 0.
 *
 * Each recursion produces a "node" record: `{x1,y1,x2,y2,dir,length,nodeDepth}`.
 * 50% chance of two-way branch, 50% of single continuation — so some sticks
 * fork heavily, others grow straight. Length shrinks to 60-95% per generation.
 */
function getStick(x, y, dir, lengthValue, maxNodeDepth) {
    const toX = x + lengthValue * sin(radians(dir));
    const toY = y + lengthValue * -cos(radians(dir));
    const nodes = [{ x1: x, y1: y, x2: toX, y2: toY, dir, length: lengthValue, nodeDepth: maxNodeDepth }];

    if (maxNodeDepth <= 0) return nodes;

    if (random() < 0.5) {
        // Two-way branch — one goes left, one right. 50% chance of one being stubby.
        let leftMin = 0.6;
        let rightMin = 0.6;
        if (random() < 0.5) leftMin = 0.1;
        else rightMin = 0.1;

        getStick(toX, toY, dir + random(-20, -6), lengthValue * random(leftMin, 0.95), maxNodeDepth - 1).forEach(node => nodes.push(node));
        getStick(toX, toY, dir + random(6, 20), lengthValue * random(rightMin, 0.95), maxNodeDepth - 1).forEach(node => nodes.push(node));
        return nodes;
    }

    // Single continuation — random small angle deviation ±20°.
    getStick(toX, toY, dir + random(-20, 20), lengthValue * random(0.6, 0.95), maxNodeDepth - 1).forEach(node => nodes.push(node));
    return nodes;
}

/**
 * Angle from (x1,y1)→(x2,y2) in degrees, rotated so 0° points "up".
 * p5's atan2 returns radians relative to the +X axis; we shift by 90°
 * so the stick generator can interpret `dir` as compass-style heading.
 */
function getAngle(x1, y1, x2, y2) {
    return atan2(y2 - y1, x2 - x1) * 180 / PI + 90;
}

/**
 * Composite the three layers to the main canvas.
 * Order matters: back (bg + back-facing pot dots) → mid (sticks + flowers)
 * → front (front-facing pot dots overlap flowers for depth).
 * Clears with a white background first so partial alpha layers don't pick
 * up stale pixels from the previous frame.
 */
function compositeScene(scene) {
    background(0, 0, 100);
    image(scene.backLayer, 0, 0);
    image(scene.midLayer, 0, 0);
    image(scene.frontLayer, 0, 0);
}
