import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Controls } from './components/Controls';
import { TileSystem, TileType, ColorTheme, Matrix, ColorScheme, Renderable, CustomThemeConfig, ThemeSlot, ColoringMode } from './types';
import { computeColors } from './utils/coloring';
import { 
  buildSpectreBase, 
  buildHatTurtleBase, 
  buildHexBase, 
  buildSupertiles,
  runOverlapTest,
  bake,
  BakedInstance
} from './utils/spectre';
import { 
  COL_MAP_PRIDE, 
  COL_MAP_MYSTICS, 
  COL_MAP_53, 
  COL_MAP_ORIG,
  COL_MAP_OCEAN,
  COL_MAP_FOREST,
  COL_MAP_SUNSET,
  COL_MAP_PASTEL,
  COL_MAP_MONOCHROME,
  COL_MAP_NEON,
  COL_MAP_AUTUMN,
  COL_MAP_BERRY,
  COL_MAP_VINTAGE,
  COL_MAP_CYBERPUNK,
  MAGMA_CONFIG,
  DEFAULT_CUSTOM_CONFIG,
  TILE_GROUP_MAP
} from './constants';
import { IDENTITY, mul, ttrans, inv, transPt, mag, trot, tscale } from './utils/geometry';

function areSetsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const item of a) if (!b.has(item)) return false;
    return true;
}

