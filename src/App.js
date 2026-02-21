import SafetyMonitor from './SafetyMonitor';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <div className="app-header">
        <div className="header-content">
          <div className="header-top">
            <div className="logo">CYPHER</div>
            <div className="header-badge">Advanced Security</div>
          </div>
          <h1>CYPHER</h1>
          <p className="subtitle">Intelligent threat detection & emergency response system</p>
          <div className="header-features">
            <div className="feature-tag">Real-time Detection</div>
            <div className="feature-tag">Instant Alerts</div>
            <div className="feature-tag">Emergency Response</div>
          </div>
        </div>
      </div>
      <SafetyMonitor />
    </div>
  );
}

export default App;
