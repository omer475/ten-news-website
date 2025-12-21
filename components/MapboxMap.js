import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1Ijoib21lcnMzOTQ4IiwiYSI6ImNtajY0bjFycTBqNjkzZnF5bzduenA0NmIifQ.8I1Q5aYeoGB3GihpfaC_WQ';

// Country code mapping for common countries (ISO 3166-1 alpha-3)
// These are LARGE AREAS that should be highlighted, not pinned
const COUNTRY_CODES = {
  'usa': 'USA', 'united states': 'USA', 'america': 'USA',
  'uk': 'GBR', 'united kingdom': 'GBR', 'britain': 'GBR', 'england': 'GBR',
  'russia': 'RUS', 'russian federation': 'RUS',
  'ukraine': 'UKR', 'china': 'CHN', 'india': 'IND',
  'france': 'FRA', 'germany': 'DEU', 'italy': 'ITA', 'spain': 'ESP',
  'japan': 'JPN', 'south korea': 'KOR', 'north korea': 'PRK',
  'iran': 'IRN', 'iraq': 'IRQ', 'syria': 'SYR', 'israel': 'ISR',
  'palestine': 'PSE', 'gaza': 'PSE', 'turkey': 'TUR', 'egypt': 'EGY',
  'saudi arabia': 'SAU', 'australia': 'AUS', 'canada': 'CAN',
  'brazil': 'BRA', 'mexico': 'MEX', 'argentina': 'ARG',
  'poland': 'POL', 'netherlands': 'NLD', 'belgium': 'BEL',
  'sweden': 'SWE', 'norway': 'NOR', 'finland': 'FIN', 'denmark': 'DNK',
  'afghanistan': 'AFG', 'pakistan': 'PAK', 'indonesia': 'IDN',
  'philippines': 'PHL', 'vietnam': 'VNM', 'thailand': 'THA',
  'taiwan': 'TWN', 'hong kong': 'HKG', 'singapore': 'SGP',
  'south africa': 'ZAF', 'nigeria': 'NGA', 'kenya': 'KEN', 'ethiopia': 'ETH'
};

// Helper to detect if a location name is a large region (country) or specific place
const isLargeRegion = (locationName) => {
  if (!locationName) return false;
  const nameLower = locationName.toLowerCase().trim();
  
  // Check if it's a known country/region
  if (COUNTRY_CODES[nameLower]) return true;
  
  // Check for country-like patterns (single word country names)
  const countryNames = Object.keys(COUNTRY_CODES);
  for (const country of countryNames) {
    if (nameLower === country || nameLower.endsWith(country)) return true;
  }
  
  // Large regions that should be highlighted
  const largeRegions = [
    'middle east', 'eastern europe', 'western europe', 'central europe',
    'east asia', 'southeast asia', 'south asia', 'central asia',
    'north africa', 'sub-saharan africa', 'latin america', 'caribbean',
    'gaza strip', 'west bank', 'crimea', 'donbas', 'kurdistan'
  ];
  
  for (const region of largeRegions) {
    if (nameLower.includes(region)) return true;
  }
  
  return false;
};

// Helper to get country code from location name
const getCountryCode = (locationName) => {
  if (!locationName) return null;
  const nameLower = locationName.toLowerCase().trim();
  return COUNTRY_CODES[nameLower] || null;
};

