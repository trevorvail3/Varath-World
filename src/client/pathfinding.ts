/**
 * src/client/pathfinding.ts
 * -------------------------
 * A* pathfinding lives in the CLIENT because it's a presentation concern:
 * it works out *which tiles to walk through* and the result is sent to the
 * core as a MOVE/INTERACT intent. The core stays the authority on where the
 * player actually is.
 *
 * Movement is 8-directional and refuses to cut diagonally through wall
 * corners: a diagonal step is only allowed if BOTH orthogonal tiles beside
 * it are walkable.
 */

import type { Vec2 } from "../core/types.ts";

type Walkable = (x: number, y: number) => boolean;

interface Node {
  x: number;
  y: number;
  g: number; // cost from start
  f: number; // g + heuristic
  parent: Node | null;
}

const STRAIGHT = 1;
const DIAGONAL = Math.SQRT2;

/**
 * How many nodes one search may expand before giving up.
 *
 * A* with an admissible heuristic finds a path quickly; what is slow is proving
 * there ISN'T one, because that means expanding every reachable tile. On the
 * 160×164 world that was ~22k tiles and a click on an unreachable target cost
 * about 150ms — tolerable. The Greater World has ~141k reachable tiles, and the
 * same click measured 937ms: a visible freeze on a mistap, on the main thread.
 *
 * 20k expansions is far more than any real journey needs (the longest
 * city→region path on this map expands a few thousand) and caps the failure
 * case at roughly the cost of a long successful search.
 */
const MAX_EXPANSIONS = 20_000;

// 8 neighbour offsets. Diagonals carry the two orthogonals that must be
// clear for the move to be legal (no corner cutting).
const NEIGHBOURS: { dx: number; dy: number; need: Vec2[] }[] = [
  { dx: 1, dy: 0, need: [] },
  { dx: -1, dy: 0, need: [] },
  { dx: 0, dy: 1, need: [] },
  { dx: 0, dy: -1, need: [] },
  { dx: 1, dy: 1, need: [{ x: 1, y: 0 }, { x: 0, y: 1 }] },
  { dx: 1, dy: -1, need: [{ x: 1, y: 0 }, { x: 0, y: -1 }] },
  { dx: -1, dy: 1, need: [{ x: -1, y: 0 }, { x: 0, y: 1 }] },
  { dx: -1, dy: -1, need: [{ x: -1, y: 0 }, { x: 0, y: -1 }] },
];

/**
 * A binary min-heap of open nodes, keyed on f.
 *
 * The old open list was a plain array scanned linearly for the lowest f, which
 * is O(n) per pop and therefore O(n²) over a search. That was fine while the
 * open list held a few hundred nodes; on a world 6× the area it is the whole
 * cost. Pushing and popping in log n makes a long search cheap enough that the
 * budget above is a safety net rather than the thing doing the work.
 */
class Heap {
  private a: Node[] = [];
  get size(): number { return this.a.length; }
  push(n: Node): void {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.f <= a[i]!.f) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): Node | undefined {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.f < a[m]!.f) m = l;
        if (r < a.length && a[r]!.f < a[m]!.f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return STRAIGHT * (dx + dy) + (DIAGONAL - 2 * STRAIGHT) * Math.min(dx, dy);
}

/**
 * Find a path from `start` to `goal`. Returns the list of tiles to step
 * onto, in order, NOT including the starting tile. Returns [] if the goal
 * is unreachable (or is itself unwalkable).
 */
