// Credit - Inspired by Zen Pots newyellow

const CURVES_IN = [
    x => x * x,
    x => x * x * x,
    x => 1 - Math.cos((x * Math.PI) / 2),
    x => 1 - Math.sqrt(1 - Math.pow(Math.min(1, x), 2)),
];

const CURVES_OUT = [
    x => 1 - (1 - x) * (1 - x),
    x => 1 - Math.pow(1 - x, 3),
    x => Math.sin((x * Math.PI) / 2),
    x => Math.sqrt(1 - Math.pow(x - 1, 2)),
];

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

const EMOTION_PIGMENTS = {
    joy: { h: 46, s: 58, b: 94 },
    surprise: { h: 48, s: 18, b: 98 },
    anger: { h: 16, s: 68, b: 78 },
    fear: { h: 272, s: 26, b: 56 },
    sadness: { h: 214, s: 42, b: 66 },
    disgust: { h: 96, s: 28, b: 58 },
    neutral: { h: 32, s: 18, b: 74 },
};

let lineDensity = 0.52;
let dotDensity = 0.5;
let stickDotDensity = 0.55;

let zenState = {
    current: makeEmotionMap({ neutral: 0.72 }),
    scene: null,
    themeMode: 'light',
};

class NYColor {
    constructor(h, s, b, a = 1) {
        this.h = h;
        this.s = s;
        this.b = b;
        this.a = a;
    }
}

class PotData {
    constructor(x, y, potWidth, potHeight, emotionKey, emotionMap, seedOffset) {
        this.x = x;
        this.y = y;
        this.emotionKey = emotionKey;
        this.edgePoints = [];

        const profileSet = POT_PROFILE_SETS[emotionKey] || POT_PROFILE_SETS.neutral;
        const profile = random(profileSet);
        const waistBias = emotionMap.sadness * 0.05 - emotionMap.joy * 0.03;
        const shoulderBias = emotionMap.anger * 0.04 + emotionMap.surprise * 0.05;

        for (let i = 0; i < profile.length; i++) {
            const t = i / (profile.length - 1);
            const anchor = profile[i];
            const shoulderLift = t > 0.55 && t < 0.88 ? shoulderBias : 0;
            const waistPinch = t > 0.18 && t < 0.48 ? waistBias : 0;
            const jitter = (noise(seedOffset, i * 0.27) - 0.5) * 0.16 + emotionMap.joy * 0.06 - emotionMap.fear * 0.05;
            const pointX = constrain(anchor + jitter + shoulderLift - waistPinch, 0.24, 1.22) * potWidth;
            this.edgePoints.push({ x: pointX, y: potHeight * t });
        }
    }
}

class StickObj {
    constructor(x, y, startDir, stickLength) {
        this.nodes = getStick(x, y, startDir, stickLength / 6, 6);
    }
}

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

function emotionMapFromPayload(emotions) {
    const map = makeEmotionMap();
    emotions.forEach(({ label, score }) => {
        if (Object.prototype.hasOwnProperty.call(map, label)) {
            map[label] = score;
        }
    });
    return map;
}

function dominantEntry(map) {
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0];
}

function topEmotionKeys(map, count = 3) {
    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([key]) => key);
}

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
        weight: entry.weight / total,
    }));
}

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
    if (hueValue < 0) hueValue += 360;
    return total ? hueValue : EMOTION_PIGMENTS.neutral.h;
}

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

function branchCountForEmotion(plantType) {
    if (plantType === 'joy' || plantType === 'surprise') return floor(random(3, 5));
    if (plantType === 'anger' || plantType === 'disgust') return floor(random(2, 4));
    if (plantType === 'sadness') return 1 + (random() < 0.25 ? 1 : 0);
    return floor(random(2, 4));
}

function buildColorSet(map) {
    const dominant = dominantEntry(map)[0];
    const secondary = topEmotionKeys(map, 2)[1] || dominant;
    const shade = weightedColor(map, -28, -24);
    const darkTheme = zenState.themeMode === 'dark';

    const lightFamilies = {
        anger: { label: 'fired orange', baseHue: 6, accentHue: 25, bloomHue: 18 },
        sadness: { label: 'rain blue porcelain', baseHue: 212, accentHue: 198, bloomHue: 224 },
        joy: { label: 'sunlit gold ceramic', baseHue: 42, accentHue: 28, bloomHue: 56 },
        fear: { label: 'violet dusk stoneware', baseHue: 272, accentHue: 286, bloomHue: 248 },
        disgust: { label: 'moss green ceramic', baseHue: 102, accentHue: 86, bloomHue: 122 },
        surprise: { label: 'bright cyan porcelain', baseHue: 188, accentHue: 204, bloomHue: 318 },
        neutral: { label: 'quiet ash ceramic', baseHue: 30, accentHue: 22, bloomHue: 40 },
    };

    const lightVariants = [
        { bgHueShift: -6, dotHueShift: 6, strokeHueShift: -2, insideHueShift: 2, edgeHueShift: 10, flowerHueShift: 0, glowHueShift: 12 },
        { bgHueShift: 10, dotHueShift: 16, strokeHueShift: 8, insideHueShift: 4, edgeHueShift: 18, flowerHueShift: 12, glowHueShift: 22 },
        { bgHueShift: -14, dotHueShift: 4, strokeHueShift: -10, insideHueShift: -2, edgeHueShift: 12, flowerHueShift: 24, glowHueShift: 32 },
        { bgHueShift: 4, dotHueShift: 12, strokeHueShift: 14, insideHueShift: 6, edgeHueShift: 22, flowerHueShift: 8, glowHueShift: 18 },
    ];

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
            bgColor: new NYColor((family.baseHue + 220) % 360, 16, 4),
            bgDotColor: new NYColor((family.accentHue + random(-12, 12) + 360) % 360, 78, 54),
            stickColor: new NYColor((family.baseHue + 24) % 360, 34, 42),
            potStrokeColorA: new NYColor((family.baseHue + random(-10, 10) + 360) % 360, 88, 72),
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
    const variant = lightVariants[random(lightVariants.length) | 0];

    return {
        label: family.label,
        bgColor: new NYColor((family.baseHue + variant.bgHueShift + 360) % 360, 18, 92),
        bgDotColor: new NYColor((family.accentHue + variant.dotHueShift + 360) % 360, 18, 78),
        stickColor: new NYColor((shade.h + 8) % 360, 20, 30),
        potStrokeColorA: new NYColor((family.baseHue + variant.strokeHueShift + 360) % 360, 58, 46),
        potInsideColorA: new NYColor((family.baseHue + variant.insideHueShift + 360) % 360, 22, 80),
        potEdgeDotColor: new NYColor((family.accentHue + variant.edgeHueShift + 360) % 360, 34, 90),
        flowerColor: dominant === 'anger'
            ? new NYColor((family.bloomHue + random(-4, 4) + 360) % 360, 66, 78)
            : new NYColor((secondaryHue + variant.flowerHueShift + 360) % 360, 44, 96),
        glowColor: dominant === 'anger'
            ? new NYColor((family.bloomHue + 8 + random(-4, 4) + 360) % 360, 44, 90)
            : new NYColor((family.bloomHue + variant.glowHueShift + 360) % 360, 26, 100),
        darkTheme,
    };
}
