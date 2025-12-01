'use client';

import React, { memo, useMemo, useState, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const GraphChart = memo(function GraphChart({ graph, expanded, accentColor = '#3b82f6' }) {
  const [contentOpacity, setContentOpacity] = useState(1);
  const [contentScale, setContentScale] = useState(1);
  const prevExpandedRef = useRef(expanded);
  const animationFrameRef = useRef(null);

  // Smooth transition when expanded state changes
  useEffect(() => {
    if (prevExpandedRef.current !== expanded) {
      // Smooth fade out
      setContentOpacity(0.3);
      setContentScale(0.97);
      
      // Gradually restore after container finishes resizing
      const restoreAnimation = () => {
        let start = null;
        const duration = 400; // ms
        
        const animate = (timestamp) => {
          if (!start) start = timestamp;
          const progress = Math.min((timestamp - start) / duration, 1);
          
          // Smooth easing function (ease-out cubic)
          const eased = 1 - Math.pow(1 - progress, 3);
          
          setContentOpacity(0.3 + (0.7 * eased));
          setContentScale(0.97 + (0.03 * eased));
          
          if (progress < 1) {
            animationFrameRef.current = requestAnimationFrame(animate);
          }
        };
        
        // Start restore after container transition begins
        setTimeout(() => {
          animationFrameRef.current = requestAnimationFrame(animate);
        }, 100);
      };
      
      restoreAnimation();
      prevExpandedRef.current = expanded;
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [expanded]);

  // Memoize chart data
  const chartData = useMemo(() => {
    if (!graph || !graph.data || graph.data.length === 0) {
      return [];
    }
    return graph.data.map(d => ({
      date: d.date,
      value: typeof d.value === 'number' ? d.value : parseFloat(d.value) || 0
    }));
  }, [graph]);

  if (chartData.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#64748b',
        fontSize: '12px'
      }}>
        No data available
      </div>
    );
  }

  const commonProps = {
    data: chartData,
    style: { fontSize: '10px' }
  };

  const axisProps = {
    stroke: '#64748b',
    style: { fontSize: '10px' },
    tick: { fill: '#64748b' }
  };

  const tooltipProps = {
    contentStyle: {
      backgroundColor: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '4px',
      fontSize: '11px'
    }
  };

  const renderChart = () => {
    if (graph.type === 'line' || !graph.type) {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" {...axisProps} />
          <YAxis 
            {...axisProps}
            label={graph.y_label ? { 
              value: graph.y_label, 
              angle: -90, 
              position: 'insideLeft', 
              style: { fontSize: '10px', fill: '#64748b' } 
            } : null}
          />
          <Tooltip {...tooltipProps} />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={accentColor} 
            strokeWidth={2}
            dot={{ fill: accentColor, r: expanded ? 4 : 2 }}
            activeDot={{ r: 6 }}
            isAnimationActive={true}
            animationDuration={1000}
            animationEasing="ease-in-out"
          />
        </LineChart>
      );
    } else if (graph.type === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" {...axisProps} />
          <YAxis 
            {...axisProps}
            label={graph.y_label ? { 
              value: graph.y_label, 
              angle: -90, 
              position: 'insideLeft', 
              style: { fontSize: '10px', fill: '#64748b' } 
            } : null}
          />
          <Tooltip {...tooltipProps} />
          <Bar 
            dataKey="value" 
            fill={accentColor} 
            isAnimationActive={true}
            animationDuration={1000}
            animationEasing="ease-in-out"
          />
        </BarChart>
      );
    } else if (graph.type === 'area') {
      return (
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" {...axisProps} />
          <YAxis 
            {...axisProps}
            label={graph.y_label ? { 
              value: graph.y_label, 
              angle: -90, 
              position: 'insideLeft', 
              style: { fontSize: '10px', fill: '#64748b' } 
            } : null}
          />
          <Tooltip {...tooltipProps} />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={accentColor} 
            fill={accentColor} 
            fillOpacity={0.3} 
            isAnimationActive={true}
            animationDuration={1000}
            animationEasing="ease-in-out"
          />
        </AreaChart>
      );
    } else if (graph.type === 'column') {
      return (
        <BarChart {...commonProps} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            type="number"
            {...axisProps}
            label={graph.x_label ? { 
              value: graph.x_label, 
              position: 'insideBottom', 
              offset: -5, 
              style: { fontSize: '10px', fill: '#64748b' } 
            } : null}
          />
          <YAxis 
            type="category"
            dataKey="date"
            {...axisProps}
            width={60}
          />
          <Tooltip {...tooltipProps} />
          <Bar 
            dataKey="value" 
            fill={accentColor} 
            isAnimationActive={true}
            animationDuration={1000}
            animationEasing="ease-in-out"
          />
        </BarChart>
      );
    } else {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip {...tooltipProps} />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={accentColor} 
            strokeWidth={2} 
            isAnimationActive={true}
            animationDuration={1000}
            animationEasing="ease-in-out"
          />
        </LineChart>
      );
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      opacity: contentOpacity,
      transform: `scale(${contentScale})`,
      transformOrigin: 'center center',
      transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      willChange: 'opacity, transform'
    }}>
      <ResponsiveContainer width="100%" height="100%" debounce={150}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
});

export default GraphChart;
