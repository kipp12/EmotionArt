/**
 * Geometric Grid — p5.js sketch (Brazilian geometric art adaptation).
 *
 * This theme draws a grid of square cells, each filled with a randomly chosen
 * geometric shape. Emotions drive the visual structure:
 *   - Grid density (columns)    — fewer columns = larger shapes
 *   - Shape distribution        — weighted random: star, circle, crown, axe, diamond, recursive sub-grid
 *   - Animation speed           — sine-wave pulse that modulates shape parameters each frame
 *   - Stroke thickness          — bolder = more intense
 *   - Recursion depth           — cells can subdivide into smaller 2x2 grids (fractal)
 *   - Star point range          — how many points the star shape gets
 *   - Colour palette            — dynamically generated from emotion scores (see below)
 *
 * Library: p5.js (loaded from CDN in the HTML).
 *   - setup() / draw() are the standard p5 lifecycle hooks.
 *   - p5 provides: createCanvas, background, fill, stroke, rect, circle, beginShape/vertex/endShape,
 *     random, randomSeed, noise, sin, cos, map, lerp, lerpColor, color, colorMode, constrain, etc.
 *
 * Colour generation:
 *   Each emotion has an anchor hue (EMOTION_HUES). The top-2 emotion scores are
 *   blended via circular averaging (atan2 of weighted sin/cos) to produce a base hue.
 *   Saturation scales with the dominant emotion's intensity. Six palette colours are
 *   then spread around the base hue with offsets, alternating brightness.
 */

// ---------------------------------------------------------------------------
// Default palette — used before any emotion is applied
// ---------------------------------------------------------------------------

let paleta_fundo = "#1d1d1b";       // Background fill colour
let paleta_contorno = "#f2f2e7";    // Stroke (outline) colour
let paleta_cores = [                // Fill colours for shapes and cell backgrounds
  "#ffb000",
  "#ff4200",
  "#7da030",
  "#ff99cc",
  "#1d1d1b",
  "#f2f2e7",
];

// ---------------------------------------------------------------------------
// Dynamic colour generation from emotion scores
// ---------------------------------------------------------------------------

// Each emotion has an anchor hue (0-360). Scores are blended into a
// weighted-average hue, then a muted palette is generated from it.
const EMOTION_HUES = {
  joy: 42,        // warm amber
  sadness: 215,   // slate blue
  anger: 8,       // brick red
  fear: 260,      // muted purple
  surprise: 320,  // dusty mauve
  disgust: 95,    // olive green
  neutral: 35,    // warm grey-tan
};

/**
 * Derive a full colour set from the raw emotion scores.
 *
 * Uses a circular weighted average of the top-2 emotions' anchor hues
 * (atan2 of sin/cos sums) so that hues near 0/360 wrap correctly.
 * Scores are squared so the dominant emotion has a much stronger pull.
 *
 * @param {Array} emotions - Sorted array of {label, score} from the classifier.
 * @returns {{ bg: p5.Color, outline: p5.Color, palette: p5.Color[] }}
 */
