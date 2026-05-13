// Deep Dive Frenzy - growth arcade game
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = 900;
const H = 550;
canvas.width = W;
canvas.height = H;

const gameBackground = new Image();
gameBackground.src = 'game_asset/background.jpeg';

const MODES = {
  classic: {
    label: 'Classic',
    goal: 'Become the biggest fish in the deep.',
    lives: 3,
    startTime: 0,
    startSpawn: 88,
    minSpawn: 34,
    foodChance: 0.7,
    growthBoost: 1,
    scoreBoost: 1,
    threatBoost: 0,
    winAtApex: true,
  },
  timeAttack: {
    label: 'Time Attack',
    goal: 'Grow and score as much as possible before the clock runs out.',
    lives: 3,
    startTime: 90,
    startSpawn: 62,
    minSpawn: 26,
    foodChance: 0.78,
    growthBoost: 1.2,
    scoreBoost: 1.35,
    threatBoost: 0.1,
    winAtApex: false,
  },
  survival: {
    label: 'Survival',
    goal: 'Stay alive while the deep gets faster and meaner.',
    lives: 1,
    startTime: 0,
    startSpawn: 72,
    minSpawn: 20,
    foodChance: 0.58,
    growthBoost: 0.9,
    scoreBoost: 1,
    threatBoost: 0.35,
    winAtApex: false,
  },
};

const APEX_RANK = 8;
const keys = {};

let selectedMode = 'classic';
let phase = 'start';
let score = 0;
let lives = 3;
let level = 1;
let elapsed = 0;
let remainingTime = 0;
let spawnTimer = 0;
let spawnInterval = 88;
let bgOffset = 0;
let flashTimer = 0;
let modeMessage = '';
let player;
let entities = [];
let bubbles = [];
let seaweed = [];
let scorePopups = [];

const FISH_TYPES = [
  { name: 'Minnow', rank: 1, col: '#56d6ff', w: 24, h: 12, pts: 8, growth: 1 },
  { name: 'Shrimp', rank: 1, col: '#ff7d66', w: 22, h: 11, pts: 10, growth: 1 },
  { name: 'Reef Fish', rank: 2, col: '#ffd166', w: 34, h: 17, pts: 16, growth: 1.4 },
  { name: 'Blue Tang', rank: 3, col: '#41b6ff', w: 46, h: 22, pts: 25, growth: 2 },
  { name: 'Barracuda', rank: 4, col: '#9ad1d4', w: 64, h: 28, pts: 42, growth: 2.8 },
  { name: 'Tuna', rank: 5, col: '#a7b8c9', w: 80, h: 34, pts: 62, growth: 3.7 },
  { name: 'Hammerhead', rank: 6, col: '#8b99a6', w: 104, h: 42, pts: 95, growth: 5 },
  { name: 'Great White', rank: 7, col: '#737f8c', w: 128, h: 52, pts: 135, growth: 6.5 },
  { name: 'Ancient Leviathan', rank: 8, col: '#505866', w: 156, h: 64, pts: 220, growth: 8 },
];

const HAZARD_TYPES = [
  { name: 'Jellyfish', col: '#cc44ff', w: 38, h: 42 },
  { name: 'Urchin', col: '#d94444', w: 34, h: 34 },
];

