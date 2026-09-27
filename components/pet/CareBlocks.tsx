"use client";

// ---------------------------------------------------------------------------
// Care Blocks: the falling-block puzzle that looks after the virtual pet.
//
// Pieces come in the four care colours. Clearing a row sends every block in it
// to the pet as a fraction of that colour's action (see onClear in
// components/pet/VirtualPet.tsx). Colours are weighted toward whatever the pet
// needs most, so the game nudges the stats back up.
//
// Controls: arrow keys (left/right move, up rotate, down soft drop), Space hard
// drop, P pause — only while the board has focus, so the page still scrolls
// normally. Touch/mouse users get on-screen buttons. The game pauses itself
// when the tab is hidden.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { PetAction } from "@/lib/pet/petState";
import {
  COLS,
  ROWS,
  collides,
  dropPosition,
  emptyBoard,
  lockPiece,
  randomPiece,
  tryMove,
  tryRotate,
  type Board,
  type Piece,
} from "@/lib/pet/careBlocks";

export const CARE_META: Record<PetAction, { label: string; stat: string; emoji: string; bg: string; mark: string }> = {
  feed: { label: "Feed", stat: "Fullness", emoji: "🍖", bg: "bg-pet-feed", mark: "●" },
  play: { label: "Play", stat: "Happiness", emoji: "🎾", bg: "bg-pet-play", mark: "★" },
  sleep: { label: "Sleep", stat: "Energy", emoji: "😴", bg: "bg-pet-rest", mark: "☾" },
  clean: { label: "Clean", stat: "Cleanliness", emoji: "🛁", bg: "bg-pet-clean", mark: "◆" },
};

type Status = "idle" | "running" | "paused" | "over";

type GameState = {
  board: Board;
  piece: Piece | null;
  next: Piece | null;
  status: Status;
  lines: number;
  /** Bumped on every clear so the parent callback fires exactly once. */
  clearId: number;
  lastClear: { rows: number; counts: Record<PetAction, number> } | null;
};

type Action =
  | { type: "start"; first: Piece; second: Piece }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "move"; dx: number }
  | { type: "rotate" }
  | { type: "down"; spawn: Piece }
  | { type: "drop"; spawn: Piece };

export const initial: GameState = {
  board: emptyBoard(),
  piece: null,
  next: null,
  status: "idle",
  lines: 0,
  clearId: 0,
  lastClear: null,
};

/** Lock the current piece, clear rows, and bring in the next one. */
function settle(state: GameState, piece: Piece, spawn: Piece): GameState {
  const result = lockPiece(state.board, piece);
  const incoming = state.next ?? spawn;
  const over = result.toppedOut || collides(result.board, incoming);
  return {
    ...state,
    board: result.board,
    piece: over ? null : incoming,
    next: over ? null : spawn,
    status: over ? "over" : state.status,
    lines: state.lines + result.rows,
    clearId: result.rows ? state.clearId + 1 : state.clearId,
    lastClear: result.rows ? { rows: result.rows, counts: result.counts } : state.lastClear,
  };
}

/** Exported for tests. */
export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "start":
      return { ...initial, clearId: state.clearId, status: "running", piece: action.first, next: action.second };
    case "pause":
      return state.status === "running" ? { ...state, status: "paused" } : state;
    case "resume":
      return state.status === "paused" ? { ...state, status: "running" } : state;
  }
  if (state.status !== "running" || !state.piece) return state;
  switch (action.type) {
    case "move": {
      const moved = tryMove(state.board, state.piece, action.dx, 0);
      return moved ? { ...state, piece: moved } : state;
    }
    case "rotate": {
      const rotated = tryRotate(state.board, state.piece);
      return rotated ? { ...state, piece: rotated } : state;
    }
    case "down": {
      const moved = tryMove(state.board, state.piece, 0, 1);
      return moved ? { ...state, piece: moved } : settle(state, state.piece, action.spawn);
    }
    case "drop":
      return settle(state, dropPosition(state.board, state.piece), action.spawn);
  }
  return state;
}

