// TodayPlus Feed — 5.9 MAP card, rendered with Mapbox GL (same token/stack as
// the site's existing MapboxMap.js). Dark style keeps the card the deliberate
// dark-surface contrast moment from the spec; pins/arc/labels carry the
// category accent. Non-interactive — it's a figure, not a widget.

import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TP, FONT_MONO } from './tokens';
import { KickerRow, Bullets, CardFooter, Headline, useReducedMotion } from './shared';
import { MAPBOX_TOKEN } from '../MapboxMap';

mapboxgl.accessToken = MAPBOX_TOKEN;

function coordString(pin) {
  const latDir = pin.lat >= 0 ? 'N' : 'S';
  const lonDir = pin.lon >= 0 ? 'E' : 'W';
  return `${Math.abs(pin.lat).toFixed(2)}°${latDir} · ${Math.abs(pin.lon).toFixed(2)}°${lonDir}`;
}

// Quadratic-bezier arc between two pins, apex lifted 22% of the pin distance
// (perpendicular offset in lon/lat space — fine at card scale).
function arcCoordinates(a, b) {
  const ax = a.lon, ay = a.lat, bx = b.lon, by = b.lat;
  const dx = bx - ax, dy = by - ay;
  const dist = Math.hypot(dx, dy) || 1;
  // control point = midpoint pushed perpendicular by 0.44·dist → apex at 0.22
  const cx = (ax + bx) / 2 - (dy / dist) * dist * 0.44;
  const cy = (ay + by) / 2 + (dx / dist) * dist * 0.44;
  const pts = [];
  for (let i = 0; i <= 48; i += 1) {
    const t = i / 48;
    const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
    const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by;
    pts.push([x, y]);
  }
  return pts;
}

function MapboxFigure({ geo, accent }) {
  const containerRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const pins = (geo.pins || []).filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180
    );
    if (!pins.length) return undefined;
    const linked = geo.link === true && pins.length === 2;

    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [pins[0].lon, pins[0].lat],
      zoom: 4,
      interactive: false,
      attributionControl: false,
    });

    // Frame the pins: bbox padded wide (the spec's ×2.4 auto-zoom intent —
    // regional context, not street level).
    if (pins.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      pins.forEach((p) => bounds.extend([p.lon, p.lat]));
      if (linked) {
        arcCoordinates(pins[0], pins[1]).forEach((c) => bounds.extend(c));
      }
      map.fitBounds(bounds, { padding: 56, maxZoom: 6, duration: 0 });
    }

    const markers = pins.map((pin) => {
      const el = document.createElement('div');
      el.className = 'tp-mb-pin';
      el.innerHTML = `
        ${reduced ? '' : `<span class="tp-mb-ring" style="border-color:${accent}"></span>`}
        <span class="tp-mb-dot" style="background:${accent}"></span>
        ${pin.label ? `<span class="tp-mb-label">${pin.label}</span>` : ''}
      `;
      return new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([pin.lon, pin.lat])
        .addTo(map);
    });

    let distMarker = null;
    map.on('load', () => {
      // Quiet the basemap labels a touch so the accent pins lead.
      try {
        map.getStyle().layers.forEach((layer) => {
          if (layer.type === 'symbol' && map.getLayer(layer.id)) {
            map.setPaintProperty(layer.id, 'text-opacity', 0.75);
          }
        });
      } catch {}

      if (linked) {
        const coords = arcCoordinates(pins[0], pins[1]);
        try {
          map.addSource('tp-arc', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } },
          });
          map.addLayer({
            id: 'tp-arc-line',
            type: 'line',
            source: 'tp-arc',
            paint: {
              'line-color': accent,
              'line-width': 1.5,
              'line-dasharray': [2.5, 2.5],
            },
          });
        } catch {}

        if (geo.distance) {
          const apex = coords[Math.floor(coords.length / 2)];
          const el = document.createElement('div');
          el.className = 'tp-mb-dist';
          el.style.color = accent;
          el.textContent = geo.distance;
          distMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat(apex)
            .addTo(map);
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      markers.forEach((m) => m.remove());
      if (distMarker) distMarker.remove();
      map.remove();
    };
  }, [geo, accent, reduced]);

  const pins = geo.pins || [];

  return (
    <div style={{
      position: 'relative', aspectRatio: '16 / 11', borderRadius: 22,
      overflow: 'hidden', background: TP.mapBg,
    }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {pins[0] ? (
        <span style={{
          position: 'absolute', left: 12, bottom: 12, pointerEvents: 'none',
          fontFamily: FONT_MONO, fontSize: 9, color: 'rgba(232,234,242,0.55)',
        }}>{coordString(pins[0])}</span>
      ) : null}

      {geo.region ? (
        <span style={{
          position: 'absolute', top: 12, right: 12, pointerEvents: 'none',
          fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(232,234,242,0.75)',
          background: 'rgba(14,19,32,0.6)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(232,234,242,0.14)', borderRadius: 99,
          padding: '6px 10px',
        }}>{geo.region}</span>
      ) : null}

      <style jsx global>{`
        .tp-mb-pin {
          position: relative;
          width: 14px;
          height: 14px;
        }
        .tp-mb-dot {
          position: absolute;
          left: 50%; top: 50%;
          width: 9px; height: 9px;
          margin: -4.5px 0 0 -4.5px;
          border-radius: 50%;
          box-shadow: 0 0 0 2px rgba(14, 19, 32, 0.55);
        }
        .tp-mb-ring {
          position: absolute;
          left: 50%; top: 50%;
          width: 9px; height: 9px;
          margin: -4.5px 0 0 -4.5px;
          border-radius: 50%;
          border: 1.2px solid;
          animation: tp-mb-pulse 2.2s ease-out infinite;
        }
        @keyframes tp-mb-pulse {
          0% { transform: scale(0.4); opacity: 0.9; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        .tp-mb-label {
          position: absolute;
          left: 16px; top: 50%;
          transform: translateY(-50%);
          font-family: ${FONT_MONO};
          font-size: 9px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #E8EAF2;
          text-shadow: 0 1px 4px rgba(0,0,0,0.8);
          white-space: nowrap;
        }
        .tp-mb-dist {
          font-family: ${FONT_MONO};
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-shadow: 0 1px 4px rgba(0,0,0,0.8);
          white-space: nowrap;
        }
        @media (prefers-reduced-motion: reduce) {
          .tp-mb-ring { animation: none !important; opacity: 0; }
        }
        /* same chrome-hiding the site's existing MapboxMap.js applies */
        .mapboxgl-ctrl-logo,
        .mapboxgl-ctrl-attrib,
        .mapboxgl-ctrl-bottom-left,
        .mapboxgl-ctrl-bottom-right {
          display: none !important;
        }
      `}</style>
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
        {display.geo?.pins?.length ? (
          <div style={{ marginTop: 18 }}>
            <MapboxFigure geo={display.geo} accent={accent} />
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
