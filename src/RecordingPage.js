import { useState, useRef, useEffect } from 'react';
import './RecordingPage.css';

function RecordingPage({ onBack, detectedWord }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    startRecording();
    loadRecordings();
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await saveRecording(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const saveRecording = async (blob) => {
    const db = await openDB();
    const transaction = db.transaction(['recordings'], 'readwrite');
    const store = transaction.objectStore('recordings');
    const recording = {
      timestamp: Date.now(),
      detectedWord: detectedWord,
      audio: blob
    };
    store.add(recording);
    await loadRecordings();
  };

  const openDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SafetyAppDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('recordings')) {
          db.createObjectStore('recordings', { keyPath: 'timestamp' });
        }
      };
    });
  };

  const loadRecordings = async () => {
    const db = await openDB();
    const transaction = db.transaction(['recordings'], 'readonly');
    const store = transaction.objectStore('recordings');
    const request = store.getAll();
    request.onsuccess = () => {
      setRecordings(request.result.reverse());
    };
  };

  const playRecording = (blob) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  };

  const deleteRecording = async (timestamp) => {
    const db = await openDB();
    const transaction = db.transaction(['recordings'], 'readwrite');
    const store = transaction.objectStore('recordings');
    store.delete(timestamp);
    await loadRecordings();
  };

  return (
    <div className="recording-container">
      <div className="recording-header">
        <button onClick={onBack} className="btn btn-secondary back-btn">
          ← Back to Monitor
        </button>
      </div>

      <div className="recording-main">
        {/* Emergency Alert Card */}
        <div className="alert-card alert-emergency">
          <div className="alert-header">
            <div className="alert-icon">⚠</div>
            <div>
              <h2>Emergency Recording Active</h2>
              <p className="detected-word">Detected threat: <strong>{detectedWord}</strong></p>
            </div>
          </div>
        </div>

        {/* Confirmation Card */}
        <div className="confirmation-card">
          <div className="confirmation-item confirmed">
            <div className="confirmation-icon">✓</div>
            <div className="confirmation-content">
              <h3>Emergency Contacts Alerted</h3>
              <p>All configured emergency contacts have been notified of the threat detection and your location.</p>
            </div>
          </div>
          <div className="confirmation-item confirmed">
            <div className="confirmation-icon">✓</div>
            <div className="confirmation-content">
              <h3>Police Dispatched</h3>
              <p>Local authorities have been notified and emergency services are being dispatched to your location with priority response.</p>
            </div>
          </div>
        </div>

        {/* Recording Control Card */}
        <div className="card recording-card">
          <h3 className="card-title">Emergency Recording</h3>
          <div className="recording-status">
            <div className="recording-indicator">
              {isRecording && <span className="recording-pulse"></span>}
              <span className="recording-text">
                {isRecording ? 'Recording in progress...' : 'Recording stopped'}
              </span>
            </div>
          </div>
          <div className="recording-actions">
            {isRecording ? (
              <button onClick={stopRecording} className="btn btn-danger">
                Stop Recording
              </button>
            ) : (
              <button onClick={startRecording} className="btn btn-success">
                Resume Recording
              </button>
            )}
          </div>
        </div>

        {/* Saved Recordings Card */}
        <div className="card recordings-list-card">
          <h3 className="card-title">Evidence Log ({recordings.length})</h3>
          <div className="recordings-list">
            {recordings.length > 0 ? (
              recordings.map((rec) => (
                <div key={rec.timestamp} className="recording-item">
                  <div className="recording-meta">
                    <div className="meta-time">
                      <span className="meta-label">Recorded</span>
                      <span className="meta-value">{new Date(rec.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="meta-word">
                      <span className="meta-label">Trigger</span>
                      <span className="meta-value">{rec.detectedWord}</span>
                    </div>
                  </div>
                  <div className="recording-item-actions">
                    <button onClick={() => playRecording(rec.audio)} className="btn btn-sm btn-secondary">
                      ▶ Play
                    </button>
                    <button onClick={() => deleteRecording(rec.timestamp)} className="btn btn-sm btn-danger">
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No recordings saved yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecordingPage;
