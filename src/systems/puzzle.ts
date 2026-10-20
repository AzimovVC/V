import { data } from '../data';
import type { GameState, PipeTile } from '../core/types';

/** Стороны: 0 вверх, 1 вправо, 2 вниз, 3 влево. */
export function sides(tile: PipeTile, rot: number): [number, number] {
  const r = ((rot % 4) + 4) % 4;
  if (tile.t === 'straight') return r % 2 === 0 ? [1, 3] : [0, 2];
  return [[0, 1], [1, 2], [2, 3], [3, 0]][r] as [number, number];
}

const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

export interface Flow { cells: number[]; solved: boolean }

/** Куда дотекла вода от входа слева. cells — индексы плиток (row*cols+col). */
export function flow(s: GameState): Flow {
  const P = data.pipe;
  const cells: number[] = [];
  let r = P.inRow, c = 0, from = 3;
  for (let guard = 0; guard < P.cols * P.rows + 2; guard++) {
    const i = r * P.cols + c;
    const tile = P.tiles[r][c];
    if (tile.broken && !s.pipe.repl[i]) return { cells, solved: false };
    const sd = sides(tile, s.pipe.rot[i]);
    if (!sd.includes(from)) return { cells, solved: false };
    cells.push(i);
    const out = sd[0] === from ? sd[1] : sd[0];
    if (out === 1 && c === P.cols - 1) return { cells, solved: r === P.outRow };
    r += DR[out]; c += DC[out]; from = (out + 2) % 4;
    if (r < 0 || r >= P.rows || c < 0 || c >= P.cols) return { cells, solved: false };
  }
  return { cells, solved: false };
}
