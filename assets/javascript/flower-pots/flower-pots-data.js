/**
 * Flower-pots data module — constants, classes, and colour/shape helpers.
 *
 * Credit — inspired by the original "Zen Pots" concept by newyellow.
 *
 * This file has no rendering logic; it only defines the data, pigments,
 * and weighting helpers that `flower-pots-scene.js` consumes. Split this
 * way so that the scene file stays focused on drawing (p5.js dot art)
 * while constants and maths live here.
 *
 * Libraries relied on:
 *   - p5.js globals: `random`, `noise`, `radians`, `degrees`, `constrain`, `floor`.
 *     (This file is loaded after p5.js in the page, so those globals exist.)
 *
 * Data model:
 *   - An "emotion map" is `{ anger, disgust, fear, joy, neutral, sadness, surprise }`
 *     with numeric scores in [0,1] summing to ~1 from the classifier.
 *   - `EMOTION_PIGMENTS` maps each emotion to an HSB anchor colour.
 *   - `POT_PROFILE_SETS` gives an array of radius profiles per emotion —
 *     each profile is a list of fractional widths from top→bottom of the pot,
 *     multiplied by the pot's pixel width inside `PotData`.
 */

// --- Easing curves used when interpolating along pot silhouettes.
//     `t` is in [0,1]. "In" = slow start, "Out" = slow end.
//     Kept as small pure functions so profiles can pick one at render time.
const CURVES_IN = [
    x => x * x,                                         // quadratic ease-in
    x => x * x * x,                                     // cubic ease-in
    x => 1 - Math.cos((x * Math.PI) / 2),               // sine ease-in
    x => 1 - Math.sqrt(1 - Math.pow(Math.min(1, x), 2)), // circular ease-in (clamped)
];

const CURVES_OUT = [
    x => 1 - (1 - x) * (1 - x),                 // quadratic ease-out
    x => 1 - Math.pow(1 - x, 3),                // cubic ease-out
    x => Math.sin((x * Math.PI) / 2),           // sine ease-out
    x => Math.sqrt(1 - Math.pow(x - 1, 2)),     // circular ease-out
];

/**
 * Pot silhouette profiles per dominant emotion.
 * Each entry is a list of fractional radii (width multipliers) sampled
 * top-to-bottom. `PotData` randomly picks one profile then jitters it
 * per-point using Perlin noise so no two pots look identical.
 *
 * Design notes per emotion:
 *   joy      — balanced, expressive curves
 *   surprise — taller, flared shoulders
 *   anger    — heavy top, narrow base (aggressive lean)
 *   fear     — thinner, uneven (timid silhouettes)
 *   sadness  — drooping, narrow base
 *   disgust  — wide mid-body, lumpy
 *   neutral  — symmetric, modest curves
 */
