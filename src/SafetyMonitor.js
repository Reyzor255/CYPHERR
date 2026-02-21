import { useState, useRef, useEffect } from 'react';
import RecordingPage from './RecordingPage';
import './SafetyMonitor.css';

function SafetyMonitor() {
  const [keyword, setKeyword] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [detectedText, setDetectedText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [errorType, setErrorType] = useState('');
  const [errorDetails, setErrorDetails] = useState('');
  const [status, setStatus] = useState('idle');
  const [lastRetryAt, setLastRetryAt] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [contacts, setContacts] = useState(['', '', '']);
  const [showRecordingPage, setShowRecordingPage] = useState(false);
  const requestIdRef = useRef(0);
  const recognitionRef = useRef(null);
  const keywordRef = useRef(keyword);
  const listeningRef = useRef(isListening);

  useEffect(() => { keywordRef.current = keyword; }, [keyword]);
  useEffect(() => { listeningRef.current = isListening; }, [isListening]);

  function pushLog(msg) {
    const id = (requestIdRef.current || 0) + 1;
    requestIdRef.current = id;
    const entry = { id, ts: Date.now(), msg };
    setDebugLogs((prev) => [entry, ...prev].slice(0, 100));
    console.log(`[SR][${id}] ${msg}`);
  }

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    if (typeof recognition.maxAlternatives !== 'undefined') recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = (event.results[i][0].transcript || '').toLowerCase().trim();
        const key = (keywordRef.current || '').toLowerCase().trim();
        if (key && transcript.includes(key)) {
          setTriggered(true);
          setDetectedText(transcript);
          setShowRecordingPage(true);
          alert('Word was detected!');
          setTimeout(() => setTriggered(false), 3000);
          setTimeout(() => setDetectedText(''), 3000);
        }
      }
    };

    recognition.onstart = () => {
      setStatus('listening');
      pushLog('recognition started');
      setErrorMsg('');
    };

    recognition.onspeechstart = () => {
      pushLog('speechstart');
    };

    recognition.onspeechend = () => {
      pushLog('speechend');
    };

    recognition.onend = () => {
      pushLog('recognition ended');
      if (listeningRef.current) {
        pushLog('attempting auto-restart');
        try { recognition.start(); } catch (e) { pushLog('auto-restart failed'); }
      } else {
        setStatus('stopped');
      }
    };

    recognition.onerror = (e) => {
      console.error('SpeechRecognition error', e);
      console.dir(e);
      const errType = (e && e.error) || (e && e.message) || 'unknown';
      setErrorType(errType);
      setErrorDetails(JSON.stringify({ error: errType, event: e }, Object.getOwnPropertyNames(e)));
      pushLog(`error ${errType}`);

      let friendly = '';
      switch (errType) {
        case 'network':
          friendly = 'Network error — check your connection and any firewall/VPN.';
          break;
        case 'no-speech':
          friendly = 'No speech detected — try speaking louder or closer to the mic.';
          break;
        case 'aborted':
          friendly = 'Recognition aborted.';
          break;
        case 'audio-capture':
          friendly = 'No microphone was found — check your device.';
          break;
        case 'not-allowed':
        case 'permission-denied':
        case 'service-not-allowed':
          friendly = 'Microphone permission was denied. Allow microphone access to continue.';
          break;
        default:
          friendly = `Speech recognition error: ${errType}`;
      }

      // If offline, report immediately
      if (!navigator.onLine) {
        friendly = 'You appear to be offline — check your network connection.';
      }

      setErrorMsg(friendly);
      setStatus('error');
      listeningRef.current = false;
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch (e) { }
      recognitionRef.current = null;
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    const newListening = !isListening;
    listeningRef.current = newListening;
    try {
      if (newListening) {
        pushLog('toggle -> start requested');
        setStatus('starting');
        recognitionRef.current.start();
      } else {
        pushLog('toggle -> stop requested');
        recognitionRef.current.stop();
        setStatus('stopped');
      }
      setIsListening(newListening);
    } catch (err) {
      console.error('Recognition start/stop failed', err);
      pushLog(`start/stop failed: ${String(err)}`);
    }
  };

  const manualRetry = () => {
    setErrorMsg('');
    setRetryCount(0);
    setLastRetryAt(Date.now());
    pushLog('manual retry requested');
    if (!recognitionRef.current) return;
    try {
      listeningRef.current = true;
      recognitionRef.current.start();
      setIsListening(true);
      setStatus('starting');
    } catch (err) {
      console.error('Manual retry failed', err);
      pushLog(`manual retry failed: ${String(err)}`);
      setErrorMsg('retry-failed');
    }
  };

  const requestMicrophoneAccess = async () => {
    // This triggers the browser permission prompt for microphone.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('getUserMedia not supported in this browser.');
      return;
    }
    try {
      pushLog('requesting microphone permission via getUserMedia');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // immediately stop tracks — we just wanted the permission
      stream.getTracks().forEach((t) => t.stop());
      setErrorMsg('');
      setErrorType('');
      setLastRetryAt(Date.now());
      // try to restart recognition
      if (recognitionRef.current) {
        try {
          pushLog('permission granted — starting recognition');
          listeningRef.current = true;
          recognitionRef.current.start();
          setIsListening(true);
          setStatus('starting');
        } catch (err) {
          console.error('start after permission failed', err);
          pushLog(`start after permission failed: ${String(err)}`);
        }
      }
    } catch (err) {
      console.error('getUserMedia failed', err);
      pushLog(`getUserMedia failed: ${String(err)}`);
      setErrorMsg('Microphone access was not granted.');
    }
  };



  if (showRecordingPage) {
    return <RecordingPage onBack={() => setShowRecordingPage(false)} detectedWord={keyword} />;
  }

  return (
    <div className="monitor-container">
      <div className="monitor-main">
        {/* Keyword Setup */}
        <div className="card keyword-card">
          <h2 className="card-title">Threat Detection Setup</h2>
          <div className="input-group">
            <label>Trigger Keyword</label>
            <input
              type="text"
              placeholder="Enter keyword to detect..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="input-field"
            />
          </div>
          <button 
            onClick={toggleListening} 
            className={`btn btn-primary ${isListening ? 'btn-active' : ''}`}
          >
            <span className="status-indicator"></span>
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </button>
        </div>

        {/* Emergency Contacts */}
        <div className="card contacts-card">
          <h2 className="card-title">Emergency Contacts</h2>
          <div className="contacts-grid">
            {contacts.map((contact, index) => (
              <div key={index} className="contact-input-wrapper">
                <label>Contact {index + 1}</label>
                <input
                  type="text"
                  placeholder="Name or phone number"
                  value={contact}
                  onChange={(e) => {
                    const newContacts = [...contacts];
                    newContacts[index] = e.target.value;
                    setContacts(newContacts);
                  }}
                  className="input-field"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Status Card */}
        <div className="card status-card">
          <h2 className="card-title">System Status</h2>
          <div className="status-grid">
            <div className="status-item">
              <div className="status-label">Status</div>
              <div className={`status-value status-${status}`}>{status}</div>
            </div>
            <div className="status-item">
              <div className="status-label">Listening</div>
              <div className={`status-value ${isListening ? 'active' : 'inactive'}`}>
                {isListening ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div className="status-item">
              <div className="status-label">Retry Attempts</div>
              <div className="status-value">{retryCount}</div>
            </div>
            <div className="status-item">
              <div className="status-label">Last Update</div>
              <div className="status-value">{lastRetryAt ? new Date(lastRetryAt).toLocaleTimeString() : '—'}</div>
            </div>
          </div>
        </div>

        {/* Detection Alert */}
        {triggered && (
          <div className="alert alert-danger">
            <div className="alert-header">
              <div className="alert-icon">!</div>
              <div className="alert-title">THREAT DETECTED</div>
            </div>
            <div className="alert-content">
              <p><strong>Keyword:</strong> {detectedText || keyword}</p>
              <p><strong>Contacts Alerted:</strong> {contacts.filter(c => c).length > 0 ? contacts.filter(c => c).join(', ') : 'No contacts configured'}</p>
              <p><strong>Emergency Services:</strong> Police dispatched</p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="alert alert-warning">
            <div className="alert-header">
              <div className="alert-icon">⚠</div>
              <div className="alert-title">Error</div>
            </div>
            <div className="alert-content">
              <p>{errorMsg}</p>
              <div className="alert-actions">
                <button onClick={manualRetry} className="btn btn-secondary btn-sm">Retry</button>
                <span className="retry-count">Attempts: {retryCount}</span>
                {(errorType === 'not-allowed' || errorType === 'permission-denied' || errorType === 'service-not-allowed') && (
                  <button onClick={requestMicrophoneAccess} className="btn btn-secondary btn-sm">Request Permission</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SafetyMonitor;
