import { useState, useRef, useEffect } from 'react';

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
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <button onClick={onBack} style={{ padding: '10px 20px', fontSize: '16px', marginBottom: '20px' }}>
        Back to Monitor
      </button>
      
      <div style={{ padding: '20px', backgroundColor: '#ffebee', borderRadius: '10px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#c62828' }}>Emergency Recording Active</h2>
        <p style={{ margin: 0 }}>Detected word: <strong>{detectedWord}</strong></p>
        <div style={{ marginTop: '15px' }}>
          {isRecording ? (
            <button onClick={stopRecording} style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: '#d32f2f', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              Stop Recording
            </button>
          ) : (
            <button onClick={startRecording} style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              Start Recording
            </button>
          )}
        </div>
      </div>

      <h3>Saved Recordings ({recordings.length})</h3>
      <div>
        {recordings.map((rec) => (
          <div key={rec.timestamp} style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '5px', marginBottom: '10px', backgroundColor: '#f9f9f9' }}>
            <div><strong>Time:</strong> {new Date(rec.timestamp).toLocaleString()}</div>
            <div><strong>Detected Word:</strong> {rec.detectedWord}</div>
            <div style={{ marginTop: '10px' }}>
              <button onClick={() => playRecording(rec.audio)} style={{ padding: '8px 15px', marginRight: '10px', fontSize: '14px', backgroundColor: '#2196f3', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                Play
              </button>
              <button onClick={() => deleteRecording(rec.timestamp)} style={{ padding: '8px 15px', fontSize: '14px', backgroundColor: '#f44336', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {recordings.length === 0 && (
          <p style={{ color: '#666' }}>No recordings yet</p>
        )}
      </div>
    </div>
  );
}

export default RecordingPage;
