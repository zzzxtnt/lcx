'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { VT323 } from 'next/font/google';

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel',
});

// --- Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 200;
const BLOCK_SIZE = 20;
const GROUND_Y = 160;
const DINO_WIDTH = 30;
const DINO_HEIGHT = 40;
const GRAVITY = 0.5;
const INITIAL_SPEED = 5;
const JUMP_FORCE = -9; // Calculated for ~3 blocks high jump

interface Cloud {
  x: number;
  y: number;
  speed: number;
}

interface Obstacle {
  x: number;
  width: number;
  height: number;
  passed: boolean;
}

type GameStatus = "START" | "PLAYING" | "GAMEOVER";

export default function GamePage() {
  const [status, setStatus] = useState<GameStatus>("START");
  const [score, setScore] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [highScore, setHighScore] = useState(0);

  // Use state or ref for game mechanics
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef({
    score: 0,
    speed: INITIAL_SPEED,
    dinoY: GROUND_Y - DINO_HEIGHT,
    dinoVelocityY: 0,
    isJumping: false,
    obstacles: [] as Obstacle[],
    clouds: [] as Cloud[],
    lastSpawnTime: 0,
    animationId: 0,
    lastFrameTime: 0,
    speedMultiplier: 1,
    frameCount: 0,
  });

  // Client-side initialization for highScore
  useEffect(() => {
    const saved = localStorage.getItem("dino_highscore");
    if (saved) {
      setHighScore(parseInt(saved));
    }
  }, []);

  // Handle Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (status === "START" || status === "GAMEOVER") {
          startGame();
        } else if (status === "PLAYING" && !gameRef.current.isJumping) {
          gameRef.current.isJumping = true;
          gameRef.current.dinoVelocityY = JUMP_FORCE;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status]);

  const startGame = () => {
    gameRef.current = {
      score: 0,
      speed: INITIAL_SPEED,
      dinoY: GROUND_Y - DINO_HEIGHT,
      dinoVelocityY: 0,
      isJumping: false,
      obstacles: [],
      clouds: [
        { x: 100, y: 40, speed: 0.2 },
        { x: 500, y: 30, speed: 0.15 },
        { x: 800, y: 60, speed: 0.25 },
      ],
      lastSpawnTime: Date.now(),
      animationId: 0,
      lastFrameTime: Date.now(),
      speedMultiplier: 1,
      frameCount: 0,
    };
    setScore(0);
    setSpeedMultiplier(1);
    setStatus("PLAYING");
  };

  const gameOver = () => {
    setStatus("GAMEOVER");
    cancelAnimationFrame(gameRef.current.animationId);
    if (gameRef.current.score > highScore) {
      setHighScore(gameRef.current.score);
      localStorage.setItem("dino_highscore", gameRef.current.score.toString());
    }
  };

  useEffect(() => {
    if (status !== "PLAYING") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gameLoop = (time: number) => {
      const state = gameRef.current;
      state.frameCount++;
      const deltaTime = time - state.lastFrameTime;
      state.lastFrameTime = time;

      // 1. Update Physics
      if (state.isJumping) {
        state.dinoVelocityY += GRAVITY;
        state.dinoY += state.dinoVelocityY;

        if (state.dinoY >= GROUND_Y - DINO_HEIGHT) {
          state.dinoY = GROUND_Y - DINO_HEIGHT;
          state.dinoVelocityY = 0;
          state.isJumping = false;
        }
      }

      // 2. Obstacle Spawning
      const minDistance = 400 + (Math.random() * 300);
      const lastObs = state.obstacles[state.obstacles.length - 1];
      if (!lastObs || (CANVAS_WIDTH - lastObs.x > minDistance / state.speedMultiplier)) {
        const hBlocks = Math.random() > 0.6 ? 2 : 1;
        state.obstacles.push({
          x: CANVAS_WIDTH,
          width: 20,
          height: hBlocks * BLOCK_SIZE,
          passed: false,
        });
      }

      // 3. Clouds Update
      state.clouds.forEach(c => {
        c.x -= c.speed;
        if (c.x < -100) c.x = CANVAS_WIDTH + 100;
      });

      // 4. Update Obstacles & Collision
      state.obstacles.forEach((obs) => {
        obs.x -= state.speed * state.speedMultiplier;

        // Collision Check (AABB)
        const dinoRect = {
          x: 50 + 6,
          y: state.dinoY + 4,
          w: DINO_WIDTH - 12,
          h: DINO_HEIGHT - 8,
        };
        const obsRect = {
          x: obs.x,
          y: GROUND_Y - obs.height,
          w: obs.width,
          h: obs.height,
        };

        if (
          dinoRect.x < obsRect.x + obsRect.w &&
          dinoRect.x + dinoRect.w > obsRect.x &&
          dinoRect.y < obsRect.y + obsRect.h &&
          dinoRect.y + dinoRect.h > obsRect.y
        ) {
          gameOver();
          return;
        }

        if (!obs.passed && obs.x + obs.width < dinoRect.x) {
          obs.passed = true;
          state.score += 10;
          setScore(state.score);
          
          if (state.score > 0 && state.score % 100 === 0) {
            state.speedMultiplier *= 1.1;
            setSpeedMultiplier(state.speedMultiplier);
          }
        }
      });

      state.obstacles = state.obstacles.filter(obs => obs.x + obs.width > -50);

      const INK = "#535353";
      const CLOUD_COLOR = "#d1d1d1";

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      state.clouds.forEach(c => {
        ctx.fillStyle = CLOUD_COLOR;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(c.x + 10, c.y);
        ctx.lineTo(c.x + 50, c.y);
        ctx.lineTo(c.x + 60, c.y + 10);
        ctx.lineTo(c.x + 50, c.y + 20);
        ctx.lineTo(c.x + 10, c.y + 20);
        ctx.lineTo(c.x, c.y + 10);
        ctx.closePath();
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      ctx.beginPath();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
      ctx.stroke();

      ctx.fillStyle = INK;
      for(let i=0; i<CANVAS_WIDTH + 40; i+=40) {
        const offset = (state.frameCount * state.speed * state.speedMultiplier * 0.5) % 40;
        ctx.fillRect(i - offset, GROUND_Y + 5, 2, 2);
        if (i % 120 === 0) ctx.fillRect(i - offset + 10, GROUND_Y + 12, 4, 1);
      }

      ctx.fillStyle = INK;
      ctx.fillRect(50, state.dinoY, DINO_WIDTH, DINO_HEIGHT - 10);
      ctx.fillRect(50 + 10, state.dinoY - 5, DINO_WIDTH - 5, 15);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(50 + DINO_WIDTH - 5, state.dinoY + 0, 3, 3);
      
      ctx.fillStyle = INK;
      const isAlt = Math.floor(state.frameCount / 8) % 2 === 0;
      if (state.isJumping) {
        ctx.fillRect(50 + 5, state.dinoY + DINO_HEIGHT - 10, 5, 10);
        ctx.fillRect(50 + 20, state.dinoY + DINO_HEIGHT - 10, 5, 10);
      } else {
        if (isAlt) {
          ctx.fillRect(50 + 5, state.dinoY + DINO_HEIGHT - 10, 5, 10);
          ctx.fillRect(50 + 20, state.dinoY + DINO_HEIGHT - 15, 5, 5);
        } else {
          ctx.fillRect(50 + 5, state.dinoY + DINO_HEIGHT - 15, 5, 5);
          ctx.fillRect(50 + 20, state.dinoY + DINO_HEIGHT - 10, 5, 10);
        }
      }
      
      state.obstacles.forEach(obs => {
        ctx.fillStyle = INK;
        ctx.fillRect(obs.x, GROUND_Y - obs.height, obs.width, obs.height);
        if (obs.height > BLOCK_SIZE) {
          ctx.fillRect(obs.x - 5, GROUND_Y - obs.height + 10, 5, 15);
          ctx.fillRect(obs.x + obs.width, GROUND_Y - obs.height + 5, 5, 15);
        }
      });

      state.animationId = requestAnimationFrame(gameLoop);
    };

    gameRef.current.animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(gameRef.current.animationId);
  }, [status, highScore]);

  return (
    <div className={`${vt323.variable} flex flex-col items-center justify-center min-h-screen p-4 font-pixel select-none bg-bg text-ink`}>
      <div className="relative w-full max-w-[800px] border-2 border-ink bg-surface p-1 rounded-sm overflow-hidden">
        <div className="absolute top-5 right-5 flex gap-5 text-2xl font-bold z-20 text-ink">
          <span className="opacity-40">HI {highScore.toString().padStart(6, "0")}</span>
          <span>{score.toString().padStart(6, "0")}</span>
        </div>

        <canvas
          id="gameCanvas"
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-auto pixel-art cursor-pointer block"
          onClick={() => {
            if (status === "START" || status === "GAMEOVER") startGame();
            else if (status === "PLAYING" && !gameRef.current.isJumping) {
               gameRef.current.isJumping = true;
               gameRef.current.dinoVelocityY = JUMP_FORCE;
            }
          }}
        />

        <AnimatePresence>
          {status === "START" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-30"
            >
              <h1 className="text-4xl mb-6 tracking-[0.2em] text-ink italic uppercase">DINO PIXEL JUMP</h1>
              <p className="text-lg mb-8 text-ink/60 uppercase">Classic 8-bit monochromatic survival runner</p>
              <div className="key-hint">PRESS SPACE TO JUMP</div>
            </motion.div>
          )}

          {status === "GAMEOVER" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[1px] z-30"
            >
              <h2 className="text-4xl mb-4 tracking-widest text-ink italic">GAME OVER</h2>
              <p className="text-xl mb-6 text-ink/60">SCORE: {score}</p>
              <button
                id="restart-btn"
                onClick={startGame}
                className="px-10 py-3 border-2 border-ink text-ink text-xl hover:bg-ink hover:text-white transition-all uppercase font-bold cursor-pointer"
              >
                RETRY
              </button>
              <p className="mt-4 text-xs text-ink/40 italic uppercase">PRESS SPACE TO RESTART</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 w-full max-w-[800px] border-t border-gray-200 pt-8 uppercase">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-gray-400 tracking-widest mb-1">Current Multiplier</span>
          <span className="text-xl font-bold text-ink italic">x{speedMultiplier.toFixed(1)} (Speed +{Math.round((speedMultiplier - 1) * 100)}%)</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-gray-400 tracking-widest mb-1">Jump Limit</span>
          <span className="text-xl font-bold text-ink italic">3 Units</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-gray-400 tracking-widest mb-1">Next Milestone</span>
          <span className="text-xl font-bold text-ink italic">{Math.ceil((score || 100) / 100) * 100} Points</span>
        </div>
      </div>

      <div className="mt-16 text-ink/40 text-center max-w-sm uppercase tracking-tighter text-[10px]">
        <p>Geometric Balance Protocol v1.4.2</p>
        <p className="mt-1">Monochromatic Rendering Pipeline Enabled</p>
      </div>
    </div>
  );
}
