// TodayPlus Feed — MAP card on Mapbox GL, four variants on the same cinematic
// base (globe → flyTo → drift): site (1–2 pins, optional linked arc), route
// (directional FROM→TO with a traveling dot + arrowhead), area (impact zone
// circle sized from radius_km), multi (3–5 staggered-pulse pins). Old rows
// without geo.kind render as site. Reduce Motion: instant camera, no pulses,
// no traveling dot (static arrow arc), static circles.

import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TP, FONT_MONO, FONT_BODY, shouldAnimateOnce, hasAnimated } from './tokens';
import { KickerRow, CardFooter, Headline, useReducedMotion, useVisibleOnce } from './shared';
import { MAPBOX_TOKEN } from '../MapboxMap';

mapboxgl.accessToken = MAPBOX_TOKEN;

function coordString(pin) {
  const latDir = pin.lat >= 0 ? 'N' : 'S';
  const lonDir = pin.lon >= 0 ? 'E' : 'W';
  return `${Math.abs(pin.lat).toFixed(2)}°${latDir} · ${Math.abs(pin.lon).toFixed(2)}°${lonDir}`;
}

// Quadratic-bezier arc between two pins, apex lifted 22% of the pin distance.
function arcCoordinates(a, b) {
  const ax = a.lon, ay = a.lat, bx = b.lon, by = b.lat;
  const dx = bx - ax, dy = by - ay;
  const dist = Math.hypot(dx, dy) || 1;
  const cx = (ax + bx) / 2 - (dy / dist) * dist * 0.44;
  const cy = (ay + by) / 2 + (dx / dist) * dist * 0.44;
  const pts = [];
  for (let i = 0; i <= 48; i += 1) {
    const t = i / 48;
    pts.push([
      (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx,
      (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by,
    ]);
  }
  return pts;
}

// Circle of radius_km around a pin (km → degrees; lon scaled by 1/cos(lat)).
function circleCoords(pin, radiusKm) {
  const rLat = radiusKm / 111;
  const cosLat = Math.max(0.05, Math.cos((pin.lat * Math.PI) / 180));
  const rLon = radiusKm / (111 * cosLat);
  const pts = [];
  for (let i = 0; i <= 72; i += 1) {
    const a = (i / 72) * Math.PI * 2;
    pts.push([pin.lon + rLon * Math.sin(a), pin.lat + rLat * Math.cos(a)]);
  }
  return pts;
}

// Geographic bearing (degrees from north) from point a to b — used to aim the
// route arrowhead with rotationAlignment:'map' so the camera drift can't skew it.
function bearing(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1]))
    - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function pinElement({ accent, label, scale = 1, dim = false, pulse = true, pulseDelay = 0, labelScale = 1 }) {
  const el = document.createElement('div');
  el.className = 'tp-mb-pin';
  el.style.opacity = dim ? '0.6' : '1';
  el.style.transform = `scale(${scale})`;
  el.innerHTML = `
    <span class="tp-mb-glow" style="background:${accent}"></span>
    ${pulse ? `<span class="tp-mb-ring" style="border-color:${accent};animation-delay:${pulseDelay}s"></span>
    <span class="tp-mb-ring tp-mb-ring2" style="border-color:${accent};animation-delay:${pulseDelay + 1.2}s"></span>` : ''}
    <span class="tp-mb-dot" style="background:${accent}"></span>
    ${label ? `<span class="tp-mb-label" style="font-size:${9.5 * labelScale}px">${label}</span>` : ''}
  `;
  return el;
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

    // Variant resolution — malformed shapes already degraded upstream, but
    // guard anyway so a bad row can only ever fall back to `site`.
    let kind = ['route', 'area', 'multi'].includes(geo.kind) ? geo.kind : 'site';
    if (kind === 'route' && pins.length !== 2) kind = 'site';
    if (kind === 'area' && !(pins.length >= 1 && Number(geo.radius_km) > 0)) kind = 'site';
    if (kind === 'multi' && pins.length < 3) kind = 'site';
    const arcLinked = kind === 'route' || (kind === 'site' && geo.link === true && pins.length === 2);

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

    // Final camera per variant: bounds must cover the full overlay (the area
    // circle, the route arc, every multi pin) — not just the pins.
    let target;
    const boundsOf = (coords) => {
      const bounds = new mapboxgl.LngLatBounds();
      coords.forEach((c) => bounds.extend(c));
      return bounds;
    };
    if (kind === 'area') {
      const circle = circleCoords(pins[0], Number(geo.radius_km));
      const cam = map.cameraForBounds(boundsOf(circle), { padding: 46, maxZoom: 9 });
      target = { center: cam.center, zoom: cam.zoom, pitch: 30, bearing: -6 };
    } else if (pins.length > 1) {
      const coords = pins.map((p) => [p.lon, p.lat]);
      if (arcLinked) coords.push(...arcCoordinates(pins[0], pins[1]));
      const cam = map.cameraForBounds(boundsOf(coords), { padding: 64, maxZoom: 5.8 });
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
      try {
        map.setFog({
          color: 'rgb(13, 18, 32)',
          'high-color': 'rgb(28, 40, 68)',
          'horizon-blend': 0.028,
          'space-color': 'rgb(4, 6, 13)',
          'star-intensity': 0.5,
        });
      } catch {}

      if (arcLinked) {
        const coords = arcCoordinates(pins[0], pins[1]);
        try {
          map.addSource('tp-arc', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } },
          });
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

      if (kind === 'area') {
        const radius = Number(geo.radius_km);
        try {
          map.addSource('tp-zone', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleCoords(pins[0], radius)] } },
          });
          map.addLayer({
            id: 'tp-zone-fill',
            type: 'fill',
            source: 'tp-zone',
            paint: { 'fill-color': accent, 'fill-opacity': 0.1 },
          });
          map.addLayer({
            id: 'tp-zone-line',
            type: 'line',
            source: 'tp-zone',
            paint: { 'line-color': accent, 'line-width': 1.2, 'line-opacity': 0.8 },
          });
          // inner ring at 50% radius for depth
          map.addSource('tp-zone-inner', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: circleCoords(pins[0], radius * 0.5) } },
          });
          map.addLayer({
            id: 'tp-zone-inner-line',
            type: 'line',
            source: 'tp-zone-inner',
            paint: { 'line-color': accent, 'line-width': 1, 'line-opacity': 0.3 },
          });
        } catch {}
      }
    });

    // ── Pins per variant ──
    const markers = [];
    const addMarker = (pin, opts) => {
      markers.push(new mapboxgl.Marker({ element: pinElement({ accent, label: pin.label, ...opts }), anchor: 'center' })
        .setLngLat([pin.lon, pin.lat])
        .addTo(map));
    };

    if (kind === 'route') {
      // pins[0] = FROM (smaller, dimmer, no pulse) → pins[1] = TO (the event)
      addMarker(pins[0], { scale: 0.72, dim: true, pulse: false, labelScale: 0.85 });
      addMarker(pins[1], { pulse: !reduced });
    } else if (kind === 'multi') {
      pins.slice(0, 5).forEach((pin, i) => {
        // keep labels on the two most important pins; only a 3-pin map has
        // room for all labels at fit-bounds zoom
        const showLabel = i < 2 || pins.length === 3;
        addMarker({ ...pin, label: showLabel ? pin.label : '' }, {
          scale: i === 0 ? 1 : 0.75,
          pulse: !reduced,
          pulseDelay: i * 0.4,
          labelScale: i === 0 ? 1 : 0.8,
        });
      });
    } else {
      pins.slice(0, 2).forEach((pin, i) => addMarker(pin, { pulse: !reduced, pulseDelay: i * 0.4 }));
    }

    // ── Route extras: arrowhead at TO + traveling dot FROM→TO ──
    let travelMarker = null;
    let travelRaf = null;
    if (kind === 'route') {
      const coords = arcCoordinates(pins[0], pins[1]);
      const tipFrom = coords[44];
      const tip = coords[47];
      const arrowEl = document.createElement('div');
      arrowEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" style="display:block">
        <path d="M7 1L12.2 12.2 7 9.4 1.8 12.2z" fill="${accent}" stroke="rgba(4,6,13,0.55)" stroke-width="0.8"/></svg>`;
      markers.push(new mapboxgl.Marker({
        element: arrowEl, anchor: 'center',
        rotation: bearing(tipFrom, tip), rotationAlignment: 'map', pitchAlignment: 'map',
      }).setLngLat(tip).addTo(map));

      if (!reduced) {
        const dotEl = document.createElement('div');
        dotEl.style.cssText = `width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:0 0 8px 2px color-mix(in srgb, ${accent} 70%, transparent);`;
        travelMarker = new mapboxgl.Marker({ element: dotEl, anchor: 'center' })
          .setLngLat(coords[0])
          .addTo(map);
        const animateDot = (now) => {
          const t = (now % 2500) / 2500;
          const f = t * (coords.length - 1);
          const i = Math.min(coords.length - 2, Math.floor(f));
          const frac = f - i;
          travelMarker.setLngLat([
            coords[i][0] + (coords[i + 1][0] - coords[i][0]) * frac,
            coords[i][1] + (coords[i + 1][1] - coords[i][1]) * frac,
          ]);
          travelRaf = requestAnimationFrame(animateDot);
        };
        travelRaf = requestAnimationFrame(animateDot);
      }
    }

    // ── Area extras: radius label on the circle's east edge ──
    let radiusMarker = null;
    if (kind === 'area') {
      const radius = Number(geo.radius_km);
      const edge = circleCoords(pins[0], radius)[18]; // due-east point
      const el = document.createElement('div');
      el.className = 'tp-mb-dist';
      el.style.color = '#fff';
      el.style.borderColor = accent;
      el.textContent = `≈${Math.round(radius)} KM`;
      radiusMarker = new mapboxgl.Marker({ element: el, anchor: 'left' })
        .setLngLat(edge)
        .addTo(map);
    }

    // legacy/site distance chip on the arc apex
    let distMarker = null;
    if (arcLinked && geo.distance) {
      const apex = arcCoordinates(pins[0], pins[1])[24];
      const el = document.createElement('div');
      el.className = 'tp-mb-dist';
      el.style.color = '#fff';
      el.style.borderColor = accent;
      el.textContent = geo.distance;
      distMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(apex)
        .addTo(map);
    }

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (travelRaf) cancelAnimationFrame(travelRaf);
      markers.forEach((m) => m.remove());
      if (travelMarker) travelMarker.remove();
      if (radiusMarker) radiusMarker.remove();
      if (distMarker) distMarker.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [geo, accent, reduced, storyId]);

  // Fly in once on first real view; gentle drift after landing.
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
        .tp-mb-pin { position: relative; width: 16px; height: 16px; }
        .tp-mb-glow {
          position: absolute; left: 50%; top: 50%;
          width: 30px; height: 30px; margin: -15px 0 0 -15px;
          border-radius: 50%; opacity: 0.32; filter: blur(9px);
        }
        .tp-mb-dot {
          position: absolute; left: 50%; top: 50%;
          width: 10px; height: 10px; margin: -5px 0 0 -5px;
          border-radius: 50%; border: 2px solid rgba(255,255,255,0.92);
          box-shadow: 0 1px 8px rgba(0,0,0,0.55); box-sizing: border-box;
        }
        .tp-mb-ring {
          position: absolute; left: 50%; top: 50%;
          width: 10px; height: 10px; margin: -5px 0 0 -5px;
          border-radius: 50%; border: 1.4px solid;
          animation: tp-mb-pulse 2.4s cubic-bezier(.2,.6,.36,1) infinite;
        }
        .tp-mb-ring2 { }
        @keyframes tp-mb-pulse {
          0% { transform: scale(0.5); opacity: 0.95; }
          100% { transform: scale(3.4); opacity: 0; }
        }
        .tp-mb-label {
          position: absolute; left: 19px; top: 50%;
          transform: translateY(-50%);
          font-family: ${FONT_MONO};
          font-weight: 500; letter-spacing: 0.09em; text-transform: uppercase;
          color: #F2F4FA;
          background: rgba(7, 11, 20, 0.66);
          border: 1px solid rgba(232,234,242,0.16);
          border-radius: 99px; padding: 4px 9px;
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          white-space: nowrap;
        }
        .tp-mb-dist {
          font-family: ${FONT_MONO};
          font-size: 9.5px; font-weight: 500; letter-spacing: 0.09em;
          background: rgba(7, 11, 20, 0.66);
          border: 1px solid; border-radius: 99px; padding: 4px 9px;
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          white-space: nowrap;
        }
        @media (prefers-reduced-motion: reduce) {
          .tp-mb-ring { animation: none !important; opacity: 0; }
        }
        .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib,
        .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right {
          display: none !important;
        }
      `}</style>
    </div>
  );
}

