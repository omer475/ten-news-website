import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// 6 color options for the globe
const GLOBE_COLORS = [
  '#FF6B35', // Coral/Orange
  '#3B82F6', // Blue
  '#10B981', // Emerald/Green
  '#8B5CF6', // Purple
  '#F59E0B', // Amber/Gold
  '#EC4899', // Pink
];

export default function StreakGlobe({ size = 550 }) {
  const svgRef = useRef(null);
  const globeRef = useRef(null);
  const rotationRef = useRef({ x: 0, y: -20 });
  const isRotatingRef = useRef(true);
  const animationFrameRef = useRef(null);
  
  // Randomly select a color on mount
  const [globeColor] = useState(() => {
    const randomIndex = Math.floor(Math.random() * GLOBE_COLORS.length);
    return GLOBE_COLORS[randomIndex];
  });

  useEffect(() => {
    let isMounted = true;

    const initGlobe = async () => {
      if (!isMounted || !svgRef.current) return;

      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove(); // Clear any existing content

      const projection = d3.geoOrthographic()
        .scale(size / 2.2)
        .center([0, 0])
        .translate([size / 2, size / 2]);

      const path = d3.geoPath().projection(projection);

      // Add sphere background and outline
      svg.append('circle')
        .attr('cx', size / 2)
        .attr('cy', size / 2)
        .attr('r', size / 2.2)
        .attr('fill', '#FAFAFA')
        .attr('stroke', '#e8e8e8')
        .attr('stroke-width', 1);

      const globe = svg.append('g');
      globeRef.current = { globe, projection, path };

      // Load world map data
      try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        const topo = await response.json();
        const countries = topojson.feature(topo, topo.objects.countries);

        // Exclude Greenland (304) and Antarctica (10)
        const exclude = [304, 10];
        const filteredCountries = {
          ...countries,
          features: countries.features.filter(f => !exclude.includes(+f.id))
        };

        globe.selectAll('path')
          .data(filteredCountries.features)
          .enter()
          .append('path')
          .attr('fill', globeColor)
          .attr('fill-opacity', 0.12)
          .attr('stroke', globeColor)
          .attr('stroke-opacity', 0.2)
          .attr('stroke-width', 0.5)
          .attr('d', path);

        // Start rotation animation
        const rotate = () => {
          if (!isMounted) return;
          
          if (isRotatingRef.current && globeRef.current) {
            rotationRef.current.x += 0.15;
            globeRef.current.projection.rotate([rotationRef.current.x, rotationRef.current.y]);
            globeRef.current.globe.selectAll('path').attr('d', globeRef.current.path);
          }
          animationFrameRef.current = requestAnimationFrame(rotate);
        };
        rotate();

        // Add drag interaction
        const drag = d3.drag()
          .on('start', () => {
            isRotatingRef.current = false;
          })
          .on('drag', (event) => {
            rotationRef.current.x += event.dx * 0.25;
            rotationRef.current.y -= event.dy * 0.25;
            rotationRef.current.y = Math.max(-90, Math.min(90, rotationRef.current.y));
            if (globeRef.current) {
              globeRef.current.projection.rotate([rotationRef.current.x, rotationRef.current.y]);
              globeRef.current.globe.selectAll('path').attr('d', globeRef.current.path);
            }
          })
          .on('end', () => {
            setTimeout(() => { isRotatingRef.current = true; }, 2000);
          });

        svg.call(drag);

      } catch (error) {
        console.error('Failed to load world map:', error);
      }
    };

    initGlobe();

    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [size, globeColor]);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      style={{ cursor: 'grab' }}
    />
  );
}

