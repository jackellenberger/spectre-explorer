
export interface Point {
  x: number;
  y: number;
}

// Affine matrix [a, b, c, d, e, f] representing:
// | a c e |
// | b d f |
// | 0 0 1 |
export type Matrix = [number, number, number, number, number, number];

export type Color = string;

export type ColorScheme = Record<string, Color>;

export interface ThemeSlot {
  color1: string;
  color2: string;
  isGradient: boolean;
  opacity: number;
  colors?: string[];
}

export interface CustomThemeConfig {
  slots: {
    [key: string]: ThemeSlot; // keys: 'group1' ... 'group5'
  };
}

export interface Renderable {
  // Updated draw signature to support hidden state
  draw: (
    ctx: CanvasRenderingContext2D, 
    transform: Matrix, 
    colors: ColorScheme,
    path?: string,
    hiddenSet?: Set<string>,
    isEditMode?: boolean
  ) => void;
  
  getSVG: (transform: Matrix, colors: ColorScheme) => string;
  
  // Hit test returns the ID path of the hit tile, or null
  hitTest: (pt: Point, transform: Matrix, path?: string) => string | null;

  quad: Point[]; // Control points for substitution
}

export interface TileSystem {
  [key: string]: Renderable;
}

export type TileType = 'Spectres' | 'Hexagons' | 'Turtles in Hats' | 'Hats in Turtles' | 'Tile(1,1)';
export type ColorTheme = 
  | 'Pride' 
  | 'Mystics' 
  | 'Figure 5.3' 
  | 'Bright'
  | 'Ocean'
  | 'Forest'
  | 'Sunset'
  | 'Pastel'
  | 'Monochrome'
  | 'Neon'
  | 'Autumn'
  | 'Berry'
  | 'Vintage'
  | 'Cyberpunk'
  | 'Magma'
  | 'Custom';

export type ColoringMode = 'default' | 'random' | 'four-color' | 'orientation' | 'orientation-gradient';
