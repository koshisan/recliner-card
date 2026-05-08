import { svg, SVGTemplateResult, nothing } from 'lit';
import type { RecliningChairProps, Zone, Level } from './types.js';

const SLAB_PALETTE = {
  dark: {
    cushion: '#5d6069',
    cushionHi: '#787c87',
    base: '#4a4d55',
    baseLo: '#3a3d44',
    seam: 'rgba(0,0,0,0.45)',
    button: '#9ba1ac',
  },
  light: {
    cushion: '#b29a7a',
    cushionHi: '#c8b294',
    base: '#7a6448',
    baseLo: '#5c4a32',
    seam: 'rgba(0,0,0,0.30)',
    button: '#5a4b38',
  },
};

const ZONE_RGB = { dark: '122, 195, 255', light: '40, 110, 200' };

let __uidSeq = 0;
const nextUid = () => `c${(++__uidSeq).toString(36)}`;

const zoneFill = (rgb: string, lvl: Level): string => {
  if (!lvl) return 'transparent';
  const o = lvl === 1 ? 0.32 : lvl === 2 ? 0.55 : 0.82;
  return `rgba(${rgb}, ${o})`;
};

interface SlabArgs {
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
  hiAxis?: 'h' | 'v';
  cushion: string;
  cushionHi: string;
  seam: string;
}

function slab({ x, y, w, h, rx = 8, hiAxis = 'h', cushion, cushionHi, seam }: SlabArgs): SVGTemplateResult {
  const hiW = hiAxis === 'h' ? w - 4 : Math.min(w * 0.32, 8);
  const hiH = hiAxis === 'h' ? Math.min(h * 0.32, 8) : h - 4;
  const hiRx = Math.max(rx - 2, 4);
  return svg`
    <g>
      <rect x=${x} y=${y} width=${w} height=${h} rx=${rx} fill=${cushion}/>
      <rect x=${x + 2} y=${y + 2} width=${hiW} height=${hiH} rx=${hiRx}
            fill=${cushionHi} opacity="0.45"/>
      <rect x=${x} y=${y} width=${w} height=${h} rx=${rx} fill="none"
            stroke=${seam} stroke-width="0.9"/>
    </g>
  `;
}

interface HotspotArgs {
  zone: Zone;
  cx: number;
  cy: number;
  r?: number;
  level: Level;
  isActive: boolean;
  interactive: boolean;
  showHotspots: boolean;
  zoneRgb: string;
  onZoneClick: ((z: Zone) => void) | null;
}

function hotspot(args: HotspotArgs): SVGTemplateResult {
  const { zone, cx, cy, level, isActive, interactive, showHotspots, zoneRgb, onZoneClick } = args;
  const r = args.r ?? 12;
  const click = (e: Event) => {
    e.stopPropagation();
    if (interactive && onZoneClick) onZoneClick(zone);
  };
  const cursor = interactive ? 'pointer' : 'default';
  const pe = interactive ? 'auto' : 'none';
  const dur = `${1.8 - level * 0.35}s`;

  return svg`
    <g style="cursor: ${cursor}; pointer-events: ${pe};" @click=${click}>
      <circle cx=${cx} cy=${cy} r=${r + 5} fill="transparent"/>
      ${(showHotspots || interactive) && !level ? svg`
        <circle cx=${cx} cy=${cy} r=${r} fill="none"
          stroke="rgba(${zoneRgb}, ${isActive ? 0.95 : 0.5})"
          stroke-width=${isActive ? 2 : 1.3}
          stroke-dasharray=${isActive ? 'none' : '2.5 3'}/>
      ` : nothing}
      ${level > 0 ? svg`
        <circle cx=${cx} cy=${cy} r=${r} fill=${zoneFill(zoneRgb, level)}>
          <animate attributeName="r" values="${r - 1};${r + 2};${r - 1}" dur=${dur} repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.65;1;0.65" dur=${dur} repeatCount="indefinite"/>
        </circle>
        <g>
          ${[0, 1, 2].map((i) => svg`
            <circle cx=${cx - 5 + i * 5} cy=${cy + r + 7} r="1.6"
              fill="rgba(${zoneRgb}, ${i < level ? 1 : 0.25})"/>
          `)}
        </g>
      ` : nothing}
    </g>
  `;
}