const POT_PROFILE_SETS = {
    joy: [
        [0.48, 0.72, 0.98, 0.88, 0.62],
        [0.36, 0.58, 0.82, 1.02, 0.9, 1.08, 0.74],
        [0.64, 0.5, 0.76, 1.04, 0.86, 0.62, 0.82],
        [0.32, 0.42, 0.88, 0.7, 1.02, 0.82, 1.08, 0.72],
        [0.42, 0.84, 1.08, 1.12, 0.98, 0.74, 0.48],
    ],
    surprise: [
        [0.4, 0.58, 0.72, 0.98, 1.12],
        [0.32, 0.46, 0.66, 0.82, 1.02, 1.2, 0.94],
        [0.56, 0.44, 0.52, 0.86, 1.08, 0.74, 1.14],
        [0.26, 0.36, 0.74, 0.62, 1.16, 0.86, 1.2, 0.76],
        [0.52, 0.94, 1.16, 1.08, 0.86, 0.96, 0.54],
    ],
    anger: [
        [0.84, 0.96, 0.91, 0.68, 0.46],
        [0.78, 0.98, 0.86, 0.58, 0.72, 0.5, 0.42],
        [0.64, 0.9, 1.08, 0.82, 0.58, 0.74, 0.48],
        [0.36, 0.42, 0.88, 0.66, 1.06, 0.82, 1.02, 0.56],
        [0.48, 0.9, 1.1, 1.02, 0.86, 0.68, 0.44],
    ],
    fear: [
        [0.46, 0.58, 0.48, 0.6, 0.34],
        [0.34, 0.42, 0.54, 0.5, 0.66, 0.44, 0.3],
        [0.42, 0.52, 0.44, 0.58, 0.5, 0.62, 0.28],
        [0.3, 0.36, 0.62, 0.52, 0.78, 0.48, 0.34],
        [0.42, 0.74, 0.96, 0.9, 0.66, 0.42],
    ],
    sadness: [
        [0.64, 0.74, 0.84, 0.7, 0.42],
        [0.54, 0.7, 0.92, 0.88, 0.62, 0.46],
        [0.72, 0.66, 0.76, 0.9, 0.74, 0.52, 0.36],
        [0.38, 0.46, 0.82, 0.7, 1, 0.76, 0.52],
        [0.5, 0.88, 1.08, 1.04, 0.88, 0.62, 0.38],
    ],
    disgust: [
        [0.52, 0.9, 1.04, 0.78, 0.5],
        [0.46, 0.74, 1, 0.94, 0.72, 0.58],
        [0.58, 0.86, 1.02, 0.82, 0.92, 0.66, 0.46],
        [0.34, 0.48, 0.94, 0.8, 1.06, 0.92, 0.62, 0.44],
        [0.46, 0.86, 1.14, 1.08, 0.94, 0.7, 0.42],
    ],
    neutral: [
        [0.58, 0.76, 0.84, 0.78, 0.58],
        [0.52, 0.68, 0.8, 0.86, 0.78, 0.62],
        [0.72, 0.62, 0.7, 0.84, 0.72, 0.56, 0.62],
        [0.3, 0.38, 0.82, 0.66, 0.96, 0.74, 0.98, 0.64],
        [0.44, 0.96, 1.16, 1.14, 0.98, 0.76, 0.46],
    ],
};

/**
 * HSB anchor pigments per emotion. `h` in [0,360], `s`/`b` in [0,100].
 * `weightedHue` and `weightedColor` use these as fixed reference points
 * and blend them by the emotion scores to derive the actual palette.
 *
 * Chosen to feel natural: warm-orange anger, cool-blue sadness,
 * sunny yellow joy, muted violet fear, and so on.
 */
const EMOTION_PIGMENTS = {
    joy: { h: 46, s: 58, b: 94 },
    surprise: { h: 48, s: 18, b: 98 },
    anger: { h: 16, s: 68, b: 78 },
    fear: { h: 272, s: 26, b: 56 },
    sadness: { h: 214, s: 42, b: 66 },
    disgust: { h: 96, s: 28, b: 58 },
    neutral: { h: 32, s: 18, b: 74 },
};

// --- Dot-art density knobs (0..1). Higher = more dots per area / stroke.
//     Mutated by scene code based on the dominant emotion.
let lineDensity = 0.52;      // density of dots along stick/stem lines
let dotDensity = 0.5;        // density of dots filling background/pot body
let stickDotDensity = 0.55;  // density of dots on plant branch nodes

/**
 * Shared mutable state for the zen-pots scene.
 *  - `current`   : latest smoothed emotion map driving the render
 *  - `scene`     : reference to the built scene graph (pots, sticks, palette)
 *  - `themeMode` : 'light' or 'dark' — chosen by the user in settings,
 *                  controls which colour family (`lightFamilies` vs `darkFamilies`) is used.
 */
let zenState = {
    current: makeEmotionMap({ neutral: 0.72 }),
    scene: null,
    themeMode: 'light',
};

/**
 * Colour wrapper (hue/saturation/brightness/alpha) so scene code can
 * carry a logical colour around without calling p5's `color()` early.
 * Scene code converts to a p5 colour via `color(c.h, c.s, c.b, c.a*255)`
 * once inside `draw()` where HSB mode is active.
 */
class NYColor {
    constructor(h, s, b, a = 1) {
        this.h = h;
        this.s = s;
        this.b = b;
        this.a = a;
    }
}

