import React, { useState } from 'react';
import { TileType, ColorTheme, ColorScheme, CustomThemeConfig, ThemeSlot, ColoringMode, ColoringConfig } from '../types';
import { TILE_NAMES, COL_MAP_53, COL_MAP_ORIG, COL_MAP_MYSTICS, COL_MAP_PRIDE, COL_MAP_OCEAN, COL_MAP_FOREST, COL_MAP_SUNSET, COL_MAP_PASTEL, COL_MAP_MONOCHROME, COL_MAP_NEON, COL_MAP_AUTUMN, COL_MAP_BERRY, COL_MAP_VINTAGE, COL_MAP_CYBERPUNK, MAGMA_CONFIG } from '../constants';
import { ColoringEditor } from './ColoringEditor';

interface ControlsProps {
  tileType: TileType;
  onTileTypeChange: (t: TileType) => void;
  
  colorTheme: ColorTheme;
  onColorThemeChange: (c: ColorTheme) => void;
  
  // Coloring Rules
  coloringRule: ColoringMode;
  onColoringModeChange: (m: ColoringMode) => void;
  onRerollColoring: () => void;
  coloringConfig: ColoringConfig;
  onColoringConfigChange: (c: ColoringConfig) => void;
  currentPalette: string[];
  uniqueAngles: number[];

  // Custom Theme Props
  customThemeConfig: CustomThemeConfig;
  onCustomThemeConfigChange: (c: CustomThemeConfig) => void;
  
  // activeTile, opacity etc
  activeTile: string;
  onActiveTileChange: (t: string) => void;

  substitutionLevel: number;
  onSubstitute: () => void;
  onReset: () => void;

  // Animation Controls
  animateGrowth: boolean;
  onAnimateGrowthChange: (b: boolean) => void;
  isAnimating: boolean;
  onSkipAnimation: () => void;
  animationSpeed: number;
  onAnimationSpeedChange: (s: number) => void;

  onExportPNG: () => void;
  onExportSVG: () => void;
  onRunTest: () => void;

  isEditMode: boolean;
  onToggleEditMode: () => void;
  onClearHidden: () => void;
  onHideAll: () => void;

  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  tileCount: number;

