import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1Ijoib21lcnMzOTQ4IiwiYSI6ImNtajY0bjFycTBqNjkzZnF5bzduenA0NmIifQ.8I1Q5aYeoGB3GihpfaC_WQ';

// Cache for location boundaries to avoid repeated API calls
const boundaryCache = new Map();

// Fetch location boundary from Nominatim (OpenStreetMap)
const fetchLocationBoundary = async (locationName, lat, lon) => {
  // Check cache first
  const cacheKey = `${locationName}-${lat}-${lon}`;
  if (boundaryCache.has(cacheKey)) {
    return boundaryCache.get(cacheKey);
  }

  try {
    // Search by name and coordinates for better accuracy
    const searchQuery = encodeURIComponent(locationName);
    const url = `https://nominatim.openstreetmap.org/search?q=${searchQuery}&format=json&polygon_geojson=1&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TenNews/1.0 (news app)'
      }
    });
    
    if (!response.ok) {
      console.log('⚠️ Nominatim API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0 && data[0].geojson) {
      const result = {
        geojson: data[0].geojson,
        boundingbox: data[0].boundingbox,
        displayName: data[0].display_name
      };
      boundaryCache.set(cacheKey, result);
      return result;
    }
    
    return null;
  } catch (err) {
    console.log('⚠️ Failed to fetch boundary:', err.message);
    return null;
  }
};

// Create a bounding box polygon from coordinates
const createBoundingBoxPolygon = (lat, lon, radiusKm = 5) => {
  // Approximate degrees per km (varies by latitude)
  const latDegPerKm = 1 / 111;
  const lonDegPerKm = 1 / (111 * Math.cos(lat * Math.PI / 180));
  
  const latOffset = radiusKm * latDegPerKm;
  const lonOffset = radiusKm * lonDegPerKm;
  
  return {
    type: 'Polygon',
    coordinates: [[
      [lon - lonOffset, lat - latOffset],
      [lon + lonOffset, lat - latOffset],
      [lon + lonOffset, lat + latOffset],
      [lon - lonOffset, lat + latOffset],
      [lon - lonOffset, lat - latOffset]
    ]]
  };
};

export default function MapboxMap({ 
  center = { lat: 0, lon: 0 }, 
  markers = [], 
  expanded = false,
  highlightColor = '#3b82f6',
  locationType = 'auto',
  regionName = null,
  location = null
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [boundaryData, setBoundaryData] = useState(null);

  // Fetch boundary when location changes
  useEffect(() => {
    const locationToSearch = location || regionName;
    if (locationToSearch && center.lat && center.lon) {
      fetchLocationBoundary(locationToSearch, center.lat, center.lon)
        .then(data => {
          if (data) {
            console.log('🗺️ Fetched boundary for:', locationToSearch);
            setBoundaryData(data);
          }
        });
    }
  }, [location, regionName, center.lat, center.lon]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map
    const initialZoom = expanded ? 8 : 11;
    
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
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

    // Apply custom theme colors
    map.on('load', () => {
      // Hide Mapbox branding
      const logo = mapContainerRef.current?.querySelector('.mapboxgl-ctrl-logo');
      if (logo) logo.style.display = 'none';
      const attrib = mapContainerRef.current?.querySelector('.mapboxgl-ctrl-attrib');
      if (attrib) attrib.style.display = 'none';
      
      // Custom professional light theme
      if (map.getLayer('water')) {
        map.setPaintProperty('water', 'fill-color', '#c7d2e0');
      }
      
      if (map.getLayer('landcover')) {
        map.setPaintProperty('landcover', 'fill-color', [
          'match', ['get', 'class'],
          'wood', '#e8e4dc', 'scrub', '#ebe7df', 'grass', '#eae6de',
          'crop', '#f2ede5', 'snow', '#f5f5f5', 'wetland', '#dde3e8',
          'sand', '#f0ebe0', '#ebe7e0'
        ]);
        map.setPaintProperty('landcover', 'fill-opacity', 0.7);
      }
      
      if (map.getLayer('landuse')) {
        map.setPaintProperty('landuse', 'fill-color', [
          'match', ['get', 'class'],
          'park', '#dfe8dc', 'cemetery', '#e5e5e0', 'hospital', '#f0eae8',
          'school', '#eae8ed', 'industrial', '#e2e2e0', 'commercial', '#ede8e3',
          'residential', '#f0ebe5', 'agriculture', '#ebe6dc', 'airport', '#e5e5e5',
          'pitch', '#e0e8dc', '#ebe7e0'
        ]);
        map.setPaintProperty('landuse', 'fill-opacity', 0.6);
      }
      
      if (map.getLayer('hillshade')) {
        map.setPaintProperty('hillshade', 'hillshade-shadow-color', '#d8d4cc');
        map.setPaintProperty('hillshade', 'hillshade-highlight-color', '#fafaf8');
        map.setPaintProperty('hillshade', 'hillshade-exaggeration', 0.25);
      }
      
      if (map.getLayer('park')) {
        map.setPaintProperty('park', 'fill-color', '#dce5d8');
      }
      if (map.getLayer('national_park')) {
        map.setPaintProperty('national_park', 'fill-color', '#d8e2d5');
      }
      
      if (map.getLayer('building')) {
        map.setPaintProperty('building', 'fill-color', '#ddd8d0');
        map.setPaintProperty('building', 'fill-opacity', 0.65);
      }
      
      const roadLayers = ['road-street', 'road-minor', 'road-major', 'road-primary', 'road-secondary', 'road-motorway', 'road-trunk'];
      roadLayers.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'line-color', '#ccc8c0');
        }
      });
    });

    mapRef.current = map;

    // Add boundary/area highlighting when map loads
    map.on('load', () => {
      console.log('🗺️ MapboxMap loaded, boundary data:', !!boundaryData);
      
      // Determine what geometry to use
      let areaGeometry = null;
      
      if (boundaryData && boundaryData.geojson) {
        // Use actual boundary from Nominatim
        areaGeometry = boundaryData.geojson;
        console.log('✅ Using real boundary polygon');
        
        // Fit map to boundary
        if (boundaryData.boundingbox) {
          const [south, north, west, east] = boundaryData.boundingbox.map(Number);
          map.fitBounds([[west, south], [east, north]], {
            padding: 40,
            duration: 0
          });
        }
      } else {
        // Fallback: create a rectangular area around the point
        areaGeometry = createBoundingBoxPolygon(center.lat, center.lon, 3);
        console.log('📦 Using fallback bounding box');
      }
      
      // Add the area source
      try {
        map.addSource('location-boundary', {
          'type': 'geojson',
          'data': {
            'type': 'Feature',
            'geometry': areaGeometry
          }
        });

        // Fill layer - semi-transparent area
        map.addLayer({
          'id': 'location-boundary-fill',
          'type': 'fill',
          'source': 'location-boundary',
          'paint': {
            'fill-color': highlightColor,
            'fill-opacity': 0.15
          }
        });

        // Outline layer - solid border
        map.addLayer({
          'id': 'location-boundary-outline',
          'type': 'line',
          'source': 'location-boundary',
          'paint': {
            'line-color': highlightColor,
            'line-width': 2,
            'line-opacity': 0.6
          }
        });

        // Outer glow effect
        map.addLayer({
          'id': 'location-boundary-glow',
          'type': 'line',
          'source': 'location-boundary',
          'paint': {
            'line-color': highlightColor,
            'line-width': 8,
            'line-opacity': 0.15,
            'line-blur': 4
          }
        }, 'location-boundary-outline');

        console.log('✅ Boundary layers added');
      } catch (err) {
        console.log('⚠️ Could not add boundary layers:', err.message);
      }
    });

    // Handle resize
    let resizeTimeout;
    const resizeObserver = new ResizeObserver(() => {
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
  }, [center.lat, center.lon, highlightColor, boundaryData]);

  // Update boundary when data arrives after map is already loaded
  useEffect(() => {
    if (mapRef.current && boundaryData && boundaryData.geojson) {
      const map = mapRef.current;
      
      try {
        // Update the source with new boundary data
        const source = map.getSource('location-boundary');
        if (source) {
          source.setData({
            'type': 'Feature',
            'geometry': boundaryData.geojson
          });
          
          // Fit to new boundary
          if (boundaryData.boundingbox) {
            const [south, north, west, east] = boundaryData.boundingbox.map(Number);
            map.fitBounds([[west, south], [east, north]], {
              padding: 40,
              duration: 500
            });
          }
          
          console.log('✅ Updated boundary with real data');
        }
      } catch (err) {
        console.log('⚠️ Could not update boundary:', err.message);
      }
    }
  }, [boundaryData]);

  // Handle expand/collapse
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      
      setIsTransitioning(true);
      
      if (expanded) {
        map.scrollZoom.enable();
        map.boxZoom.enable();
        map.dragPan.enable();
        map.doubleClickZoom.enable();
        map.touchZoomRotate.enable();
      } else {
        map.scrollZoom.disable();
        map.boxZoom.disable();
        map.dragPan.disable();
        map.doubleClickZoom.disable();
        map.touchZoomRotate.disable();
      }
      
      // Adjust zoom for expand/collapse
      const targetZoom = expanded ? 8 : 11;
      
      map.easeTo({
        zoom: targetZoom,
        duration: 350,
        easing: (t) => 1 - Math.pow(1 - t, 3)
      });
      
      // Resize during transition
      const resizeTimes = [50, 150, 250, 350];
      const timeouts = resizeTimes.map(time => 
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.resize();
          }
        }, time)
      );
      
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
          opacity: isTransitioning ? 0.85 : 1,
          transition: 'opacity 0.15s ease-out',
          willChange: 'opacity'
        }} 
      />
    </>
  );
}
