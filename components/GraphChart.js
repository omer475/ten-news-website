'use client';

import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function GraphChart({ graph, expanded }) {
  if (!graph || !graph.data || graph.data.length === 0) {
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

  const chartData = graph.data.map(d => ({
    date: d.date,
    value: typeof d.value === 'number' ? d.value : parseFloat(d.value) || 0
  }));

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
    // Hide axis label names when collapsed, but keep axis lines visible
    const xAxisLabel = expanded && graph.x_label ? { 
      value: graph.x_label, 
      position: 'insideBottom', 
      offset: -5, 
      style: { fontSize: '10px', fill: '#64748b' } 
    } : null;
    
    const yAxisLabel = expanded && graph.y_label ? { 
      value: graph.y_label, 
      angle: -90, 
      position: 'insideLeft', 
      style: { fontSize: '10px', fill: '#64748b' } 
    } : null;

    // Axis props - show lines but hide tick labels when collapsed
    const xAxisPropsCollapsed = {
      ...axisProps,
      tick: false, // Hide tick labels
      label: null // Hide axis label name
    };
    
    const yAxisPropsCollapsed = {
      ...axisProps,
      tick: false, // Hide tick labels
      label: null // Hide axis label name
    };

    if (graph.type === 'line' || !graph.type) {
      return (
        <LineChart {...commonProps}>
          {expanded && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
          <XAxis 
            dataKey="date" 
            {...(expanded ? axisProps : xAxisPropsCollapsed)}
            label={xAxisLabel}
          />
          <YAxis 
            {...(expanded ? axisProps : yAxisPropsCollapsed)}
            label={yAxisLabel}
          />
          {expanded && <Tooltip {...tooltipProps} />}
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#3b82f6" 
            strokeWidth={expanded ? 2 : 2.5}
            dot={{ fill: '#3b82f6', r: expanded ? 4 : 3 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      );
    } else if (graph.type === 'bar') {
      return (
        <BarChart {...commonProps}>
          {expanded && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
          <XAxis 
            dataKey="date" 
            {...(expanded ? axisProps : xAxisPropsCollapsed)}
            label={xAxisLabel}
          />
          <YAxis 
            {...(expanded ? axisProps : yAxisPropsCollapsed)}
            label={yAxisLabel}
          />
          {expanded && <Tooltip {...tooltipProps} />}
          <Bar 
            dataKey="value" 
            fill={expanded ? "#3b82f6" : "#2563eb"}
            stroke={expanded ? "#3b82f6" : "#1e40af"}
            strokeWidth={expanded ? 0 : 1.5}
            radius={expanded ? [4, 4, 0, 0] : [2, 2, 0, 0]}
          />
        </BarChart>
      );
    } else if (graph.type === 'area') {
      return (
        <AreaChart {...commonProps}>
          {expanded && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
          <XAxis 
            dataKey="date" 
            {...(expanded ? axisProps : xAxisPropsCollapsed)}
            label={xAxisLabel}
          />
          <YAxis 
            {...(expanded ? axisProps : yAxisPropsCollapsed)}
            label={yAxisLabel}
          />
          {expanded && <Tooltip {...tooltipProps} />}
          <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
        </AreaChart>
      );
    } else if (graph.type === 'column') {
      return (
        <BarChart {...commonProps} layout="vertical">
          {expanded && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
          <XAxis 
            type="number"
            {...(expanded ? axisProps : xAxisPropsCollapsed)}
            label={expanded && graph.x_label ? { 
              value: graph.x_label, 
              position: 'insideBottom', 
              offset: -5, 
              style: { fontSize: '10px', fill: '#64748b' } 
            } : null}
          />
          <YAxis 
            type="category"
            dataKey="date"
            {...(expanded ? axisProps : yAxisPropsCollapsed)}
            width={expanded ? 60 : 40}
          />
          {expanded && <Tooltip {...tooltipProps} />}
          <Bar 
            dataKey="value" 
            fill={expanded ? "#3b82f6" : "#2563eb"}
            stroke={expanded ? "#3b82f6" : "#1e40af"}
            strokeWidth={expanded ? 0 : 1.5}
            radius={expanded ? [4, 4, 0, 0] : [2, 2, 0, 0]}
          />
        </BarChart>
      );
    } else {
      return (
        <LineChart {...commonProps}>
          {expanded && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
          <XAxis 
            dataKey="date" 
            {...(expanded ? axisProps : xAxisPropsCollapsed)}
          />
          <YAxis 
            {...(expanded ? axisProps : yAxisPropsCollapsed)}
          />
          {expanded && <Tooltip {...tooltipProps} />}
          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={expanded ? 2 : 2.5} />
        </LineChart>
      );
    }
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      {renderChart()}
    </ResponsiveContainer>
  );
}