export default function MapboxMap({ 
  center = { lat: 0, lon: 0 }, 
  markers = [], 
  expanded = false,
  highlightColor = '#3b82f6',
  locationType = 'auto',  // 'pin', 'area', or 'auto' (auto-detect from location name)
  regionName = null,      // Country/region name to highlight when locationType is 'area'
  location = null         // Location name for auto-detection (e.g., "Ukraine", "White House")
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Auto-detect location type based on location name
  const effectiveLocationType = (() => {
    if (locationType === 'area') return 'area';
    if (locationType === 'pin') return 'pin';
    // Auto-detect: check if location name is a country/large region
    const locationToCheck = location || regionName;
    if (locationToCheck && isLargeRegion(locationToCheck)) {
      return 'area';
    }
    return 'pin';  // Default to pin for specific locations
  })();

  // Get the country code for area highlighting
  const effectiveRegionCode = (() => {
    if (regionName) return getCountryCode(regionName) || regionName.toUpperCase();
    if (location) return getCountryCode(location) || null;
    return null;
  })();

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map with custom professional light theme
    // When collapsed: zoom IN to show specific location (zoom 8-10)
    // When expanded: zoom OUT to show more context (zoom 4-6)
    const initialZoom = expanded 
      ? (effectiveLocationType === 'area' ? 4 : 6)   // Expanded: show context
      : (effectiveLocationType === 'area' ? 5 : 10); // Collapsed: focus on location
    
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',  // Start with light base
      center: [center.lon || 0, center.lat || 0],
      zoom: initialZoom,
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

    // Hide the Mapbox logo and apply custom light theme colors
    map.on('load', () => {
      const logo = mapContainerRef.current.querySelector('.mapboxgl-ctrl-logo');
      if (logo) logo.style.display = 'none';
      const attrib = mapContainerRef.current.querySelector('.mapboxgl-ctrl-attrib');
      if (attrib) attrib.style.display = 'none';
      
      // Custom professional light theme with terrain-based color variations
      
      // Water: soft light blue
      if (map.getLayer('water')) {
        map.setPaintProperty('water', 'fill-color', '#dbeafe');
      }
      
      // Landcover with terrain-based grey variations
      // Different land types get subtly different grey tones
      if (map.getLayer('landcover')) {
        map.setPaintProperty('landcover', 'fill-color', [
          'match',
          ['get', 'class'],
          'wood', '#e8ebe8',           // Forest: slight green-grey
          'scrub', '#eaebe8',          // Scrubland: warm grey
          'grass', '#ebeee9',          // Grassland: light sage grey
          'crop', '#f0efe8',           // Agricultural: warm cream grey
          'snow', '#f8fafc',           // Snow/ice: very light cool grey
          'wetland', '#e5eaed',        // Wetland: blue-grey
          'sand', '#f5f3ed',           // Desert/sand: warm beige grey
          '#f1f3f4'                    // Default: neutral grey
        ]);
        map.setPaintProperty('landcover', 'fill-opacity', 0.6);
      }
      
      // Landuse with activity-based variations
      if (map.getLayer('landuse')) {
        map.setPaintProperty('landuse', 'fill-color', [
          'match',
          ['get', 'class'],
          'park', '#e5ede5',           // Parks: soft sage
          'cemetery', '#eaecea',       // Cemetery: muted grey-green
          'hospital', '#f5f0f0',       // Hospital: warm pink-grey
          'school', '#f0f0f5',         // School: cool grey
          'industrial', '#e8e8e8',     // Industrial: neutral grey
          'commercial', '#f2f2f0',     // Commercial: warm light grey
          'residential', '#f5f5f3',    // Residential: cream grey
          'agriculture', '#f0efe8',    // Agriculture: warm cream
          'airport', '#ebebeb',        // Airport: cool grey
          'pitch', '#e8ede8',          // Sports: light green-grey
          '#f1f3f4'                    // Default
        ]);
        map.setPaintProperty('landuse', 'fill-opacity', 0.5);
      }
      
      // Hillshade for terrain depth (if available)
      if (map.getLayer('hillshade')) {
        map.setPaintProperty('hillshade', 'hillshade-shadow-color', '#e0e0e0');
        map.setPaintProperty('hillshade', 'hillshade-highlight-color', '#fafafa');
        map.setPaintProperty('hillshade', 'hillshade-exaggeration', 0.3);
      }
      
      // Parks/green areas: soft sage tones
      if (map.getLayer('park')) {
        map.setPaintProperty('park', 'fill-color', '#e5ede5');
      }
      if (map.getLayer('national_park')) {
        map.setPaintProperty('national_park', 'fill-color', '#e2eae2');
      }
      
      // Buildings: subtle warm grey
      if (map.getLayer('building')) {
        map.setPaintProperty('building', 'fill-color', '#e5e5e5');
        map.setPaintProperty('building', 'fill-opacity', 0.7);
      }
      
      // Roads: soft grey tones
      const roadLayers = ['road-street', 'road-minor', 'road-major', 'road-primary', 'road-secondary', 'road-motorway', 'road-trunk'];
      roadLayers.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-color', '#d4d4d4');
        }
      });
    });

    mapRef.current = map;

    // Wait for map to load before adding markers or area highlights
    map.on('load', () => {
      // Create custom marker element - minimal modern design
      const createCustomMarker = (color, isMain = true) => {
        const el = document.createElement('div');
        const size = isMain ? 16 : 12;
        
        el.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border-radius: 50%;
          border: 2.5px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
          position: relative;
        `;
        
        // Subtle outer ring for main marker
        if (isMain) {
          const ring = document.createElement('div');
          ring.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${size + 12}px;
            height: ${size + 12}px;
            border: 2px solid ${color};
            border-radius: 50%;
            opacity: 0.4;
            pointer-events: none;
          `;
          el.appendChild(ring);
        }
        
        return el;
      };

      console.log('🗺️ MapboxMap loaded:', { effectiveLocationType, effectiveRegionCode, center, location });
      
      // ALWAYS add a pin marker first (visible for both pin and area types)
      const mainMarker = new mapboxgl.Marker({
        element: createCustomMarker(highlightColor, true),
        anchor: 'center'
      })
        .setLngLat([center.lon || 0, center.lat || 0])
        .addTo(map);
      markersRef.current.push(mainMarker);
      console.log('📍 Pin marker added at:', center);

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

      // ADDITIONALLY for AREA type - try to highlight country/region
      if (effectiveLocationType === 'area' && effectiveRegionCode) {
        console.log('🌍 Attempting area highlight for:', effectiveRegionCode);
        try {
          const countryCode = effectiveRegionCode;
          
          // Try to add country highlight using admin boundaries
          // This works with most Mapbox styles
          map.addLayer({
            'id': 'country-highlight-fill',
            'type': 'fill',
            'source': 'composite',
            'source-layer': 'admin-0-boundary-bg',
            'filter': ['==', ['get', 'iso_3166_1'], countryCode.substring(0, 2)],
            'paint': {
              'fill-color': highlightColor,
              'fill-opacity': 0.25
            }
          });
          console.log('✅ Area fill layer added');
        } catch (err) {
          console.log('⚠️ Could not add area highlight (this is OK):', err.message);
          // Marker is already added above, so we're fine
        }
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
  }, [center.lat, center.lon, highlightColor, effectiveLocationType, effectiveRegionCode]);

  // Handle expand/collapse - update zoom level and enable/disable interactions
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      
      // Quick, subtle fade for smoothness
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
      
      // Smoothly animate zoom change during container transition
      // Use flyTo for smooth animation instead of jumpTo
      const targetZoom = expanded ? 6 : 10;  // Collapsed: zoom 10 (focused), Expanded: zoom 6 (context)
      
      // Start zoom animation immediately - it will animate alongside container
      map.easeTo({
        zoom: targetZoom,
        duration: 350,  // Match container transition duration
        easing: (t) => 1 - Math.pow(1 - t, 3)  // Smooth ease-out curve
      });
      
      // Resize multiple times during transition for smooth scaling
      const resizeTimes = [50, 150, 250, 350];
      const timeouts = resizeTimes.map(time => 
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.resize();
          }
        }, time)
      );
      
      // Fade back in quickly
      const fadeTimeout = setTimeout(() => {
        setIsTransitioning(false);
      }, 100);
      
      return () => {
        timeouts.forEach(t => clearTimeout(t));
        clearTimeout(fadeTimeout);
      };
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
          // Subtle opacity dip during transition - barely noticeable but smooths resize
          opacity: isTransitioning ? 0.85 : 1,
          transition: 'opacity 0.15s ease-out',
          willChange: 'opacity'
        }} 
      />
    </>
  );
}