function generateEmotionPalette(emotions) {
  // Switch to HSB mode for intuitive hue/saturation/brightness manipulation.
  // Arguments: hue range 0-360, saturation 0-100, brightness 0-100, alpha 0-100.
  colorMode(HSB, 360, 100, 100, 100);

  // Only use the top 2 emotions for hue — using all 7 muddies the result.
  // Square the scores so the dominant emotion has much stronger pull.
  const top = emotions.slice(0, 2);
  let hueX = 0, hueY = 0, totalScore = 0;
  for (const e of top) {
    const label = e.label.toLowerCase();
    const h = EMOTION_HUES[label] !== undefined ? EMOTION_HUES[label] : EMOTION_HUES.neutral;
    const w = e.score * e.score; // squared weight — dominant emotion dominates
    // Circular average: project each hue onto a unit circle, weight, then atan2
    hueX += Math.cos(h * Math.PI / 180) * w;
    hueY += Math.sin(h * Math.PI / 180) * w;
    totalScore += w;
  }

  // Recover the blended hue from the weighted x/y components
  let baseHue = ((Math.atan2(hueY, hueX) * 180 / Math.PI) + 360) % 360;

  // Intensity: how dominant the top emotion is (higher = more saturated)
  let intensity = emotions[0] ? emotions[0].score : 0;

  // Base saturation: lerp between 15 (weak) and 40 (strong) — always muted
  let baseSat = lerp(15, 40, intensity);

  // Background: very dark, slight hue tint
  const bg = color(baseHue, baseSat * 0.3, 11);

  // Outline: light, desaturated version of the base hue
  const outline = color(baseHue, baseSat * 0.2, 92);

  // Generate 6 palette colours spread around the base hue.
  // Offsets in degrees — wider spread gives more colour variety within the palette.
  const offsets = [-35, -15, 0, 20, 40, 60];
  const palette = offsets.map((off, i) => {
    const h = (baseHue + off + 360) % 360;
    // Alternate brightness for visual variety between even/odd palette slots
    const b = (i % 2 === 0) ? lerp(50, 70, intensity) : lerp(60, 80, intensity);
    // Saturation ramps slightly across the palette for tonal range
    const s = lerp(baseSat * 0.6, baseSat * 1.2, (i / offsets.length));
    return color(h, constrain(s, 8, 50), b);
  });

  // Switch back to RGB mode for the rest of the sketch
  colorMode(RGB, 255);
  return { bg, outline, palette };
}

// ---------------------------------------------------------------------------
// Emotion-driven structural parameters
// ---------------------------------------------------------------------------

let seno_escala = 0.01;              // Animation pulse speed (radians per frame)
let grade_coluna_qtd;                // Number of grid columns
let grade_linha_qtd;                 // Number of grid rows (computed from columns)
let semente;                         // Random seed — keeps the grid stable between frames

// Shape weights: [estrela, circulo, coroa, machado, losango, recursao]
// Higher number = more likely that shape is picked for a given cell.
let shape_weights = [1, 1, 1, 1, 1, 3];

let recursion_min_size = 60;         // Cells smaller than this pixel size won't subdivide
let stroke_peso = 2;                 // Stroke thickness in pixels
let star_points_range = [4, 18];     // [min, max] number of points on star shapes

/**
 * Each emotion defines a distinct structural fingerprint that changes how
 * the grid looks and behaves — independent of colour.
 *
 * Parameters:
 *   columns       — [min, max] grid density (fewer = bigger shapes, more = busier)
 *   weights       — probability weights for [star, circle, crown, axe, diamond, recursive]
 *   seno          — animation pulse speed (higher = faster oscillation)
 *   stroke        — outline thickness (heavier = more intense)
 *   recursion_min — minimum cell size in pixels before recursion stops
 *   star_points   — [min, max] number of star points
 */
const EMOTION_STRUCTURES = {
  joy: {
    columns: [5, 8],                   // Dense, varied grid
    weights: [2, 2, 2, 2, 2, 4],      // All shapes equally likely, lots of recursion
    seno: 0.025,                       // Moderate animation speed
    stroke: 2,
    recursion_min: 40,                 // Deep recursion allowed
    star_points: [8, 18],              // Multi-pointed stars
  },
  sadness: {
    columns: [2, 3],                   // Sparse, large shapes
    weights: [0, 3, 0, 0, 3, 0],      // Only circles and diamonds — simple, still
    seno: 0.003,                       // Very slow animation
    stroke: 1,                         // Thin, delicate lines
    recursion_min: 200,                // Effectively no recursion
    star_points: [4, 6],              // Simple star if one appears
  },
  anger: {
    columns: [3, 5],                   // Medium density
    weights: [4, 0, 1, 4, 0, 2],      // Stars and axes dominate — sharp, aggressive
    seno: 0.04,                        // Fast, agitated animation
    stroke: 4,                         // Heavy, bold strokes
    recursion_min: 50,
    star_points: [4, 6],              // Fewer points — jagged
  },
  fear: {
    columns: [6, 10],                  // Very dense, claustrophobic
    weights: [1, 0, 0, 1, 1, 6],      // Mostly recursive subdivision — fractal complexity
    seno: 0.015,
    stroke: 1,                         // Thin, anxious lines
    recursion_min: 25,                 // Very deep recursion
    star_points: [14, 18],            // Many-pointed stars — spiky
  },
  surprise: {
    columns: [4, 7],
    weights: [3, 3, 3, 3, 3, 3],      // Completely even — chaotic variety
    seno: 0.035,                       // Fast, energetic
    stroke: 3,
    recursion_min: 35,
    star_points: [3, 18],             // Widest range of star points
  },
  disgust: {
    columns: [3, 4],                   // Sparse
    weights: [0, 0, 4, 3, 0, 1],      // Crowns and axes — irregular, unsettling
    seno: 0.008,                       // Slow, uneasy
    stroke: 3,
    recursion_min: 80,
    star_points: [4, 8],
  },
  neutral: {
    columns: [3, 6],                   // Balanced
    weights: [1, 1, 1, 1, 1, 3],      // Default: slight bias toward recursion
    seno: 0.01,
    stroke: 2,
    recursion_min: 60,
    star_points: [4, 18],
  },
};

