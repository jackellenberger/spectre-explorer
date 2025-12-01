import { ColorScheme, CustomThemeConfig } from './types';

export const TILE_NAMES = [ 
	'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi',
	'Pi', 'Sigma', 'Phi', 'Psi' 
];

// Mapping tile labels to the 5 custom slots
export const TILE_GROUP_MAP: Record<string, string> = {
  'Gamma': 'group1', 'Gamma1': 'group1', 'Gamma2': 'group1',
  'Delta': 'group2', 'Theta': 'group2',
  'Lambda': 'group3', 'Xi': 'group3',
  'Pi': 'group4', 'Sigma': 'group4',
  'Phi': 'group5', 'Psi': 'group5'
};

export const DEFAULT_CUSTOM_CONFIG: CustomThemeConfig = {
  slots: {
    'group1': { color1: '#cccccc', color2: '#ffffff', isGradient: false, opacity: 1.0 },
  }
};

export const MAGMA_CONFIG: CustomThemeConfig = {
  slots: {
    'group1': { color1: '#3c0000', color2: '#8b0000', isGradient: true, opacity: 1.0 }, // Gamma - Dark Red/Maroon
    'group2': { color1: '#d00000', color2: '#ff4d00', isGradient: true, opacity: 1.0 }, // Delta/Theta - Bright Red/Orange
    'group3': { color1: '#ff8c00', color2: '#ffcc00', isGradient: true, opacity: 1.0 }, // Lambda/Xi - Orange/Yellow
    'group4': { color1: '#1a0500', color2: '#4a0e00', isGradient: true, opacity: 1.0 }, // Pi/Sigma - Almost Black/Dark Brown
    'group5': { color1: '#ffd700', color2: '#ffeb3b', isGradient: false, opacity: 1.0 }, // Phi/Psi - Solid Gold/Yellow
  }
};

export const COL_MAP_53: ColorScheme = {
	'Gamma' : 'rgb(203, 157, 126)',
	'Gamma1' : 'rgb(203, 157, 126)',
	'Gamma2' : 'rgb(203, 157, 126)',
	'Delta' : 'rgb(163, 150, 133)',
	'Theta' : 'rgb(208, 215, 150)',
	'Lambda' : 'rgb(184, 205, 178)',
	'Xi' : 'rgb(211, 177, 144)',
	'Pi' : 'rgb(218, 197, 161)',
	'Sigma' : 'rgb(191, 146, 126)',
	'Phi' : 'rgb(228, 213, 167)',
	'Psi' : 'rgb(224, 223, 156)' 
};

export const COL_MAP_ORIG: ColorScheme = {
	'Gamma' : 'rgb(255, 255, 255)',
	'Gamma1' : 'rgb(255, 255, 255)',
	'Gamma2' : 'rgb(255, 255, 255)',
	'Delta' : 'rgb(220, 220, 220)',
	'Theta' : 'rgb(255, 191, 191)',
	'Lambda' : 'rgb(255, 160, 122)',
	'Xi' : 'rgb(255, 242, 0)',
	'Pi' : 'rgb(135, 206, 250)',
	'Sigma' : 'rgb(245, 245, 220)',
	'Phi' : 'rgb(0, 255, 0)',
	'Psi' : 'rgb(0, 255, 255)' 
};

export const COL_MAP_MYSTICS: ColorScheme = {
	'Gamma' : 'rgb(196, 201, 169)',
	'Gamma1' : 'rgb(196, 201, 169)',
	'Gamma2' : 'rgb(156, 160, 116)',
	'Delta' : 'rgb(247, 252, 248)',
	'Theta' : 'rgb(247, 252, 248)',
	'Lambda' : 'rgb(247, 252, 248)',
	'Xi' : 'rgb(247, 252, 248)',
	'Pi' : 'rgb(247, 252, 248)',
	'Sigma' : 'rgb(247, 252, 248)',
	'Phi' : 'rgb(247, 252, 248)',
	'Psi' : 'rgb(247, 252, 248)' 
};

export const COL_MAP_PRIDE: ColorScheme = {
	'Gamma' : 'rgb(255, 255, 255)',
	'Gamma1' : 'rgb(97, 57, 21)', 
	'Gamma2' : 'rgb(0, 0, 0)',
	'Delta' : 'rgb(2, 129, 33)',
	'Theta' : 'rgb(0, 76, 255)',
	'Lambda' : 'rgb(118, 0, 136)',
	'Xi' : 'rgb(229, 0, 0)',
	'Pi' : 'rgb(255, 175, 199)',
	'Sigma' : 'rgb(115, 215, 238)',
	'Phi' : 'rgb(255, 141, 0)',
	'Psi' : 'rgb(255, 238, 0)' 
};

