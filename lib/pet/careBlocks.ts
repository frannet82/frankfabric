// ---------------------------------------------------------------------------
// Care Blocks: a tiny falling-block puzzle that replaces the Feed / Play /
// Sleep / Clean buttons of the virtual pet.
//
// Every piece is painted in one of the four care colours. When a row fills and
// clears, each block in it counts toward its colour's care action (see
// applyActionScaled in lib/pet/petState.ts), so the colours you clear decide
// how the pet is looked after.
//
// Pure and framework-agnostic: randomness is injected (`rand`) so the engine
// is deterministic under test. The React wrapper lives in
// components/pet/CareBlocks.tsx.
// ---------------------------------------------------------------------------

import type { PetAction } from "@/lib/pet/petState";

export const COLS = 10;
export const ROWS = 14;

export type Cell = PetAction | null;
export type Board = Cell[][];

export type Piece = {
  /** Square matrix; 1 = filled. */
  shape: number[][];
  /** Column of the matrix's left edge (may be negative while kicking). */
  x: number;
  /** Row of the matrix's top edge (may be negative while spawning). */
  y: number;
  color: PetAction;
};

export const CARE_COLORS: PetAction[] = ["feed", "play", "sleep", "clean"];

// The seven classic four-block shapes, as square matrices so rotation stays
// centred.
const SHAPES: number[][][] = [
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
];

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

/**
 * A new piece, centred at the top. Colour selection is weighted toward
 * `needs` (higher weight = more likely), so the stat that is lowest shows up
 * more often and the game gently helps the pet recover.
 */
export function randomPiece(rand: () => number, needs?: Record<PetAction, number>): Piece {
  const shape = SHAPES[Math.floor(rand() * SHAPES.length) % SHAPES.length];
  let color: PetAction = CARE_COLORS[Math.floor(rand() * CARE_COLORS.length) % CARE_COLORS.length];
  if (needs) {
    const total = CARE_COLORS.reduce((sum, c) => sum + Math.max(0.01, needs[c]), 0);
    let roll = rand() * total;
    for (const c of CARE_COLORS) {
      roll -= Math.max(0.01, needs[c]);
      if (roll <= 0) {
        color = c;
        break;
      }
    }
  }
  return {
    shape: shape.map((row) => [...row]),
    x: Math.floor((COLS - shape.length) / 2),
    y: shape === SHAPES[0] ? -1 : 0,
    color,
  };
}

/** Rotate a square matrix 90 degrees clockwise. */
export function rotateShape(shape: number[][]): number[][] {
  const n = shape.length;
  return shape.map((row, r) => row.map((_, c) => shape[n - 1 - c][r]));
}

/** True when the piece overlaps a wall, the floor or a settled block. */
export function collides(board: Board, piece: Piece): boolean {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const x = piece.x + c;
      const y = piece.y + r;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
}

/** Try to move; returns the moved piece or null if blocked. */
export function tryMove(board: Board, piece: Piece, dx: number, dy: number): Piece | null {
  const next = { ...piece, x: piece.x + dx, y: piece.y + dy };
  return collides(board, next) ? null : next;
}

/** Rotate clockwise with small wall kicks; returns null if nothing fits. */
export function tryRotate(board: Board, piece: Piece): Piece | null {
  const shape = rotateShape(piece.shape);
  for (const kick of [0, -1, 1, -2, 2]) {
    const next = { ...piece, shape, x: piece.x + kick };
    if (!collides(board, next)) return next;
  }
  return null;
}

/** Row the piece would land on if dropped straight down (for the ghost). */
export function dropPosition(board: Board, piece: Piece): Piece {
  let p = piece;
  for (;;) {
    const next = tryMove(board, p, 0, 1);
    if (!next) return p;
    p = next;
  }
}

export type ClearResult = {
  board: Board;
  /** Number of rows cleared by this lock. */
  rows: number;
  /** Blocks cleared per care colour. */
  counts: Record<PetAction, number>;
  /** True when part of the piece locked above the top edge (board is full). */
  toppedOut: boolean;
};

/** Settle the piece into the board, then clear any full rows. */
export function lockPiece(board: Board, piece: Piece): ClearResult {
  const next = board.map((row) => [...row]);
  let toppedOut = false;
  piece.shape.forEach((row, r) =>
    row.forEach((v, c) => {
      if (!v) return;
      const y = piece.y + r;
      const x = piece.x + c;
      if (y < 0) toppedOut = true;
      else next[y][x] = piece.color;
    }),
  );

  const counts: Record<PetAction, number> = { feed: 0, play: 0, sleep: 0, clean: 0 };
  const kept = next.filter((row) => {
    const full = row.every(Boolean);
    if (full) row.forEach((cell) => cell && counts[cell]++);
    return !full;
  });
  const rows = ROWS - kept.length;
  const refill = Array.from({ length: rows }, () => Array<Cell>(COLS).fill(null));
  return { board: [...refill, ...kept], rows, counts, toppedOut };
}
