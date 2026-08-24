export const id = "sinuca";
export const label = "🎱 Sinuca";

// Mesa "virtual" nesse sistema de coordenadas - o board vai renderizar isso
// escalado pro tamanho de tela que quiser, sempre nessa mesma proporção
// 2:1 de mesa de sinuca de verdade.
export const TABLE_W = 800;
export const TABLE_H = 400;
export const PLAY_LEFT = 24;
export const PLAY_TOP = 24;
export const PLAY_RIGHT = TABLE_W - 24;
export const PLAY_BOTTOM = TABLE_H - 24;
export const BALL_R = 11;
export const POCKET_R = 22;

const MID_X = (PLAY_LEFT + PLAY_RIGHT) / 2;
const MID_Y = (PLAY_TOP + PLAY_BOTTOM) / 2;
export const POCKETS = [
  { x: PLAY_LEFT, y: PLAY_TOP },
  { x: MID_X, y: PLAY_TOP },
  { x: PLAY_RIGHT, y: PLAY_TOP },
  { x: PLAY_LEFT, y: PLAY_BOTTOM },
  { x: MID_X, y: PLAY_BOTTOM },
  { x: PLAY_RIGHT, y: PLAY_BOTTOM },
];

const MAX_SPEED = 780;
const MIN_POWER = 0.12;
const FRICTION_DECEL = 480;
const RESTITUTION = 0.92;
const STOP_EPS = 4;
const DT = 1 / 120;
const MAX_STEPS = 900;
const TRAJECTORY_STRIDE = 3;

// Numeradas 1-7 são sólidas, 9-15 são listradas, 8 é a preta.
function ballGroup(ballId) {
  if (ballId === "8") return "eight";
  const n = Number(ballId);
  if (n >= 1 && n <= 7) return "solid";
  if (n >= 9 && n <= 15) return "stripe";
  return null;
}

function defaultCuePos() {
  return { x: PLAY_LEFT + 150, y: MID_Y };
}

// Monta o triângulo padrão: 5 fileiras (1+2+3+4+5=15 bolas), com a bola 8
// sempre no meio da 3ª fileira, igual sinuca de verdade.
export function createInitialState() {
  const balls = [{ id: "cue", ...defaultCuePos(), active: true }];

  const numberedIds = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  let ni = 0;
  const apexX = PLAY_RIGHT - 170;
  const rowSpacing = BALL_R * 2 * 0.87;
  const colSpacing = BALL_R * 2.02;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const isCenterOfThird = row === 2 && col === 1;
      const ballId = isCenterOfThird ? "8" : String(numberedIds[ni++]);
      const x = apexX + row * rowSpacing;
      const y = MID_Y + (col - row / 2) * colSpacing;
      balls.push({ id: ballId, x, y, active: true });
    }
  }

  return {
    balls,
    groups: { X: null, O: null },
    winner: null,
    trajectory: null,
    lastShotBy: null,
    lastEvent: null,
  };
}

function cloneBalls(balls) {
  return balls.map((b) => ({ ...b }));
}

function findBall(balls, id) {
  return balls.find((b) => b.id === id);
}

