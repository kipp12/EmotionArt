const ZEN_EMOTIONS = [
    { key: 'joy', color: '#f4c94f' },
    { key: 'surprise', color: '#f8f1d9' },
    { key: 'anger', color: '#c85f3d' },
    { key: 'fear', color: '#675b85' },
    { key: 'sadness', color: '#5977a5' },
    { key: 'disgust', color: '#74855b' },
    { key: 'neutral', color: '#a19179' },
];

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
    history: [],
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
        this.edgePointCount = profile.length;
        const waistBias = emotionMap.sadness * 0.05 - emotionMap.joy * 0.03;
        const shoulderBias = emotionMap.anger * 0.04 + emotionMap.surprise * 0.05;

        for (let i = 0; i < this.edgePointCount; i++) {
            const t = i / (this.edgePointCount - 1);
            const anchor = profile[i];
            const shoulderLift = t > 0.55 && t < 0.88 ? shoulderBias : 0;
            const waistPinch = t > 0.18 && t < 0.48 ? waistBias : 0;
            const jitter = (noise(seedOffset, i * 0.27) - 0.5) * 0.16 + emotionMap.joy * 0.06 - emotionMap.fear * 0.05;
            const pointX = constrain(anchor + jitter + shoulderLift - waistPinch, 0.24, 1.22) * potWidth;
            const pointY = potHeight * t;
            this.edgePoints.push({ x: pointX, y: pointY });
        }
    }
}

