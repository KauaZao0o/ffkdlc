"use client";

import { useEffect, useRef, useState } from "react";
import { TABLE_W, TABLE_H, PLAY_LEFT, PLAY_TOP, PLAY_RIGHT, PLAY_BOTTOM, BALL_R, POCKET_R, POCKETS } from "@/lib/games/sinuca.js";

const BALL_IDS = ["cue", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"];
const BALL_COLORS = {
  1: "#e8c122", 2: "#1f4fd8", 3: "#d62828", 4: "#7c3aa8", 5: "#e8720c", 6: "#1c8a4b", 7: "#7a2e1d", 8: "#171717",
  9: "#e8c122", 10: "#1f4fd8", 11: "#d62828", 12: "#7c3aa8", 13: "#e8720c", 14: "#1c8a4b", 15: "#7a2e1d",
};
const MAX_DRAG_DIST = 230;
const GROUP_LABEL = { solid: "bolas lisas", stripe: "bolas listradas" };

const DARK_BALLS = new Set([4, 6, 7, 8, 12, 14, 15]);

function isStripe(id) {
  return Number(id) >= 9;
}

export default function SinucaBoard({ game, onMove }) {
  const svgRef = useRef(null);
  const [aiming, setAiming] = useState(false);
  const [aimPoint, setAimPoint] = useState(null);
  const [animBalls, setAnimBalls] = useState(null);
  const canPlay = game.status === "playing" && game.turn === game.mySymbol;
  const isAnimating = !!animBalls;

  // Toca a animação da tacada quando uma nova trajetória chega - os dois
  // lados calculam a mesma física a partir das mesmas jogadas, então só
  // precisa reproduzir a sequência de posições que já veio pronta no estado.
  useEffect(() => {
    if (!game.trajectory || game.trajectory.length === 0) return;
    let cancelled = false;
    let frame = 0;
    const traj = game.trajectory;

    function step() {
      if (cancelled) return;
      setAnimBalls(traj[frame]);
      frame++;
      if (frame < traj.length) {
        setTimeout(step, 16);
      } else {
        setAnimBalls(null);
      }
    }
    step();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.trajectory]);

  const ballsMap = animBalls || Object.fromEntries(game.balls.map((b) => [b.id, b]));

  function getSvgPoint(clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * TABLE_W,
      y: ((clientY - rect.top) / rect.height) * TABLE_H,
    };
  }

  function handlePointerDown(e) {
    if (!canPlay || isAnimating) return;
    const cue = ballsMap.cue;
    if (!cue?.active) return;
    e.preventDefault();
    setAiming(true);
    setAimPoint(getSvgPoint(e.clientX, e.clientY));
  }

  useEffect(() => {
    if (!aiming) return;
    function move(e) {
      setAimPoint(getSvgPoint(e.clientX, e.clientY));
    }
    function up(e) {
      setAiming(false);
      const cue = ballsMap.cue;
      const point = getSvgPoint(e.clientX, e.clientY);
      const dx = point.x - cue.x;
      const dy = point.y - cue.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 12) return;
      const angle = Math.atan2(dy, dx);
      const power = Math.max(0.15, Math.min(1, dist / MAX_DRAG_DIST));
      onMove({ angle, power });
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiming]);

  const cue = ballsMap.cue;
  const myGroup = game.groups?.[game.mySymbol];
  const opponentGroup = myGroup === "solid" ? "stripe" : myGroup === "stripe" ? "solid" : null;

  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-faint)" }}>
        {myGroup
          ? `Você: ${GROUP_LABEL[myGroup]} · Oponente: ${GROUP_LABEL[opponentGroup]}`
          : "Grupo (lisas/listradas) definido na primeira bola encaçapada"}
        {canPlay && !isAnimating && " · Arraste na mesa pra mirar e soltar tacar"}
      </p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${TABLE_W} ${TABLE_H}`}
        className="sinuca-table"
        onPointerDown={handlePointerDown}
        style={{ cursor: canPlay && !isAnimating ? "crosshair" : "default", touchAction: "none" }}
      >
        <rect x={0} y={0} width={TABLE_W} height={TABLE_H} rx={16} className="sinuca-rail" />
        <rect x={PLAY_LEFT - BALL_R} y={PLAY_TOP - BALL_R} width={PLAY_RIGHT - PLAY_LEFT + BALL_R * 2} height={PLAY_BOTTOM - PLAY_TOP + BALL_R * 2} rx={6} className="sinuca-felt" />

        {POCKETS.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={POCKET_R} className="sinuca-pocket" />
        ))}

        {aiming && aimPoint && cue?.active && (
          <line x1={cue.x} y1={cue.y} x2={aimPoint.x} y2={aimPoint.y} className="sinuca-aim-line" />
        )}

        {BALL_IDS.map((id) => {
          const b = ballsMap[id];
          if (!b || !b.active) return null;
          const stripe = isStripe(id);
          const color = id === "cue" ? "#f7f5ef" : BALL_COLORS[id];
          return (
            <g key={id}>
              <circle cx={b.x} cy={b.y} r={BALL_R} fill={color} stroke={stripe ? "#fff" : "rgba(0,0,0,0.25)"} strokeWidth={stripe ? 3.5 : 1} />
              {id !== "cue" && (
                <text x={b.x} y={b.y + 3} textAnchor="middle" className="sinuca-ball-label" fill={DARK_BALLS.has(Number(id)) ? "#fff" : "#1c1c1c"}>
                  {id}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
