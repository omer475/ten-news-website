import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const GraphChart = dynamic(() => import('../components/GraphChart'), { 
  ssr: false,
  loading: () => <div>Loading chart...</div>
});

export default function TestGraph() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  const testGraph = {
    type: "line",
    title: "Test Graph",
    data: [
      { date: "2023-01", value: 100 },
      { date: "2023-02", value: 150 },
      { date: "2023-03", value: 200 },
      { date: "2023-04", value: 180 }
    ],
    y_label: "Value",
    x_label: "Date"
  };

  return (
    <div style={{ padding: '40px' }}>
      <h1>Graph Test Page</h1>
      
      <div style={{ marginTop: '20px' }}>
        <h2>Status:</h2>
        <p>Loaded: {loaded ? 'Yes' : 'No'}</p>
        <p>Window: {typeof window !== 'undefined' ? 'Available' : 'Not available'}</p>
      </div>

      <div style={{ marginTop: '40px', border: '1px solid #ccc', padding: '20px' }}>
        <h2>Graph Component Test:</h2>
        <div style={{ width: '600px', height: '300px', marginTop: '20px' }}>
          {loaded && typeof window !== 'undefined' ? (
            <GraphChart graph={testGraph} expanded={true} />
          ) : (
            <p>Waiting for client-side rendering...</p>
          )}
        </div>
      </div>

      <div style={{ marginTop: '40px' }}>
        <h2>Test Data:</h2>
        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          {JSON.stringify(testGraph, null, 2)}
        </pre>
      </div>
    </div>
  );
}