function currentMode() {
  return MODES[selectedMode];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function initPlayer() {
  player = {
    x: W / 2,
    y: H / 2,
    rank: 2,
    growth: 0,
    nextGrowth: growthNeeded(2),
    w: 72,
    h: 32,
    vx: 0,
    vy: 0,
    facing: 1,
    invTimer: 0,
    eatAnim: 0,
  };
  syncPlayerSize();
}

function growthNeeded(rank) {
  return 5 + rank * 2.5;
}

function syncPlayerSize() {
  const scale = 0.78 + player.rank * 0.16 + Math.min(0.12, player.growth / player.nextGrowth * 0.12);
  player.w = 70 * scale;
  player.h = 32 * scale;
}

function initSeaweed() {
  seaweed = [];
  for (let i = 0; i < 12; i++) {
    seaweed.push({
      x: i * (W / 11) + 20,
      h: 40 + Math.random() * 60,
      phase: Math.random() * Math.PI * 2,
      col: i % 2 === 0 ? '#0D3A36' : '#14524B',
    });
  }
}

function initBubbles() {
  bubbles = [];
  for (let i = 0; i < 40; i++) bubbles.push(mkBubble(true));
}

function mkBubble(randomY) {
  return {
    x: Math.random() * W,
    y: randomY ? Math.random() * H : H + 10,
    r: Math.random() * 3 + 1,
    sp: Math.random() * 0.6 + 0.2,
    op: Math.random() * 0.3 + 0.05,
  };
}

function resetRun() {
  const mode = currentMode();
  score = 0;
  lives = mode.lives;
  level = 1;
  elapsed = 0;
  remainingTime = mode.startTime;
  spawnTimer = 0;
  spawnInterval = mode.startSpawn;
  flashTimer = 0;
  modeMessage = mode.goal;
  entities = [];
  scorePopups = [];
  initPlayer();
  initBubbles();
  initSeaweed();
  seedStartingFish();
  updateModeButtons();
}

function seedStartingFish() {
  for (let i = 0; i < 8; i++) spawnEntity(true);
}

function weightedFishPool() {
  const mode = currentMode();
  const maxRank = clamp(player.rank + 3 + Math.floor(level / 3), 2, APEX_RANK);
  const minRank = selectedMode === 'survival' ? 1 : Math.max(1, player.rank - 2);
  return FISH_TYPES.filter(fish => fish.rank >= minRank && fish.rank <= maxRank).filter(fish => {
    if (fish.rank <= player.rank + 1) return true;
    return Math.random() < 0.35 + mode.threatBoost;
  });
}

function spawnEntity(seed = false) {
  const mode = currentMode();
  const spawnHazard = !seed && Math.random() > mode.foodChance + Math.min(0.08, player.rank * 0.01);
  if (spawnHazard) {
    spawnHazardEntity();
    return;
  }

  const pool = weightedFishPool();
  const type = pool[Math.floor(Math.random() * pool.length)] || FISH_TYPES[0];
  const fromLeft = Math.random() < 0.5;
  const speed = (0.65 + Math.random() * 1.35 + level * 0.12 + type.rank * 0.04) * (fromLeft ? 1 : -1);
  const y = seed ? rand(80, H - 120) : rand(62, H - 125);
  entities.push({
    type: 'fish',
    name: type.name,
    rank: type.rank,
    x: seed ? rand(60, W - 60) : (fromLeft ? -90 : W + 90),
    y,
    vx: seed ? speed * 0.55 : speed,
    vy: rand(-0.45, 0.45),
    w: type.w,
    h: type.h,
    col: type.col,
    pts: type.pts,
    growth: type.growth,
    alive: true,
    wobble: Math.random() * Math.PI * 2,
  });
}

function spawnHazardEntity() {
  const type = HAZARD_TYPES[Math.floor(Math.random() * HAZARD_TYPES.length)];
  const jelly = type.name === 'Jellyfish';
  entities.push({
    type: 'hazard',
    name: type.name,
    rank: APEX_RANK + 1,
    x: jelly ? rand(35, W - 35) : (Math.random() < 0.5 ? -70 : W + 70),
    y: jelly ? H + 45 : rand(70, H - 130),
    vx: jelly ? rand(-0.25, 0.25) : (Math.random() < 0.5 ? 1 : -1) * rand(1.2, 2.3 + level * 0.1),
    vy: jelly ? -rand(0.6, 1.4) : rand(-0.35, 0.35),
    w: type.w,
    h: type.h,
    col: type.col,
    alive: true,
    wobble: Math.random() * Math.PI * 2,
  });
}

function isEdible(entity) {
  return entity.type === 'fish' && player.rank >= entity.rank;
}

function isThreat(entity) {
  return entity.type === 'hazard' || (entity.type === 'fish' && entity.rank > player.rank);
}

function eatEntity(entity) {
  const mode = currentMode();
  const rankBonus = Math.max(1, entity.rank * 0.15);
  const points = Math.round(entity.pts * mode.scoreBoost * rankBonus);
  entity.alive = false;
  score += points;
  player.eatAnim = 12;
  player.growth += entity.growth * mode.growthBoost;
  scorePopups.push({ x: entity.x, y: entity.y, txt: '+' + points, life: 60, vy: -1.2 });

  while (player.rank < APEX_RANK && player.growth >= player.nextGrowth) {
    player.growth -= player.nextGrowth;
    player.rank++;
    level = Math.max(level, player.rank - 1);
    player.nextGrowth = growthNeeded(player.rank);
    spawnInterval = Math.max(mode.minSpawn, spawnInterval - 7);
    scorePopups.push({ x: W / 2, y: H / 2, txt: sizeLabel(), life: 95, vy: -0.45, big: true });
  }

  if (player.rank >= APEX_RANK) {
    player.growth = 0;
    if (mode.winAtApex) {
      modeMessage = 'You became the biggest fish in the deep.';
      phase = 'won';
    } else {
      modeMessage = 'Apex size reached. Keep hunting for a record score.';
    }
  }
  syncPlayerSize();
}

function sizeLabel() {
  if (player.rank >= APEX_RANK) return 'APEX PREDATOR!';
  return 'SIZE ' + player.rank + '!';
}

function takeHit() {
  if (player.invTimer > 0) return;
  lives--;
  flashTimer = 30;
  player.invTimer = 88;
  scorePopups.push({ x: player.x, y: player.y - 28, txt: lives > 0 ? 'HIT!' : 'NO LIVES', life: 55, vy: -0.6, danger: true });
  if (lives <= 0) {
    modeMessage = selectedMode === 'survival' ? 'Survival run ended.' : 'The deep claimed you.';
    phase = 'gameover';
  }
}

function updateModeButtons() {
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === selectedMode);
  });
}