export function findPath(
  walkable: Walkable,
  start: Vec2,
  goal: Vec2,
): Vec2[] {
  const sx = Math.round(start.x);
  const sy = Math.round(start.y);
  const gx = goal.x;
  const gy = goal.y;

  if (!walkable(gx, gy)) return [];
  if (sx === gx && sy === gy) return [];

  const open = new Heap();
  const startNode: Node = {
    x: sx,
    y: sy,
    g: 0,
    f: octile(sx, sy, gx, gy),
    parent: null,
  };
  open.push(startNode);

  // Numeric keys, not `${x},${y}`: the inner loop touches the maps eight times
  // per expansion, and on a 400-wide world building a string for each one costs
  // more than the search itself. The stride is the map width bound generously —
  // any coordinate the walkable callback accepts must fit.
  const STRIDE = 4096;
  const key = (x: number, y: number): number => y * STRIDE + x;
  const openMap = new Map<number, Node>([[key(sx, sy), startNode]]);
  const closed = new Set<number>();

  let expanded = 0;
  while (open.size > 0) {
    const current = open.pop()!;
    const ck = key(current.x, current.y);
    // A node whose cost improved was re-pushed rather than moved in place, so
    // the heap can hold stale copies. The first one out is the good one; any
    // later copy is already closed and is skipped here.
    if (closed.has(ck)) continue;
    openMap.delete(ck);
    if (++expanded > MAX_EXPANSIONS) return []; // give up rather than freeze

    if (current.x === gx && current.y === gy) {
      return reconstruct(current);
    }
    closed.add(ck);

    for (const n of NEIGHBOURS) {
      const nx = current.x + n.dx;
      const ny = current.y + n.dy;
      if (closed.has(key(nx, ny))) continue;
      if (!walkable(nx, ny)) continue;
      // No corner cutting: both flanking orthogonal tiles must be open.
      if (n.need.some((o) => !walkable(current.x + o.x, current.y + o.y))) {
        continue;
      }

      const stepCost = n.dx !== 0 && n.dy !== 0 ? DIAGONAL : STRAIGHT;
      const g = current.g + stepCost;
      const existing = openMap.get(key(nx, ny));
      if (existing && g >= existing.g) continue;

      const node: Node = {
        x: nx,
        y: ny,
        g,
        f: g + octile(nx, ny, gx, gy),
        parent: current,
      };
      // Re-push on improvement instead of mutating in place: a heap cannot
      // re-sort a node whose key changed underneath it. The stale copy is
      // discarded by the closed check above.
      open.push(node);
      openMap.set(key(nx, ny), node);
      void existing;
    }
  }

  return []; // no path
}

function reconstruct(node: Node): Vec2[] {
  const path: Vec2[] = [];
  let cur: Node | null = node;
  while (cur && cur.parent) {
    path.push({ x: cur.x, y: cur.y });
    cur = cur.parent;
  }
  path.reverse();
  return path;
}

/**
 * For interactions: find the walkable tile next to `target` that is cheapest
 * to reach from `from`, then return the path to it. Returns [] if the player
 * is already standing next to the target (caller should interact at once) or
 * if nothing adjacent is reachable. The `alreadyAdjacent` flag distinguishes
 * the two cases.
 */
export function pathToAdjacent(
  walkable: Walkable,
  from: Vec2,
  target: Vec2,
): { path: Vec2[]; reachable: boolean; alreadyAdjacent: boolean } {
  const fx = Math.round(from.x);
  const fy = Math.round(from.y);

  // Already next to it (including diagonally)?
  if (Math.abs(fx - target.x) <= 1 && Math.abs(fy - target.y) <= 1) {
    return { path: [], reachable: true, alreadyAdjacent: true };
  }

  let best: Vec2[] | null = null;
  for (const n of NEIGHBOURS) {
    const ax = target.x + n.dx;
    const ay = target.y + n.dy;
    if (!walkable(ax, ay)) continue;
    const path = findPath(walkable, from, { x: ax, y: ay });
    if (path.length === 0) continue;
    if (best === null || path.length < best.length) best = path;
  }

  if (best === null) return { path: [], reachable: false, alreadyAdjacent: false };
  return { path: best, reachable: true, alreadyAdjacent: false };
}

/**
 * Path toward `target` but stop as soon as the player is within `reach` tiles
 * (Chebyshev) of it — how an archer closes only to bow-shot, not melee. Reuses
 * the route to an adjacent tile and truncates it at the first waypoint in range,
 * so the player walks the minimum needed to loose an arrow.
 */
export function pathToWithin(
  walkable: Walkable,
  from: Vec2,
  target: Vec2,
  reach: number,
): { path: Vec2[]; reachable: boolean; alreadyInRange: boolean } {
  const fx = Math.round(from.x);
  const fy = Math.round(from.y);
  if (Math.max(Math.abs(fx - target.x), Math.abs(fy - target.y)) <= reach) {
    return { path: [], reachable: true, alreadyInRange: true };
  }
  const { path, reachable } = pathToAdjacent(walkable, from, target);
  if (!reachable) return { path: [], reachable: false, alreadyInRange: false };
  // Walk only until the first step that brings us within bow-shot.
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    if (Math.max(Math.abs(p.x - target.x), Math.abs(p.y - target.y)) <= reach) {
      return { path: path.slice(0, i + 1), reachable: true, alreadyInRange: false };
    }
  }
  return { path, reachable: true, alreadyInRange: false };
}
