'use client';

import React, { memo, useMemo, useState, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const GraphChart = memo(function GraphChart({ graph, expanded, accentColor = '#3b82f6' }) {
  const [isResizing, setIsResizing] = useState(false);
  const resizeTimeoutRef = useRef(null);
  const prevExpandedRef = useRef(expanded);

  // Detect when expanded state changes and temporarily disable animations
  useEffect(() => {
    if (prevExpandedRef.current !== expanded) {
      setIsResizing(true);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        setIsResizing(false);
      }, 400); // Wait for CSS transition to complete
      prevExpandedRef.current = expanded;
    }
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [expanded]);

  // Memoize chart data to prevent recalculation on every render
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

  // Only animate when not resizing
  const shouldAnimate = !isResizing;

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
            isAnimationActive={shouldAnimate}
            animationDuration={800}
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
            isAnimationActive={shouldAnimate}
            animationDuration={800}
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
            isAnimationActive={shouldAnimate}
            animationDuration={800}
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
            isAnimationActive={shouldAnimate}
            animationDuration={800}
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
            isAnimationActive={shouldAnimate}
            animationDuration={800}
          />
        </LineChart>
      );
    }
  };

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={100}>
      {renderChart()}
    </ResponsiveContainer>
  );
});

export default GraphChart;
