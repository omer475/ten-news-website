/**
 * DataAnalyticsSection
 *
 * Power BI-style multi-chart dashboard for event data analytics.
 * Uses Recharts for visualizations with liquid glass styling.
 */

import React, { useMemo } from 'react';
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

// Transform per-series data to per-x-value rows for Recharts
function pivotData(series) {
  const map = {};
  for (const s of series) {
    for (const pt of s.data) {
      if (!map[pt.x]) map[pt.x] = { x: pt.x };
      map[pt.x][s.name] = pt.y;
    }
  }
  // Preserve original x order from first series
  const order = series[0]?.data.map(d => d.x) || [];
  const seen = new Set();
  const result = [];
  for (const x of order) {
    if (!seen.has(x) && map[x]) {
      seen.add(x);
      result.push(map[x]);
    }
  }
  // Add any remaining keys not in first series
  for (const key of Object.keys(map)) {
    if (!seen.has(key)) result.push(map[key]);
  }
  return result;
}

// Format values for tooltips and axes
function formatValue(val, fmt) {
  if (val == null) return '';
  switch (fmt) {
    case 'percent':
      return `${val}%`;
    case 'currency_b':
      return `$${val}B`;
    case 'currency_m':
      return `$${val}M`;
    case 'compact':
      if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
      if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
      if (Math.abs(val) >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
      return val.toLocaleString();
    default:
      return val.toLocaleString();
  }
}

function ChartCard({ chart }) {
  const { title, description, chart_type, series, x_label, y_label, y_format, source } = chart;

  const data = useMemo(() => pivotData(series || []), [series]);

  // Pie/donut data uses first series directly
  const pieData = useMemo(() => {
    if (chart_type !== 'pie' && chart_type !== 'donut') return [];
    const s = series?.[0];
    if (!s) return [];
    return s.data.map(d => ({ name: d.x, value: d.y, color: null }));
  }, [series, chart_type]);

  const pieColors = useMemo(() => {
    if (chart_type !== 'pie' && chart_type !== 'donut') return [];
    // Use colors from all series or generate from palette
    const palette = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    return pieData.map((_, i) => series?.[0]?.color && i === 0 ? series[0].color : palette[i % palette.length]);
  }, [pieData, series, chart_type]);

  const tickFormatter = (val) => formatValue(val, y_format);
  const tooltipFormatter = (val) => formatValue(val, y_format);

  const customTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        fontSize: 12,
      }}>
        <div style={{ fontWeight: 600, color: '#1d1d1f', marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            <span style={{ color: '#48484a' }}>{p.name}: <strong>{formatValue(p.value, y_format)}</strong></span>
          </div>
        ))}
      </div>
    );
  };

  const pieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        fontSize: 12,
      }}>
        <div style={{ fontWeight: 600, color: '#1d1d1f' }}>{d.name}: <strong>{formatValue(d.value, y_format)}</strong></div>
      </div>
    );
  };

  const axisStyle = { fontSize: 11, fill: '#9ca3af' };
  const gridStyle = { strokeDasharray: '3 3', stroke: 'rgba(0,0,0,0.06)' };

  const renderChart = () => {
    switch (chart_type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="x" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
              <Tooltip content={customTooltip} />
              {series.map((s, i) => (
                <Line key={i} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3, fill: s.color }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="x" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
              <Tooltip content={customTooltip} />
              {series.map((s, i) => (
                <Bar key={i} dataKey={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'stacked_bar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="x" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
              <Tooltip content={customTooltip} />
              {series.map((s, i) => (
                <Bar key={i} dataKey={s.name} fill={s.color} stackId="stack" radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="x" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
              <Tooltip content={customTooltip} />
              {series.map((s, i) => (
                <Area key={i} type="monotone" dataKey={s.name} stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'horizontal_bar':
        return (
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
              <YAxis type="category" dataKey="x" tick={axisStyle} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={customTooltip} />
              {series.map((s, i) => (
                <Bar key={i} dataKey={s.name} fill={s.color} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={chart_type === 'donut' ? 50 : 0}
                outerRadius={80}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={pieColors[i]} />
                ))}
              </Pie>
              <Tooltip content={pieTooltip} />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  // Legend items
  const legendItems = (chart_type === 'pie' || chart_type === 'donut')
    ? pieData.map((d, i) => ({ name: d.name, color: pieColors[i] }))
    : series.map(s => ({ name: s.name, color: s.color }));

  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {description && <p className="chart-desc">{description}</p>}

      {legendItems.length > 1 && (
        <div className="chart-legend">
          {legendItems.map((item, i) => (
            <span key={i} className="legend-item">
              <span className="legend-dot" style={{ background: item.color }} />
              {item.name}
            </span>
          ))}
        </div>
      )}

      <div className="chart-body">
        {renderChart()}
      </div>

      {source && (
        <div className="chart-source">Source: {source}</div>
      )}
    </div>
  );
}

function KeyFactCard({ fact }) {
  return (
    <div className="key-fact-card">
      <div className="key-fact-value">{fact.value}</div>
      <div className="key-fact-label">{fact.label}</div>
      {fact.context && <div className="key-fact-context">{fact.context}</div>}
      {fact.source && <div className="key-fact-source">{fact.source}</div>}
    </div>
  );
}

export default function DataAnalyticsSection({ data, dataSources }) {
  if (!data || !data.charts || data.charts.length === 0) return null;

  const keyFacts = data.key_facts || [];
  const hasKeyFacts = keyFacts.length > 0;

  // Build sources list: prefer dedicated dataSources, fall back to collecting from data
  const sources = useMemo(() => {
    if (dataSources && dataSources.length > 0) return dataSources;
    const collected = [];
    for (const fact of (data.key_facts || [])) {
      if (fact.source) collected.push(fact.source);
    }
    for (const chart of (data.charts || [])) {
      if (chart.source) collected.push(chart.source);
    }
    // Dedupe preserving order
    return [...new Map(collected.map(s => [s, s])).values()];
  }, [data, dataSources]);

  return (
    <>
      <style jsx>{`
        .analytics-section {
          margin: 24px 0;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .section-title {
          font-size: 11px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .count-badge {
          font-size: 9px;
          color: #fff;
          background: #1d1d1f;
          padding: 2px 6px;
          border-radius: 6px;
          font-weight: 600;
        }

        .analytics-summary {
          font-size: 13px;
          color: #48484a;
          line-height: 1.6;
          margin: 0 0 16px 0;
          padding: 12px 16px;
          border-radius: 12px;
          background-color: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(4px) saturate(180%);
          -webkit-backdrop-filter: blur(4px) saturate(180%);
          box-shadow:
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.08),
            inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.7),
            inset -1px -1px 0px -1px rgba(255, 255, 255, 0.6),
            0px 1px 3px rgba(0, 0, 0, 0.03);
        }

        .key-facts-scroll {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          padding: 2px 0 16px 0;
          margin: 0 0 4px 0;
          scrollbar-width: none;
        }
        .key-facts-scroll::-webkit-scrollbar {
          display: none;
        }

        .charts-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .sources-footer {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid rgba(0,0,0,0.04);
        }
        .sources-label {
          font-size: 10px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-right: 2px;
          line-height: 22px;
        }
        .source-pill {
          font-size: 10px;
          color: #6b7280;
          background-color: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(4px) saturate(180%);
          -webkit-backdrop-filter: blur(4px) saturate(180%);
          padding: 3px 10px;
          border-radius: 10px;
          white-space: nowrap;
          box-shadow:
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.08),
            inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.7),
            inset -1px -1px 0px -1px rgba(255, 255, 255, 0.6),
            0px 1px 3px rgba(0, 0, 0, 0.03);
        }
      `}</style>

      {/* ChartCard + KeyFactCard styles need global scope since they are separate components */}
      <style jsx global>{`
        .chart-card {
          padding: 16px;
          border-radius: 14px;
          background-color: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(4px) saturate(180%);
          -webkit-backdrop-filter: blur(4px) saturate(180%);
          box-shadow:
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.08),
            inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.7),
            inset -1px -1px 0px -1px rgba(255, 255, 255, 0.6),
            0px 1px 3px rgba(0, 0, 0, 0.03);
        }

        .chart-title {
          font-size: 14px;
          font-weight: 600;
          color: #1d1d1f;
          line-height: 1.35;
          margin: 0 0 4px 0;
        }

        .chart-desc {
          font-size: 12px;
          color: #86868b;
          line-height: 1.4;
          margin: 0 0 10px 0;
        }

        .chart-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 10px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #6b7280;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .chart-body {
          margin: 0 -8px;
        }

        .chart-source {
          font-size: 10px;
          color: #c4c4c6;
          margin-top: 8px;
          font-style: italic;
        }

        .key-fact-card {
          flex: 0 0 auto;
          min-width: 140px;
          max-width: 180px;
          padding: 14px 16px;
          border-radius: 12px;
          scroll-snap-align: start;
          background-color: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(4px) saturate(180%);
          -webkit-backdrop-filter: blur(4px) saturate(180%);
          box-shadow:
            inset 0 0 0 0.5px rgba(255, 255, 255, 0.08),
            inset 0.9px 1.5px 0px -1px rgba(255, 255, 255, 0.7),
            inset -1px -1px 0px -1px rgba(255, 255, 255, 0.6),
            0px 1px 3px rgba(0, 0, 0, 0.03);
        }

        .key-fact-value {
          font-size: 20px;
          font-weight: 700;
          color: #1d1d1f;
          line-height: 1.2;
          margin-bottom: 4px;
        }

        .key-fact-label {
          font-size: 11px;
          font-weight: 600;
          color: #48484a;
          line-height: 1.3;
          margin-bottom: 3px;
        }

        .key-fact-context {
          font-size: 10px;
          color: #86868b;
          line-height: 1.3;
        }

        .key-fact-source {
          font-size: 9px;
          color: #c4c4c6;
          margin-top: 6px;
          font-style: italic;
        }
      `}</style>

      <section className="analytics-section">
        <div className="section-header">
          <span className="section-title">Data Analytics</span>
          <span className="count-badge">{data.charts.length}</span>
        </div>

        {data.summary && (
          <p className="analytics-summary">{data.summary}</p>
        )}

        {hasKeyFacts && (
          <div className="key-facts-scroll">
            {keyFacts.map((fact, i) => (
              <KeyFactCard key={i} fact={fact} />
            ))}
          </div>
        )}

        <div className="charts-stack">
          {data.charts.map((chart) => (
            <ChartCard key={chart.id} chart={chart} />
          ))}
        </div>

        {sources.length > 0 && (
          <div className="sources-footer">
            <span className="sources-label">Sources</span>
            {sources.map((source, i) => (
              <span key={i} className="source-pill">{source}</span>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