const MAP_KICKER_LABELS = {
  route: 'ON THE MOVE',
  area: 'IMPACT ZONE',
  multi: 'ACROSS THE MAP',
};

export function MapCard({ story, display, accent, onOpen }) {
  const kind = display.geo?.kind;
  return (
    <article>
      <div>
        <KickerRow category={display.category} accent={accent} story={story}
          countdown={display.countdown} label={MAP_KICKER_LABELS[kind]} />
        <div style={{ marginTop: 10 }}>
          <Headline raw={display.title} accent={accent} size={22.5} />
        </div>
        {display.geo?.pins?.length ? (
          <div style={{ marginTop: 18 }}>
            <MapboxFigure geo={display.geo} accent={accent} storyId={String(story.id)} />
          </div>
        ) : null}
        {/* one supporting sentence — NOT a bullet list (§redesign) */}
        {display.lede ? (
          <p style={{
            fontFamily: FONT_BODY, fontSize: 14.4, lineHeight: 1.55, color: TP.ink2,
            margin: '16px 0 0', maxWidth: '52ch',
          }}>{display.lede}</p>
        ) : null}
      </div>
      {/* NO mini-chart — the map owns the frame (§redesign) */}
      <div style={{ marginTop: 18 }}>
        <CardFooter story={story} tags={display.tags} onOpen={onOpen} />
      </div>
    </article>
  );
}