// ---------------------------------------------------------------------------
// Emotion application — called by the app controller after analysis
// ---------------------------------------------------------------------------

/**
 * Apply a new set of emotion scores to the grid.
 *
 * Blends the top-2 emotions' structural parameters (columns, weights, speed, etc.)
 * and regenerates the colour palette from the raw scores.
 *
 * @param {Array} emotions - Sorted array of {label, score} from the classifier.
 *   e.g. [{label: "joy", score: 0.72}, {label: "surprise", score: 0.14}, ...]
 */
function applyEmotionPalette(emotions) {
  if (!emotions || emotions.length === 0) return;

  // Primary emotion drives the structure
  const top = emotions[0];
  const label = top.label.toLowerCase();
  const structure = EMOTION_STRUCTURES[label] || EMOTION_STRUCTURES.neutral;

  // Secondary emotion — used for blending toward a mixed look
  const second = emotions.length > 1 ? emotions[1] : null;
  const secondStructure = second
    ? (EMOTION_STRUCTURES[second.label.toLowerCase()] || EMOTION_STRUCTURES.neutral)
    : null;

  // Blend ratio: how much the secondary emotion influences the result.
  // e.g. if top=0.72, second=0.14 → blendRatio ≈ 0.16 (mostly top)
  const blendRatio = second ? second.score / (top.score + second.score) : 0;

  // Blend column ranges between primary and secondary emotions
  const colMin = secondStructure
    ? lerp(structure.columns[0], secondStructure.columns[0], blendRatio)
    : structure.columns[0];
  const colMax = secondStructure
    ? lerp(structure.columns[1], secondStructure.columns[1], blendRatio)
    : structure.columns[1];

  // Pick a random column count within the blended range
  grade_coluna_qtd = floor(random(colMin, colMax + 1));

  // Blend shape weights with secondary emotion
  shape_weights = structure.weights.map((w, i) => {
    const sw = secondStructure ? secondStructure.weights[i] : w;
    return lerp(w, sw, blendRatio);
  });

  // Blend animation speed
  seno_escala = secondStructure
    ? lerp(structure.seno, secondStructure.seno, blendRatio)
    : structure.seno;

  // Blend stroke thickness
  stroke_peso = secondStructure
    ? lerp(structure.stroke, secondStructure.stroke, blendRatio)
    : structure.stroke;

  // Blend recursion threshold
  recursion_min_size = secondStructure
    ? lerp(structure.recursion_min, secondStructure.recursion_min, blendRatio)
    : structure.recursion_min;

  // Blend star point ranges
  star_points_range = [
    secondStructure
      ? floor(lerp(structure.star_points[0], secondStructure.star_points[0], blendRatio))
      : structure.star_points[0],
    secondStructure
      ? floor(lerp(structure.star_points[1], secondStructure.star_points[1], blendRatio))
      : structure.star_points[1],
  ];

  // Generate colours dynamically from all emotion scores
  const generatedColors = generateEmotionPalette(emotions);
  paleta_fundo = generatedColors.bg;
  paleta_contorno = generatedColors.outline;
  paleta_cores = generatedColors.palette;

  // Recompute grid dimensions from the new column count
  let modulo_tamanho = width / grade_coluna_qtd;
  grade_linha_qtd = ceil(height / modulo_tamanho);

  // New seed so the grid pattern changes on each emotion input
  semente = random(1000);
}

