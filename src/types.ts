import type { HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';

export type Zone = 'back' | 'lumbar' | 'thigh' | 'leg';
export type Level = 0 | 1 | 2 | 3;
export type Theme = 'dark' | 'light';
export type MotorKey = 'recline' | 'footrest' | 'lift';

export interface RecliningCardConfig extends LovelaceCardConfig {
  type: string;
  name?: string;
  subtitle?: string;
  recline_entity?: string;
  footrest_entity?: string;
  lift_entity?: string;
  heat_entity?: string;
  massage_zones?: Partial<Record<Zone, string>>;
  theme?: Theme;
}

export interface RecliningChairProps {
  recline: number;
  footrest: number;
  lift: number;
  heat: boolean;
  zones: Record<Zone, Level>;
  theme: Theme;
  size: number;
  interactive: boolean;
  showHotspots: boolean;
  activeZone: Zone | null;
  onZoneClick: ((z: Zone) => void) | null;
}

export interface RecliningState {
  recline: number;
  footrest: number;
  lift: number;
  heat: boolean;
  zones: Record<Zone, Level>;
  moving: MotorKey | null;
}

export const ZONE_LABEL: Record<Zone, string> = {
  back: 'Back',
  lumbar: 'Lumbar',
  thigh: 'Thigh',
  leg: 'Leg',
};

export const ZONES: Zone[] = ['back', 'lumbar', 'thigh', 'leg'];

export interface ThemeTokens {
  bg: string;
  card: string;
  cardElev: string;
  text: string;
  textDim: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  heat: string;
  heatSoft: string;
  track: string;
  pill: string;
  pillActive: string;
}

export const HA_TOKENS: Record<Theme, ThemeTokens> = {
  dark: {
    bg: '#1c1f24',
    card: '#262a31',
    cardElev: '#2f343c',
    text: '#e7e9ee',
    textDim: '#9ba1ac',
    border: 'rgba(255,255,255,0.06)',
    borderStrong: 'rgba(255,255,255,0.12)',
    accent: '#7ac3ff',
    accentSoft: 'rgba(122,195,255,0.16)',
    heat: '#ff7a4a',
    heatSoft: 'rgba(255,122,74,0.18)',
    track: 'rgba(255,255,255,0.07)',
    pill: 'rgba(255,255,255,0.05)',
    pillActive: 'rgba(122,195,255,0.22)',
  },
  light: {
    bg: '#f3f1ec',
    card: '#ffffff',
    cardElev: '#fbfaf6',
    text: '#1f2127',
    textDim: '#6b6f78',
    border: 'rgba(0,0,0,0.06)',
    borderStrong: 'rgba(0,0,0,0.12)',
    accent: '#286ec8',
    accentSoft: 'rgba(40,110,200,0.10)',
    heat: '#d54a1a',
    heatSoft: 'rgba(213,74,26,0.10)',
    track: 'rgba(0,0,0,0.06)',
    pill: 'rgba(0,0,0,0.04)',
    pillActive: 'rgba(40,110,200,0.14)',
  },
};

export type { HomeAssistant };