export default function CareBlocks({
  needs,
  onClear,
  disabled = false,
}: {
  /** 0..100 per action; higher = the pet needs it more (weights piece colours). */
  needs: Record<PetAction, number>;
  onClear: (counts: Record<PetAction, number>, rows: number) => void;
  disabled?: boolean;
}) {
  const [game, dispatch] = useReducer(reducer, initial);
  const needsRef = useRef(needs);
  const onClearRef = useRef(onClear);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    needsRef.current = needs;
    onClearRef.current = onClear;
  }, [needs, onClear]);

  const spawn = useCallback(() => randomPiece(Math.random, needsRef.current), []);

  // Report each clear to the parent exactly once.
  const reported = useRef(0);
  useEffect(() => {
    if (game.clearId !== reported.current && game.lastClear) {
      reported.current = game.clearId;
      onClearRef.current(game.lastClear.counts, game.lastClear.rows);
    }
  }, [game.clearId, game.lastClear]);

  // Gravity. Speeds up gently as you clear lines.
  const speed = Math.max(260, 700 - game.lines * 18);
  useEffect(() => {
    if (game.status !== "running") return;
    const id = window.setInterval(() => dispatch({ type: "down", spawn: spawn() }), speed);
    return () => window.clearInterval(id);
  }, [game.status, speed, spawn]);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVisibility = () => document.hidden && dispatch({ type: "pause" });
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const start = useCallback(() => {
    dispatch({ type: "start", first: spawn(), second: spawn() });
    boardRef.current?.focus();
  }, [spawn]);

  const primary = () => {
    if (game.status === "running") dispatch({ type: "pause" });
    else if (game.status === "paused") {
      dispatch({ type: "resume" });
      boardRef.current?.focus();
    } else start();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key;
    if (game.status !== "running") {
      // Enter only: Space is the drop key, so hammering it at game over
      // must not silently start a new round.
      if (key === "Enter") {
        e.preventDefault();
        primary();
      }
      return;
    }
    const map: Record<string, () => void> = {
      ArrowLeft: () => dispatch({ type: "move", dx: -1 }),
      ArrowRight: () => dispatch({ type: "move", dx: 1 }),
      ArrowUp: () => dispatch({ type: "rotate" }),
      ArrowDown: () => dispatch({ type: "down", spawn: spawn() }),
      " ": () => dispatch({ type: "drop", spawn: spawn() }),
      p: () => dispatch({ type: "pause" }),
      P: () => dispatch({ type: "pause" }),
    };
    if (map[key]) {
      e.preventDefault();
      map[key]();
    }
  };

  // Compose what to draw: settled board + ghost + live piece.
  const cells: { color: PetAction | null; ghost: boolean }[][] = game.board.map((row) =>
    row.map((color) => ({ color, ghost: false })),
  );
  if (game.piece) {
    const ghost = dropPosition(game.board, game.piece);
    for (const [p, isGhost] of [
      [ghost, true],
      [game.piece, false],
    ] as const) {
      p.shape.forEach((row, r) =>
        row.forEach((v, c) => {
          const y = p.y + r;
          const x = p.x + c;
          if (!v || y < 0 || y >= ROWS || x < 0 || x >= COLS) return;
          if (isGhost) {
            if (!cells[y][x].color) cells[y][x] = { color: p.color, ghost: true };
          } else cells[y][x] = { color: p.color, ghost: false };
        }),
      );
    }
  }

  const overlay =
    game.status === "idle"
      ? { title: "Care Blocks", body: "Clear rows to care for Luffy. Each block fills the stat of its colour.", cta: "Play" }
      : game.status === "paused"
        ? { title: "Paused", body: "Luffy is waiting.", cta: "Resume" }
        : game.status === "over"
          ? { title: "Board full", body: `You cleared ${game.lines} ${game.lines === 1 ? "row" : "rows"}. Stats you earned are kept.`, cta: "Play again" }
          : null;

  const ctrl =
    "grid place-items-center w-11 h-9 rounded-lg bg-pet-cream border border-pet-accentSoft text-pet-ink text-[14px] active:translate-y-px hover:border-pet-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-pet-accent disabled:opacity-40";
  const control = (kind: "left" | "right" | "rotate" | "down" | "drop") => {
    if (kind === "left") dispatch({ type: "move", dx: -1 });
    else if (kind === "right") dispatch({ type: "move", dx: 1 });
    else if (kind === "rotate") dispatch({ type: "rotate" });
    else dispatch({ type: kind, spawn: spawn() });
    boardRef.current?.focus({ preventScroll: true });
  };
  const live = game.status === "running";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] text-pet-ink leading-tight">Care Blocks</h3>
          <p className="font-mono text-[11px] text-pet-inkSoft">
            Rows cleared <span className="tabular-nums text-pet-ink">{game.lines}</span>
          </p>
        </div>
        {/* Only while playing: the board overlay carries Play / Resume / Play again */}
        <button
          type="button"
          onClick={primary}
          disabled={disabled}
          hidden={game.status !== "running"}
          className="rounded-full bg-pet-accent text-white text-[12.5px] font-semibold px-4 py-2 shadow-sm hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-pet-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pet-paper transition-all disabled:opacity-40"
        >
          {game.status === "running" ? "Pause" : game.status === "paused" ? "Resume" : game.status === "over" ? "Play again" : "Play"}
        </button>
      </div>

      {/* Board, with the next piece and colour key beside it on desktop and
          underneath it on phones. */}
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-5 items-center lg:items-start">
        <div className="flex flex-col items-center gap-2.5 shrink-0">
          {/* Board */}
          <div
            ref={boardRef}
            tabIndex={0}
            role="group"
            aria-roledescription="game board"
            aria-label="Care Blocks. Left and right arrows move, up rotates, down drops one row, space drops, P pauses."
            onKeyDown={onKeyDown}
            className="care-board relative shrink-0 rounded-xl bg-pet-ink/[0.06] border border-pet-accentSoft p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-pet-accent"
          >
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: `repeat(${COLS}, var(--cell))`, gridTemplateRows: `repeat(${ROWS}, var(--cell))` }}
              aria-hidden="true"
            >
              {cells.flatMap((row, y) =>
                row.map((cell, x) => {
                  if (!cell.color) return <span key={`${y}-${x}`} className="care-slot bg-white/60" />;
                  const meta = CARE_META[cell.color];
                  return cell.ghost ? (
                    <span key={`${y}-${x}`} className={`care-slot ${meta.bg} opacity-25`} />
                  ) : (
                    <span
                      key={`${y}-${x}`}
                      className={`care-slot care-cell ${meta.bg} grid place-items-center text-white/75 leading-none`}
                    >
                      {meta.mark}
                    </span>
                  );
                }),
              )}
            </div>
            {overlay && (
              <div className="absolute inset-0 grid place-items-center rounded-xl bg-pet-paper/85 backdrop-blur-[2px] p-3 text-center">
                <div className="flex flex-col items-center gap-2">
                  <span className="font-display text-[17px] text-pet-ink">{overlay.title}</span>
                  <span className="text-[12.5px] leading-snug text-pet-inkSoft max-w-[180px]">{overlay.body}</span>
                  <button
                    type="button"
                    onClick={primary}
                    disabled={disabled}
                    className="mt-1 rounded-full bg-pet-accent text-white text-[12.5px] font-semibold px-4 py-2 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-pet-accent disabled:opacity-40"
                  >
                    {overlay.cta}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Small touch / mouse controls under the board */}
          <div className="care-controls flex justify-center gap-1.5">
            <button type="button" aria-label="Move left" disabled={!live} onClick={() => control("left")} className={ctrl}>◀</button>
            <button type="button" aria-label="Rotate" disabled={!live} onClick={() => control("rotate")} className={ctrl}>↻</button>
            <button type="button" aria-label="Move right" disabled={!live} onClick={() => control("right")} className={ctrl}>▶</button>
            <button type="button" aria-label="Down one row" disabled={!live} onClick={() => control("down")} className={ctrl}>▼</button>
            <button type="button" aria-label="Drop" disabled={!live} onClick={() => control("drop")} className={ctrl}>⤓</button>
          </div>
        </div>
        <div className="w-full lg:w-auto flex lg:flex-col gap-4 items-start min-w-0">
          {/* Next piece */}
          <div className="shrink-0">
            <p className="font-mono text-[10px] tracking-widest uppercase text-pet-inkSoft mb-1.5">Next</p>
            <div className="grid grid-cols-4 gap-px w-fit p-1.5 rounded-lg bg-pet-ink/[0.05]" aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => {
                const r = Math.floor(i / 4);
                const c = i % 4;
                const filled = game.next?.shape[r]?.[c];
                return (
                  <span
                    key={i}
                    className={`w-3 h-3 lg:w-4 lg:h-4 rounded-[3px] ${filled && game.next ? CARE_META[game.next.color].bg : "bg-transparent"}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Colour key */}
          <ul className="flex-1 grid grid-cols-2 lg:grid-cols-1 gap-x-3 gap-y-1.5 pt-4 lg:pt-0" aria-label="Block colours">
            {(Object.keys(CARE_META) as PetAction[]).map((key) => {
              const meta = CARE_META[key];
              return (
                <li key={key} className="flex items-center gap-2 text-[12px] text-pet-ink min-w-0">
                  <span className={`grid place-items-center w-4 h-4 shrink-0 rounded-[4px] ${meta.bg} text-white/80 text-[8px]`} aria-hidden="true">
                    {meta.mark}
                  </span>
                  <span className="truncate">
                    <span className="hidden lg:inline">{meta.label} <span className="text-pet-inkSoft">→ </span></span>
                    {meta.stat}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

    </div>
  );
}