// ---------------------------------------------------------------------------
// Grid regeneration (used on startup and window resize)
// ---------------------------------------------------------------------------

/**
 * Regenerate the grid with random default parameters (no emotion influence).
 */
function regenerateGrid() {
  grade_coluna_qtd = floor(random(3, 7));
  let modulo_tamanho = width / grade_coluna_qtd;
  grade_linha_qtd = ceil(height / modulo_tamanho);
  semente = random(1000);
}

/**
 * Read the current dimensions of the #p5-holder container.
 * Falls back to window dimensions if the element doesn't exist.
 */
function getStageSize() {
  const holder = document.getElementById('p5-holder');
  if (!holder) {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return {
    width: holder.clientWidth || window.innerWidth,
    height: holder.clientHeight || window.innerHeight,
  };
}

// ---------------------------------------------------------------------------
// p5.js lifecycle
// ---------------------------------------------------------------------------

/** p5 setup — called once when the sketch loads. */
function setup() {
  const stageSize = getStageSize();
  const canvas = createCanvas(stageSize.width, stageSize.height);
  canvas.parent('p5-holder');  // Attach the canvas to the holder div
  strokeJoin(ROUND);           // Rounded corners on all stroke joins
  regenerateGrid();
}

/**
 * p5 draw — called every frame (~60fps).
 * Sets the background, locks the random seed (so the grid doesn't flicker),
 * then draws the full recursive grid.
 */
function draw() {
  background(paleta_fundo);
  randomSeed(semente);  // Lock randomness so the same grid is drawn each frame
  grade(0, 0, grade_coluna_qtd, grade_linha_qtd, width);
}

/** p5 windowResized — called when the browser window changes size. */
function windowResized() {
  const stageSize = getStageSize();
  resizeCanvas(stageSize.width, stageSize.height);
  regenerateGrid();
}

// ---------------------------------------------------------------------------
// Shape selection
// ---------------------------------------------------------------------------

/**
 * Weighted random selection from shape_weights.
 *
 * Each index corresponds to a shape:
 *   0 = estrela (star), 1 = circulo (circle), 2 = coroa_dupla (double crown),
 *   3 = machado (axe), 4 = losango (diamond), 5 = recursive sub-grid
 *
 * The algorithm sums all weights, picks a random number in [0, total),
 * then walks the array subtracting each weight until r <= 0.
 */
function pickShape() {
  const total = shape_weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) return 1; // fallback to circle if all weights are zero
  let r = random(total);
  for (let i = 0; i < shape_weights.length; i++) {
    r -= shape_weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Grid drawing (recursive)
// ---------------------------------------------------------------------------

/**
 * Draw the grid of geometric shapes.
 *
 * This function is recursive: when a cell selects shape index 5 (recursion)
 * and the cell is large enough, it calls grade() again to subdivide that
 * cell into a 2x2 mini-grid, creating a fractal effect.
 *
 * @param {number} x_inicial      — Top-left X of this grid region
 * @param {number} y_inicial      — Top-left Y of this grid region
 * @param {number} coluna_qtd     — Number of columns in this grid
 * @param {number} linha_qtd      — Number of rows in this grid
 * @param {number} largura_total  — Total pixel width of this grid region
 */
function grade(x_inicial, y_inicial, coluna_qtd, linha_qtd, largura_total) {
  stroke(paleta_contorno);
  strokeWeight(stroke_peso);

  let modulo_tamanho = largura_total / coluna_qtd; // Cell size in pixels
  let movimento_diferencial = 0; // Phase offset so each cell animates differently

  for (let j = 0; j < linha_qtd; j++) {
    for (let i = 0; i < coluna_qtd; i++) {
      let x = x_inicial + i * modulo_tamanho;
      let y = y_inicial + j * modulo_tamanho;

      // Draw the cell background with a random palette colour
      let cor_indice = floor(random(paleta_cores.length - 1));
      fill(paleta_cores[cor_indice]);
      rect(x, y, modulo_tamanho, modulo_tamanho);

      // Set the shape fill to the next palette colour (wrapping around)
      fill(paleta_cores[(cor_indice + 1) % paleta_cores.length]);

      // Sine-wave animation value (0-1) — modulates shape parameters.
      // Each cell gets a different phase offset (movimento_diferencial)
      // so shapes pulse independently.
      let movimento = map(sin(frameCount * seno_escala + movimento_diferencial), -1, 1, 0, 1);

      // Pick a shape using weighted random selection
      let seletor = pickShape();

      // --- Shape 0: Estrela (Star) ---
      // A multi-pointed star with inner radius animated by the sine wave.
      if (seletor === 0) {
        let raio_externo = modulo_tamanho / 2 - 5;       // Outer radius (fits within cell)
        let raio_interno = raio_externo * movimento;       // Inner radius pulses with animation
        let range = star_points_range[1] - star_points_range[0];
        let pontas_qtd = star_points_range[0] + floor(random(range / 2 + 1)) * 2; // Even number of points
        estrela(x + modulo_tamanho / 2, y + modulo_tamanho / 2, raio_interno, raio_externo, pontas_qtd, 0);
      }

      // --- Shape 1: Circulo (Circle) ---
      // A circle with diameter animated by the sine wave.
      if (seletor === 1) {
        let diametro = random(modulo_tamanho / 2, modulo_tamanho) * movimento;
        circle(x + modulo_tamanho / 2, y + modulo_tamanho / 2, diametro);
      }

      // --- Shape 2: Coroa Dupla (Double Crown) ---
      // Two interlocking zigzag rows forming a crown/wave pattern.
      if (seletor === 2) {
        let pontas = [3, 5, 7, 9, 11, 13][floor(random(6))]; // Odd number of crown points
        let pontas_altura = map(movimento, 0, 1, 0.2, 0.8);   // Crown height animated
        coroa_dupla(x, y, modulo_tamanho, modulo_tamanho, pontas, pontas_altura);
      }

      // --- Shape 3: Machado (Axe/Cross) ---
      // An axe-head cross shape with arm width animated.
      if (seletor === 3) {
        let haste_largura = map(movimento, 0, 1, 0.2, 0.8);
        machado(x, y, modulo_tamanho, modulo_tamanho, haste_largura);
      }

      // --- Shape 4: Losango (Diamond/Rhombus) ---
      // A diamond with width animated by the sine wave.
      if (seletor === 4) {
        let abertura_largura = random(0.4, 1) * movimento;
        losango(x, y, modulo_tamanho, modulo_tamanho, abertura_largura);
      }

      // --- Shape 5: Recursive Sub-Grid ---
      // Subdivide this cell into a 2x2 mini-grid (fractal recursion).
      // Only recurse if the cell is larger than the recursion minimum.
      if (seletor === 5 && modulo_tamanho > recursion_min_size) {
        grade(x, y, 2, 2, modulo_tamanho);
      }

      movimento_diferencial += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Shape drawing functions
// ---------------------------------------------------------------------------

/**
 * Draw a multi-pointed star.
 *
 * Alternates between inner and outer radius vertices around a centre point,
 * creating the characteristic star shape.
 *
 * @param {number} x             — Centre X
 * @param {number} y             — Centre Y
 * @param {number} raio_interno  — Inner radius (distance to inner vertices)
 * @param {number} raio_externo  — Outer radius (distance to outer points)
 * @param {number} pontas_qtd    — Number of star points
 * @param {number} angulo_inicial — Starting rotation angle in radians
 */
function estrela(x, y, raio_interno, raio_externo, pontas_qtd, angulo_inicial) {
  let step = TWO_PI / pontas_qtd; // Angle between consecutive points
  beginShape();
  for (let i = 0; i < pontas_qtd; i++) {
    let ang = angulo_inicial + step * i;
    // Inner vertex
    let interno_x = x + cos(ang) * raio_interno;
    let interno_y = y + sin(ang) * raio_interno;
    vertex(interno_x, interno_y);
    // Outer vertex (halfway between inner vertices)
    let externo_x = x + cos(ang + step / 2.0) * raio_externo;
    let externo_y = y + sin(ang + step / 2.0) * raio_externo;
    vertex(externo_x, externo_y);
  }
  endShape(CLOSE);
}

/**
 * Draw a double crown — two interlocking zigzag rows.
 *
 * The top row zigzags downward, the bottom row zigzags upward,
 * creating a decorative frame-like pattern within the cell.
 *
 * @param {number} x       — Top-left X
 * @param {number} y       — Top-left Y
 * @param {number} largura — Width
 * @param {number} altura  — Height
 * @param {number} pontas_qtd              — Number of zigzag points
 * @param {number} pontas_altura_relativa  — Height of zigzags relative to cell height (0-1)
 */
function coroa_dupla(x, y, largura, altura, pontas_qtd, pontas_altura_relativa) {
  let pontas_altura = altura * pontas_altura_relativa / 2;
  let pontas_deslocamento = largura / (pontas_qtd - 1); // Horizontal spacing between points
  beginShape();
  // Top zigzag row (left to right)
  for (let i = 0; i < pontas_qtd; i++) {
    let ponta_x = x + i * pontas_deslocamento;
    let ponta_y = y;
    if (i % 2 !== 0) {
      ponta_y = y + pontas_altura; // Odd points dip down
    }
    vertex(ponta_x, ponta_y);
  }
  // Bottom zigzag row (right to left)
  for (let i = 0; i < pontas_qtd; i++) {
    let ponta_x = (x + largura) - (i * pontas_deslocamento);
    let ponta_y = y + altura;
    if (i % 2 !== 0) {
      ponta_y = (y + altura) - pontas_altura; // Odd points push up
    }
    vertex(ponta_x, ponta_y);
  }
  endShape(CLOSE);
}

/**
 * Draw a machado (axe/cross) shape.
 *
 * A cross-like shape with notched corners, resembling a double-headed axe.
 * The arm width is animated by the sine wave.
 *
 * @param {number} x       — Top-left X
 * @param {number} y       — Top-left Y
 * @param {number} largura — Width
 * @param {number} altura  — Height
 * @param {number} haste_largura_relativa — Arm width relative to cell size (0-1)
 */
function machado(x, y, largura, altura, haste_largura_relativa) {
  let haste_largura = largura * haste_largura_relativa / 2;
  beginShape();
  // 12 vertices forming the cross/axe outline (clockwise)
  vertex(x, y);                                              // Top-left corner
  vertex(x + haste_largura, y + haste_largura);             // Left notch
  vertex(x + haste_largura, y);                              // Inner top-left
  vertex(x + (largura - haste_largura), y);                  // Inner top-right
  vertex(x + (largura - haste_largura), y + haste_largura); // Right notch
  vertex(x + largura, y);                                    // Top-right corner
  vertex(x + largura, y + altura);                           // Bottom-right corner
  vertex(x + (largura - haste_largura), y + (altura - haste_largura)); // Right bottom notch
  vertex(x + (largura - haste_largura), y + altura);         // Inner bottom-right
  vertex(x + haste_largura, y + altura);                     // Inner bottom-left
  vertex(x + haste_largura, y + (altura - haste_largura));  // Left bottom notch
  vertex(x, y + altura);                                     // Bottom-left corner
  endShape(CLOSE);
}

/**
 * Draw a losango (diamond/rhombus) shape.
 *
 * A four-vertex diamond centred within the cell. The horizontal width
 * is animated, making it breathe between narrow and wide.
 *
 * @param {number} x       — Top-left X
 * @param {number} y       — Top-left Y
 * @param {number} largura — Width
 * @param {number} altura  — Height
 * @param {number} abertura_relativa — Diamond width relative to cell (0-1)
 */
function losango(x, y, largura, altura, abertura_relativa) {
  let abertura_largura = largura * abertura_relativa / 2;
  beginShape();
  vertex(x + abertura_largura, y + altura / 2);          // Left point
  vertex(x + largura / 2, y);                              // Top point
  vertex(x + (largura - abertura_largura), y + altura / 2); // Right point
  vertex(x + largura / 2, y + altura);                     // Bottom point
  endShape(CLOSE);
}