document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.key === ' ') handleSpace();
  if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (phase === 'playing' || phase === 'paused')) togglePause();
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

function handleSpace() {
  if (phase === 'start') startGame();
  else if (phase === 'gameover' || phase === 'won') startGame();
  else if (phase === 'playing' || phase === 'paused') togglePause();
}

function togglePause() {
  phase = phase === 'paused' ? 'playing' : 'paused';
}

window.setGameMode = function setGameMode(modeKey) {
  if (!MODES[modeKey]) return;
  selectedMode = modeKey;
  resetRun();
  phase = 'start';
  updateModeButtons();
};

window.startGame = function startGame() {
  resetRun();
  phase = 'playing';
};

window.resetGame = function resetGame() {
  resetRun();
  phase = 'start';
};

window.pauseGame = function pauseGame() {
  if (phase === 'playing' || phase === 'paused') togglePause();
};

function update() {
  if (phase !== 'playing') return;

  const mode = currentMode();
  elapsed++;
  bgOffset = (bgOffset + 0.3 + level * 0.02) % W;

  if (mode.startTime > 0) {
    remainingTime = Math.max(0, mode.startTime - Math.floor(elapsed / 60));
    if (remainingTime <= 0) {
      modeMessage = 'Time is up. Final score: ' + score;
      phase = 'gameover';
      return;
    }
  }

  if (selectedMode === 'survival' && elapsed % 600 === 0) {
    level++;
    spawnInterval = Math.max(mode.minSpawn, spawnInterval - 5);
    score += 25 * level;
    scorePopups.push({ x: W / 2, y: 92, txt: 'DEPTH ' + level, life: 80, vy: -0.45, big: true });
  }

  bubbles.forEach((b, i) => {
    b.y -= b.sp;
    if (b.y < -5) bubbles[i] = mkBubble(false);
  });
  seaweed.forEach(s => { s.phase += 0.02; });

  updatePlayer();
  updateSpawning();
  updateEntities();
  checkCollisions();
  updatePopups();
}

function updatePlayer() {
  const accel = 0.52;
  const drag = 0.88;
  const maxSpd = 4.5 + Math.min(2.4, player.rank * 0.22);

  if (keys.ArrowLeft || keys.a || keys.A) { player.vx -= accel; player.facing = -1; }
  if (keys.ArrowRight || keys.d || keys.D) { player.vx += accel; player.facing = 1; }
  if (keys.ArrowUp || keys.w || keys.W) player.vy -= accel;
  if (keys.ArrowDown || keys.s || keys.S) player.vy += accel;

  player.vx *= drag;
  player.vy *= drag;
  player.vx = clamp(player.vx, -maxSpd, maxSpd);
  player.vy = clamp(player.vy, -maxSpd, maxSpd);
  player.x += player.vx;
  player.y += player.vy;
  player.x = clamp(player.x, player.w / 2, W - player.w / 2);
  player.y = clamp(player.y, player.h / 2, H - player.h / 2 - 16);

  if (player.invTimer > 0) player.invTimer--;
  if (player.eatAnim > 0) player.eatAnim--;
}

