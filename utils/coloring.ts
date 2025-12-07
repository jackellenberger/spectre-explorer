import { BakedInstance } from './spectre';
import { Matrix, Point, ColoringMode, ColoringConfig } from '../types';
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

// --- Color Utils ---

function parseColor(c: string): [number, number, number] {
    if (c.startsWith('#')) {
        const hex = c.replace(/^#/, '');
        if (hex.length === 3) {
            return [
                parseInt(hex[0] + hex[0], 16),
                parseInt(hex[1] + hex[1], 16),
                parseInt(hex[2] + hex[2], 16)
            ];
        }
        return [
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16)
        ];
    }
    if (c.startsWith('rgb')) {
        const parts = c.match(/\d+/g);
        if (parts && parts.length >= 3) {
            return [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])];
        }
    }
    return [0, 0, 0];
}

function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map(x => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function interpolateColor(c1: string, c2: string, t: number): string {
    const [r1, g1, b1] = parseColor(c1);
    const [r2, g2, b2] = parseColor(c2);
    const r = r1 + (r2 - r1) * t;
    const g = g1 + (g2 - g1) * t;
    const b = b1 + (b2 - b1) * t;
    return rgbToHex(r, g, b);
}

function interpolateGradient(angleRad: number, stops: {angle: number, color: string}[]): string {
    // Sort stops by angle
    const sorted = [...stops].sort((a,b) => a.angle - b.angle);
    if (sorted.length === 0) return '#000000';
    if (sorted.length === 1) return sorted[0].color;

    // Convert angle to degrees 0-360
    let deg = (angleRad * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;

    // Find segment
    let idx = -1;
    for(let i=0; i<sorted.length; i++) {
        if (sorted[i].angle > deg) {
            idx = i - 1;
            break;
        }
    }

    if (idx === -1) {
        // larger than last stop? check if deg is smaller than first (idx -1 loop break)
        // If loop finished without break, deg > all stops. idx is effectively last.
        // Wait, loop: if sorted[i] > deg.
        // If deg < sorted[0], then loop breaks at i=0. idx = -1.

        if (deg < sorted[0].angle) {
            // Between last and first
            const s1 = sorted[sorted.length-1];
            const s2 = sorted[0];
            const span = (360 - s1.angle) + s2.angle;
            const dist = (360 - s1.angle) + deg;
            return interpolateColor(s1.color, s2.color, dist/(span || 1));
        } else {
            // larger than last
            const s1 = sorted[sorted.length-1];
            const s2 = sorted[0];
            const span = (360 - s1.angle) + s2.angle;
            const dist = deg - s1.angle;
            return interpolateColor(s1.color, s2.color, dist/(span || 1));
        }
    } else {
        // Between idx and idx+1
        const s1 = sorted[idx];
        const s2 = sorted[idx+1];
        const span = s2.angle - s1.angle;
        const dist = deg - s1.angle;
        return interpolateColor(s1.color, s2.color, dist/(span || 1));
    }
}

// --- Orientation Logic ---

export function getOrientation(m: Matrix): number {
    // M[0] is cos(theta) * scale, M[3] is sin(theta) * scale
    return Math.atan2(m[3], m[0]);
}

export function normalizeAngle(angle: number): number {
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

    tiles.forEach((tile, idx) => {
        const x = tile.matrix[2];
        const y = tile.matrix[5];
        const cx = Math.floor(x / gridSize);
        const cy = Math.floor(y / gridSize);

        const key = `${cx},${cy}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(idx);
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
    seed: number,
    config?: ColoringConfig
): Map<string, string> | null {
    if (mode === 'default') return null;

    const result = new Map<string, string>();
    if (palette.length === 0) palette.push('#cccccc'); // Fallback

    // Sort tiles by path to ensure stable processing regardless of input order (e.g. sorted by distance vs DFS)
    const sortedTiles = [...tiles].sort((a, b) => a.path.localeCompare(b.path));

    if (mode === 'random') {
        const rng = createRandom(seed);
        sortedTiles.forEach(t => {
            const idx = Math.floor(rng() * palette.length);
            result.set(t.path, palette[idx]);
        });
        return result;
    }

    if (mode === 'orientation') {
        // Group by orientation
        const buckets: Map<number, BakedInstance[]> = new Map();

        sortedTiles.forEach(t => {
            const ang = normalizeAngle(getOrientation(t.matrix));
            const deg = Math.round(ang * 180 / Math.PI);
            const key = deg;
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key)!.push(t);
        });

        const uniqueAngles = Array.from(buckets.keys()).sort((a,b) => a-b);

        // Map each unique angle to a color in the palette or config
        uniqueAngles.forEach((ang, idx) => {
            let color = palette[idx % palette.length];
            if (config?.orientationMap && config.orientationMap[ang]) {
                color = config.orientationMap[ang];
            }
            buckets.get(ang)!.forEach(t => {
                result.set(t.path, color);
            });
        });
        return result;
    }

    if (mode === 'orientation-gradient') {
        // Prepare stops
        let stops = config?.gradientStops || [];
        if (stops.length === 0) {
            // Default from palette
            const N = palette.length;
            const step = 360 / N;
            stops = palette.map((c, i) => ({ angle: i * step, color: c }));
        }

        sortedTiles.forEach(t => {
            const ang = normalizeAngle(getOrientation(t.matrix)); // 0 to 2PI
            const color = interpolateGradient(ang, stops);
            result.set(t.path, color);
        });
        return result;
    }

    if (mode === 'four-color') {
        const adj = buildAdjacencyGraph(sortedTiles);
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

        const assignments: number[] = new Array(sortedTiles.length).fill(-1);
        const indices = sortedTiles.map((_, i) => i);

        // Shuffle indices to avoid bias (using seeded RNG)
        // Note: Because sortedTiles is stable, this shuffle is stable.
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

        sortedTiles.forEach((t, i) => {
            const cIdx = assignments[i];
            const color = effectivePalette[cIdx % effectivePalette.length];
            result.set(t.path, color);
        });

        return result;
    }

    return result;
}