class StickObj {
    constructor(x, y, startDir, stickLength) {
        this.nodes = [];
        this.nodeCount = 6;
        const segmentAvgLength = stickLength / this.nodeCount;
        this.nodes = getStick(x, y, startDir, segmentAvgLength, this.nodeCount);
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
    const secondEntry = rankedEntries[1] || [dominantKey, 0];
    const secondKey = secondEntry[0] || dominantKey;
    const secondScore = secondEntry[1] || 0;
    const sequence = [];

    if ((dominantKey === 'joy' || dominantKey === 'surprise') && dominantScore >= 0.8) {
        for (let i = 0; i < count; i++) {
            sequence.push(dominantKey);
        }
        return sequence;
    }

    // Only use the two strongest emotions
    if (secondScore <= 0.02) {
        for (let i = 0; i < count; i++) {
            sequence.push(dominantKey);
        }
        return sequence;
    }

    for (let i = 0; i < count; i++) {
        sequence.push(i % 2 === 0 ? dominantKey : secondKey);
    }

    return sequence;
}

function buildPlantEmotionMix(map) {
    const rankedEntries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const [dominantKey, dominantScore] = rankedEntries[0] || ['neutral', 1];
    const secondEntry = rankedEntries[1] || [dominantKey, 0];
    const secondKey = secondEntry[0] || dominantKey;
    const secondScore = secondEntry[1] || 0;

    if (secondScore <= 0.02) {
        return [{ key: dominantKey, weight: 1, score: dominantScore }];
    }

    const total = Math.max(0.001, dominantScore + secondScore);
    return [
        { key: dominantKey, weight: dominantScore / total, score: dominantScore },
        { key: secondKey, weight: secondScore / total, score: secondScore },
    ];
}

function chooseEmotionFromMix(plantMix) {
    if (!plantMix || !plantMix.length) return 'neutral';
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

function tone(colorValue, hDelta = 0, sDelta = 0, bDelta = 0) {
    return new NYColor(
        (colorValue.h + hDelta + 360) % 360,
        constrain(colorValue.s + sDelta, 0, 100),
        constrain(colorValue.b + bDelta, 0, 100),
        colorValue.a
    );
}

function growthTypeForEmotion(key) {
    if (key === 'joy') return 'daisy bloom';
    if (key === 'sadness') return 'drooping reed';
    if (key === 'anger') return 'thorn branch';
    if (key === 'fear') return 'trembling grass';
    if (key === 'disgust') return 'curling vine';
    if (key === 'surprise') return 'starburst flower';
    return 'bonsai stem';
}

function paletteDescription(map) {
    if (!zenState.scene) return 'ceramic study';
    return zenState.scene.themeLabel;
}

function summaryText(map) {
    const dominant = dominantEntry(map)[0];
    const mood = dominant.charAt(0).toUpperCase() + dominant.slice(1);
    const growth = growthTypeForEmotion(dominant);
    return `${mood} drives this arrangement, pushing the clay toward ${paletteDescription(map)} and encouraging ${growth}s to emerge from the vessel.`;
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
    if (plantType === 'joy' || plantType === 'surprise') {
        return floor(random(3, 5));
    }
    if (plantType === 'anger' || plantType === 'disgust') {
        return floor(random(2, 4));
    }
    if (plantType === 'sadness') {
        return 1 + (random() < 0.25 ? 1 : 0);
    }
    if (plantType === 'fear') {
        return floor(random(2, 4));
    }
    return floor(random(2, 4));
}

function buildColorSet(map) {
    const dominant = dominantEntry(map)[0];
    const secondary = topEmotionKeys(map, 2)[1] || dominant;
    const ceramic = weightedColor(map, -16, 2);
    const bloom = weightedColor(map, 12, 18);
    const shade = weightedColor(map, -28, -24);
    const darkTheme = zenState.themeMode === 'dark';
    const lightFamilies = {
        anger: {
            label: 'fired red stoneware',
            baseHue: 8,
            accentHue: 356,
            bloomHue: 18,
        },
        sadness: {
            label: 'rain blue porcelain',
            baseHue: 212,
            accentHue: 198,
            bloomHue: 224,
        },
        joy: {
            label: 'sunlit gold ceramic',
            baseHue: 42,
            accentHue: 28,
            bloomHue: 56,
        },
        fear: {
            label: 'violet dusk stoneware',
            baseHue: 272,
            accentHue: 286,
            bloomHue: 248,
        },
        disgust: {
            label: 'moss green ceramic',
            baseHue: 102,
            accentHue: 86,
            bloomHue: 122,
        },
        surprise: {
            label: 'bright cyan porcelain',
            baseHue: 188,
            accentHue: 204,
            bloomHue: 318,
        },
        neutral: {
            label: 'quiet ash ceramic',
            baseHue: 30,
            accentHue: 22,
            bloomHue: 40,
        },
    };
    const lightVariants = [
        {
            type: 'anchored',
            bgHueShift: -6,
            dotHueShift: 6,
            strokeHueShift: -2,
            insideHueShift: 2,
            edgeHueShift: 10,
            flowerHueShift: 0,
            glowHueShift: 12,
        },
        {
            type: 'anchored',
            bgHueShift: 10,
            dotHueShift: 16,
            strokeHueShift: 8,
            insideHueShift: 4,
            edgeHueShift: 18,
            flowerHueShift: 12,
            glowHueShift: 22,
        },
        {
            type: 'anchored',
            bgHueShift: -14,
            dotHueShift: 4,
            strokeHueShift: -10,
            insideHueShift: -2,
            edgeHueShift: 12,
            flowerHueShift: 24,
            glowHueShift: 32,
        },
        {
            type: 'anchored',
            bgHueShift: 4,
            dotHueShift: 12,
            strokeHueShift: 14,
            insideHueShift: 6,
            edgeHueShift: 22,
            flowerHueShift: 8,
            glowHueShift: 18,
        },
    ];
    const darkFamilies = {
        anger: {
            label: 'ember neon ceramic',
            baseHue: 6,
            accentHue: 348,
            glowHue: 18,
        },
        sadness: {
            label: 'midnight blue ceramic',
            baseHue: 214,
            accentHue: 194,
            glowHue: 228,
        },
        joy: {
            label: 'gold neon ceramic',
            baseHue: 42,
            accentHue: 26,
            glowHue: 56,
        },
        fear: {
            label: 'violet neon ceramic',
            baseHue: 274,
            accentHue: 292,
            glowHue: 254,
        },
        disgust: {
            label: 'acid green ceramic',
            baseHue: 104,
            accentHue: 138,
            glowHue: 86,
        },
        surprise: {
            label: 'electric cyan ceramic',
            baseHue: 190,
            accentHue: 320,
            glowHue: 176,
        },
        neutral: {
            label: 'mono neon ceramic',
            baseHue: 28,
            accentHue: 210,
            glowHue: 330,
        },
    };

    let chosen;
    if (darkTheme) {
        const family = darkFamilies[dominant] || darkFamilies.neutral;
        const secondaryHue = EMOTION_PIGMENTS[secondary].h;
        const baseJitter = random(-10, 10);
        const accentJitter = random(-12, 12);
        const glowJitter = random(-14, 14);
        chosen = {
            label: family.label,
            bgColor: new NYColor((family.baseHue + 220) % 360, 16, 4),
            bgDotColor: new NYColor((family.accentHue + accentJitter + 360) % 360, 78, 54),
            groundColor: new NYColor((family.baseHue + 200) % 360, 18, 8),
            stickColor: new NYColor((family.baseHue + 24) % 360, 34, 42),
            potStrokeColorA: new NYColor((family.baseHue + baseJitter + 360) % 360, 88, 72),
            potInsideColorA: dominant === 'disgust'
                ? new NYColor((262 + random(-10, 10) + 360) % 360, 42, 10)
                : new NYColor((secondaryHue + random(-10, 10) + 360) % 360, 38, 32),
            potEdgeDotColor: new NYColor((family.accentHue + random(-8, 8) + 360) % 360, 96, 96),
            flowerColor: new NYColor((family.glowHue + glowJitter + 360) % 360, 84, 100),
            glowColor: new NYColor((family.glowHue + 22 + random(-10, 10) + 360) % 360, 90, 100),
        };
    } else {
        const variant = random(lightVariants.length) | 0;
        const family = lightFamilies[dominant] || lightFamilies.neutral;
        const secondaryHue = EMOTION_PIGMENTS[secondary].h;
        const v = lightVariants[variant];
        chosen = {
            label: family.label,
            bgColor: new NYColor((family.baseHue + v.bgHueShift + 360) % 360, 18, 92),
            bgDotColor: new NYColor((family.accentHue + v.dotHueShift + 360) % 360, 18, 78),
            groundColor: new NYColor((family.baseHue + 8) % 360, 18, 74),
            stickColor: new NYColor((shade.h + 8) % 360, 20, 30),
            potStrokeColorA: new NYColor((family.baseHue + v.strokeHueShift + 360) % 360, 58, 46),
            potInsideColorA: new NYColor((family.baseHue + v.insideHueShift + 360) % 360, 22, 80),
            potEdgeDotColor: new NYColor((family.accentHue + v.edgeHueShift + 360) % 360, 34, 90),
            flowerColor: dominant === 'anger'
                ? new NYColor((family.bloomHue + random(-4, 4) + 360) % 360, 66, 78)
                : new NYColor((secondaryHue + v.flowerHueShift + 360) % 360, 44, 96),
            glowColor: dominant === 'anger'
                ? new NYColor((family.bloomHue + 8 + random(-4, 4) + 360) % 360, 44, 90)
                : new NYColor((family.bloomHue + v.glowHueShift + 360) % 360, 26, 100),
        };
    }

    return {
        ...chosen,
        darkTheme,
    };
}

function buildScene(map) {
    const seed = Math.floor(Math.random() * 1000000000);
    randomSeed(seed);
    noiseSeed(seed);

    const colorSet = buildColorSet(map);
    const dominant = dominantEntry(map)[0];

    const backLayer = createGraphics(width, height);
    const midLayer = createGraphics(width, height);
    const frontLayer = createGraphics(width, height);
    backLayer.colorMode(HSB, 360, 100, 100, 1);
    midLayer.colorMode(HSB, 360, 100, 100, 1);
    frontLayer.colorMode(HSB, 360, 100, 100, 1);

    backLayer.background(colorSet.bgColor.h, colorSet.bgColor.s, colorSet.bgColor.b);

    const padding = 0.08 * min(width, height);
    const baseHeight = height * 0.74;
    const queue = [];

    paintBackgroundDots(backLayer, colorSet, baseHeight);

    const potCount = min(12, max(9, floor(width / 110)));
    const potKeys = buildPotEmotionSequence(map, potCount);
    const plantMix = buildPlantEmotionMix(map);
    const clusterWidth = min(width * 0.9, 1120);
    const potWidth = clusterWidth / potCount;
    const overlap = 0.7;
    const occupiedWidth = potWidth * ((potCount - 1) * overlap + 1);
    const clusterStart = (width - occupiedWidth) * 0.5;
    const pots = [];

    potKeys.forEach((emotionKey, index) => {
        const influence = map[emotionKey];
        const potX = clusterStart + potWidth * 0.5 + index * potWidth * overlap;
        const baseOffset = random(-height * 0.006, height * 0.008) + sin(index * 0.9) * height * 0.002;
        const potY = baseHeight + baseOffset;
        const potHeight = random(0.62, 1.04) * potWidth * (1 + map.sadness * 0.18 - map.joy * 0.08 + influence * 0.08);
        const potData = new PotData(potX, potY, potWidth * 0.225, potHeight, emotionKey, map, 100 + index * 37);
        const edgeCurves = buildEdgeCurves(potData, emotionKey);
        const potMeta = {
            emotionKey,
            plantMix,
            influence,
        };
        queuePotCommands(queue, potData, edgeCurves, colorSet, potMeta);
        pots.push({ potData, edgeCurves, potMeta });
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
        stepsPerFrame: constrain(floor(queue.length / 90), 36, 110),
        pots,
    };
}

function paintBackgroundDots(layer, colorSet, baseHeight) {
    const bgHeight = 0.16 * height;
    const xCount = floor(width * 0.58);
    const dotAlpha = colorSet.darkTheme ? 0.42 : 0.95;
    for (let x = 0; x < xCount; x++) {
        const yDotCount = floor(bgHeight * dotDensity * 0.42);
        for (let y = 0; y < yDotCount; y++) {
            const t = tan(random(TWO_PI));
            const nowX = x * (width / max(1, xCount - 1));
            const nowY = baseHeight - bgHeight * t - 0.26 * height;
            const size = random(0.2, 2.4);
            layer.noFill();
            layer.stroke(colorSet.bgDotColor.h, colorSet.bgDotColor.s, colorSet.bgDotColor.b, dotAlpha);
            layer.circle(nowX, nowY, size);
        }
    }
}

function buildEdgeCurves(potData, emotionKey) {
    const edgeCurves = [];
    let isOutCurve = emotionKey === 'joy' || emotionKey === 'anger' || emotionKey === 'surprise';
    for (let i = 0; i < potData.edgePoints.length - 1; i++) {
        const curvePool = isOutCurve ? CURVES_OUT : CURVES_IN;
        edgeCurves.push(curvePool[int(random(curvePool.length))]);
        isOutCurve = !isOutCurve;
    }
    return edgeCurves;
}

function queuePotCommands(queue, potData, edgeCurves, colorSet, potMeta) {
    for (let i = 0; i < potData.edgePoints.length - 1; i++) {
        const nowPoint = potData.edgePoints[i];
        const nextPoint = potData.edgePoints[i + 1];
        queueEdgeSegment(queue, potData.x, potData.y - nowPoint.y, nowPoint.x, potData.x, potData.y - nextPoint.y, nextPoint.x, edgeCurves[i], colorSet);
    }

    for (let i = 0; i < potData.edgePoints.length - 1; i++) {
        const nowPoint = potData.edgePoints[i];
        const nextPoint = potData.edgePoints[i + 1];
        queueSegmentDots(queue, potData.x, potData.y - nowPoint.y, nowPoint.x, potData.x, potData.y - nextPoint.y, nextPoint.x, edgeCurves[i], colorSet);
    }

    queuePlant(queue, potData, colorSet, potMeta.plantMix, potMeta.influence);
}

function queueEdgeSegment(queue, fromX, fromY, fromDist, toX, toY, toDist, curveFunc, colorSet) {
    const lineCount = max(8, floor(lineDensity * dist(fromX, fromY, toX, toY)));
    for (let i = 0; i < lineCount; i++) {
        const t = i / lineCount;
        const curveT = curveFunc(t);
        const centerX = lerp(fromX, toX, t);
        const centerY = lerp(fromY, toY, t);
        const nowDist = lerp(fromDist, toDist, curveT);
        const leftX = centerX - nowDist;
        const rightX = centerX + nowDist;
        const curveHeight = abs(leftX - rightX) * 0.24;
        queue.push({
            type: 'curve-line',
            leftX,
            leftY: centerY,
            rightX,
            rightY: centerY,
            curveHeight,
            color: colorSet.potStrokeColorA,
            thickness: 12,
        });
        queue.push({
            type: 'curve-line',
            leftX,
            leftY: centerY,
            rightX,
            rightY: centerY,
            curveHeight,
            color: colorSet.potInsideColorA,
            thickness: 3,
        });
    }
}

function queueSegmentDots(queue, fromX, fromY, fromDist, toX, toY, toDist, curveFunc, colorSet) {
    const lineCount = max(8, floor(lineDensity * dist(fromX, fromY, toX, toY)));
    for (let i = 0; i < lineCount; i++) {
        const t = i / lineCount;
        const curveT = curveFunc(t);
        const centerX = lerp(fromX, toX, t);
        const centerY = lerp(fromY, toY, t);
        const nowDist = lerp(fromDist, toDist, curveT);
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

function queuePlant(queue, potData, colorSet, plantMix, influence) {
    const flowerDensity = flowerDensityForMap(zenState.current);
    const branchCount = max(1, ...plantMix.map(entry => branchCountForEmotion(entry.key)));
    const baseRadius = potData.edgePoints[0].x;
    const endRadius = potData.edgePoints[potData.edgePoints.length - 1].x;
    const endYOffset = potData.edgePoints[potData.edgePoints.length - 1].y;

    for (let branchIndex = 0; branchIndex < branchCount; branchIndex++) {
        const plantType = chooseEmotionFromMix(plantMix);
        const branchInfluence = zenState.current[plantType] || influence;
        const baseAngleT = random(0.58, 0.82);
        const endAngleT = random() < 0.5 ? random(0.18, 0.38) : random(0.62, 0.84);
        const angleSpread = branchCount > 1 ? map(branchIndex, 0, branchCount - 1, -0.12, 0.12) : 0;
        const startX = potData.x + baseRadius * sin(radians(lerp(90, 270, baseAngleT + angleSpread)));
        const startY = potData.y + baseRadius * 0.24 * -cos(radians(lerp(90, 270, baseAngleT + angleSpread)));
        const endX = potData.x + endRadius * sin(radians(lerp(90, 270, endAngleT + angleSpread)));
        const endY = potData.y - endYOffset + endRadius * 0.24 * -cos(radians(lerp(90, 270, endAngleT + angleSpread)));
        const stickAngle = getAngle(startX, startY, endX, endY);
        const stickX = lerp(startX, endX, 0.9);
        const stickY = lerp(startY, endY, 0.9);
        const lengthScale = plantType === 'joy' || plantType === 'surprise' ? random(1.55, 2.9) : random(0.95, 1.8);
        const stickLength = lengthScale * endYOffset * (0.82 + branchInfluence * 0.28);
        const stickObj = new StickObj(stickX, stickY, stickAngle, stickLength);

        stickObj.nodes.forEach(node => {
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
            const densityBoost = plantType === 'anger'
                ? 1.85
                : plantType === 'disgust'
                    ? 1.8
                    : plantType === 'fear'
                        ? 1.35
                        : plantType === 'neutral'
                            ? 1.28
                            : 1;
            const accentChance = sparseMood
                ? constrain(0.01 + branchInfluence * 0.05 + flowerDensity * 0.08 - node.nodeDepth * 0.1, 0.005, 0.08)
                : constrain(0.16 + branchInfluence * 0.22 + flowerDensity * 0.72 - node.nodeDepth * 0.05, 0.1, 0.88);
            const adjustedAccentChance = constrain(accentChance * densityBoost, 0.005, 0.95);

            if (node.nodeDepth <= 3 && random() < adjustedAccentChance) {
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
        });
    }
}

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
        return;
    }

}

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
        const briAddRatio = sin(radians(lerp(0, 180, t)));
        const dotSize = noise(centerX * 0.01, centerY * 0.01, nowAngle * 0.04) * (thickness * 0.72) + 1.2;
        const targetLayer = nowAngle > 90 && nowAngle < 270 ? scene.frontLayer : scene.backLayer;

        targetLayer.noStroke();
        targetLayer.fill(dotColor.h, dotColor.s, constrain(dotColor.b + briAddRatio * 18, 0, 100), 0.95);
        targetLayer.circle(x, y, dotSize);
    }
}

function drawCurveLineDots(scene, x1, y1, x2, y2, curveHeight, dotColor, thickness) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const r1 = abs(x2 - x1) / 2;
    const r2 = curveHeight;
    const dotCount = 44;

    for (let i = 0; i < dotCount; i++) {
        const t = 1 - random(random(random()));
        const nowAngle = lerp(90, 270, t);
        const x = centerX + r1 * sin(radians(nowAngle));
        const y = centerY + r2 * -cos(radians(nowAngle));
        const dotSize = noise(centerX * 0.01, centerY * 0.01, nowAngle * 0.04) * thickness + 0.8;
        scene.frontLayer.noStroke();
        scene.frontLayer.fill(dotColor.h, dotColor.s, dotColor.b, 0.9);
        scene.frontLayer.circle(x, y, dotSize);
    }
}

function drawStickBranch(layer, x1, y1, x2, y2, thickness, colorValue) {
    const dotCount = max(6, dist(x1, y1, x2, y2) * stickDotDensity);
    layer.noStroke();
    layer.fill(colorValue.h, colorValue.s, colorValue.b, 0.94);

    for (let i = 0; i < dotCount; i++) {
        const t = i / max(1, dotCount - 1);
        let nowX = lerp(x1, x2, t);
        let nowY = lerp(y1, y2, t);
        const normalAngle = getAngle(x1, y1, x2, y2) + 90;
        nowX += sin(radians(normalAngle)) * noise(nowX * 0.1, nowY * 0.1, 666) * thickness;
        nowY -= cos(radians(normalAngle)) * noise(nowX * 0.1, nowY * 0.1, 999) * thickness;
        const dotSize = noise(nowX * 0.6, nowY * 0.6) * thickness + thickness * 0.35;
        layer.circle(nowX, nowY, dotSize);
    }
}

function drawPlantAccent(scene, step) {
    const xPos = lerp(step.x1, step.x2, random(0.45, 1));
    const yPos = lerp(step.y1, step.y2, random(0.1, 0.9));
    const plantType = step.plantType;
    const layer = scene.midLayer;
    const baseHue = (step.color.h + random(-8, 8) + 360) % 360;
    const baseSat = constrain(step.color.s + random(-8, 8), 0, 100);
    const baseBri = constrain(step.color.b + random(-8, 8), 0, 100);
    const glowHue = (step.glow.h + random(-10, 10) + 360) % 360;
    const glowSat = constrain(step.glow.s + random(-8, 8), 0, 100);
    const glowBri = constrain(step.glow.b + random(-6, 6), 0, 100);

    if (plantType === 'joy') {
        const joyAccentChoices = [
            { h: step.color.h, s: step.color.s - 10, b: step.color.b + 4 },
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
                layer.fill((joyHue + i * random(1.5, 3.5) + 360) % 360, constrain(joySat + 4, 0, 100), joyBri, 0.9);
                layer.ellipse(
                    xPos + cos(angle) * (petalLength * 0.55),
                    yPos + sin(angle) * (petalLength * 0.55),
                    petalLength,
                    3.2
                );
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
        return;
    }

    if (plantType === 'sadness') {
        layer.noStroke();
        layer.fill(baseHue, constrain(baseSat - 12, 0, 100), baseBri, 0.88);
        layer.ellipse(xPos, yPos + 5, 6, 14);
        return;
    }

    if (plantType === 'anger') {
        const emberHue = (16 + random(-4, 3) + 360) % 360;
        const emberSat = 72 + random(-5, 5);
        const emberBri = 64 + random(-5, 5);
        const flareCount = floor(random(3, 5));
        const flareRadius = random(5, 8);
        layer.stroke(emberHue, emberSat, constrain(emberBri - 10, 0, 100), 0.95);
        layer.strokeWeight(1.1);
        for (let i = 0; i < flareCount; i++) {
            const angle = -HALF_PI + map(i, 0, max(1, flareCount - 1), -0.75, 0.75) + random(-0.12, 0.12);
            const x2 = xPos + cos(angle) * flareRadius;
            const y2 = yPos + sin(angle) * flareRadius;
            layer.line(xPos, yPos, x2, y2);
        }
        layer.noStroke();
        layer.fill(emberHue, constrain(emberSat + 6, 0, 100), constrain(emberBri + 10, 0, 100), 0.55);
        layer.circle(xPos, yPos, 8);
        layer.fill(emberHue, constrain(emberSat + 10, 0, 100), constrain(emberBri + 14, 0, 100), 0.95);
        layer.circle(xPos, yPos, 5);
        layer.fill((emberHue + 6) % 360, constrain(emberSat - 8, 0, 100), constrain(emberBri + 22, 0, 100), 0.95);
        layer.circle(xPos + random(-0.8, 0.8), yPos + random(-0.8, 0.8), 2.6);
        return;
    }

    if (plantType === 'fear') {
        layer.stroke(glowHue, constrain(glowSat - 12, 0, 100), glowBri, 0.9);
        layer.strokeWeight(1);
        for (let i = 0; i < 4; i++) {
            const dx = noise(xPos * 0.02, yPos * 0.02, i * 0.2) * 12 - 6;
            const dy = 8 + noise(xPos * 0.01, yPos * 0.01, i * 0.4) * 8;
            layer.line(xPos, yPos, xPos + dx, yPos - dy);
        }
        return;
    }

    if (plantType === 'disgust') {
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

    if (plantType === 'surprise') {
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

    layer.noStroke();
    layer.fill(baseHue, constrain(baseSat - 18, 0, 100), constrain(baseBri - 6, 0, 100), 0.9);
    layer.ellipse(xPos, yPos, 9, 5);
}

function getStick(x, y, dir, lengthValue, maxNodeDepth) {
    const fromX = x;
    const fromY = y;
    const toX = fromX + lengthValue * sin(radians(dir));
    const toY = fromY + lengthValue * -cos(radians(dir));
    const nodes = [{
        x1: fromX,
        y1: fromY,
        x2: toX,
        y2: toY,
        dir,
        length: lengthValue,
        nodeDepth: maxNodeDepth,
    }];

    const splitNode = random() < 0.5;

    if (maxNodeDepth > 0 && splitNode) {
        let leftMin = 0.6;
        let rightMin = 0.6;
        if (random() < 0.5) leftMin = 0.1;
        else rightMin = 0.1;

        const leftNodes = getStick(toX, toY, dir + random(-20, -6), lengthValue * random(leftMin, 0.95), maxNodeDepth - 1);
        const rightNodes = getStick(toX, toY, dir + random(6, 20), lengthValue * random(rightMin, 0.95), maxNodeDepth - 1);
        leftNodes.forEach(node => nodes.push(node));
        rightNodes.forEach(node => nodes.push(node));
    } else if (maxNodeDepth > 0) {
        const newNodes = getStick(toX, toY, dir + random(-20, 20), lengthValue * random(0.6, 0.95), maxNodeDepth - 1);
        newNodes.forEach(node => nodes.push(node));
    }

    return nodes;
}

function getAngle(x1, y1, x2, y2) {
    const xDiff = x2 - x1;
    const yDiff = y2 - y1;
    return atan2(yDiff, xDiff) * 180 / PI + 90;
}

function updateReadout() {
    if (!zenState.scene) return;
}

function renderHistoryBar() {
    const bar = document.getElementById('history-bar');
    if (!bar) return;
    bar.innerHTML = '';
    zenState.history.forEach(entry => {
        const dominant = dominantEntry(entry)[0];
        const dot = document.createElement('div');
        dot.className = 'history-dot';
        dot.style.background = ZEN_EMOTIONS.find(item => item.key === dominant).color;
        bar.appendChild(dot);
    });
}

function pushHistory(map) {
    zenState.history.push({ ...map });
    if (zenState.history.length > 8) zenState.history.shift();
    renderHistoryBar();
}

function compositeScene(scene) {
    background(0, 0, 100);
    image(scene.backLayer, 0, 0);
    image(scene.midLayer, 0, 0);
    image(scene.frontLayer, 0, 0);
}

function buildAndStartScene(map) {
    zenState.current = { ...map };
    zenState.scene = buildScene(map);
    updateReadout();
}

function setup() {
    const canvas = createCanvas(window.innerWidth, window.innerHeight);
    canvas.parent('p5-holder');
    colorMode(HSB, 360, 100, 100, 1);
    noStroke();
    pushHistory(zenState.current);
    buildAndStartScene(zenState.current);
}

function draw() {
    if (!zenState.scene) return;

    const scene = zenState.scene;
    const stepsPerFrame = scene.stepsPerFrame;

    for (let i = 0; i < stepsPerFrame && scene.queueIndex < scene.queue.length; i++) {
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
    if (transcript) {
        transcript.textContent = text;
    }

    try {
        const response = await fetch('/analyse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        const payload = await response.json();
        const map = emotionMapFromPayload(payload.emotions);

        pushHistory(map);
        buildAndStartScene(map);

        document.getElementById('output').textContent = payload.emotions
            .slice(0, 5)
            .map(entry => `${entry.label.toUpperCase()}: ${Math.round(entry.score * 100)}%`)
            .join('\n');

        status.textContent = isListening ? 'LISTENING...' : 'READY';
    } catch (error) {
        console.error(error);
        status.textContent = 'ERROR';
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
        const transcript = event.results[0][0].transcript;
        await analyseText(transcript);
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
    button.textContent = 'Pause Listening';
    button.classList.add('active');
} else {
    button.textContent = 'No Mic API';
    button.disabled = true;
    document.getElementById('status').textContent = 'MIC UNAVAILABLE';
}
