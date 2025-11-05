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
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: expanded ? 4 : 2 }}
            activeDot={{ r: 6 }}
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
          <Bar dataKey="value" fill="#3b82f6" />
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
          <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
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
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      );
    } else {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip {...tooltipProps} />
          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
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

