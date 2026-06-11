// TodayPlus Feed — 5.9 MAP card. Stylized inline vector world map in a
// 720×360 equirectangular space (x=(lon+180)/360·720, y=(90−lat)/180·360).
// Pure SVG: no map service, no API keys, works offline (§10.5).

import React from 'react';
import { TP, FONT_MONO } from './tokens';
import { KickerRow, Bullets, CardFooter, Headline } from './shared';

// Low-poly continent outlines (lon, lat)
const LANDS = [
  // North + Central America
  [[-168, 66], [-156, 71], [-140, 70], [-125, 72], [-110, 73], [-95, 72], [-82, 70],
   [-75, 62], [-80, 55], [-65, 60], [-55, 52], [-60, 46], [-70, 44], [-75, 38],
   [-80, 32], [-81, 25], [-90, 29], [-95, 22], [-90, 15], [-83, 9], [-79, 8.5],
   [-84, 13], [-92, 16], [-97, 20], [-105, 20], [-110, 23], [-115, 30], [-122, 34],
   [-124, 40], [-124, 48], [-132, 55], [-140, 60], [-152, 60], [-165, 55]],
  // South America
  [[-79, 9], [-71, 12], [-60, 8], [-52, 5], [-44, -2], [-35, -7], [-39, -13],
   [-41, -22], [-48, -28], [-53, -34], [-58, -39], [-65, -41], [-66, -48], [-69, -52],
   [-74, -50], [-72, -44], [-71, -32], [-70, -18], [-77, -12], [-81, -5], [-79, 2]],
  // Greenland
  [[-46, 60], [-38, 66], [-22, 70], [-18, 75], [-25, 78], [-38, 80], [-55, 82],
   [-68, 80], [-73, 78], [-60, 75], [-55, 69], [-52, 64]],
  // Eurasia
  [[-10, 36], [-9, 43], [-1, 46], [0, 51], [8, 54], [8, 57], [5, 62], [12, 65],
   [18, 69], [26, 71], [40, 68], [50, 69], [60, 69], [70, 73], [80, 73], [90, 75],
   [100, 77], [110, 74], [120, 73], [140, 72], [160, 70], [170, 66], [179, 65],
   [178, 62], [163, 60], [155, 53], [142, 47], [135, 43], [129, 35], [122, 30],
   [121, 23], [108, 12], [104, 2], [98, 8], [91, 22], [80, 8], [77, 8], [72, 20],
   [66, 25], [57, 25], [52, 16], [44, 12], [43, 16], [35, 28], [33, 31], [36, 36],
   [27, 37], [26, 40], [22, 37], [15, 38], [18, 40], [13, 44], [9, 44], [3, 43],
   [3, 40], [-1, 37], [-6, 36]],
  // Africa
  [[-6, 35], [11, 37], [20, 32], [32, 31], [34, 28], [38, 18], [43, 12], [51, 12],
   [46, 2], [41, -2], [40, -10], [35, -20], [33, -29], [27, -34], [20, -35],
   [17, -29], [12, -18], [9, -7], [9, 4], [-5, 5], [-13, 9], [-17, 15], [-16, 20],
   [-13, 28]],
  // Australia
  [[114, -22], [122, -18], [130, -12], [136, -12], [142, -11], [146, -19],
   [150, -23], [153, -28], [151, -34], [146, -39], [139, -37], [135, -35],
   [129, -32], [122, -34], [115, -34], [113, -26]],
  // British Isles
  [[-5, 50], [-3, 53], [-5, 56], [-3, 58], [-6, 58], [-8, 54], [-10, 52]],
  // Japan
  [[130, 31], [135, 34.5], [140, 36], [141, 40], [144, 44], [141, 42], [137, 36], [132, 33]],
];

const project = (lon, lat) => [((lon + 180) / 360) * 720, ((90 - lat) / 180) * 360];

// Auto-zoom (§5.9): bbox of pins padded ×2.4, min width 200, clamped, 16:11.
function viewBoxFor(pins) {
  const pts = pins.map((p) => project(p.lon, p.lat));
  if (!pts.length) return [0, 0, 720, 495];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let w = Math.max((Math.max(...xs) - Math.min(...xs)) * 2.4, 200);
  let h = (w * 11) / 16;
  const neededH = Math.max((Math.max(...ys) - Math.min(...ys)) * 2.4, h);
  if (neededH > h) { h = neededH; w = (h * 16) / 11; }
  w = Math.min(w, 720); h = Math.min(h, 495);
  let x = cx - w / 2;
  let y = cy - h / 2;
  x = Math.max(0, Math.min(x, 720 - w));
  y = Math.max(0, Math.min(y, Math.max(0, 360 - h)));
  return [x, y, w, h];
}

