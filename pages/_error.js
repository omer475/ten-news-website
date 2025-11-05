import { useEffect } from 'react';

function Error({ statusCode, hasGetInitialPropsRun, err }) {
  useEffect(() => {
    // Log error to console for debugging
    if (err) {
      console.error('Error:', err);
    }
  }, [err]);

  return (
    <div style={{
      padding: '20px',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>
        {statusCode
          ? `An error ${statusCode} occurred`
          : 'An error occurred'}
      </h1>
      <p style={{ fontSize: '16px', color: '#666' }}>
        {statusCode === 404
          ? 'The page you are looking for does not exist.'
          : 'Something went wrong. Please try refreshing the page.'}
      </p>
      <button 
        onClick={() => window.location.reload()}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Refresh Page
      </button>
    </div>
  );
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { 
    statusCode,
    hasGetInitialPropsRun: true,
    err
  };
};

export default Error;

