import { Point, Matrix, Renderable, TileSystem, ColorScheme, TileType } from '../types';
import { IDENTITY, mul, psub, pframe, transPt, ttrans, trot, toRadians, inv, isPointInPoly } from './geometry';

// --- Types for Optimization ---

export interface BakedInstance {
  shape: Shape | CurvyShape;
  matrix: Matrix;
  path: string;
  isHidden: boolean;
}

// --- Data Classes ---

export class Shape implements Renderable {
  pts: Point[];
  quad: Point[];
  label: string;
  path2D: Path2D;

  constructor(pts: Point[], quad: Point[], label: string) {
    this.pts = pts;
    this.quad = quad;
    this.label = label;
    
    // Pre-calculate path in local space
    this.path2D = new Path2D();
    if (pts.length > 0) {
        this.path2D.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            this.path2D.lineTo(pts[i].x, pts[i].y);
        }
        this.path2D.closePath();
    }
  }

  // Legacy draw for compatibility / debug, though App.tsx should now use path2D
  draw(ctx: CanvasRenderingContext2D, T: Matrix, colors: ColorScheme, path?: string, hiddenSet?: Set<string>, isEditMode?: boolean) {
    // Legacy draw not used in optimized pipeline
  }

  hitTest(pt: Point, T: Matrix, path: string): string | null {
    const invT = inv(T);
    const localPt = transPt(invT, pt);
    if (isPointInPoly(localPt, this.pts)) {
      return path;
    }
    return null;
  }

  getSVG(T: Matrix, colors: ColorScheme): string {
    const col = colors[this.label] || '#cccccc';
    let pointsStr = "";
    for (let p of this.pts) {
      const tp = transPt(T, p);
      pointsStr += `${tp.x.toFixed(3)},${tp.y.toFixed(3)} `;
    }
    return `<polygon points="${pointsStr.trim()}" fill="${col}" stroke="black" stroke-width="0.1" />`;
  }
}

export class CurvyShape implements Renderable {
  quad: Point[];
  label: string;
  pts: Point[];
  path2D: Path2D;

  constructor(pts: Point[], quad: Point[], label: string) {
    this.quad = quad;
    this.label = label;
    this.pts = [pts[pts.length - 1]];
    let toggle = true;

    // Generate curve control points
    for (const p of pts) {
      const prev = this.pts[this.pts.length - 1];
      const v = psub(p, prev);
      const w = { x: -v.y, y: v.x };
      if (toggle) {
        this.pts.push(pframe(prev, v, w, 0.33, 0.6));
        this.pts.push(pframe(prev, v, w, 0.67, 0.6));
      } else {
        this.pts.push(pframe(prev, v, w, 0.33, -0.6));
        this.pts.push(pframe(prev, v, w, 0.67, -0.6));
      }
      toggle = !toggle;
      this.pts.push(p);
    }

    // Cache Path2D
    this.path2D = new Path2D();
    const start = this.pts[0];
    this.path2D.moveTo(start.x, start.y);

    for (let i = 1; i < this.pts.length; i += 3) {
      const a = this.pts[i];
      const b = this.pts[i + 1];
      const c = this.pts[i + 2];
      this.path2D.bezierCurveTo(a.x, a.y, b.x, b.y, c.x, c.y);
    }
    this.path2D.closePath();
  }

  draw(ctx: CanvasRenderingContext2D, T: Matrix, colors: ColorScheme, path?: string, hiddenSet?: Set<string>, isEditMode?: boolean) {
    // Legacy draw not used in optimized pipeline
  }

  hitTest(pt: Point, T: Matrix, path: string): string | null {
    const invT = inv(T);
    const localPt = transPt(invT, pt);
    // Rough approximation for hit testing on curves
    if (isPointInPoly(localPt, this.pts)) {
      return path;
    }
    return null;
  }

  getSVG(T: Matrix, colors: ColorScheme): string {
    const col = colors[this.label] || '#cccccc';
    const start = transPt(T, this.pts[0]);
    let d = `M ${start.x.toFixed(3)} ${start.y.toFixed(3)}`;

    for (let i = 1; i < this.pts.length; i += 3) {
      const a = transPt(T, this.pts[i]);
      const b = transPt(T, this.pts[i + 1]);
      const c = transPt(T, this.pts[i + 2]);
      d += ` C ${a.x.toFixed(3)} ${a.y.toFixed(3)} ${b.x.toFixed(3)} ${b.y.toFixed(3)} ${c.x.toFixed(3)} ${c.y.toFixed(3)}`;
    }

    return `<path d="${d}" fill="${col}" stroke="black" stroke-width="0.1" />`;
  }
}

