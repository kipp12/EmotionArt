// Geometric Grid theme - adapted from a Brazilian geometric art sketch.
// Emotions drive grid structure, shape distribution, recursion, and animation.

let paleta_fundo = "#1d1d1b";
let paleta_contorno = "#f2f2e7";
let paleta_cores = [
  "#ffb000",
  "#ff4200",
  "#7da030",
  "#ff99cc",
  "#1d1d1b",
  "#f2f2e7",
];

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

// Derive a full colour set from the raw emotion scores.
// Returns { bg, outline, palette[] } — all p5 color objects.
function generateEmotionPalette(emotions) {
  colorMode(HSB, 360, 100, 100, 100);

  // Only use the top 2 emotions for hue — using all 7 muddies the result.
  // Square the scores so the dominant emotion has much stronger pull.
  const top = emotions.slice(0, 2);
  let hueX = 0, hueY = 0, totalScore = 0;
  for (const e of top) {
    const label = e.label.toLowerCase();
    const h = EMOTION_HUES[label] !== undefined ? EMOTION_HUES[label] : EMOTION_HUES.neutral;
    const w = e.score * e.score; // squared weight
    hueX += Math.cos(h * Math.PI / 180) * w;
    hueY += Math.sin(h * Math.PI / 180) * w;
    totalScore += w;
  }

  let baseHue = ((Math.atan2(hueY, hueX) * 180 / Math.PI) + 360) % 360;
  // Intensity: how dominant the top emotion is (higher = more saturated)
  let intensity = emotions[0] ? emotions[0].score : 0;
  let baseSat = lerp(15, 40, intensity);

  // Background: very dark, slight hue tint
  const bg = color(baseHue, baseSat * 0.3, 11);

  // Outline: light, desaturated version
  const outline = color(baseHue, baseSat * 0.2, 92);

  // Generate 6 palette colours spread around the base hue
  const offsets = [-35, -15, 0, 20, 40, 60];
  const palette = offsets.map((off, i) => {
    const h = (baseHue + off + 360) % 360;
    // Alternate brightness for visual variety
    const b = (i % 2 === 0) ? lerp(50, 70, intensity) : lerp(60, 80, intensity);
    const s = lerp(baseSat * 0.6, baseSat * 1.2, (i / offsets.length));
    return color(h, constrain(s, 8, 50), b);
  });

  colorMode(RGB, 255);
  return { bg, outline, palette };
}

// --- Emotion-driven structural parameters ---

let seno_escala = 0.01;       // animation pulse speed
let grade_coluna_qtd;
let grade_linha_qtd;
let semente;

// Shape weights: [estrela, circulo, coroa, machado, losango, recursao]
// Higher number = more likely to appear.
let shape_weights = [1, 1, 1, 1, 1, 3];

let recursion_min_size = 60;  // cells smaller than this won't subdivide
let stroke_peso = 2;          // stroke thickness
let star_points_range = [4, 18]; // min/max star points

// Each emotion defines a distinct structural fingerprint.
// columns:        grid density (fewer = bigger shapes, more = busier)
// weights:        [estrela, circulo, coroa, machado, losango, recursao]
// seno:           animation pulse speed
// stroke:         outline thickness
// recursion_min:  minimum cell size before recursion stops
// star_points:    [min, max] points on stars
const EMOTION_STRUCTURES = {
  joy: {
    columns: [5, 8],
    weights: [2, 2, 2, 2, 2, 4],
    seno: 0.025,
    stroke: 2,
    recursion_min: 40,
    star_points: [8, 18],
  },
  sadness: {
    columns: [2, 3],
    weights: [0, 3, 0, 0, 3, 0],
    seno: 0.003,
    stroke: 1,
    recursion_min: 200,
    star_points: [4, 6],
  },
  anger: {
    columns: [3, 5],
    weights: [4, 0, 1, 4, 0, 2],
    seno: 0.04,
    stroke: 4,
    recursion_min: 50,
    star_points: [4, 6],
  },
  fear: {
    columns: [6, 10],
    weights: [1, 0, 0, 1, 1, 6],
    seno: 0.015,
    stroke: 1,
    recursion_min: 25,
    star_points: [14, 18],
  },
  surprise: {
    columns: [4, 7],
    weights: [3, 3, 3, 3, 3, 3],
    seno: 0.035,
    stroke: 3,
    recursion_min: 35,
    star_points: [3, 18],
  },
  disgust: {
    columns: [3, 4],
    weights: [0, 0, 4, 3, 0, 1],
    seno: 0.008,
    stroke: 3,
    recursion_min: 80,
    star_points: [4, 8],
  },
  neutral: {
    columns: [3, 6],
    weights: [1, 1, 1, 1, 1, 3],
    seno: 0.01,
    stroke: 2,
    recursion_min: 60,
    star_points: [4, 18],
  },
};