/**
 * Describes one pot: its anchor position, dimensions, dominant emotion key,
 * and a list of `edgePoints` forming the right-hand silhouette.
 * The scene mirrors these points to the left side when drawing.
 *
 * @param {number} x            centre-x of the pot (pixels)
 * @param {number} y            top-y of the pot (pixels)
 * @param {number} potWidth     max radius of the pot (pixels)
 * @param {number} potHeight    vertical extent of the pot (pixels)
 * @param {string} emotionKey   dominant emotion, picks the profile set
 * @param {object} emotionMap   full emotion map (influences biases/jitter)
 * @param {number} seedOffset   per-pot Perlin noise seed so pots differ
 */
class PotData {
    constructor(x, y, potWidth, potHeight, emotionKey, emotionMap, seedOffset) {
        this.x = x;
        this.y = y;
        this.emotionKey = emotionKey;
        this.edgePoints = [];

        // Pick one profile at random from the emotion's profile set
        // (fallback to neutral if emotion key not recognised).
        const profileSet = POT_PROFILE_SETS[emotionKey] || POT_PROFILE_SETS.neutral;
        const profile = random(profileSet);

        // Biases nudge the silhouette based on the *other* emotions too,
        // so a "sad joy" pot differs subtly from a "pure joy" pot.
        const waistBias = emotionMap.sadness * 0.05 - emotionMap.joy * 0.03;       // pinches waist when sad
        const shoulderBias = emotionMap.anger * 0.04 + emotionMap.surprise * 0.05; // flares shoulder when angry/surprised

        for (let i = 0; i < profile.length; i++) {
            const t = i / (profile.length - 1);
            const anchor = profile[i];
            // Apply shoulder/waist biases only within their vertical band.
            const shoulderLift = t > 0.55 && t < 0.88 ? shoulderBias : 0;
            const waistPinch = t > 0.18 && t < 0.48 ? waistBias : 0;
            // Organic per-point jitter — Perlin noise + small emotion lean.
            const jitter = (noise(seedOffset, i * 0.27) - 0.5) * 0.16
                         + emotionMap.joy * 0.06
                         - emotionMap.fear * 0.05;
            // Clamp to [0.24, 1.22] * potWidth so pots never collapse or explode.
            const pointX = constrain(anchor + jitter + shoulderLift - waistPinch, 0.24, 1.22) * potWidth;
            this.edgePoints.push({ x: pointX, y: potHeight * t });
        }
    }
}

/**
 * A plant "stick" (stem/branch). Nodes are generated by `getStick()`
 * (defined in flower-pots-scene.js) which creates a jittery polyline
 * from the starting position.
 */
class StickObj {
    constructor(x, y, startDir, stickLength) {
        this.nodes = getStick(x, y, startDir, stickLength / 6, 6);
    }
}

/**
 * Build a zero-initialised emotion map, optionally seeded with values.
 * Ensures all 7 keys exist so downstream code never sees `undefined`.
 */
function makeEmotionMap(seed = {}) {
    return {
        anger: seed.anger || 0,
        disgust: seed.disgust || 0,
        fear: seed.fear || 0,
        joy: seed.joy || 0,
        neutral: seed.neutral || 0,
        sadness: seed.sadness || 0,
        surprise: seed.surprise || 0,
    };
}

/**
 * Convert the classifier's `[{label, score}, …]` payload into an
 * emotion map keyed by label. Unknown labels are dropped silently.
 */
function emotionMapFromPayload(emotions) {
    const map = makeEmotionMap();
    emotions.forEach(({ label, score }) => {
        if (Object.prototype.hasOwnProperty.call(map, label)) {
            map[label] = score;
        }
    });
    return map;
}

/** Return `[key, score]` for the highest-scoring emotion. */
function dominantEntry(map) {
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0];
}

/** Return the `count` highest-scoring emotion keys, in descending order. */
function topEmotionKeys(map, count = 3) {
    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([key]) => key);
}