// Helper to find the controlling hidden ancestor
// Returns the shortest path in hiddenSet that is a prefix of path
function findHiddenAncestor(path: string, hiddenSet: Set<string>): string | null {
  const parts = path.split(':');
  let current = parts[0];
  if (hiddenSet.has(current)) return current;
  for (let i = 1; i < parts.length; i++) {
    current += ':' + parts[i];
    if (hiddenSet.has(current)) return current;
  }
  return null;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sys, setSys] = useState<TileSystem | null>(null);
  const [tileType, setTileType] = useState<TileType>('Tile(1,1)');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('Mystics');
  const [customThemeConfig, setCustomThemeConfig] = useState<CustomThemeConfig>(DEFAULT_CUSTOM_CONFIG);
  
  const [activeTile, setActiveTile] = useState<string>('Delta');
  const [subLevel, setSubLevel] = useState(0);

  // Appearance State
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(0.1);

  // Coloring State
  const [coloringMode, setColoringMode] = useState<ColoringMode>('default');
  const [coloringSeed, setColoringSeed] = useState<number>(Date.now());

  // Animation State
  const [animateGrowth, setAnimateGrowth] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(0.2);
  
  // Performance State: Baked list of tiles to render
  const [bakedTiles, setBakedTiles] = useState<BakedInstance[]>([]);
  
  // Animation Refs
  const visibleCountRef = useRef(0);
  const animSpeedRef = useRef(1);

  // Interaction State
  const [isEditMode, setIsEditMode] = useState(false);
  const [hiddenTiles, setHiddenTiles] = useState<Set<string>>(new Set());
  
  // Undo/Redo State
  const [past, setPast] = useState<Set<string>[]>([]);
  const [future, setFuture] = useState<Set<string>[]>([]);

  // Refs for performance / interaction
  const transformRef = useRef<Matrix>([20, 0, 0, 0, -20, 0]); 
  const pointersRef = useRef<Map<number, {x: number, y: number}>>(new Map());
  const dragActionRef = useRef<'hide' | 'show' | null>(null);
  const lastHitPathRef = useRef<string | null>(null);
  const dragStartSnapshotRef = useRef<Set<string> | null>(null);

  // --- Initialization & Logic ---

  const initSystem = useCallback((type: TileType) => {
    let newSys: TileSystem;
    if (type === 'Hexagons') newSys = buildHexBase();
    else if (type === 'Turtles in Hats') newSys = buildHatTurtleBase(true);
    else if (type === 'Hats in Turtles') newSys = buildHatTurtleBase(false);
    else if (type === 'Spectres') newSys = buildSpectreBase(true);
    else newSys = buildSpectreBase(false); 
    
    setSys(newSys);
    setSubLevel(0);
    setHiddenTiles(new Set<string>());
    setPast([]);
    setFuture([]);
    setIsAnimating(false);
    
    transformRef.current = [20, 0, 0, 0, -20, 0]; 
  }, []);

  useEffect(() => {
    initSystem(tileType);
  }, [tileType, initSystem]);

  // Set default background based on theme for convenience
  useEffect(() => {
     if (colorTheme === 'Cyberpunk' || colorTheme === 'Neon' || colorTheme === 'Magma') {
        setBackgroundColor('#111111');
        setStrokeColor('#ffffff');
        // Auto-adjust stroke thickness for dark themes usually looks better thinner
        setStrokeWidth(0.05); 
     } else {
        setBackgroundColor('#ffffff');
        setStrokeColor('#000000');
        setStrokeWidth(0.1);
     }
  }, [colorTheme]);

  // Re-bake when system, active tile, or visibility settings change
  useEffect(() => {
    // If animating, the baking is handled in handleSubstitute to sort logic
    // We only auto-bake here if NOT animating to respond to other changes (edit mode, active tile, etc)
    if (isAnimating) return;

    if (sys && sys[activeTile]) {
      const shouldPrune = !isEditMode;
      const flatList = bake(sys[activeTile], IDENTITY, "0", hiddenTiles, shouldPrune);
      setBakedTiles(flatList);
    } else {
      setBakedTiles([]);
    }
  }, [sys, activeTile, hiddenTiles, isEditMode, isAnimating]);

  // --- History Management ---

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    
    setFuture(prev => [...prev, new Set<string>(hiddenTiles)]);
    setHiddenTiles(previous);
    setPast(newPast);
  }, [past, hiddenTiles]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const newFuture = future.slice(0, -1);

    setPast(prev => [...prev, new Set<string>(hiddenTiles)]);
    setHiddenTiles(next);
    setFuture(newFuture);
  }, [future, hiddenTiles]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                handleRedo();
            } else {
                handleUndo();
            }
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
            e.preventDefault();
            handleRedo();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);


  const handleSubstitute = () => {
    if (!sys) return;
    
    const prevCount = bakedTiles.length;
    const newSys = buildSupertiles(sys);
    const newHiddenTiles = new Set<string>(hiddenTiles);

    // Calculate new tiles
    let flatList: BakedInstance[] = [];
    if (newSys[activeTile]) {
         const shouldPrune = !isEditMode;
         flatList = bake(newSys[activeTile], IDENTITY, "0", newHiddenTiles, shouldPrune);
    }

    if (animateGrowth) {
        // Sort by distance from origin (0,0)
        // This ensures that the "center" tiles (which correspond to the previous generation in many cases)
        // are processed first. By setting visibleCount to prevCount, we effectively "skip" animating
        // the tiles that are already on screen, building on the existing pattern.
        flatList.sort((a, b) => {
            const da = a.matrix[2] * a.matrix[2] + a.matrix[5] * a.matrix[5];
            const db = b.matrix[2] * b.matrix[2] + b.matrix[5] * b.matrix[5];
            return da - db;
        });

        // Start from the number of tiles we already had
        // If the new count is somehow smaller, clamp it.
        visibleCountRef.current = Math.min(prevCount, flatList.length);
        
        animSpeedRef.current = 0.5; // Base speed
        setIsAnimating(true);
    }

    setSys(newSys);
    setSubLevel(prev => prev + 1);
    setHiddenTiles(newHiddenTiles);
    setBakedTiles(flatList);
    setPast([]);
    setFuture([]);
  };

  const handleSkipAnimation = () => {
     visibleCountRef.current = bakedTiles.length;
     setIsAnimating(false);
  };

  const handleReset = () => {
    initSystem(tileType);
  };

  const handleRunTest = () => {
    const result = runOverlapTest(tileType);
    alert(result);
  };

  const handleClearHidden = () => {
    if (hiddenTiles.size === 0) return;
    setPast(prev => [...prev, new Set<string>(hiddenTiles)]);
    setFuture([]);
    setHiddenTiles(new Set<string>());
  };

  const handleHideAll = () => {
    if (hiddenTiles.has("0")) return;
    
    setPast(prev => [...prev, new Set<string>(hiddenTiles)]);
    setFuture([]);
    setHiddenTiles(prev => {
        const next = new Set<string>(prev);
        next.add("0");
        return next;
    });
  };

  const colors = useMemo(() => {
    switch (colorTheme) {
      case 'Figure 5.3': return COL_MAP_53;
      case 'Bright': return COL_MAP_ORIG;
      case 'Mystics': return COL_MAP_MYSTICS;
      case 'Ocean': return COL_MAP_OCEAN;
      case 'Forest': return COL_MAP_FOREST;
      case 'Sunset': return COL_MAP_SUNSET;
      case 'Pastel': return COL_MAP_PASTEL;
      case 'Monochrome': return COL_MAP_MONOCHROME;
      case 'Neon': return COL_MAP_NEON;
      case 'Autumn': return COL_MAP_AUTUMN;
      case 'Berry': return COL_MAP_BERRY;
      case 'Vintage': return COL_MAP_VINTAGE;
      case 'Cyberpunk': return COL_MAP_CYBERPUNK;
      // Magma and Custom handled separately in render
      default: return COL_MAP_PRIDE;
    }
  }, [colorTheme]);

  const dynamicColors = useMemo(() => {
    if (coloringMode === 'default') return null;

    // Determine palette
    let palette: string[] = [];
    if (colorTheme === 'Custom') {
        palette = Object.values(customThemeConfig.slots).map(s => s.color1);
    } else if (colorTheme === 'Magma') {
        palette = Object.values(MAGMA_CONFIG.slots).map(s => s.color1);
    } else {
        // Use unique colors from the current theme
        palette = Array.from(new Set(Object.values(colors)));
    }

    return computeColors(bakedTiles, coloringMode, palette, coloringSeed);
  }, [bakedTiles, coloringMode, coloringSeed, colorTheme, colors, customThemeConfig]);

  // --- Rendering Loop ---

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    
    // Determine current custom config
    let activeCustomConfig: CustomThemeConfig | null = null;
    if (colorTheme === 'Custom') activeCustomConfig = customThemeConfig;
    else if (colorTheme === 'Magma') activeCustomConfig = MAGMA_CONFIG;

    // Pre-calculate mapping from tile groups ('group1'...'group5') to available user slots
    const effectiveSlots: Record<string, ThemeSlot> = {};
    if (activeCustomConfig) {
       const userKeys = Object.keys(activeCustomConfig.slots).sort((a, b) => 
           a.localeCompare(b, undefined, { numeric: true })
       );
       
       if (userKeys.length > 0) {
           for(let i=1; i<=5; i++) {
               const logicalKey = `group${i}`;
               if (activeCustomConfig.slots[logicalKey]) {
                   effectiveSlots[logicalKey] = activeCustomConfig.slots[logicalKey];
               } else {
                   const mappedKey = userKeys[(i - 1) % userKeys.length];
                   effectiveSlots[logicalKey] = activeCustomConfig.slots[mappedKey];
               }
           }
       }
    }

    const render = () => {
      // Handle High DPI
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
      }

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(rect.width / 2, rect.height / 2);
      
      // Camera Transform
      const mat = transformRef.current;
      ctx.transform(mat[0], mat[1], mat[3], mat[4], mat[2], mat[5]);

      // Calculate Draw Limit for Animation
      let limit = bakedTiles.length;
      if (isAnimating) {
        limit = Math.floor(visibleCountRef.current);
        
        // Linear acceleration with Speed Factor
        const accel = 0.05 * animationSpeed;
        const speed = animSpeedRef.current * animationSpeed;
        
        visibleCountRef.current += speed;
        animSpeedRef.current += accel; 
        
        if (visibleCountRef.current >= bakedTiles.length) {
             visibleCountRef.current = bakedTiles.length;
             if (limit >= bakedTiles.length) {
                 limit = bakedTiles.length;
                 setTimeout(() => setIsAnimating(false), 0);
             }
        }
      }

      ctx.lineWidth = strokeWidth; // World units
      
      const fadeWindow = 20; // Fewer tiles for fade in

      for (let i = 0; i < limit; i++) {
        const inst = bakedTiles[i];
        const T = inst.matrix;

        ctx.save();
        
        // Setup appearance
        let alpha = 1.0;
        let slot: ThemeSlot | null = null;

        if (activeCustomConfig) {
             const groupKey = TILE_GROUP_MAP[inst.shape.label] || 'group1';
             slot = effectiveSlots[groupKey];
             if (slot) {
                 alpha = slot.opacity;
             }
        }

        // Apply fade-in effect at the leading edge of animation
        if (isAnimating) {
            const dist = limit - i;
            if (dist < fadeWindow) {
                alpha *= (dist / fadeWindow);
            }
        }

        if (inst.isHidden) {
             ctx.globalAlpha = 0.15;
             ctx.strokeStyle = '#ff0000';
             ctx.lineWidth = strokeWidth * 1.5;
             ctx.fillStyle = '#cccccc';
        } else {
             ctx.globalAlpha = alpha;
             ctx.strokeStyle = strokeColor;
             
             // Color Logic
             if (dynamicColors && dynamicColors.has(inst.path)) {
                 ctx.fillStyle = dynamicColors.get(inst.path)!;
             } else if (activeCustomConfig && slot) {
                 if (slot.isGradient) {
                     const grad = ctx.createLinearGradient(0, 0, 1.5, 1.5);
                     grad.addColorStop(0, slot.color1);
                     if (slot.colors && slot.colors.length > 0) {
                         // Support multi-stop gradients if present
                         const len = slot.colors.length;
                         slot.colors.forEach((c, idx) => {
                             grad.addColorStop((idx + 1) / (len + 1), c);
                         });
                     }
                     grad.addColorStop(1, slot.color2);
                     ctx.fillStyle = grad;
                 } else {
                     ctx.fillStyle = slot.color1;
                 }
             } else {
                 ctx.fillStyle = colors[inst.shape.label] || '#cccccc';
             }
        }

        // Apply Model Transform
        ctx.transform(T[0], T[3], T[1], T[4], T[2], T[5]);
        
        ctx.fill(inst.shape.path2D);
        if (strokeWidth > 0) {
            ctx.stroke(inst.shape.path2D);
        }
        
        ctx.restore();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [bakedTiles, colors, colorTheme, isEditMode, backgroundColor, strokeColor, strokeWidth, customThemeConfig, isAnimating, animationSpeed]);

  // --- Interaction Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 0.9 : 1.1;
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    const current = transformRef.current;
    const invMat = inv(current);
    const worldMouse = transPt(invMat, {x: mouseX, y: mouseY});

    const newMat: Matrix = [
        current[0] * scale, current[1] * scale, current[2],
        current[3] * scale, current[4] * scale, current[5]
    ];

    const newWorldMouseProjected = transPt(newMat, worldMouse);
    newMat[2] += (mouseX - newWorldMouseProjected.x);
    newMat[5] += (mouseY - newWorldMouseProjected.y);

    transformRef.current = newMat;
  };

  const performHitTest = (clientX: number, clientY: number): string | null => {
    if (!canvasRef.current || bakedTiles.length === 0) return null;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const mouseX = clientX - cx;
    const mouseY = clientY - cy;
    
    // Mouse in World Space
    const invView = inv(transformRef.current);
    const worldPt = transPt(invView, {x: mouseX, y: mouseY});

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return null;

    // Iterate in reverse for painter's algorithm order (top-most first)
    for (let i = bakedTiles.length - 1; i >= 0; i--) {
        const inst = bakedTiles[i];
        
        // Transform Point to Local Space of the tile
        const invModel = inv(inst.matrix);
        const localPt = transPt(invModel, worldPt);
        
        // Use native hardware-accelerated hit test
        if (ctx.isPointInPath(inst.shape.path2D, localPt.x, localPt.y)) {
            return inst.path;
        }
    }

    return null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvasRef.current?.setPointerCapture(e.pointerId);

    if (isEditMode) {
        const hitPath = performHitTest(e.clientX, e.clientY);
        if (hitPath) {
            dragStartSnapshotRef.current = new Set<string>(hiddenTiles);

            // Determine if we are hitting a tile that is effectively hidden by an ancestor
            const hiddenAncestor = findHiddenAncestor(hitPath, hiddenTiles);
            const targetPath = hiddenAncestor || hitPath;

            const isHidden = hiddenTiles.has(targetPath);
            const action = isHidden ? 'show' : 'hide';
            dragActionRef.current = action;
            lastHitPathRef.current = targetPath;
            
            setHiddenTiles(prev => {
                const next = new Set<string>(prev);
                if (action === 'hide') next.add(targetPath);
                else next.delete(targetPath);
                return next;
            });
        } else {
            dragActionRef.current = null;
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const prev = pointersRef.current.get(e.pointerId);
    if (!prev) return;
    
    const curr = { x: e.clientX, y: e.clientY };

    if (isEditMode && dragActionRef.current) {
        const hitPath = performHitTest(e.clientX, e.clientY);
        if (hitPath) {
            // Logic: if we hit a ghost (child of hidden), we want to act on the hidden ancestor.
            // If we hit a visible tile, we act on the tile itself.
            const hiddenAncestor = findHiddenAncestor(hitPath, hiddenTiles);
            const targetPath = hiddenAncestor || hitPath;

            if (targetPath !== lastHitPathRef.current) {
                lastHitPathRef.current = targetPath;
                const action = dragActionRef.current;
                
                setHiddenTiles(prev => {
                    const next = new Set<string>(prev);
                    if (action === 'hide') next.add(targetPath);
                    else next.delete(targetPath);
                    return next;
                });
            }
        }
    } else if (!isEditMode) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        if (pointersRef.current.size === 2) {
           let otherId = -1;
           let otherPos = {x: 0, y: 0};
           for(const [id, pos] of pointersRef.current) {
             if (id !== e.pointerId) {
               otherId = id;
               otherPos = pos;
               break;
             }
           }

           if (otherId !== -1) {
             const p1 = { x: prev.x - cx, y: prev.y - cy };
             const p2 = { x: otherPos.x - cx, y: otherPos.y - cy };
             const q1 = { x: curr.x - cx, y: curr.y - cy };
             const q2 = { x: otherPos.x - cx, y: otherPos.y - cy };

             const distPrev = Math.hypot(p2.x - p1.x, p2.y - p1.y);
             const distCurr = Math.hypot(q2.x - q1.x, q2.y - q1.y);
             const angPrev = Math.atan2(p2.y - p1.y, p2.x - p1.x);
             const angCurr = Math.atan2(q2.y - q1.y, q2.x - q1.x);
             
             const midPrev = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
             const midCurr = { x: (q1.x + q2.x)/2, y: (q1.y + q2.y)/2 };

             const scale = distCurr / (distPrev || 1); 
             const rotate = angCurr - angPrev;
             
             const T_center_inv = ttrans(-midPrev.x, -midPrev.y);
             const T_rot_scale = mul(tscale(scale), trot(rotate));
             const T_center_new = ttrans(midCurr.x, midCurr.y);
             
             const T_delta = mul(T_center_new, mul(T_rot_scale, T_center_inv));
             transformRef.current = mul(T_delta, transformRef.current);
           }
        } else if (pointersRef.current.size === 1) {
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          transformRef.current[2] += dx;
          transformRef.current[5] += dy;
        }
    }

    pointersRef.current.set(e.pointerId, curr);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    canvasRef.current?.releasePointerCapture(e.pointerId);
    dragActionRef.current = null;
    lastHitPathRef.current = null;
    
    if (dragStartSnapshotRef.current) {
        if (!areSetsEqual(dragStartSnapshotRef.current, hiddenTiles)) {
            setPast(prev => [...prev, dragStartSnapshotRef.current!]);
            setFuture([]);
        }
        dragStartSnapshotRef.current = null;
    }
  };

  const exportPNG = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `spectre-tiling-${Date.now()}.png`;
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  };

  const exportSVG = () => {
    if (!sys) return;
    const svgContent = sys[activeTile].getSVG(transformRef.current, colors);
    const w = canvasRef.current?.width || 800;
    const h = canvasRef.current?.height || 600;
    
    const svgFile = `
      <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="background-color: ${backgroundColor}">
        <g transform="translate(${w/2},${h/2})">
           ${svgContent}
        </g>
      </svg>
    `;
    
    const blob = new Blob([svgFile], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spectre-tiling-${Date.now()}.svg`;
    link.click();
  };

  return (
    <div className="relative w-full h-screen bg-gray-100 overflow-hidden font-sans">
      <canvas
        ref={canvasRef}
        className={`block w-full h-full touch-none ${isEditMode ? 'cursor-crosshair' : 'cursor-move'}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      <Controls 
        tileType={tileType}
        onTileTypeChange={setTileType}
        colorTheme={colorTheme}
        onColorThemeChange={setColorTheme}
        customThemeConfig={customThemeConfig}
        onCustomThemeConfigChange={setCustomThemeConfig}
        activeTile={activeTile}
        onActiveTileChange={setActiveTile}
        substitutionLevel={subLevel}
        onSubstitute={handleSubstitute}
        onReset={handleReset}
        animateGrowth={animateGrowth}
        onAnimateGrowthChange={setAnimateGrowth}
        isAnimating={isAnimating}
        onSkipAnimation={handleSkipAnimation}
        animationSpeed={animationSpeed}
        onAnimationSpeedChange={setAnimationSpeed}
        onExportPNG={exportPNG}
        onExportSVG={exportSVG}
        onRunTest={handleRunTest}
        isEditMode={isEditMode}
        onToggleEditMode={() => setIsEditMode(prev => !prev)}
        onClearHidden={handleClearHidden}
        onHideAll={handleHideAll}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        tileCount={bakedTiles.length}
        backgroundColor={backgroundColor}
        onBackgroundColorChange={setBackgroundColor}
        strokeColor={strokeColor}
        onStrokeColorChange={setStrokeColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        coloringRule={coloringMode}
        onColoringModeChange={setColoringMode}
        onRerollColoring={() => setColoringSeed(Date.now())}
      />
    </div>
  );
}