export function renderChair(props: RecliningChairProps): SVGTemplateResult {
  const { recline, footrest, lift, heat, zones, theme, size, interactive, showHotspots, activeZone, onZoneClick } = props;
  const p = SLAB_PALETTE[theme];
  const zoneRgb = ZONE_RGB[theme];
  const heatId = `heat-${nextUid()}`;

  const reclineDeg = -(5 + recline * 72);
  const footDeg = (1 - Math.min(1, footrest / 0.8)) * 90;
  const recliningTiltDeg = -Math.max(0, (footrest - 0.8) / 0.2) * 7.5;
  const liftDeg = lift * 28;

  const hotArgs = (zone: Zone, cx: number, cy: number) => ({
    zone, cx, cy, r: 11,
    level: zones[zone] ?? 0,
    isActive: activeZone === zone,
    interactive, showHotspots, zoneRgb, onZoneClick,
  });

  const transition = 'transform 0.55s cubic-bezier(.4,.05,.2,1)';
  const slabTransition = 'transform 0.6s cubic-bezier(.4,.05,.2,1)';

  return svg`
    <svg viewBox="-70 0 430 240" width=${size} height=${size * 240 / 430}
         style="display:block; overflow:visible;"
         role="img" aria-label="Recliner chair">
      <defs>
        <radialGradient id=${heatId} cx="50%" cy="50%">
          <stop offset="0%" stop-color="#ff6a3a" stop-opacity="0.65"/>
          <stop offset="55%" stop-color="#ff6a3a" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#ff6a3a" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <ellipse cx="144" cy="222" rx=${90 - lift * 8} ry="5"
        fill="rgba(0,0,0,0.32)" opacity=${theme === 'dark' ? 0.55 : 0.16}
        style="transition: all 0.5s;"/>

      <g transform="rotate(${recliningTiltDeg} 80 212)" style="transition: ${transition};">
      <g transform="rotate(${liftDeg} 212 212)" style="transition: ${transition};">

        <g transform="rotate(${footDeg} 212 128)" style="transition: ${slabTransition};">
          ${slab({ x: 212, y: 128, w: 72, h: 30, rx: 8, hiAxis: 'h', cushion: p.cushion, cushionHi: p.cushionHi, seam: p.seam })}
          <line x1="220" y1="143" x2="276" y2="143" stroke=${p.seam} stroke-width="0.5" opacity="0.4"/>
          ${hotspot(hotArgs('leg', 248, 143))}
        </g>

        <g transform="rotate(${reclineDeg} 72 158)" style="transition: ${slabTransition};">
          ${slab({ x: 72, y: 32, w: 30, h: 126, rx: 9, hiAxis: 'v', cushion: p.cushion, cushionHi: p.cushionHi, seam: p.seam })}
          <line x1="87" y1="44" x2="87" y2="152" stroke=${p.seam} stroke-width="0.6" opacity="0.55"/>
          <line x1="76" y1="95" x2="98" y2="95" stroke=${p.seam} stroke-width="0.5" opacity="0.4"/>
          ${heat ? svg`
            <ellipse cx="87" cy="95" rx="14" ry="55" fill="url(#${heatId})" style="pointer-events:none;">
              <animate attributeName="opacity" values="0.55;0.95;0.55" dur="2.2s" repeatCount="indefinite"/>
            </ellipse>
          ` : nothing}
          ${hotspot(hotArgs('back', 87, 65))}
          ${hotspot(hotArgs('lumbar', 87, 125))}
        </g>

        <rect x="80" y="158" width="124" height="54" rx="7" fill=${p.base}/>
        <rect x="82" y="160" width="120" height="6" rx="3" fill=${p.cushionHi} opacity="0.18"/>
        <rect x="80" y="158" width="124" height="54" rx="7" fill="none" stroke=${p.seam} stroke-width="0.9"/>
        <circle cx="178" cy="188" r="5" fill=${p.baseLo}/>
        <circle cx="178" cy="188" r="3" fill=${p.button} opacity="0.55"/>

        ${slab({ x: 72, y: 128, w: 140, h: 30, rx: 9, hiAxis: 'h', cushion: p.cushion, cushionHi: p.cushionHi, seam: p.seam })}
        <line x1="84" y1="143" x2="200" y2="143" stroke=${p.seam} stroke-width="0.5" opacity="0.4"/>
        ${heat ? svg`
          <ellipse cx="142" cy="143" rx="58" ry="11" fill="url(#${heatId})" style="pointer-events:none;">
            <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2.2s" repeatCount="indefinite"/>
          </ellipse>
        ` : nothing}
        ${hotspot(hotArgs('thigh', 142, 143))}

      </g>
      </g>
    </svg>
  `;
}