export const COL_MAP_OCEAN: ColorScheme = {
  'Gamma' : '#CAF0F8',
  'Gamma1' : '#CAF0F8',
  'Gamma2' : '#90E0EF',
  'Delta' : '#00B4D8',
  'Theta' : '#0077B6',
  'Lambda' : '#03045E',
  'Xi' : '#ADE8F4',
  'Pi' : '#48CAE4',
  'Sigma' : '#0096C7',
  'Phi' : '#023E8A',
  'Psi' : '#00B4D8' 
};

export const COL_MAP_FOREST: ColorScheme = {
  'Gamma' : '#DAEDE2',
  'Gamma1' : '#DAEDE2',
  'Gamma2' : '#B8D8BE',
  'Delta' : '#93C1A4',
  'Theta' : '#5C816C',
  'Lambda' : '#2C4233',
  'Xi' : '#9CAF88',
  'Pi' : '#748F56',
  'Sigma' : '#43633A',
  'Phi' : '#314A2B',
  'Psi' : '#D6E6C9' 
};

export const COL_MAP_SUNSET: ColorScheme = {
  'Gamma' : '#FFD670',
  'Gamma1' : '#FFD670',
  'Gamma2' : '#FF9770',
  'Delta' : '#FF70A6',
  'Theta' : '#FF9770',
  'Lambda' : '#70D6FF',
  'Xi' : '#E9FF70',
  'Pi' : '#FFB870',
  'Sigma' : '#FF7E70',
  'Phi' : '#C86496',
  'Psi' : '#FFC896' 
};

export const COL_MAP_PASTEL: ColorScheme = {
  'Gamma' : '#FFDFD3',
  'Gamma1' : '#FFDFD3',
  'Gamma2' : '#FFD1DC',
  'Delta' : '#E0BBE4',
  'Theta' : '#957DAD',
  'Lambda' : '#FFFAC8',
  'Xi' : '#D1EFD0',
  'Pi' : '#C8E6FF',
  'Sigma' : '#FFF0F5',
  'Phi' : '#F0FFF0',
  'Psi' : '#E6E6FA' 
};

export const COL_MAP_MONOCHROME: ColorScheme = {
  'Gamma' : '#F8F9FA',
  'Gamma1' : '#F8F9FA',
  'Gamma2' : '#E9ECEF',
  'Delta' : '#DEE2E6',
  'Theta' : '#CED4DA',
  'Lambda' : '#ADB5BD',
  'Xi' : '#6C757D',
  'Pi' : '#495057',
  'Sigma' : '#343A40',
  'Phi' : '#212529',
  'Psi' : '#969696' 
};

export const COL_MAP_NEON: ColorScheme = {
  'Gamma' : '#141414',
  'Gamma1' : '#141414',
  'Gamma2' : '#323232',
  'Delta' : '#FF0080', 
  'Theta' : '#00FFFF', 
  'Lambda' : '#80FF00', 
  'Xi' : '#FFFF00', 
  'Pi' : '#9D00FF', 
  'Sigma' : '#0080FF', 
  'Phi' : '#FF8000', 
  'Psi' : '#FF0000' 
};

export const COL_MAP_AUTUMN: ColorScheme = {
  'Gamma' : '#E6C229',
  'Gamma1' : '#E6C229',
  'Gamma2' : '#F17105',
  'Delta' : '#D65108',
  'Theta' : '#A6200A',
  'Lambda' : '#590D08',
  'Xi' : '#EBA83A',
  'Pi' : '#D2691E',
  'Sigma' : '#8B4513',
  'Phi' : '#A0522D',
  'Psi' : '#DAA520' 
};

export const COL_MAP_BERRY: ColorScheme = {
  'Gamma' : '#E0B1CB',
  'Gamma1' : '#E0B1CB',
  'Gamma2' : '#BE95C4',
  'Delta' : '#9F86C0',
  'Theta' : '#5E548E',
  'Lambda' : '#231942',
  'Xi' : '#C86482',
  'Pi' : '#A05064',
  'Sigma' : '#783250',
  'Phi' : '#642846',
  'Psi' : '#B47896' 
};

export const COL_MAP_VINTAGE: ColorScheme = {
  'Gamma' : '#F4F1DE',
  'Gamma1' : '#F4F1DE',
  'Gamma2' : '#E07A5F',
  'Delta' : '#3D405B',
  'Theta' : '#81B29A',
  'Lambda' : '#F2CC8F',
  'Xi' : '#D2B48C',
  'Pi' : '#BC8F8F',
  'Sigma' : '#A52A2A',
  'Phi' : '#556B2F',
  'Psi' : '#778899' 
};

export const COL_MAP_CYBERPUNK: ColorScheme = {
  'Gamma' : '#0A141E',
  'Gamma1' : '#0A141E',
  'Gamma2' : '#FCEE0A', 
  'Delta' : '#0AFFC8', 
  'Theta' : '#FF13F0', 
  'Lambda' : '#6E32C8', 
  'Xi' : '#32C832', 
  'Pi' : '#143250', 
  'Sigma' : '#FF4500', 
  'Phi' : '#00BFFF', 
  'Psi' : '#FFFFFF' 
};