import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1Ijoib21lcnMzOTQ4IiwiYSI6ImNtajY0bjFycTBqNjkzZnF5bzduenA0NmIifQ.8I1Q5aYeoGB3GihpfaC_WQ';

export default function MapboxMap({ 
  center = { lat: 0, lon: 0 }, 
  markers = [], 
  expanded = false,
  highlightColor = '#3b82f6'
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [center.lon || 0, center.lat || 0],
      zoom: expanded ? 5 : 2,
      interactive: true,
      attributionControl: false,
      logoPosition: 'bottom-left',
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: true,
      touchPitch: false
    });

    // Initially disable interactions if not expanded
    if (!expanded) {
      map.scrollZoom.disable();
      map.boxZoom.disable();
      map.dragPan.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
    }

    // Hide the Mapbox logo
    map.on('load', () => {
      const logo = mapContainerRef.current.querySelector('.mapboxgl-ctrl-logo');
      if (logo) logo.style.display = 'none';
      const attrib = mapContainerRef.current.querySelector('.mapboxgl-ctrl-attrib');
      if (attrib) attrib.style.display = 'none';
    });

    mapRef.current = map;

    // Wait for map to load before adding markers
    map.on('load', () => {
      // Create custom marker element - modern pulsing dot
      const createCustomMarker = (color, isMain = true) => {
        const el = document.createElement('div');
        el.style.cssText = `
          width: ${isMain ? '14px' : '10px'};
          height: ${isMain ? '14px' : '10px'};
          background: ${color};
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 0 0 4px ${color}33, 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          position: relative;
        `;
        
        // Add pulse animation ring
        if (isMain) {
          const pulse = document.createElement('div');
          pulse.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            height: 100%;
            background: ${color};
            border-radius: 50%;
            animation: markerPulse 2s ease-out infinite;
            opacity: 0.4;
            pointer-events: none;
          `;
          el.appendChild(pulse);
        }
        
        return el;
      };

      // Add main marker
      const mainMarker = new mapboxgl.Marker({
        element: createCustomMarker(highlightColor, true),
        anchor: 'center'
      })
        .setLngLat([center.lon || 0, center.lat || 0])
        .addTo(map);

      markersRef.current.push(mainMarker);

      // Add additional markers if available
      if (markers && markers.length > 0) {
        markers.forEach((marker) => {
          const m = new mapboxgl.Marker({
            element: createCustomMarker(highlightColor, false),
            anchor: 'center'
          })
            .setLngLat([marker.lon || 0, marker.lat || 0])
            .addTo(map);
          markersRef.current.push(m);
        });
      }
    });

    // Use ResizeObserver to handle container size changes with debounce
    let resizeTimeout;
    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize calls to prevent flickering during animations
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      }, 50);
    });
    resizeObserver.observe(mapContainerRef.current);

    // Cleanup
    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
    };
  }, [center.lat, center.lon, highlightColor]);

  // Handle expand/collapse - update zoom level and enable/disable interactions
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      
      // Start fade out
      setIsTransitioning(true);
      
      if (expanded) {
        // Enable interactions when expanded
        map.scrollZoom.enable();
        map.boxZoom.enable();
        map.dragPan.enable();
        map.doubleClickZoom.enable();
        map.touchZoomRotate.enable();
      } else {
        // Disable interactions when collapsed
        map.scrollZoom.disable();
        map.boxZoom.disable();
        map.dragPan.disable();
        map.doubleClickZoom.disable();
        map.touchZoomRotate.disable();
      }
      
      // Set zoom immediately (no animation) after container finishes transitioning
      const resizeTimeout = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.resize();
          mapRef.current.jumpTo({
            zoom: expanded ? 6 : 2
          });
          // Fade back in
          setTimeout(() => {
            setIsTransitioning(false);
          }, 50);
        }
      }, 400); // Wait for most of the container transition
      
      return () => clearTimeout(resizeTimeout);
    }
  }, [expanded]);

  return (
    <>
      <style jsx global>{`
        .mapboxgl-ctrl-logo,
        .mapboxgl-ctrl-attrib,
        .mapboxgl-ctrl-bottom-left,
        .mapboxgl-ctrl-bottom-right {
          display: none !important;
        }
        
        .mapboxgl-canvas-container,
        .mapboxgl-canvas {
          transition: opacity 0.3s ease !important;
        }
        
        @keyframes markerPulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(3);
            opacity: 0;
          }
        }
      `}</style>
      <div 
        ref={mapContainerRef} 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: '8px',
          overflow: 'hidden',
          opacity: isTransitioning ? 0.3 : 1,
          transition: 'opacity 0.25s ease-in-out'
        }} 
      />
    </>
  );
}