function applyEmotionPalette(emotions) {
  if (!emotions || emotions.length === 0) return;

  const top = emotions[0];
  const label = top.label.toLowerCase();
  const structure = EMOTION_STRUCTURES[label] || EMOTION_STRUCTURES.neutral;

  // If there's a secondary emotion, blend the column range toward it
  const second = emotions.length > 1 ? emotions[1] : null;
  const secondStructure = second
    ? (EMOTION_STRUCTURES[second.label.toLowerCase()] || EMOTION_STRUCTURES.neutral)
    : null;

  const blendRatio = second ? second.score / (top.score + second.score) : 0;

  const colMin = secondStructure
    ? lerp(structure.columns[0], secondStructure.columns[0], blendRatio)
    : structure.columns[0];
  const colMax = secondStructure
    ? lerp(structure.columns[1], secondStructure.columns[1], blendRatio)
    : structure.columns[1];

  grade_coluna_qtd = floor(random(colMin, colMax + 1));

  // Blend shape weights with secondary emotion
  shape_weights = structure.weights.map((w, i) => {
    const sw = secondStructure ? secondStructure.weights[i] : w;
    return lerp(w, sw, blendRatio);
  });

  seno_escala = secondStructure
    ? lerp(structure.seno, secondStructure.seno, blendRatio)
    : structure.seno;

  stroke_peso = secondStructure
    ? lerp(structure.stroke, secondStructure.stroke, blendRatio)
    : structure.stroke;

  recursion_min_size = secondStructure
    ? lerp(structure.recursion_min, secondStructure.recursion_min, blendRatio)
    : structure.recursion_min;

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

  let modulo_tamanho = width / grade_coluna_qtd;
  grade_linha_qtd = ceil(height / modulo_tamanho);
  semente = random(1000);
}

function regenerateGrid() {
  grade_coluna_qtd = floor(random(3, 7));
  let modulo_tamanho = width / grade_coluna_qtd;
  grade_linha_qtd = ceil(height / modulo_tamanho);
  semente = random(1000);
}

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

function setup() {
  const stageSize = getStageSize();
  const canvas = createCanvas(stageSize.width, stageSize.height);
  canvas.parent('p5-holder');
  strokeJoin(ROUND);
  regenerateGrid();
}

function draw() {
  background(paleta_fundo);
  randomSeed(semente);
  grade(0, 0, grade_coluna_qtd, grade_linha_qtd, width);
}

function windowResized() {
  const stageSize = getStageSize();
  resizeCanvas(stageSize.width, stageSize.height);
  regenerateGrid();
}

