import React from "react";

export default function Home() {
  return (
    <div style={{
      fontFamily: "system-ui, -apple-system, sans-serif",
      minHeight: "100vh",
      backgroundColor: "#fafafa"
    }}>
      <header style={{
        backgroundColor: "#000",
        color: "#fff", 
        padding: "1rem 2rem",
        textAlign: "center"
      }}>
        <h1 style={{ margin: 0, fontSize: "2rem" }}>TEN NEWS</h1>
      </header>
      
      <main style={{ 
        maxWidth: "1200px", 
        margin: "0 auto", 
        padding: "2rem",
        textAlign: "center"
      }}>
        <h2>🚀 Your Ten News Website is Live!</h2>
        <p>AI-powered news automation is active and running.</p>
        <p>Fresh content will appear daily at 7 AM UK time.</p>
        
        <div style={{
          backgroundColor: "#fff",
          padding: "2rem",
          borderRadius: "12px",
          marginTop: "2rem",
          border: "1px solid #e0e0e0"
        }}>
          <h3>✅ What's Working:</h3>
          <ul style={{ textAlign: "left", maxWidth: "500px", margin: "0 auto" }}>
            <li>🤖 GitHub Actions automation</li>
            <li>🌍 GDELT API news fetching</li>
            <li>🧠 Claude AI curation</li>
            <li>📊 Daily processing logs</li>
            <li>🚀 Vercel deployment</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