/**
 * Decide which emotion each of the `count` pots should represent.
 *  - If joy or surprise dominates strongly (≥0.8), all pots match it.
 *  - If the second emotion is effectively zero, all pots match dominant.
 *  - Otherwise alternate between dominant and secondary (even / odd index).
 *
 * Keeps visual diversity when emotions are mixed, and unity when one is clear.
 */
function buildPotEmotionSequence(map, count) {
    const rankedEntries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const [dominantKey, dominantScore] = rankedEntries[0] || ['neutral', 0];
    const [secondKey, secondScore] = rankedEntries[1] || [dominantKey, 0];

    if ((dominantKey === 'joy' || dominantKey === 'surprise') && dominantScore >= 0.8) {
        return Array.from({ length: count }, () => dominantKey);
    }

    if (secondScore <= 0.02) {
        return Array.from({ length: count }, () => dominantKey);
    }

    return Array.from({ length: count }, (_, index) => (index % 2 === 0 ? dominantKey : secondKey));
}

/**
 * Convert emotion scores into a weighted probability distribution
 * for choosing plant/flower emotions. Scores are raised to 1.3 so the
 * dominant emotion dominates without fully silencing the others.
 * Emotions below 0.01 are ignored as noise.
 */
function buildPlantEmotionMix(map) {
    const entries = Object.entries(map)
        .filter(([, score]) => score > 0.01)
        .map(([key, score]) => ({
            key, rawScore: score, weight: Math.pow(score, 1.3),
        }));

    if (!entries.length) {
        return [{ key: 'neutral', weight: 1 }];
    }

    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);

    return entries.map(entry => ({
        key: entry.key,
        weight: entry.weight / total, // normalise so weights sum to 1
    }));
}

/**
 * Sample one emotion key from the weighted mix (categorical sampling).
 * Classic "spin the roulette": subtract each weight from a [0,1) roll
 * until it goes non-positive, then return that key.
 */
function chooseEmotionFromMix(plantMix) {
    if (!plantMix.length) return 'neutral';
    if (plantMix.length === 1) return plantMix[0].key;

    let roll = random();
    for (const entry of plantMix) {
        roll -= entry.weight;
        if (roll <= 0) return entry.key;
    }
    return plantMix[plantMix.length - 1].key;
}

/**
 * Circular-mean hue blending over the emotion pigments.
 *
 * Hue is an angle (0°=360°) so a naive weighted mean breaks near the
 * red/violet boundary. Instead we convert each pigment hue to a unit
 * vector (cos, sin), accumulate weighted vectors, and take atan2 —
 * the standard "mean of angles" technique.
 *
 * Scores are squared so the dominant emotion has much stronger pull
 * (this was the fix for the "everything-goes-violet" bug: unsquared
 * scores let fear+surprise drag the average even when they weren't dominant).
 */
function weightedHue(map) {
    let x = 0;
    let y = 0;
    let total = 0;

    Object.entries(map).forEach(([key, value]) => {
        const pigment = EMOTION_PIGMENTS[key];
        const weight = Math.max(0.001, value * value);
        const angle = radians(pigment.h);
        x += Math.cos(angle) * weight;
        y += Math.sin(angle) * weight;
        total += weight;
    });

    let hueValue = degrees(Math.atan2(y, x));
    if (hueValue < 0) hueValue += 360;               // atan2 returns (-180, 180]; normalise to [0,360)
    return total ? hueValue : EMOTION_PIGMENTS.neutral.h;
}

/**
 * Full weighted colour blend — uses `weightedHue` for hue, and a
 * linear weighted average for saturation/brightness (no angle trick
 * needed since S and B are ordinary scalars).
 *
 * `satDelta` / `briDelta` let callers push the result darker or
 * more muted without recomputing the blend.
 */
function weightedColor(map, satDelta = 0, briDelta = 0) {
    let total = 0;
    let sat = 0;
    let bri = 0;

    Object.entries(map).forEach(([key, value]) => {
        const pigment = EMOTION_PIGMENTS[key];
        const weight = Math.max(0.001, value * value);
        sat += pigment.s * weight;
        bri += pigment.b * weight;
        total += weight;
    });

    return new NYColor(
        weightedHue(map),
        constrain(sat / total + satDelta, 0, 100),
        constrain(bri / total + briDelta, 0, 100)
    );
}