export class Meta implements Renderable {
  geoms: { geom: Renderable; xform: Matrix }[] = [];
  quad: Point[] = [];

  addChild(g: Renderable, T: Matrix) {
    this.geoms.push({ geom: g, xform: T });
  }

  draw(ctx: CanvasRenderingContext2D, S: Matrix, colors: ColorScheme, path?: string, hiddenSet?: Set<string>, isEditMode?: boolean) {
     // Legacy draw
  }

  hitTest(pt: Point, S: Matrix, path: string): string | null {
      for(let i = this.geoms.length - 1; i >= 0; i--) {
          const g = this.geoms[i];
          const childPath = path ? `${path}:${i}` : `${i}`;
          const hit = g.geom.hitTest(pt, mul(S, g.xform), childPath);
          if (hit) return hit;
      }
      return null;
  }

  getSVG(S: Matrix, colors: ColorScheme): string {
    let svg = "";
    for (let g of this.geoms) {
      svg += g.geom.getSVG(mul(S, g.xform), colors);
    }
    return svg;
  }
}

// --- Baking Logic ---

export function bake(
    node: Renderable, 
    transform: Matrix = IDENTITY, 
    path: string = "0", 
    hiddenSet?: Set<string>,
    pruneHidden: boolean = true,
    isParentHidden: boolean = false,
    list: BakedInstance[] = []
): BakedInstance[] {
    const isHidden = isParentHidden || (hiddenSet ? hiddenSet.has(path) : false);

    // Pruning Optimization:
    // If this node is hidden, and we are in "prune" mode (View Mode), 
    // stop recursion immediately. This effectively removes the branch from the system.
    if (isHidden && pruneHidden) {
        return list;
    }

    if (node instanceof Meta) {
        for (let i = 0; i < node.geoms.length; i++) {
            const child = node.geoms[i];
            const childPath = `${path}:${i}`;
            bake(child.geom, mul(transform, child.xform), childPath, hiddenSet, pruneHidden, isHidden, list);
        }
    } else if (node instanceof Shape || node instanceof CurvyShape) {
        list.push({
            shape: node,
            matrix: transform,
            path: path,
            isHidden: isHidden
        });
    }
    return list;
}

// --- Builders ---

export function buildSpectreBase(curved: boolean): TileSystem {
  const spectre: Point[] = [
    { x: 0, y: 0 },
    { x: 1.0, y: 0.0 },
    { x: 1.5, y: -0.8660254037844386 },
    { x: 2.366025403784439, y: -0.36602540378443865 },
    { x: 2.366025403784439, y: 0.6339745962155614 },
    { x: 3.366025403784439, y: 0.6339745962155614 },
    { x: 3.866025403784439, y: 1.5 },
    { x: 3.0, y: 2.0 },
    { x: 2.133974596215561, y: 1.5 },
    { x: 1.6339745962155614, y: 2.3660254037844393 },
    { x: 0.6339745962155614, y: 2.3660254037844393 },
    { x: -0.3660254037844386, y: 2.3660254037844393 },
    { x: -0.866025403784439, y: 1.5 },
    { x: 0.0, y: 1.0 },
  ];

  const spectre_keys = [spectre[3], spectre[5], spectre[7], spectre[11]];
  const ret: TileSystem = {};
  const labels = ['Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi'];

  for (const lab of labels) {
    if (curved) {
      ret[lab] = new CurvyShape(spectre, spectre_keys, lab);
    } else {
      ret[lab] = new Shape(spectre, spectre_keys, lab);
    }
  }

  const mystic = new Meta();
  if (curved) {
    mystic.addChild(new CurvyShape(spectre, spectre_keys, 'Gamma1'), IDENTITY);
    mystic.addChild(
      new CurvyShape(spectre, spectre_keys, 'Gamma2'),
      mul(ttrans(spectre[8].x, spectre[8].y), trot(Math.PI / 6))
    );
  } else {
    mystic.addChild(new Shape(spectre, spectre_keys, 'Gamma1'), IDENTITY);
    mystic.addChild(
      new Shape(spectre, spectre_keys, 'Gamma2'),
      mul(ttrans(spectre[8].x, spectre[8].y), trot(Math.PI / 6))
    );
  }
  mystic.quad = spectre_keys;
  ret['Gamma'] = mystic;

  return ret;
}

