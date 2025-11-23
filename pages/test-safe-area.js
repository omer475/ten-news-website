export default function TestSafeArea() {
  return (
    <>
      <style jsx>{`
        .test-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(to bottom, #ff0000, #0000ff);
        }
        
        .test-box-top {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: #ffff00;
          padding-top: calc(20px + env(safe-area-inset-top, 0px));
          padding-bottom: 20px;
          text-align: center;
          font-size: 20px;
          font-weight: bold;
          color: #000;
        }
        
        .test-box-bottom {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #00ff00;
          padding-top: 20px;
          padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
          text-align: center;
          color: #000;
          font-size: 20px;
          font-weight: bold;
        }

        .test-box-left {
          position: fixed;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          background: #ff00ff;
          padding-left: calc(10px + env(safe-area-inset-left, 0px));
          padding-right: 10px;
          padding-top: 20px;
          padding-bottom: 20px;
          color: #fff;
          font-size: 16px;
          font-weight: bold;
          writing-mode: vertical-rl;
        }

        .test-box-right {
          position: fixed;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: #00ffff;
          padding-right: calc(10px + env(safe-area-inset-right, 0px));
          padding-left: 10px;
          padding-top: 20px;
          padding-bottom: 20px;
          color: #000;
          font-size: 16px;
          font-weight: bold;
          writing-mode: vertical-rl;
        }

        .center-info {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.9);
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          max-width: 300px;
        }

        .center-info h1 {
          font-size: 24px;
          margin-bottom: 10px;
          color: #000;
        }

        .center-info p {
          font-size: 14px;
          color: #666;
          margin: 5px 0;
        }

        .value {
          font-weight: bold;
          color: #0066cc;
        }
      `}</style>

      <div className="test-container">
        <div className="test-box-top">
          TOP - Should be below notch
        </div>
        
        <div className="test-box-bottom">
          BOTTOM - Should be above home indicator
        </div>

        <div className="test-box-left">
          LEFT
        </div>

        <div className="test-box-right">
          RIGHT
        </div>

        <div className="center-info">
          <h1>Safe Area Test</h1>
          <p>If working correctly:</p>
          <p>• Yellow bar below notch ✅</p>
          <p>• Green bar above home indicator ✅</p>
          <p>• No black bars at edges ✅</p>
          <p>• Background extends edge-to-edge ✅</p>
        </div>
      </div>
    </>
  )
}