/**
 * How many flowers should a plant carry? Returns a density factor in [0.01,1].
 * Joy/surprise push it up, sadness/anger/disgust pull it down, fear adds a
 * little (nervous over-blooming). The 0.08 base ensures even neutral plants
 * still have *some* blossoms.
 */
function flowerDensityForMap(map) {
    return constrain(
        0.08
        + map.joy * 1.02
        + map.surprise * 0.92
        + map.neutral * 0.34
        - map.anger * 0.08
        - map.sadness * 0.58
        - map.disgust * 0.04
        + map.fear * 0.24,
        0.01,
        1
    );
}

/**
 * Number of branches per plant, chosen by the plant's dominant emotion.
 * Sad plants are sparse (1-2 branches), joyful/surprised plants are busy
 * (3-4), angry/disgust are medium (2-3).
 */
function branchCountForEmotion(plantType) {
    if (plantType === 'joy' || plantType === 'surprise') return floor(random(3, 5));
    if (plantType === 'anger' || plantType === 'disgust') return floor(random(2, 4));
    if (plantType === 'sadness') return 1 + (random() < 0.25 ? 1 : 0);
    return floor(random(2, 4));
}

/**
 * Build the full colour set (background, dots, pot strokes, flowers, glow)
 * for the current scene, based on the smoothed emotion map and theme mode.
 *
 * The set is driven by two things:
 *   1. Dominant emotion → picks a "family" of named palettes (light or dark).
 *   2. Secondary emotion → provides accent hues so mixed moods don't look
 *      identical to their pure versions.
 *
 * Light variants add randomised hue offsets per render so repeated scenes
 * with the same emotion don't look identical. Dark mode uses higher-saturation
 * neon-style colours on a very dark background.
 */