export function buildHatTurtleBase(hat_dominant: boolean): TileSystem {
    const hr3 = 0.8660254037844386;

    const hexPt = (x: number, y: number) => ({ x: x + 0.5 * y, y: -hr3 * y });
    
    const hat = [
        hexPt(-1, 2), hexPt(0, 2), hexPt(0, 3), hexPt(2, 2), hexPt(3, 0),
        hexPt(4, 0), hexPt(5,-1), hexPt(4,-2), hexPt(2,-1), hexPt(2,-2),
        hexPt( 1, -2), hexPt(0,-2), hexPt(-1,-1), hexPt(0, 0) 
    ];

    const turtle = [
        hexPt(0,0), hexPt(2,-1), hexPt(3,0), hexPt(4,-1), hexPt(4,-2),
        hexPt(6,-3), hexPt(7,-5), hexPt(6,-5), hexPt(5,-4), hexPt(4,-5),
        hexPt(2,-4), hexPt(0,-3), hexPt(-1,-1), hexPt(0,-1)
    ];

    const hat_keys = [hat[3], hat[5], hat[7], hat[11]];
    const turtle_keys = [turtle[3], turtle[5], turtle[7], turtle[11]];
    
    const ret: TileSystem = {};
    const labels = ['Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi'];

    if(hat_dominant) {
        for(const lab of labels) {
            ret[lab] = new Shape(hat, hat_keys, lab);
        }
        const mystic = new Meta();
        mystic.addChild(new Shape(hat, hat_keys, 'Gamma1'), IDENTITY);
        mystic.addChild(new Shape(turtle, turtle_keys, 'Gamma2'), ttrans(hat[8].x, hat[8].y));
        mystic.quad = hat_keys;
        ret['Gamma'] = mystic;
    } else {
        for(const lab of labels) {
            ret[lab] = new Shape(turtle, turtle_keys, lab);
        }
        const mystic = new Meta();
        mystic.addChild(new Shape(turtle, turtle_keys, 'Gamma1'), IDENTITY);
        mystic.addChild(new Shape(hat, hat_keys, 'Gamma2'), mul(ttrans(turtle[9].x, turtle[9].y), trot(Math.PI / 3)));
        mystic.quad = turtle_keys;
        ret['Gamma'] = mystic;
    }
    return ret;
}

export function buildHexBase(): TileSystem {
	const hr3 = 0.8660254037844386;

	const hex = [
		{x:0, y:0},
		{x:1.0, y:0.0},
		{x:1.5, y:hr3},
		{x:1, y:2*hr3},
		{x:0, y:2*hr3},
		{x:-0.5, y:hr3} 
	];

	const hex_keys = [ hex[1], hex[2], hex[3], hex[5] ];
	const ret: TileSystem = {};

    const labels = ['Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi'];
	for(const lab of labels) {
		ret[lab] = new Shape( hex, hex_keys, lab );
	}
	return ret;
}

// --- Substitution Logic ---

function transTo(p: Point, q: Point): Matrix {
    return ttrans(q.x - p.x, q.y - p.y);
}