function updateSpawning() {
  const mode = currentMode();
  spawnTimer++;
  const pressure = selectedMode === 'survival' ? Math.floor(elapsed / 900) * 3 : 0;
  const targetInterval = Math.max(mode.minSpawn, spawnInterval - pressure);
  if (spawnTimer >= targetInterval) {
    spawnTimer = 0;
    spawnEntity();
  }
}

function updateEntities() {
  entities.forEach(entity => {
    entity.x += entity.vx;
    entity.y += entity.vy;
    entity.wobble += 0.06;

    if (entity.type === 'hazard' && entity.name === 'Jellyfish') {
      entity.vx += Math.sin(entity.wobble) * 0.025;
    }
    if (entity.type === 'fish' && entity.rank > player.rank && Math.abs(entity.y - player.y) < 120) {
      entity.vy += entity.y < player.y ? 0.018 : -0.018;
      entity.vy = clamp(entity.vy, -0.8, 0.8);
    }
  });

  entities = entities.filter(entity => {
    return entity.alive && entity.x > -180 && entity.x < W + 180 && entity.y > -140 && entity.y < H + 140;
  });
}

function checkCollisions() {
  entities.forEach(entity => {
    if (!entity.alive) return;
    const dx = Math.abs(player.x - entity.x);
    const dy = Math.abs(player.y - entity.y);
    const hit = dx < (player.w / 2 + entity.w / 2) * 0.68 && dy < (player.h / 2 + entity.h / 2) * 0.74;
    if (!hit) return;

    if (isEdible(entity)) {
      eatEntity(entity);
    } else if (isThreat(entity)) {
      if (entity.type === 'fish') entity.alive = false;
      takeHit();
    }
  });
}

function updatePopups() {
  scorePopups.forEach(popup => {
    popup.y += popup.vy;
    popup.life--;
  });
  scorePopups = scorePopups.filter(popup => popup.life > 0);
}

function drawBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#050e0e');
  g.addColorStop(0.6, '#071a19');
  g.addColorStop(1, '#0D3A36');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (gameBackground.complete && gameBackground.naturalWidth > 0) {
    drawCoverImage(gameBackground, 0, 0, W, H);
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(5,14,14,0.34)');
    shade.addColorStop(0.55, 'rgba(5,7,7,0.22)');
    shade.addColorStop(1, 'rgba(5,7,7,0.52)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.save();
  for (let i = 0; i < 5; i++) {
    const rx = (bgOffset + i * 200) % W;
    const rg = ctx.createRadialGradient(rx, -40, 0, rx, 100, 320);
    rg.addColorStop(0, 'rgba(0,208,230,0.04)');
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawCoverImage(image, x, y, w, h) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = w / h;
  let sourceW = image.naturalWidth;
  let sourceH = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > canvasRatio) {
    sourceW = image.naturalHeight * canvasRatio;
    sourceX = (image.naturalWidth - sourceW) / 2;
  } else {
    sourceH = image.naturalWidth / canvasRatio;
    sourceY = (image.naturalHeight - sourceH) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, x, y, w, h);
}

function drawSeaweed() {
  seaweed.forEach(s => {
    const segments = 6;
    const segH = s.h / segments;
    ctx.beginPath();
    ctx.moveTo(s.x, H - 10);
    for (let i = 1; i <= segments; i++) {
      const sway = Math.sin(s.phase + i * 0.7) * 10 * (i / segments);
      ctx.lineTo(s.x + sway, H - 10 - i * segH);
    }
    ctx.strokeStyle = s.col;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  });
}

function drawBubbles() {
  bubbles.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(31,230,255,${b.op})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function drawEntity(entity) {
  ctx.save();
  ctx.translate(entity.x, entity.y + Math.sin(entity.wobble) * 3);

  if (entity.type === 'hazard') {
    drawHazard(entity);
  } else {
    drawFish(entity, isEdible(entity));
  }

  ctx.restore();
}

function drawFish(entity, edible) {
  if (entity.vx > 0) ctx.scale(-1, 1);

  const dangerGlow = edible ? entity.col : '#ff4444';
  ctx.shadowColor = dangerGlow;
  ctx.shadowBlur = edible ? 8 : 16;
  ctx.fillStyle = edible ? entity.col + 'bb' : '#65707f99';
  ctx.beginPath();
  ctx.ellipse(0, 0, entity.w / 2, entity.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = edible ? entity.col + '88' : '#ff444488';
  ctx.beginPath();
  ctx.moveTo(-entity.w / 2, 0);
  ctx.lineTo(-entity.w / 2 - entity.w * 0.34, -entity.h * 0.45);
  ctx.lineTo(-entity.w / 2 - entity.w * 0.34, entity.h * 0.45);
  ctx.closePath();
  ctx.fill();

  if (!edible) {
    ctx.strokeStyle = '#ff777777';
    ctx.lineWidth = 1.4;
    for (let t = 0; t < 4; t++) {
      ctx.beginPath();
      ctx.moveTo(-entity.w * 0.12 + t * entity.w * 0.15, entity.h * 0.34);
      ctx.lineTo(-entity.w * 0.12 + t * entity.w * 0.15 + 3, entity.h * 0.55);
      ctx.stroke();
    }
  }

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(entity.w * 0.27, -entity.h * 0.16, Math.max(3, entity.h * 0.18), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = edible ? '#111' : '#e00022';
  ctx.beginPath();
  ctx.arc(entity.w * 0.29, -entity.h * 0.16, Math.max(1.8, entity.h * 0.08), 0, Math.PI * 2);
  ctx.fill();

}

function drawHazard(entity) {
  if (entity.name === 'Jellyfish') {
    ctx.shadowColor = entity.col;
    ctx.shadowBlur = 14;
    ctx.fillStyle = entity.col + '70';
    ctx.beginPath();
    ctx.arc(0, -entity.h * 0.15, entity.w / 2, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    for (let t = 0; t < 5; t++) {
      ctx.strokeStyle = entity.col + '80';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-entity.w * 0.35 + t * (entity.w * 0.17), entity.h * 0.1);
      ctx.bezierCurveTo(
        -entity.w * 0.35 + t * (entity.w * 0.17) + Math.sin(entity.wobble + t) * 8,
        entity.h * 0.4,
        -entity.w * 0.35 + t * (entity.w * 0.17) + Math.sin(entity.wobble + t + 1) * 8,
        entity.h * 0.7,
        -entity.w * 0.35 + t * (entity.w * 0.17) + Math.sin(entity.wobble + t) * 5,
        entity.h * 0.9,
      );
      ctx.stroke();
    }
  } else {
    ctx.shadowColor = '#ff5555';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#d9444488';
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(entity.w * 0.58, 3);
      ctx.lineTo(entity.w * 0.58, -3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, entity.w * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  if (!player) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.facing === -1) ctx.scale(-1, 1);
  if (player.invTimer > 0 && Math.floor(player.invTimer / 6) % 2 === 0) {
    ctx.restore();
    return;
  }

  const pulseW = player.w + (player.eatAnim > 0 ? 7 : 0);
  const pulseH = player.h + (player.eatAnim > 0 ? 5 : 0);
  ctx.shadowColor = player.rank >= APEX_RANK ? '#FFD166' : '#1FE6FF';
  ctx.shadowBlur = player.rank >= APEX_RANK ? 26 : 18;
  ctx.fillStyle = player.rank >= APEX_RANK ? '#FFD166cc' : '#1FE6FFcc';
  ctx.beginPath();
  ctx.ellipse(0, 0, pulseW / 2, pulseH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = player.rank >= APEX_RANK ? '#ff8f3daa' : '#00D0E6aa';
  ctx.beginPath();
  ctx.moveTo(-pulseW / 2, 0);
  ctx.lineTo(-pulseW / 2 - pulseW * 0.32, -pulseH * 0.55);
  ctx.lineTo(-pulseW / 2 - pulseW * 0.32, pulseH * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-pulseW * 0.05, -pulseH / 2);
  ctx.lineTo(pulseW * 0.12, -pulseH / 2 - 15);
  ctx.lineTo(pulseW * 0.34, -pulseH / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fff';
  for (let t = 0; t < 5; t++) {
    ctx.beginPath();
    ctx.moveTo(pulseW / 2 - 4 - t * 6, pulseH * 0.1);
    ctx.lineTo(pulseW / 2 - 1 - t * 6, pulseH * 0.36);
    ctx.lineTo(pulseW / 2 - 9 - t * 6, pulseH * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(pulseW * 0.28, -pulseH * 0.18, pulseH * 0.21, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a1518';
  ctx.beginPath();
  ctx.arc(pulseW * 0.31, -pulseH * 0.18, pulseH * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHUD() {
  drawPanel(10, 10, 184, 70);
  ctx.fillStyle = 'rgba(0,208,230,0.7)';
  ctx.font = 'bold 11px Exo 2,sans-serif';
  ctx.fillText('SCORE', 20, 28);
  ctx.fillStyle = '#1FE6FF';
  ctx.font = 'bold 26px Cinzel,serif';
  ctx.fillText(score, 20, 56);

  drawPanel(W / 2 - 126, 10, 252, 60);
  ctx.fillStyle = '#00D0E6';
  ctx.font = 'bold 12px Exo 2,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(currentMode().label.toUpperCase(), W / 2, 28);
  ctx.fillStyle = '#F2F2F2';
  ctx.font = 'bold 16px Cinzel,serif';
  ctx.fillText(player.rank >= APEX_RANK ? 'APEX SIZE' : 'SIZE ' + player.rank + ' / ' + APEX_RANK, W / 2, 50);
  drawGrowthBar(W / 2 - 88, 58, 176, 5);
  ctx.textAlign = 'left';

  drawPanel(W - 162, 10, 152, currentMode().startTime > 0 ? 70 : 54);
  ctx.fillStyle = 'rgba(0,208,230,0.7)';
  ctx.font = 'bold 11px Exo 2,sans-serif';
  const rightLabel = selectedMode === 'survival' ? 'SURVIVED' : (currentMode().startTime > 0 ? 'TIME' : 'LIVES');
  ctx.fillText(rightLabel, W - 150, 28);
  ctx.fillStyle = '#1FE6FF';
  ctx.font = 'bold 22px Cinzel,serif';
  if (currentMode().startTime > 0) {
    ctx.fillText(formatTime(remainingTime), W - 150, 54);
    ctx.font = '18px serif';
    for (let i = 0; i < currentMode().lives; i++) {
      ctx.fillStyle = i < lives ? '#1FE6FF' : '#333';
      ctx.fillText('🦈', W - 76 + i * 25, 54);
    }
  } else {
    if (selectedMode === 'survival') {
      ctx.fillText(formatTime(Math.floor(elapsed / 60)), W - 150, 54);
    } else {
      for (let i = 0; i < currentMode().lives; i++) {
        ctx.font = '22px serif';
        ctx.fillStyle = i < lives ? '#1FE6FF' : '#333';
        ctx.fillText('🦈', W - 150 + i * 36, 54);
      }
    }
  }

  if (flashTimer > 0) {
    ctx.fillStyle = `rgba(255,40,40,${(flashTimer / 30) * 0.3})`;
    ctx.fillRect(0, 0, W, H);
    flashTimer--;
  }

  scorePopups.forEach(popup => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, popup.life / 30);
    ctx.fillStyle = popup.danger ? '#ff7777' : (popup.big ? '#FFD166' : '#1FE6FF');
    ctx.font = popup.big ? 'bold 28px Cinzel,serif' : 'bold 16px Exo 2,sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fillText(popup.txt, popup.x, popup.y);
    ctx.restore();
  });
  ctx.textAlign = 'left';
}

function drawPanel(x, y, w, h) {
  ctx.fillStyle = 'rgba(5,7,7,0.58)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#2B2F31';
  ctx.strokeRect(x, y, w, h);
}

function drawGrowthBar(x, y, w, h) {
  ctx.fillStyle = 'rgba(242,242,242,0.12)';
  ctx.fillRect(x, y, w, h);
  const pct = player.rank >= APEX_RANK ? 1 : clamp(player.growth / player.nextGrowth, 0, 1);
  ctx.fillStyle = player.rank >= APEX_RANK ? '#FFD166' : '#1FE6FF';
  ctx.fillRect(x, y, w * pct, h);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins + ':' + String(secs).padStart(2, '0');
}

function drawOverlay(title, sub, buttonText) {
  ctx.fillStyle = 'rgba(5,7,7,0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#0C8E83';
  ctx.lineWidth = 2;
  const bx = W / 2 - 250;
  const by = H / 2 - 166;
  const bw = 500;
  const bh = 332;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.strokeStyle = 'rgba(0,208,230,0.15)';
  ctx.strokeRect(bx + 4, by + 4, bw - 8, bh - 8);

  ctx.fillStyle = '#1FE6FF';
  ctx.font = 'bold 38px Cinzel,serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#1FE6FF';
  ctx.shadowBlur = 20;
  ctx.fillText(title, W / 2, H / 2 - 92);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(242,242,242,0.68)';
  ctx.font = '14px Exo 2,sans-serif';
  wrapText(sub, W / 2, H / 2 - 58, 420, 20);

  ctx.fillStyle = '#FFD166';
  ctx.font = 'bold 16px Cinzel,serif';
  ctx.fillText(currentMode().label, W / 2, H / 2 + 8);

  if (phase === 'gameover' || phase === 'won') {
    ctx.fillStyle = '#1FE6FF';
    ctx.font = 'bold 22px Cinzel,serif';
    ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 46);
  }

  ctx.fillStyle = 'rgba(0,208,230,0.85)';
  ctx.font = 'bold 13px Exo 2,sans-serif';
  ctx.fillText(buttonText, W / 2, H / 2 + 92);
  ctx.fillStyle = 'rgba(242,242,242,0.38)';
  ctx.font = '12px Exo 2,sans-serif';
  ctx.fillText('or press SPACE', W / 2, H / 2 + 114);
  ctx.textAlign = 'left';
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lineY = y;
  words.forEach(word => {
    const testLine = line + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, lineY);
      line = word + ' ';
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  });
  ctx.fillText(line.trim(), x, lineY);
}

function drawPause() {
  ctx.fillStyle = 'rgba(5,7,7,0.75)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1FE6FF';
  ctx.font = 'bold 44px Cinzel,serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#1FE6FF';
  ctx.shadowBlur = 24;
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(242,242,242,0.5)';
  ctx.font = '14px Exo 2,sans-serif';
  ctx.fillText('Press SPACE, P, or ESC to resume', W / 2, H / 2 + 24);
  ctx.textAlign = 'left';
}

function loop() {
  update();
  drawBg();

  if (phase === 'playing' || phase === 'paused') {
    drawSeaweed();
    drawBubbles();
    entities.forEach(drawEntity);
    drawPlayer();
    drawHUD();
  }

  if (phase === 'start') {
    drawSeaweed();
    drawBubbles();
    drawOverlay('DIVE FRENZY', modeMessage || currentMode().goal, 'Click START or press SPACE');
  }
  if (phase === 'gameover') drawOverlay('RUN COMPLETE', modeMessage, 'Click START AGAIN or press SPACE');
  if (phase === 'won') drawOverlay('APEX PREDATOR', modeMessage, 'Play another dive');
  if (phase === 'paused') drawPause();

  requestAnimationFrame(loop);
}

let touchStart = { x: 0, y: 0 };
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const touch = e.touches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const touch = e.touches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  Object.keys(keys).forEach(key => { keys[key] = false; });
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 10) { keys.ArrowRight = true; player.facing = 1; }
    else if (dx < -10) { keys.ArrowLeft = true; player.facing = -1; }
  } else {
    if (dy > 10) keys.ArrowDown = true;
    else if (dy < -10) keys.ArrowUp = true;
  }
}, { passive: false });

canvas.addEventListener('touchend', () => {
  Object.keys(keys).forEach(key => { keys[key] = false; });
});

resetRun();
phase = 'start';
loop();