function coordString(pin) {
  const latDir = pin.lat >= 0 ? 'N' : 'S';
  const lonDir = pin.lon >= 0 ? 'E' : 'W';
  return `${Math.abs(pin.lat).toFixed(2)}°${latDir} · ${Math.abs(pin.lon).toFixed(2)}°${lonDir}`;
}

function MapFigure({ geo, accent }) {
  const pins = geo.pins || [];
  const [vx, vy, vw, vh] = viewBoxFor(pins);
  const scaleUnit = vw / 360; // font/pin sizing relative to zoom
  const linked = geo.link === true && pins.length === 2;

  // Graticule every 20 units
  const grid = [];
  for (let gx = Math.floor(vx / 20) * 20; gx <= vx + vw; gx += 20) {
    grid.push(<line key={`gx${gx}`} x1={gx} y1={vy} x2={gx} y2={vy + vh} stroke={TP.mapGrid} strokeWidth={0.6 * scaleUnit} />);
  }
  for (let gy = Math.floor(vy / 20) * 20; gy <= vy + vh; gy += 20) {
    grid.push(<line key={`gy${gy}`} x1={vx} y1={gy} x2={vx + vw} y2={gy} stroke={TP.mapGrid} strokeWidth={0.6 * scaleUnit} />);
  }

  let arc = null;
  let distLabel = null;
  if (linked) {
    const [ax, ay] = project(pins[0].lon, pins[0].lat);
    const [bx, by] = project(pins[1].lon, pins[1].lat);
    const dist = Math.hypot(bx - ax, by - ay);
    // Quadratic control lifted 2× the apex lift so the APEX rises 22% of dist.
    const cxp = (ax + bx) / 2;
    const cyp = (ay + by) / 2 - dist * 0.44;
    arc = (
      <path
        d={`M ${ax} ${ay} Q ${cxp} ${cyp} ${bx} ${by}`}
        fill="none" stroke={accent} strokeWidth={1.2 * scaleUnit}
        strokeDasharray={`${4 * scaleUnit} ${4 * scaleUnit}`}
      />
    );
    if (geo.distance) {
      distLabel = (
        <text
          x={cxp} y={(ay + by) / 2 - dist * 0.22 - 8 * scaleUnit}
          textAnchor="middle" fill={accent}
          fontFamily={FONT_MONO} fontSize={9 * scaleUnit} fontWeight="500"
        >{geo.distance}</text>
      );
    }
  }

  return (
    <div style={{
      position: 'relative', aspectRatio: '16 / 11', borderRadius: 22,
      overflow: 'hidden', background: TP.mapBg,
    }}>
      <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden>
        {grid}
        {LANDS.map((land, i) => (
          <polygon
            key={i}
            points={land.map(([lon, lat]) => project(lon, lat).join(',')).join(' ')}
            fill={TP.mapLand} stroke={TP.mapLandStroke} strokeWidth={0.8 * scaleUnit}
          />
        ))}
        {arc}
        {distLabel}
        {pins.map((pin, i) => {
          const [px, py] = project(pin.lon, pin.lat);
          return (
            <g key={i}>
              <circle className="tp-map-pulse" cx={px} cy={py} r={3.4 * scaleUnit} fill="none" stroke={accent} strokeWidth={1.2 * scaleUnit} />
              <circle cx={px} cy={py} r={3.4 * scaleUnit} fill={accent} />
              {pin.label ? (
                <text
                  x={px + 6 * scaleUnit} y={py + 3 * scaleUnit}
                  fill={TP.mapText} fontFamily={FONT_MONO}
                  fontSize={9 * scaleUnit} style={{ textTransform: 'uppercase' }}
                >{pin.label}</text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {pins[0] ? (
        <span style={{
          position: 'absolute', left: 12, bottom: 12,
          fontFamily: FONT_MONO, fontSize: 9, color: 'rgba(232,234,242,0.55)',
        }}>{coordString(pins[0])}</span>
      ) : null}

      {geo.region ? (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(232,234,242,0.75)',
          background: 'rgba(14,19,32,0.6)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(232,234,242,0.14)', borderRadius: 99,
          padding: '6px 10px',
        }}>{geo.region}</span>
      ) : null}
    </div>
  );
}

export function MapCard({ story, display, accent, onOpen }) {
  return (
    <article>
      <div onClick={() => onOpen?.(story)} style={{ cursor: 'pointer' }}>
        <KickerRow category={display.category} accent={accent} story={story} prefix="ON THE MAP" />
        <div style={{ marginTop: 10 }}>
          <Headline raw={display.title} accent={accent} size={24} />
        </div>
        {display.geo ? (
          <div style={{ marginTop: 18 }}>
            <MapFigure geo={display.geo} accent={accent} />
          </div>
        ) : null}
        <div style={{ marginTop: 16 }}>
          <Bullets bullets={display.bullets} accent={accent} max={2} />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}