// Roda a física do zero até a mesa parar (ou até um teto de passos, pra
// nunca travar o navegador se algo ficar quicando pra sempre). Devolve as
// posições finais + eventos (quem caiu, quem foi a primeira bola tocada) +
// uma trilha de posições pra a interface poder animar a tacada.
function simulateShot(initialBalls, angle, power) {
  const balls = cloneBalls(initialBalls);
  const cue = findBall(balls, "cue");
  const speed = MIN_POWER + Math.max(0, Math.min(1, power)) * (1 - MIN_POWER) * MAX_SPEED;
  cue.vx = Math.cos(angle) * speed;
  cue.vy = Math.sin(angle) * speed;
  for (const b of balls) {
    if (b.id !== "cue") {
      b.vx = 0;
      b.vy = 0;
    }
  }

  const pottedThisShot = [];
  let firstHitBallId = null;
  const trajectory = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    let anyMoving = false;

    for (const b of balls) {
      if (!b.active) continue;
      const spd = Math.hypot(b.vx, b.vy);
      if (spd <= 0) continue;
      const newSpd = Math.max(0, spd - FRICTION_DECEL * DT);
      const scale = newSpd / spd;
      b.vx *= scale;
      b.vy *= scale;
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      if (Math.hypot(b.vx, b.vy) > STOP_EPS) anyMoving = true;
      else {
        b.vx = 0;
        b.vy = 0;
      }
    }

    // Buracos primeiro - uma bola que está entrando num buraco não deve
    // quicar na tabela, tem que cair.
    for (const b of balls) {
      if (!b.active) continue;
      for (const pocket of POCKETS) {
        if (Math.hypot(b.x - pocket.x, b.y - pocket.y) < POCKET_R) {
          b.active = false;
          b.vx = 0;
          b.vy = 0;
          pottedThisShot.push(b.id);
          break;
        }
      }
    }

    for (const b of balls) {
      if (!b.active) continue;
      if (b.x - BALL_R < PLAY_LEFT) {
        b.x = PLAY_LEFT + BALL_R;
        b.vx = -b.vx * RESTITUTION;
      } else if (b.x + BALL_R > PLAY_RIGHT) {
        b.x = PLAY_RIGHT - BALL_R;
        b.vx = -b.vx * RESTITUTION;
      }
      if (b.y - BALL_R < PLAY_TOP) {
        b.y = PLAY_TOP + BALL_R;
        b.vy = -b.vy * RESTITUTION;
      } else if (b.y + BALL_R > PLAY_BOTTOM) {
        b.y = PLAY_BOTTOM - BALL_R;
        b.vy = -b.vy * RESTITUTION;
      }
    }

    const active = balls.filter((b) => b.active);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const bi = active[i];
        const bj = active[j];
        const dx = bj.x - bi.x;
        const dy = bj.y - bi.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0 || dist >= BALL_R * 2) continue;

        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = BALL_R * 2 - dist;
        bi.x -= (nx * overlap) / 2;
        bi.y -= (ny * overlap) / 2;
        bj.x += (nx * overlap) / 2;
        bj.y += (ny * overlap) / 2;

        const rvx = bj.vx - bi.vx;
        const rvy = bj.vy - bi.vy;
        const velAlongNormal = rvx * nx + rvy * ny;
        if (velAlongNormal < 0) {
          bi.vx += velAlongNormal * nx;
          bi.vy += velAlongNormal * ny;
          bj.vx -= velAlongNormal * nx;
          bj.vy -= velAlongNormal * ny;

          if (firstHitBallId === null) {
            if (bi.id === "cue") firstHitBallId = bj.id;
            else if (bj.id === "cue") firstHitBallId = bi.id;
          }
        }
      }
    }

    if (step % TRAJECTORY_STRIDE === 0) {
      const snapshot = {};
      for (const b of balls) snapshot[b.id] = { x: b.x, y: b.y, active: b.active };
      trajectory.push(snapshot);
    }

    if (!anyMoving) break;
  }

  const finalSnapshot = {};
  for (const b of balls) finalSnapshot[b.id] = { x: b.x, y: b.y, active: b.active };
  trajectory.push(finalSnapshot);

  return {
    balls: balls.map((b) => ({ id: b.id, x: b.x, y: b.y, active: b.active })),
    pottedThisShot,
    firstHitBallId,
    trajectory,
  };
}

// move = { angle (radianos), power (0..1) }
export function applyMove(state, move, symbol) {
  if (state.turn !== symbol || state.winner) return null;
  const cue = findBall(state.balls, "cue");
  if (!cue || !cue.active) return null;

  const { balls, pottedThisShot, firstHitBallId, trajectory } = simulateShot(state.balls, move.angle, move.power);

  const cueScratched = pottedThisShot.includes("cue");
  const eightPotted = pottedThisShot.includes("8");
  const myGroup = state.groups[symbol];
  const enemy = symbol === "X" ? "O" : "X";

  const noHit = firstHitBallId === null;
  const wrongFirstHit = !noHit && myGroup && firstHitBallId !== "8" && ballGroup(firstHitBallId) !== myGroup;

  const groupBallsLeft = (group) => balls.some((b) => b.active && b.id !== "cue" && b.id !== "8" && ballGroup(b.id) === group);

  let winner = null;
  if (eightPotted) {
    if (cueScratched) {
      winner = enemy;
    } else if (myGroup && !groupBallsLeft(myGroup) && firstHitBallId === "8") {
      winner = symbol;
    } else {
      winner = enemy;
    }
  }

  // Reposiciona a bola branca se ela caiu (falta) - jeito simplificado de
  // "bola na mão": sempre volta pro ponto inicial de saque, ao invés de
  // deixar escolher onde colocar.
  let finalBalls = balls;
  if (cueScratched && !winner) {
    const spot = defaultCuePos();
    finalBalls = balls.map((b) => (b.id === "cue" ? { ...b, x: spot.x, y: spot.y, active: true } : b));
  }

  let groups = state.groups;
  const pottedNumbered = pottedThisShot.filter((pid) => pid !== "cue" && pid !== "8");
  if (!winner && !groups[symbol] && !groups[enemy] && pottedNumbered.length > 0) {
    const firstGroup = ballGroup(pottedNumbered[0]);
    if (firstGroup === "solid" || firstGroup === "stripe") {
      groups = { [symbol]: firstGroup, [enemy]: firstGroup === "solid" ? "stripe" : "solid" };
    }
  }

  const foul = noHit || cueScratched || wrongFirstHit;
  const myGroupAfter = groups[symbol];
  const pottedOwn = pottedNumbered.some((pid) => myGroupAfter && ballGroup(pid) === myGroupAfter);
  const keepsTurn = !winner && !foul && pottedOwn;

  let lastEvent = "miss";
  if (winner === symbol) lastEvent = "win";
  else if (winner === enemy) lastEvent = "lose";
  else if (cueScratched) lastEvent = "scratch";
  else if (noHit) lastEvent = "no-hit";
  else if (wrongFirstHit) lastEvent = "wrong-ball";
  else if (pottedOwn) lastEvent = "potted";

  return {
    balls: finalBalls,
    groups,
    turn: winner ? state.turn : keepsTurn ? symbol : enemy,
    winner,
    trajectory,
    lastShotBy: symbol,
    lastEvent,
  };
}

