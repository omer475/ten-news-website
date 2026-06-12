// TodayPlus Feed — 5.9 MAP card, rendered with Mapbox GL (same token/stack as
// the site's existing MapboxMap.js). Dark style keeps the card the deliberate
// dark-surface contrast moment from the spec; pins/arc/labels carry the
// category accent. Non-interactive — it's a figure, not a widget.

import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TP, FONT_MONO, shouldAnimateOnce, hasAnimated } from './tokens';
import { KickerRow, Bullets, CardFooter, Headline, useReducedMotion, useVisibleOnce } from './shared';
import { MiniChart } from './TPCards';
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

function MapboxFigure({ geo, accent, storyId }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const targetRef = useRef(null);
  const flownRef = useRef(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const pins = (geo.pins || []).filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180
    );
    if (!pins.length) return undefined;
    const linked = geo.link === true && pins.length === 2;

    // The cinematic shot: open on the globe floating in space, then dive to
    // the story's location once the card is actually being looked at.
    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      projection: 'globe',
      center: [pins[0].lon, pins[0].lat],
      zoom: 1.05,
      pitch: 0,
      bearing: 0,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    mapRef.current = map;

    // Final camera: single pin → regional close-up with cinematic pitch;
    // two pins → framed bounds (flatter so both stay readable).
    let target;
    if (pins.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      pins.forEach((p) => bounds.extend([p.lon, p.lat]));
      if (linked) arcCoordinates(pins[0], pins[1]).forEach((c) => bounds.extend(c));
      const cam = map.cameraForBounds(bounds, { padding: 70, maxZoom: 5.8 });
      target = { center: cam.center, zoom: cam.zoom, pitch: 28, bearing: -6 };
    } else {
      target = { center: [pins[0].lon, pins[0].lat], zoom: 5.4, pitch: 45, bearing: -10 };
    }
    targetRef.current = target;

    if (reduced || hasAnimated(`mapfly.${storyId}`)) {
      map.jumpTo(target);
      flownRef.current = true;
    }

    map.on('style.load', () => {
      // Space-black atmosphere with stars — the "wow" frame around the globe.
      try {
        map.setFog({
          color: 'rgb(13, 18, 32)',
          'high-color': 'rgb(28, 40, 68)',
          'horizon-blend': 0.028,
          'space-color': 'rgb(4, 6, 13)',
          'star-intensity': 0.5,
        });
      } catch {}

      if (linked) {
        const coords = arcCoordinates(pins[0], pins[1]);
        try {
          map.addSource('tp-arc', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } },
          });
          // soft glow under the dashed line
          map.addLayer({
            id: 'tp-arc-glow',
            type: 'line',
            source: 'tp-arc',
            paint: { 'line-color': accent, 'line-width': 6, 'line-opacity': 0.25, 'line-blur': 6 },
          });
          map.addLayer({
            id: 'tp-arc-line',
            type: 'line',
            source: 'tp-arc',
            paint: { 'line-color': accent, 'line-width': 1.6, 'line-dasharray': [2.5, 2.5] },
          });
        } catch {}
      }
    });

    const markers = pins.map((pin) => {
      const el = document.createElement('div');
      el.className = 'tp-mb-pin';
      el.innerHTML = `
        <span class="tp-mb-glow" style="background:${accent}"></span>
        ${reduced ? '' : `<span class="tp-mb-ring" style="border-color:${accent}"></span>
        <span class="tp-mb-ring tp-mb-ring2" style="border-color:${accent}"></span>`}
        <span class="tp-mb-dot" style="background:${accent}"></span>
        ${pin.label ? `<span class="tp-mb-label">${pin.label}</span>` : ''}
      `;
      return new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([pin.lon, pin.lat])
        .addTo(map);
    });

    let distMarker = null;
    if (linked && geo.distance) {
      const apex = arcCoordinates(pins[0], pins[1])[24];
      const el = document.createElement('div');
      el.className = 'tp-mb-dist';
      el.style.color = '#fff';
      el.style.borderColor = `${accent}`;
      el.textContent = geo.distance;
      distMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(apex)
        .addTo(map);
    }

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      markers.forEach((m) => m.remove());
      if (distMarker) distMarker.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [geo, accent, reduced]);

  // Fly in once, the first time the figure is half on screen. After landing,
  // a barely-perceptible bearing drift keeps the scene alive.
  const visRef = useVisibleOnce(0.45, () => {
    const map = mapRef.current;
    const target = targetRef.current;
    if (!map || !target || flownRef.current || reduced) return;
    flownRef.current = true;
    if (!shouldAnimateOnce(`mapfly.${storyId}`)) {
      map.jumpTo(target);
      return;
    }
    map.flyTo({ ...target, duration: 3200, curve: 1.42, essential: true });
    map.once('moveend', () => {
      try {
        map.easeTo({ bearing: target.bearing + 16, duration: 50000, easing: (t) => t });
      } catch {}
    });
  });

  const pins = geo.pins || [];

  return (
    <div ref={visRef} style={{
      position: 'relative', aspectRatio: '16 / 11', borderRadius: 26,
      overflow: 'hidden', background: 'rgb(4,6,13)',
      boxShadow: 'inset 0 0 0 1px rgba(232,234,242,0.07)',
    }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* cinematic vignette + bottom fade for the coordinate readout */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        boxShadow: 'inset 0 0 90px 18px rgba(2,4,10,0.55)',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 64,
        pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(3,5,11,0.62), rgba(3,5,11,0))',
      }} />

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
          width: 16px;
          height: 16px;
        }
        .tp-mb-glow {
          position: absolute;
          left: 50%; top: 50%;
          width: 30px; height: 30px;
          margin: -15px 0 0 -15px;
          border-radius: 50%;
          opacity: 0.32;
          filter: blur(9px);
        }
        .tp-mb-dot {
          position: absolute;
          left: 50%; top: 50%;
          width: 10px; height: 10px;
          margin: -5px 0 0 -5px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.92);
          box-shadow: 0 1px 8px rgba(0,0,0,0.55);
          box-sizing: border-box;
        }
        .tp-mb-ring {
          position: absolute;
          left: 50%; top: 50%;
          width: 10px; height: 10px;
          margin: -5px 0 0 -5px;
          border-radius: 50%;
          border: 1.4px solid;
          animation: tp-mb-pulse 2.4s cubic-bezier(.2,.6,.36,1) infinite;
        }
        .tp-mb-ring2 {
          animation-delay: 1.2s;
        }
        @keyframes tp-mb-pulse {
          0% { transform: scale(0.5); opacity: 0.95; }
          100% { transform: scale(3.4); opacity: 0; }
        }
        .tp-mb-label {
          position: absolute;
          left: 19px; top: 50%;
          transform: translateY(-50%);
          font-family: ${FONT_MONO};
          font-size: 9.5px;
          font-weight: 500;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #F2F4FA;
          background: rgba(7, 11, 20, 0.66);
          border: 1px solid rgba(232,234,242,0.16);
          border-radius: 99px;
          padding: 4px 9px;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          white-space: nowrap;
        }
        .tp-mb-dist {
          font-family: ${FONT_MONO};
          font-size: 9.5px;
          font-weight: 500;
          letter-spacing: 0.09em;
          background: rgba(7, 11, 20, 0.66);
          border: 1px solid;
          border-radius: 99px;
          padding: 4px 9px;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
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
      <div>
        <KickerRow category={display.category} accent={accent} story={story} prefix="ON THE MAP" countdown={display.countdown} />
        <div style={{ marginTop: 10 }}>
          <Headline raw={display.title} accent={accent} size={22.5} />
        </div>
        {display.geo?.pins?.length ? (
          <div style={{ marginTop: 18 }}>
            <MapboxFigure geo={display.geo} accent={accent} storyId={String(story.id)} />
          </div>
        ) : null}
        <div style={{ marginTop: 16 }}>
          <Bullets bullets={display.bullets} accent={accent} max={2} />
        </div>
      </div>
      <MiniChart display={display} accent={accent} storyId={story.id} />
      <div style={{ marginTop: 14 }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}