function buildColorSet(map) {
    const dominant = dominantEntry(map)[0];
    const secondary = topEmotionKeys(map, 2)[1] || dominant;
    // Shade is a slightly darker/muted version of the weighted blend —
    // used for stick (branch) colour so branches don't glare.
    const shade = weightedColor(map, -28, -24);
    const darkTheme = zenState.themeMode === 'dark';

    // --- Light-theme palette families (one entry per dominant emotion).
    //     `baseHue` drives background/pot; `accentHue` drives secondary dots;
    //     `bloomHue` drives flower highlights.
    const lightFamilies = {
        anger: { label: 'fired orange', baseHue: 6, accentHue: 25, bloomHue: 18 },
        sadness: { label: 'rain blue porcelain', baseHue: 212, accentHue: 198, bloomHue: 224 },
        joy: { label: 'sunlit gold ceramic', baseHue: 42, accentHue: 28, bloomHue: 56 },
        fear: { label: 'violet dusk stoneware', baseHue: 272, accentHue: 286, bloomHue: 248 },
        disgust: { label: 'moss green ceramic', baseHue: 102, accentHue: 86, bloomHue: 122 },
        surprise: { label: 'bright cyan porcelain', baseHue: 188, accentHue: 204, bloomHue: 318 },
        neutral: { label: 'quiet ash ceramic', baseHue: 30, accentHue: 22, bloomHue: 40 },
    };

    // --- Hue-shift variants — a random one is chosen to diversify repeat scenes.
    //     Every field shifts a different element of the palette (bg, dots, strokes…)
    //     so the overall colour *feel* stays stable while details vary.
    const lightVariants = [
        { bgHueShift: -6, dotHueShift: 6, strokeHueShift: -2, insideHueShift: 2, edgeHueShift: 10, flowerHueShift: 0, glowHueShift: 12 },
        { bgHueShift: 10, dotHueShift: 16, strokeHueShift: 8, insideHueShift: 4, edgeHueShift: 18, flowerHueShift: 12, glowHueShift: 22 },
        { bgHueShift: -14, dotHueShift: 4, strokeHueShift: -10, insideHueShift: -2, edgeHueShift: 12, flowerHueShift: 24, glowHueShift: 32 },
        { bgHueShift: 4, dotHueShift: 12, strokeHueShift: 14, insideHueShift: 6, edgeHueShift: 22, flowerHueShift: 8, glowHueShift: 18 },
    ];

    // --- Dark-theme palette families — more saturated, neon-glow style.
    const darkFamilies = {
        anger: { label: 'ember neon ceramic', baseHue: 6, accentHue: 348, glowHue: 18 },
        sadness: { label: 'midnight blue ceramic', baseHue: 214, accentHue: 194, glowHue: 228 },
        joy: { label: 'gold neon ceramic', baseHue: 42, accentHue: 26, glowHue: 56 },
        fear: { label: 'violet neon ceramic', baseHue: 274, accentHue: 292, glowHue: 254 },
        disgust: { label: 'acid green ceramic', baseHue: 104, accentHue: 138, glowHue: 86 },
        surprise: { label: 'electric cyan ceramic', baseHue: 190, accentHue: 320, glowHue: 176 },
        neutral: { label: 'mono neon ceramic', baseHue: 28, accentHue: 210, glowHue: 330 },
    };

    if (darkTheme) {
        const family = darkFamilies[dominant] || darkFamilies.neutral;
        const secondaryHue = EMOTION_PIGMENTS[secondary].h;
        return {
            label: family.label,
            // Background: hue rotated 220° from base → near-complement → very dark ceramic feel.
            bgColor: new NYColor((family.baseHue + 220) % 360, 16, 4),
            bgDotColor: new NYColor((family.accentHue + random(-12, 12) + 360) % 360, 78, 54),
            stickColor: new NYColor((family.baseHue + 24) % 360, 34, 42),
            potStrokeColorA: new NYColor((family.baseHue + random(-10, 10) + 360) % 360, 88, 72),
            // Disgust picks a violet inner lip so it doesn't look too swampy.
            potInsideColorA: dominant === 'disgust'
                ? new NYColor((262 + random(-10, 10) + 360) % 360, 42, 10)
                : new NYColor((secondaryHue + random(-10, 10) + 360) % 360, 38, 32),
            potEdgeDotColor: new NYColor((family.accentHue + random(-8, 8) + 360) % 360, 96, 96),
            flowerColor: new NYColor((family.glowHue + random(-14, 14) + 360) % 360, 84, 100),
            glowColor: new NYColor((family.glowHue + 22 + random(-10, 10) + 360) % 360, 90, 100),
            darkTheme,
        };
    }

    const family = lightFamilies[dominant] || lightFamilies.neutral;
    const secondaryHue = EMOTION_PIGMENTS[secondary].h;
    // Pick one of the light variants at random per scene build.
    const variant = lightVariants[random(lightVariants.length) | 0];

    return {
        label: family.label,
        bgColor: new NYColor((family.baseHue + variant.bgHueShift + 360) % 360, 18, 92),
        bgDotColor: new NYColor((family.accentHue + variant.dotHueShift + 360) % 360, 18, 78),
        // Use `shade` (blend of all emotions) for sticks so mixed moods read through on branches.
        stickColor: new NYColor((shade.h + 8) % 360, 20, 30),
        potStrokeColorA: new NYColor((family.baseHue + variant.strokeHueShift + 360) % 360, 58, 46),
        potInsideColorA: new NYColor((family.baseHue + variant.insideHueShift + 360) % 360, 22, 80),
        potEdgeDotColor: new NYColor((family.accentHue + variant.edgeHueShift + 360) % 360, 34, 90),
        // Anger gets a custom bloom-hue flower; everyone else uses a secondary-derived hue.
        flowerColor: dominant === 'anger'
            ? new NYColor((family.bloomHue + random(-4, 4) + 360) % 360, 66, 78)
            : new NYColor((secondaryHue + variant.flowerHueShift + 360) % 360, 44, 96),
        glowColor: dominant === 'anger'
            ? new NYColor((family.bloomHue + 8 + random(-4, 4) + 360) % 360, 44, 90)
            : new NYColor((family.bloomHue + variant.glowHueShift + 360) % 360, 26, 100),
        darkTheme,
    };
}
