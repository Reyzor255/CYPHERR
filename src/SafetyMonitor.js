import { useState, useRef, useEffect } from 'react';
import RecordingPage from './RecordingPage';

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
  const [envInfo, setEnvInfo] = useState(null);
  const [gUMStatus, setGUMStatus] = useState('idle');
  const [fetchStatus, setFetchStatus] = useState('idle');
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

  const collectEnv = () => {
    const info = {
      online: Boolean(navigator.onLine),
      userAgent: navigator.userAgent,
      connection: (navigator.connection && navigator.connection.effectiveType) || 'unknown',
      platform: navigator.platform || 'unknown'
    };
    setEnvInfo(info);
    pushLog('collected env info');
    return info;
  };

  const testGetUserMedia = async () => {
    setGUMStatus('pending');
    pushLog('running getUserMedia test');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setGUMStatus('getUserMedia not supported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setGUMStatus('ok');
      pushLog('getUserMedia ok');
    } catch (err) {
      setGUMStatus(String(err));
      pushLog(`getUserMedia error: ${String(err)}`);
    }
  };

  const testFetch = async (url = 'https://www.google.com') => {
    setFetchStatus('pending');
    pushLog(`running fetch test to ${url}`);
    try {
      await fetch(url, { mode: 'no-cors' });
      setFetchStatus('ok');
      pushLog('fetch ok');
    } catch (err) {
      setFetchStatus(String(err));
      pushLog(`fetch error: ${String(err)}`);
    }
  };

  if (showRecordingPage) {
    return <RecordingPage onBack={() => setShowRecordingPage(false)} detectedWord={keyword} />;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <input
        type="text"
        placeholder="Set Keyword"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ padding: '10px', fontSize: '16px', marginRight: '10px' }}
      />
      <button onClick={toggleListening} style={{ padding: '10px 20px', fontSize: '16px' }}>
        {isListening ? 'Stop Listening' : 'Start Listening'}
      </button>
      
      <div style={{marginTop:20}}>
        <div style={{fontWeight:'bold', marginBottom:8}}>Emergency Contacts:</div>
        {contacts.map((contact, index) => (
          <input
            key={index}
            type="text"
            placeholder={`Contact ${index + 1}`}
            value={contact}
            onChange={(e) => {
              const newContacts = [...contacts];
              newContacts[index] = e.target.value;
              setContacts(newContacts);
            }}
            style={{ padding: '8px', fontSize: '14px', marginRight: '10px', marginBottom: '8px', display: 'block' }}
          />
        ))}
      </div>

      <div style={{marginTop:12, padding:10, border:'1px solid #eee', borderRadius:6, background:'#fafafa'}}>
        <div><strong>Status:</strong> {status} <span style={{marginLeft:12}}><strong>Listening:</strong> {String(isListening)}</span></div>
        <div style={{marginTop:6}}><strong>Retry attempts:</strong> {retryCount} <span style={{marginLeft:12}}><strong>Last retry:</strong> {lastRetryAt ? new Date(lastRetryAt).toLocaleString() : '—'}</span></div>
      </div>
      <div style={{marginTop:12, padding:10, border:'1px solid #eee', borderRadius:6, background:'#fff'}}>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button onClick={() => { const i = collectEnv(); setEnvInfo(i); }} style={{padding:'6px 10px'}}>Collect Env</button>
          <button onClick={() => testGetUserMedia()} style={{padding:'6px 10px'}}>Test getUserMedia</button>
          <button onClick={() => testFetch()} style={{padding:'6px 10px'}}>Test Fetch</button>
        </div>
        <div style={{marginTop:8}}>
          <div><strong>Online:</strong> {envInfo ? String(envInfo.online) : '—' } <strong style={{marginLeft:12}}>UA:</strong> {envInfo ? envInfo.userAgent.split(') ')[0] + ')' : '—'}</div>
          <div style={{marginTop:6}}><strong>Connection:</strong> {envInfo ? envInfo.connection : '—'} <strong style={{marginLeft:12}}>GUM:</strong> {gUMStatus} <strong style={{marginLeft:12}}>Fetch:</strong> {fetchStatus}</div>
        </div>
      </div>
      
      {triggered && (
        <div style={{
          marginTop: '30px',
          padding: '40px',
          backgroundColor: '#ff0000',
          color: '#fff',
          fontSize: '48px',
          fontWeight: 'bold',
          textAlign: 'center',
          borderRadius: '10px'
        }}>
          DETECTED
          <div style={{fontSize: '20px', marginTop: '10px', fontWeight: 'normal'}}>
            {detectedText || keyword}
          </div>
          <div style={{fontSize: '18px', marginTop: '20px', fontWeight: 'normal'}}>
            Alerting contacts: {contacts.filter(c => c).join(', ') || 'No contacts set'}
          </div>
          <div style={{fontSize: '18px', marginTop: '10px', fontWeight: 'normal'}}>
            Alerted the police
          </div>
        </div>
      )}
      {errorMsg && (
        <div style={{marginTop:20, color:'#a00'}}>
          <div><strong>Error:</strong> {errorMsg}</div>
          <div style={{marginTop:8}}>
            <button onClick={manualRetry} style={{padding:'8px 12px'}}>Retry Listening</button>
            <span style={{marginLeft:12, color:'#666'}}>Attempts: {retryCount}</span>
            {(errorType === 'not-allowed' || errorType === 'permission-denied' || errorType === 'service-not-allowed') && (
              <button onClick={requestMicrophoneAccess} style={{padding:'8px 12px', marginLeft:12}}>Request Microphone Permission</button>
            )}
          </div>
          {errorDetails && (
            <pre style={{marginTop:12, whiteSpace:'pre-wrap', color:'#300', background:'#f7f7f7', padding:8, borderRadius:4, maxHeight:200, overflow:'auto'}}>
              {errorDetails}
            </pre>
          )}
        </div>
      )}
      {debugLogs && debugLogs.length > 0 && (
        <div style={{marginTop:12}}>
          <div style={{fontWeight:'bold'}}>Debug Log</div>
          <div style={{maxHeight:160, overflow:'auto', background:'#111', color:'#0f0', padding:8, borderRadius:4, marginTop:6}}>
            {debugLogs.map((d) => (
              <div key={d.id} style={{fontFamily:'monospace', fontSize:12}}>[{d.id}] {new Date(d.ts).toLocaleTimeString()} - {d.msg}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SafetyMonitor;