export function buildSupertiles(sys: TileSystem): TileSystem {
  const quad = sys['Delta'].quad;
  const R: Matrix = [-1, 0, 0, 0, 1, 0]; // Reflection matrix

  // Format: [angle, fromIndex, toIndex]
  const t_rules: [number, number, number][] = [
    [60, 3, 1], [0, 2, 0], [60, 3, 1], [60, 3, 1],
    [0, 2, 0], [60, 3, 1], [-120, 3, 3]
  ];

  const Ts: Matrix[] = [IDENTITY];
  let total_ang = 0;
  let rot = IDENTITY;
  const tquad = [...quad];

  for (const [ang, from, to] of t_rules) {
    total_ang += ang;
    if (ang !== 0) {
      rot = trot(toRadians(total_ang));
      for (let i = 0; i < 4; ++i) {
        tquad[i] = transPt(rot, quad[i]);
      }
    }
    
    // Compute translation to align points
    const ttt = transTo(tquad[to], transPt(Ts[Ts.length - 1], quad[from]));
    Ts.push(mul(ttt, rot));
  }

  // Apply Reflection to all transforms
  for (let idx = 0; idx < Ts.length; ++idx) {
    Ts[idx] = mul(R, Ts[idx]);
  }

  const super_rules: {[key: string]: string[]} = {
		'Gamma' :  ['Pi','Delta','null','Theta','Sigma','Xi','Phi','Gamma'],
		'Delta' :  ['Xi','Delta','Xi','Phi','Sigma','Pi','Phi','Gamma'],
		'Theta' :  ['Psi','Delta','Pi','Phi','Sigma','Pi','Phi','Gamma'],
		'Lambda' : ['Psi','Delta','Xi','Phi','Sigma','Pi','Phi','Gamma'],
		'Xi' :     ['Psi','Delta','Pi','Phi','Sigma','Psi','Phi','Gamma'],
		'Pi' :     ['Psi','Delta','Xi','Phi','Sigma','Psi','Phi','Gamma'],
		'Sigma' :  ['Xi','Delta','Xi','Phi','Sigma','Pi','Lambda','Gamma'],
		'Phi' :    ['Psi','Delta','Psi','Phi','Sigma','Pi','Phi','Gamma'],
		'Psi' :    ['Psi','Delta','Psi','Phi','Sigma','Psi','Phi','Gamma'] 
  };

  const super_quad = [
    transPt(Ts[6], quad[2]),
    transPt(Ts[5], quad[1]),
    transPt(Ts[3], quad[2]),
    transPt(Ts[0], quad[1])
  ];

  const ret: TileSystem = {};

  for(const [lab, subs] of Object.entries(super_rules)) {
    const sup = new Meta();
    for(let idx = 0; idx < 8; ++idx) {
        if(subs[idx] === 'null') continue;
        if(!sys[subs[idx]]) {
            console.error(`Missing tile: ${subs[idx]}`);
            continue;
        }
        sup.addChild(sys[subs[idx]], Ts[idx]);
    }
    sup.quad = super_quad;
    ret[lab] = sup;
  }

  return ret;
}

// --- Testing Logic ---

// Helper to calculate centroid of a set of points
function getCentroid(pts: Point[]): Point {
  if (pts.length === 0) return {x:0, y:0};
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

// Recursively traverse the tile system to find all leaf shapes
function flattenTiles(node: any, T: Matrix, list: {centroid: Point, label: string}[]) {
  if (node instanceof Meta) {
    for (const child of node.geoms) {
      flattenTiles(child.geom, mul(T, child.xform), list);
    }
  } else if (node instanceof Shape || node instanceof CurvyShape) {
     // Leaf node found
     const transformedPts = node.pts.map((p: Point) => transPt(T, p));
     list.push({
       centroid: getCentroid(transformedPts),
       label: node.label
     });
  }
}

export function runOverlapTest(tileType: TileType): string {
  let sys;
  if (tileType === 'Hexagons') sys = buildHexBase();
  else if (tileType === 'Turtles in Hats') sys = buildHatTurtleBase(true);
  else if (tileType === 'Hats in Turtles') sys = buildHatTurtleBase(false);
  else if (tileType === 'Spectres') sys = buildSpectreBase(true);
  else sys = buildSpectreBase(false);

  sys = buildSupertiles(sys);
  sys = buildSupertiles(sys);

  const tiles: {centroid: Point, label: string}[] = [];
  const root = sys['Delta'] || sys['Gamma'];
  if (!root) return "Error: Could not find root tile to test.";

  flattenTiles(root, IDENTITY, tiles);

  let failures = 0;
  const threshold = 0.1; 

  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const dx = tiles[i].centroid.x - tiles[j].centroid.x;
      const dy = tiles[i].centroid.y - tiles[j].centroid.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < threshold) {
        console.warn(`Overlap Detected: ${tiles[i].label} vs ${tiles[j].label} at distance ${dist.toFixed(4)}`);
        failures++;
      }
    }
  }

  if (failures > 0) {
    return `FAILED: ${failures} overlaps detected. Check console for details.`;
  }
  
  return `PASSED: Checked ${tiles.length} tiles. No overlaps found.`;
}