  backgroundColor: string;
  onBackgroundColorChange: (c: string) => void;
  strokeColor: string;
  onStrokeColorChange: (c: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (w: number) => void;
}

const THEMES: { label: ColorTheme, colors?: ColorScheme, custom?: boolean }[] = [
  { label: 'Pride', colors: COL_MAP_PRIDE },
  { label: 'Magma', custom: true }, // Special case gradient theme
  { label: 'Mystics', colors: COL_MAP_MYSTICS },
  { label: 'Figure 5.3', colors: COL_MAP_53 },
  { label: 'Bright', colors: COL_MAP_ORIG },
  { label: 'Ocean', colors: COL_MAP_OCEAN },
  { label: 'Forest', colors: COL_MAP_FOREST },
  { label: 'Sunset', colors: COL_MAP_SUNSET },
  { label: 'Pastel', colors: COL_MAP_PASTEL },
  { label: 'Monochrome', colors: COL_MAP_MONOCHROME },
  { label: 'Neon', colors: COL_MAP_NEON },
  { label: 'Autumn', colors: COL_MAP_AUTUMN },
  { label: 'Berry', colors: COL_MAP_BERRY },
  { label: 'Vintage', colors: COL_MAP_VINTAGE },
  { label: 'Cyberpunk', colors: COL_MAP_CYBERPUNK },
  { label: 'Custom', custom: true },
];

export const Controls: React.FC<ControlsProps> = ({
  tileType,
  onTileTypeChange,
  colorTheme,
  onColorThemeChange,
  customThemeConfig,
  onCustomThemeConfigChange,
  activeTile,
  onActiveTileChange,
  substitutionLevel,
  onSubstitute,
  onReset,
  animateGrowth,
  onAnimateGrowthChange,
  isAnimating,
  onSkipAnimation,
  animationSpeed,
  onAnimationSpeedChange,
  onExportPNG,
  onExportSVG,
  onRunTest,
  isEditMode,
  onToggleEditMode,
  onClearHidden,
  onHideAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  tileCount,
  backgroundColor,
  onBackgroundColorChange,
  strokeColor,
  onStrokeColorChange,
  strokeWidth,
  onStrokeWidthChange,
  coloringRule,
  onColoringModeChange,
  onRerollColoring,
  coloringConfig,
  onColoringConfigChange,
  currentPalette,
  uniqueAngles
}) => {
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const getPreviewColors = (theme: typeof THEMES[0]) => {
     if (theme.label === 'Magma') return ['#3c0000', '#ff4d00', '#ffcc00', '#4a0e00', '#ffd700'];
     if (theme.label === 'Custom') return Object.values(customThemeConfig.slots).map((s: ThemeSlot) => s.color1);
     return Object.values(theme.colors || {}).slice(0, 5);
  };

  const updateCustomSlot = (key: string, field: 'color1' | 'color2' | 'isGradient' | 'opacity', value: any) => {
    onCustomThemeConfigChange({
        ...customThemeConfig,
        slots: {
            ...customThemeConfig.slots,
            [key]: {
                ...customThemeConfig.slots[key],
                [field]: value
            }
        }
    });
  };

  const addCustomSlot = () => {
    const keys = Object.keys(customThemeConfig.slots);
    // Find the next available index
    let nextIndex = 1;
    while (keys.includes(`group${nextIndex}`)) {
        nextIndex++;
    }
    const newKey = `group${nextIndex}`;
    onCustomThemeConfigChange({
        ...customThemeConfig,
        slots: {
            ...customThemeConfig.slots,
            [newKey]: { color1: '#888888', color2: '#ffffff', isGradient: false, opacity: 1.0 }
        }
    });
  };

  const removeCustomSlot = (key: string) => {
    const newSlots = { ...customThemeConfig.slots };
    delete newSlots[key];
    onCustomThemeConfigChange({
        ...customThemeConfig,
        slots: newSlots
    });
  };

  const handleEditTheme = () => {
     // Find current theme data
     const currentTheme = THEMES.find(t => t.label === colorTheme);
     if (!currentTheme || !currentTheme.colors) return;

     // Map standard theme colors to custom slots based on the 5-group mapping logic
     // Mapping: Gamma->1, Delta->2, Lambda->3, Pi->4, Phi->5
     const mapping = [
        { key: 'group1', label: 'Gamma' },
        { key: 'group2', label: 'Delta' },
        { key: 'group3', label: 'Lambda' },
        { key: 'group4', label: 'Pi' },
        { key: 'group5', label: 'Phi' },
     ];

     const newSlots: Record<string, ThemeSlot> = {};
     mapping.forEach(m => {
        const col = currentTheme.colors![m.label] || '#cccccc';
        newSlots[m.key] = {
            color1: col,
            color2: '#ffffff',
            isGradient: false,
            opacity: 1.0
        };
     });

     onCustomThemeConfigChange({ slots: newSlots });
     onColorThemeChange('Custom');
     setIsThemeOpen(false);
  };

  // Sort keys naturally (group1, group2, group10...)
  const sortedSlotKeys = Object.keys(customThemeConfig.slots).sort((a, b) => 
    a.localeCompare(b, undefined, { numeric: true })
  );

  return (
    <div className="absolute top-4 left-4 w-80 bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-xl border border-gray-200 flex flex-col gap-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Spectre Explorer</h1>
        <p className="text-xs text-gray-500 mt-1">Visualization of chiral aperiodic monotiles</p>
      </div>

      {/* Mode Switcher */}
      <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
          <button 
             onClick={onToggleEditMode} 
             className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${!isEditMode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
             View / Pan
          </button>
          <button 
             onClick={onToggleEditMode} 
             className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${isEditMode ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
             Edit / Hide
          </button>
      </div>

      {/* Edit Tools */}
      {isEditMode && (
         <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="text-xs text-red-800 font-medium">Click or Drag to Hide/Show tiles</p>
            
            <div className="flex gap-2 mb-1">
               <button 
                 onClick={onUndo} 
                 disabled={!canUndo}
                 className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${canUndo ? 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50' : 'bg-gray-100 text-gray-400 border-transparent cursor-not-allowed'}`}
               >
                 ↶ Undo
               </button>
               <button 
                 onClick={onRedo}
                 disabled={!canRedo}
                 className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${canRedo ? 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50' : 'bg-gray-100 text-gray-400 border-transparent cursor-not-allowed'}`}
               >
                 Redo ↷
               </button>
            </div>

            <div className="flex gap-2">
                <button 
                  onClick={onHideAll}
                  className="flex-1 py-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-medium"
                >
                  Hide All
                </button>
                <button 
                  onClick={onClearHidden}
                  className="flex-1 py-2 bg-white text-red-700 border border-red-200 hover:bg-red-50 rounded-lg text-xs font-medium"
                >
                  Unhide All
                </button>
            </div>
         </div>
      )}

      {/* Substitution Control */}
      <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
             <span className="text-xs font-bold text-blue-900">Iteration: {substitutionLevel}</span>
             <span className="text-[10px] text-blue-600 font-mono">{tileCount} Tiles</span>
          </div>
          <button 
            onClick={onReset}
            className="px-3 py-1 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded text-xs font-medium transition-colors"
          >
            Reset
          </button>
        </div>

        {isAnimating ? (
            <button 
              onClick={onSkipAnimation}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-md transition-colors animate-pulse"
            >
              Skip Animation
            </button>
        ) : (
            <button 
              onClick={onSubstitute}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-md transition-colors"
            >
              Grow Pattern
            </button>
        )}
        
        <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={animateGrowth} 
                    onChange={(e) => onAnimateGrowthChange(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-blue-800">Animate Growth</span>
            </label>
            
            {animateGrowth && (
                <div className="flex items-center gap-2 px-1">
                   <span className="text-[10px] text-blue-800 whitespace-nowrap">Growth Speed</span>
                   <input 
                      type="range" 
                      min="0.01" 
                      max="2.0" 
                      step="0.01" 
                      value={animationSpeed} 
                      onChange={(e) => onAnimationSpeedChange(parseFloat(e.target.value))}
                      className="w-full h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                   />
                   <span className="text-[10px] text-blue-800 w-6 text-right">{animationSpeed.toFixed(2)}x</span>
                </div>
            )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Base Shape */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Base Shape</label>
          <select 
            className="w-full p-2 rounded-lg bg-gray-50 border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900"
            value={tileType}
            onChange={(e) => onTileTypeChange(e.target.value as TileType)}
          >
            <option value="Spectres">Spectres (Curved)</option>
            <option value="Tile(1,1)">Tile(1,1) (Polygonal)</option>
            <option value="Hexagons">Hexagons</option>
            <option value="Turtles in Hats">Turtles in Hats</option>
            <option value="Hats in Turtles">Hats in Turtles</option>
          </select>
        </div>

        {/* Custom Theme Selector with Preview */}
        <div className="flex flex-col gap-1 relative">
           <div className="flex justify-between items-center">
             <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Color Theme</label>
             {colorTheme !== 'Custom' && colorTheme !== 'Magma' && (
               <button 
                 onClick={handleEditTheme}
                 className="text-[10px] text-blue-600 hover:text-blue-800 font-medium underline"
               >
                 Edit Theme
               </button>
             )}
           </div>
           <div 
             className="w-full p-2 rounded-lg bg-gray-50 border border-gray-300 cursor-pointer flex justify-between items-center hover:bg-gray-50 transition-colors"
             onClick={() => setIsThemeOpen(!isThemeOpen)}
           >
             <span className="text-sm text-gray-900 font-medium">{colorTheme}</span>
             <div className="flex gap-1">
                 {getPreviewColors(THEMES.find(t => t.label === colorTheme) || THEMES[0]).slice(0, 4).map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: c }} />
                 ))}
             </div>
           </div>
           
           {isThemeOpen && (
             <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                {THEMES.map(theme => (
                  <div 
                    key={theme.label}
                    className={`p-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center ${colorTheme === theme.label ? 'bg-blue-50' : ''}`}
                    onClick={() => {
                        onColorThemeChange(theme.label);
                        setIsThemeOpen(false);
                    }}
                  >
                    <span className="text-sm text-gray-800">{theme.label}</span>
                    <div className="flex gap-1">
                        {/* Show first 5 unique colors */}
                        {getPreviewColors(theme).slice(0, 5).map((c, i) => (
                           <div key={i} className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: c }} />
                        ))}
                    </div>
                  </div>
                ))}
             </div>
           )}
        </div>

        {/* Coloring Rules */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Coloring Rule</label>
          <div className="flex gap-2">
            <select
              className="flex-1 p-2 rounded-lg bg-gray-50 border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900"
              value={coloringRule}
              onChange={(e) => onColoringModeChange(e.target.value as ColoringMode)}
            >
              <option value="default">Default (By Label)</option>
              <option value="random">Randomize</option>
              <option value="four-color">4/5 Color Map</option>
              <option value="orientation">Orientation</option>
              <option value="orientation-gradient">Orientation Gradient</option>
            </select>
            {(coloringRule === 'random' || coloringRule === 'four-color') && (
               <button
                 onClick={onRerollColoring}
                 className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium border border-gray-200"
                 title="Reroll"
               >
                 🎲
               </button>
            )}
            {(coloringRule === 'orientation' || coloringRule === 'orientation-gradient') && (
               <button
                 onClick={() => setIsEditorOpen(true)}
                 className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium border border-gray-200"
                 title="Edit Rule"
               >
                 ✏️
               </button>
            )}
          </div>
        </div>

        <ColoringEditor
            isOpen={isEditorOpen}
            onClose={() => setIsEditorOpen(false)}
            mode={coloringRule}
            config={coloringConfig}
            onChange={onColoringConfigChange}
            palette={currentPalette}
            uniqueAngles={uniqueAngles}
        />

        {/* Custom Theme Editor */}
        {colorTheme === 'Custom' && (
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 flex flex-col gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customize Palette</span>
                
                {sortedSlotKeys.map((key, idx) => {
                    const slot = customThemeConfig.slots[key];
                    return (
                        <div key={key} className="flex flex-col gap-1 bg-white p-2 rounded border border-gray-100 shadow-sm animate-in fade-in zoom-in duration-200">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-gray-700">Group {idx + 1}</span>
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1 cursor-pointer">
                                      <input 
                                          type="checkbox" 
                                          checked={slot.isGradient} 
                                          onChange={(e) => updateCustomSlot(key, 'isGradient', e.target.checked)}
                                          className="rounded text-blue-500 focus:ring-blue-500 w-3 h-3"
                                      />
                                      <span className="text-[10px] text-gray-500">Gradient</span>
                                  </label>
                                  {sortedSlotKeys.length > 1 && (
                                    <button 
                                      onClick={() => removeCustomSlot(key)}
                                      className="text-gray-400 hover:text-red-500 text-[10px] font-bold px-1"
                                      title="Remove Group"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1 flex items-center gap-1 border border-gray-200 rounded px-1">
                                    <input 
                                        type="color" 
                                        value={slot.color1} 
                                        onChange={(e) => updateCustomSlot(key, 'color1', e.target.value)}
                                        className="w-5 h-5 rounded-full border-0 p-0 bg-transparent cursor-pointer"
                                    />
                                    <span className="text-[10px] font-mono text-gray-500">{slot.color1}</span>
                                </div>
                                {slot.isGradient && (
                                    <div className="flex-1 flex items-center gap-1 border border-gray-200 rounded px-1 animate-in fade-in zoom-in duration-200">
                                        <input 
                                            type="color" 
                                            value={slot.color2} 
                                            onChange={(e) => updateCustomSlot(key, 'color2', e.target.value)}
                                            className="w-5 h-5 rounded-full border-0 p-0 bg-transparent cursor-pointer"
                                        />
                                        <span className="text-[10px] font-mono text-gray-500">{slot.color2}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] text-gray-400 w-8">Opacity</span>
                                <input 
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={slot.opacity}
                                    onChange={(e) => updateCustomSlot(key, 'opacity', parseFloat(e.target.value))}
                                    className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                        </div>
                    );
                })}
                <button 
                    onClick={addCustomSlot}
                    className="w-full py-1.5 mt-1 border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                >
                    <span>+</span> Add Color Group
                </button>
            </div>
        )}

        {/* Advanced Appearance */}
        <div className="grid grid-cols-2 gap-2">
           <div className="flex flex-col gap-1">
             <span className="text-xs text-gray-400">Background</span>
             <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-lg border border-gray-200 h-[60px]">
                <input 
                  type="color" 
                  value={backgroundColor} 
                  onChange={(e) => onBackgroundColorChange(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                />
                <span className="text-[10px] text-gray-600 font-mono uppercase">{backgroundColor}</span>
             </div>
           </div>
           <div className="flex flex-col gap-1">
             <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Outline</span>
                <span className="text-[10px] text-gray-400">{strokeWidth.toFixed(2)}</span>
             </div>
             <div className="flex flex-col gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 h-[60px] justify-center">
                <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={strokeColor} 
                      onChange={(e) => onStrokeColorChange(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                    />
                    <input 
                        type="range"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={strokeWidth}
                        onChange={(e) => onStrokeWidthChange(parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
             </div>
           </div>
        </div>

        <div className="flex flex-col gap-1">
             <div className="flex items-center gap-1 group relative w-fit">
                <span className="text-xs text-gray-400">Active Group Highlight</span>
                <div className="w-3 h-3 rounded-full border border-gray-400 flex items-center justify-center text-[9px] text-gray-500 cursor-help">?</div>
                <div className="absolute bottom-full left-0 mb-2 w-60 p-2.5 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-normal leading-relaxed">
                   Selects the initial "seed" tile for pattern generation. 
                   <br/><br/>
                   The substitution rules use 9 distinct tile roles (Gamma, Delta, etc.) to enforce aperiodicity. Changing this dictates which role starts the growth process.
                </div>
             </div>
             <select 
              className="w-full p-2 rounded-lg bg-gray-50 border border-gray-300 text-sm text-gray-900"
              value={activeTile}
              onChange={(e) => onActiveTileChange(e.target.value)}
            >
              {TILE_NAMES.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
        </div>
      </div>

      {/* Export & Tests */}
      <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
         <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Export</label>
         <div className="grid grid-cols-2 gap-2">
            <button onClick={onExportPNG} className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium">
              Save PNG
            </button>
            <button onClick={onExportSVG} className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium">
              Save SVG
            </button>
         </div>
      </div>

      <div className="text-[10px] text-gray-400 text-center mt-1">
        {isEditMode ? "Mode: EDIT (Drag to hide)" : "Mode: VIEW (Pinch/Pan)"}
      </div>
    </div>
  );
};