// Weighted random selection from shape_weights
function pickShape() {
  const total = shape_weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) return 1; // fallback to circle
  let r = random(total);
  for (let i = 0; i < shape_weights.length; i++) {
    r -= shape_weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

function grade(x_inicial, y_inicial, coluna_qtd, linha_qtd, largura_total) {
  stroke(paleta_contorno);
  strokeWeight(stroke_peso);

  let modulo_tamanho = largura_total / coluna_qtd;
  let movimento_diferencial = 0;

  for (let j = 0; j < linha_qtd; j++) {
    for (let i = 0; i < coluna_qtd; i++) {
      let x = x_inicial + i * modulo_tamanho;
      let y = y_inicial + j * modulo_tamanho;

      let cor_indice = floor(random(paleta_cores.length - 1));
      fill(paleta_cores[cor_indice]);
      rect(x, y, modulo_tamanho, modulo_tamanho);
      fill(paleta_cores[(cor_indice + 1) % paleta_cores.length]);

      let movimento = map(sin(frameCount * seno_escala + movimento_diferencial), -1, 1, 0, 1);

      let seletor = pickShape();

      if (seletor === 0) {
        let raio_externo = modulo_tamanho / 2 - 5;
        let raio_interno = raio_externo * movimento;
        let range = star_points_range[1] - star_points_range[0];
        let pontas_qtd = star_points_range[0] + floor(random(range / 2 + 1)) * 2;
        estrela(x + modulo_tamanho / 2, y + modulo_tamanho / 2, raio_interno, raio_externo, pontas_qtd, 0);
      }

      if (seletor === 1) {
        let diametro = random(modulo_tamanho / 2, modulo_tamanho) * movimento;
        circle(x + modulo_tamanho / 2, y + modulo_tamanho / 2, diametro);
      }

      if (seletor === 2) {
        let pontas = [3, 5, 7, 9, 11, 13][floor(random(6))];
        let pontas_altura = map(movimento, 0, 1, 0.2, 0.8);
        coroa_dupla(x, y, modulo_tamanho, modulo_tamanho, pontas, pontas_altura);
      }

      if (seletor === 3) {
        let haste_largura = map(movimento, 0, 1, 0.2, 0.8);
        machado(x, y, modulo_tamanho, modulo_tamanho, haste_largura);
      }

      if (seletor === 4) {
        let abertura_largura = random(0.4, 1) * movimento;
        losango(x, y, modulo_tamanho, modulo_tamanho, abertura_largura);
      }

      if (seletor === 5 && modulo_tamanho > recursion_min_size) {
        grade(x, y, 2, 2, modulo_tamanho);
      }

      movimento_diferencial += 1;
    }
  }
}

function estrela(x, y, raio_interno, raio_externo, pontas_qtd, angulo_inicial) {
  let step = TWO_PI / pontas_qtd;
  beginShape();
  for (let i = 0; i < pontas_qtd; i++) {
    let ang = angulo_inicial + step * i;
    let interno_x = x + cos(ang) * raio_interno;
    let interno_y = y + sin(ang) * raio_interno;
    vertex(interno_x, interno_y);
    let externo_x = x + cos(ang + step / 2.0) * raio_externo;
    let externo_y = y + sin(ang + step / 2.0) * raio_externo;
    vertex(externo_x, externo_y);
  }
  endShape(CLOSE);
}

function coroa_dupla(x, y, largura, altura, pontas_qtd, pontas_altura_relativa) {
  let pontas_altura = altura * pontas_altura_relativa / 2;
  let pontas_deslocamento = largura / (pontas_qtd - 1);
  beginShape();
  for (let i = 0; i < pontas_qtd; i++) {
    let ponta_x = x + i * pontas_deslocamento;
    let ponta_y = y;
    if (i % 2 !== 0) {
      ponta_y = y + pontas_altura;
    }
    vertex(ponta_x, ponta_y);
  }
  for (let i = 0; i < pontas_qtd; i++) {
    let ponta_x = (x + largura) - (i * pontas_deslocamento);
    let ponta_y = y + altura;
    if (i % 2 !== 0) {
      ponta_y = (y + altura) - pontas_altura;
    }
    vertex(ponta_x, ponta_y);
  }
  endShape(CLOSE);
}

function machado(x, y, largura, altura, haste_largura_relativa) {
  let haste_largura = largura * haste_largura_relativa / 2;
  beginShape();
  vertex(x, y);
  vertex(x + haste_largura, y + haste_largura);
  vertex(x + haste_largura, y);
  vertex(x + (largura - haste_largura), y);
  vertex(x + (largura - haste_largura), y + haste_largura);
  vertex(x + largura, y);
  vertex(x + largura, y + altura);
  vertex(x + (largura - haste_largura), y + (altura - haste_largura));
  vertex(x + (largura - haste_largura), y + altura);
  vertex(x + haste_largura, y + altura);
  vertex(x + haste_largura, y + (altura - haste_largura));
  vertex(x, y + altura);
  endShape(CLOSE);
}

function losango(x, y, largura, altura, abertura_relativa) {
  let abertura_largura = largura * abertura_relativa / 2;
  beginShape();
  vertex(x + abertura_largura, y + altura / 2);
  vertex(x + largura / 2, y);
  vertex(x + (largura - abertura_largura), y + altura / 2);
  vertex(x + largura / 2, y + altura);
  endShape(CLOSE);
}
