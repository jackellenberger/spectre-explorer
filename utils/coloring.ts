import { BakedInstance } from './spectre';
import { Matrix, Point, ColorScheme, ColoringMode } from '../types';
import { transPt } from './geometry';

// Simple seeded PRNG (Mulberry32)
export function createRandom(seed: number) {
    return function() {
      var t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// --- Orientation Logic ---

function getOrientation(m: Matrix): number {
    // M[0] is cos(theta) * scale, M[3] is sin(theta) * scale
    // We assume uniform scaling usually, or at least we want the rotation angle.
    return Math.atan2(m[3], m[0]);
}

function normalizeAngle(angle: number): number {
    let a = angle % (2 * Math.PI);
    if (a < 0) a += 2 * Math.PI;
    return a;
}

// --- Neighbor Graph (for Graph Coloring) ---

// Check if two tiles are neighbors.
// Heuristic: They are neighbors if they share at least 2 vertices (an edge).
// To be robust against float errors, we use a small epsilon.
const EPSILON = 0.1;

function getTransformedVertices(inst: BakedInstance): Point[] {
    // We use the shape's points (polyPts if available for consistency with CurvyShape)
    const shape = inst.shape as any;
    const pts = shape.polyPts || shape.pts;
    if (!pts) return [];
    return pts.map((p: Point) => transPt(inst.matrix, p));
}

function areNeighbors(a: BakedInstance, b: BakedInstance): boolean {
    // Bounding box check first for performance?
    // Let's rely on centroid distance first as a fast cull.
    // Average spectre size is roughly 2-3 units?
    // Let's compute centroids on the fly? Or just skip to vertex check.
    // Vertex check is O(N*M) where N, M are vertex counts (approx 14). 14*14 = 196 ops.
    // With 1000 tiles, comparing all pairs is 1,000,000 * 200 = 200M ops. Too slow.
    // We need spatial hashing or just checking K nearest by centroid.

    const vertsA = getTransformedVertices(a);
    const vertsB = getTransformedVertices(b);

    let sharedVertices = 0;
    for (const va of vertsA) {
        for (const vb of vertsB) {
            const dx = va.x - vb.x;
            const dy = va.y - vb.y;
            if (dx*dx + dy*dy < EPSILON * EPSILON) {
                sharedVertices++;
            }
        }
    }
    return sharedVertices >= 2;
}

// Build adjacency list
function buildAdjacencyGraph(tiles: BakedInstance[]): number[][] {
    const adj: number[][] = Array.from({ length: tiles.length }, () => []);

    // Optimization: Spatial grid
    const gridSize = 4.0; // Slightly larger than a tile
    const grid: Map<string, number[]> = new Map();

    const getGridKeys = (inst: BakedInstance) => {
        // Use bounding box to find grid cells
        // Quick centroid approx: transform (0,0) (not always centroid but close enough for grid)
        // Better: transform a few points and take average
        // Or just use matrix[2], matrix[5] (translation) which is where the local (0,0) ends up.
        // Spectre local (0,0) is one of the vertices.
        const x = inst.matrix[2];
        const y = inst.matrix[5];
        return [`${Math.floor(x/gridSize)},${Math.floor(y/gridSize)}`];

        // If tiles overlap grid boundaries, we might miss neighbors if we only check one cell.
        // But since we iterate all pairs in a cell, we just need to make sure neighbors share *at least* one cell.
        // Actually, best to put tile in all cells it overlaps.
        // For simplicity, let's just check 3x3 neighbor cells for each tile.
    };

    // 1. Populate grid
    const tileCells: string[][] = [];

    tiles.forEach((tile, idx) => {
        const x = tile.matrix[2];
        const y = tile.matrix[5];
        const cx = Math.floor(x / gridSize);
        const cy = Math.floor(y / gridSize);

        // Add to the main cell and maybe adjacent ones?
        // Safer approach: Add to one cell, but when checking, check 9 cells.
        const key = `${cx},${cy}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(idx);
        tileCells[idx] = [key];
    });

    // 2. Check neighbors
    tiles.forEach((tile, i) => {
        const x = tile.matrix[2];
        const y = tile.matrix[5];
        const cx = Math.floor(x / gridSize);
        const cy = Math.floor(y / gridSize);

        // Check 3x3 grid around the tile
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${cx + dx},${cy + dy}`;
                const cellMembers = grid.get(key);
                if (cellMembers) {
                    for (const j of cellMembers) {
                        if (i < j) { // Check each pair once
                             if (areNeighbors(tile, tiles[j])) {
                                 adj[i].push(j);
                                 adj[j].push(i);
                             }
                        }
                    }
                }
            }
        }
    });

    return adj;
}

// --- Coloring Algorithms ---

export function computeColors(
    tiles: BakedInstance[],
    mode: ColoringMode,
    palette: string[],
    seed: number
): Map<string, string> | null {
    if (mode === 'default') return null;

    const result = new Map<string, string>();
    if (palette.length === 0) palette.push('#cccccc'); // Fallback

    if (mode === 'random') {
        const rng = createRandom(seed);
        tiles.forEach(t => {
            const idx = Math.floor(rng() * palette.length);
            result.set(t.path, palette[idx]);
        });
        return result;
    }

    if (mode === 'orientation') {
        // Group by orientation
        const buckets: Map<number, BakedInstance[]> = new Map();

        tiles.forEach(t => {
            const ang = normalizeAngle(getOrientation(t.matrix));
            const deg = Math.round(ang * 180 / Math.PI);
            const key = deg;
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key)!.push(t);
        });

        const uniqueAngles = Array.from(buckets.keys()).sort((a,b) => a-b);

        // Map each unique angle to a color in the palette
        uniqueAngles.forEach((ang, idx) => {
            const color = palette[idx % palette.length];
            buckets.get(ang)!.forEach(t => {
                result.set(t.path, color);
            });
        });
        return result;
    }

    if (mode === 'orientation-gradient') {
        tiles.forEach(t => {
            const ang = normalizeAngle(getOrientation(t.matrix));
            // Map angle 0..2PI to a color wheel
            const hue = (ang * 180 / Math.PI) % 360;
            result.set(t.path, `hsl(${hue}, 70%, 60%)`);
        });
        return result;
    }

    if (mode === 'four-color') {
        const adj = buildAdjacencyGraph(tiles);
        const rng = createRandom(seed);

        // Shuffle palette for randomness in assignment
        const shuffledPalette = [...palette];
        for (let i = shuffledPalette.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [shuffledPalette[i], shuffledPalette[j]] = [shuffledPalette[j], shuffledPalette[i]];
        }

        // User asked for "4 or 5 color map theorem".
        const maxColors = Math.min(palette.length, 6);
        const effectivePalette = shuffledPalette.slice(0, maxColors);

        const assignments: number[] = new Array(tiles.length).fill(-1);
        const indices = tiles.map((_, i) => i);
        // Shuffle indices to avoid bias
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        for (const idx of indices) {
            const neighbors = adj[idx];
            const usedColors = new Set<number>();
            for (const n of neighbors) {
                if (assignments[n] !== -1) {
                    usedColors.add(assignments[n]);
                }
            }

            let colorIdx = 0;
            while (usedColors.has(colorIdx)) {
                colorIdx++;
            }
            assignments[idx] = colorIdx;
        }

        tiles.forEach((t, i) => {
            const cIdx = assignments[i];
            const color = effectivePalette[cIdx % effectivePalette.length];
            result.set(t.path, color);
        });

        return result;
    }

    return result;
}