export function checkResult(state) {
  if (!state.winner) return null;
  return { winner: state.winner };
}

function ghostAim(cue, target, pocket) {
  const dx = pocket.x - target.x;
  const dy = pocket.y - target.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return null;
  const nx = dx / dist;
  const ny = dy / dist;
  const ghostX = target.x - nx * BALL_R * 2;
  const ghostY = target.y - ny * BALL_R * 2;
  const angle = Math.atan2(ghostY - cue.y, ghostX - cue.x);
  const cueDist = Math.hypot(ghostX - cue.x, ghostY - cue.y);
  return { angle, cueDist, pocketDist: dist };
}

function distToSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + abx * t, cy = a.y + aby * t;
  return Math.hypot(p.x - cx, p.y - cy);
}

function pathIsClear(balls, from, to, ignoreIds) {
  for (const b of balls) {
    if (!b.active || ignoreIds.includes(b.id)) continue;
    if (distToSegment(b, from, to) < BALL_R * 1.9) return false;
  }
  return true;
}

// easy: mira numa bola qualquer com bastante ruído. medium: calcula o
// ângulo "de verdade" (bola fantasma) pra bola mais perto de uma caçapa,
// com um pouco de ruído. hard: testa várias bolas/caçapas, prefere tacadas
// sem obstrução no caminho e mira quase perfeito.
export function botMove(state, symbol, difficulty = "medium") {
  const cue = findBall(state.balls, "cue");
  if (!cue) return { angle: 0, power: 0.5 };

  const myGroup = state.groups[symbol];
  let candidates = state.balls.filter((b) => b.active && b.id !== "cue" && b.id !== "8" && (!myGroup || ballGroup(b.id) === myGroup));
  if (candidates.length === 0) {
    const groupLeft = myGroup && state.balls.some((b) => b.active && b.id !== "cue" && b.id !== "8" && ballGroup(b.id) === myGroup);
    if (!groupLeft) {
      const eight = findBall(state.balls, "8");
      candidates = eight?.active ? [eight] : [];
    }
  }
  if (candidates.length === 0) candidates = state.balls.filter((b) => b.active && b.id !== "cue");
  if (candidates.length === 0) return { angle: Math.random() * Math.PI * 2, power: 0.5 };

  if (difficulty === "easy") {
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const angle = Math.atan2(target.y - cue.y, target.x - cue.x) + (Math.random() - 0.5) * 0.5;
    return { angle, power: 0.4 + Math.random() * 0.4 };
  }

  const options = [];
  for (const target of candidates) {
    for (const pocket of POCKETS) {
      const aim = ghostAim(cue, target, pocket);
      if (!aim) continue;
      let clear = true;
      if (difficulty === "hard") {
        const ghostPos = { x: target.x - ((pocket.x - target.x) / aim.pocketDist) * BALL_R * 2, y: target.y - ((pocket.y - target.y) / aim.pocketDist) * BALL_R * 2 };
        clear =
          pathIsClear(state.balls, cue, ghostPos, ["cue", target.id]) &&
          pathIsClear(state.balls, target, pocket, ["cue", target.id]);
      }
      options.push({ ...aim, clear });
    }
  }

  const clearOptions = options.filter((o) => o.clear);
  const pool = clearOptions.length > 0 ? clearOptions : options;
  pool.sort((a, b) => a.cueDist + a.pocketDist - (b.cueDist + b.pocketDist));

  const pickFrom = difficulty === "hard" ? pool.slice(0, 2) : pool.slice(0, Math.min(4, pool.length));
  const pick = pickFrom[Math.floor(Math.random() * pickFrom.length)] || pool[0];

  const noise = difficulty === "hard" ? 0.02 : 0.09;
  const angle = pick.angle + (Math.random() - 0.5) * noise;
  const totalDist = pick.cueDist + pick.pocketDist;
  const power = Math.max(0.35, Math.min(0.95, 0.4 + totalDist / 900)) + (Math.random() - 0.5) * (difficulty === "hard" ? 0.04 : 0.12);

  return { angle, power: Math.max(0.2, Math.min(1, power)) };
}
