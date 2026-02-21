import SafetyMonitor from './SafetyMonitor';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <div className="app-header">
        <div className="header-content">
          <div className="logo">Shield</div>
          <h1>Safety Monitor</h1>
          <p className="subtitle">Real-time threat detection & emergency response</p>
        </div>
      </div>
      <SafetyMonitor />
    </div>
  );
}

export default App;
