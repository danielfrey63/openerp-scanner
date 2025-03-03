import { useState, useEffect, useRef } from 'react';
import { qrCodeScanner } from './QRCodeScanner';

interface CameraProps {
  onScanComplete: (data: string) => void;
  onClose?: () => void;
}

const Camera = ({ onScanComplete, onClose }: CameraProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [continuousScanActive, setContinuousScanActive] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Starte die Kamera
  const startCamera = async () => {
    if (!videoRef.current) return;
    
    setIsScanning(true);
    setError('');

    try {
      // Versuche verschiedene Kamera-Konfigurationen
      let stream: MediaStream | null = null;
      
      // Versuche zuerst die Rückkamera (für Mobilgeräte)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
      } catch (e) {
        console.log('Rückkamera nicht verfügbar, versuche andere Kamera');
      }
      
      // Wenn das nicht funktioniert, versuche irgendeine Kamera
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
        } catch (e) {
          throw new Error('Keine Kamera verfügbar');
        }
      }
      
      // Stream speichern und Video-Element damit verbinden
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      
      // Erfolgsmeldung
      console.log('Kamera erfolgreich gestartet');
      
      // Warte kurz, bis die Kamera initialisiert ist
      setTimeout(() => {
        startContinuousScan();
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      console.error('Kamera konnte nicht gestartet werden:', err);
      setError('Kamera konnte nicht gestartet werden: ' + errorMessage);
      setIsScanning(false);
    }
  };

  // Stoppe die Kamera
  const stopCamera = () => {
    stopContinuousScan();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  };

  // Starte kontinuierliches Scannen
  const startContinuousScan = () => {
    // Stoppe vorherige Scan-Intervalle
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    setContinuousScanActive(true);
    console.log('Kontinuierliches Scannen gestartet');
    
    // Scanne alle 500ms nach QR-Codes
    scanIntervalRef.current = window.setInterval(() => {
      scanCurrentFrame();
    }, 500);
  };

  // Stoppe kontinuierliches Scannen
  const stopContinuousScan = () => {
    setContinuousScanActive(false);
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    console.log('Kontinuierliches Scannen gestoppt');
  };

  // Scanne den aktuellen Frame nach QR-Codes
  const scanCurrentFrame = async () => {
    if (!videoRef.current || !isScanning) return;
    
    // Überprüfe, ob das Video bereits Daten hat
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      return;
    }
    
    try {
      // Canvas erstellen und Foto machen
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas-Kontext konnte nicht erstellt werden');
      
      // Canvas-Größe auf Video-Größe setzen
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      // Video-Frame auf Canvas zeichnen
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      // Als Bild exportieren
      const imageUrl = canvas.toDataURL('image/png');
      
      // QR-Code scannen
      const result = await qrCodeScanner.scanFromImageUrl(imageUrl);
      
      if (result) {
        // Stoppe das kontinuierliche Scannen
        stopContinuousScan();
        
        // Zeige Erfolgsmeldung
        console.log('QR-Code gefunden:', result);
        setError('');
        
        // Rufe den Callback auf
        onScanComplete(result);
      }
    } catch (err) {
      // Fehler beim Scannen, aber wir wollen nicht bei jedem Frame einen Fehler anzeigen
      console.error('Fehler beim Scannen:', err);
    }
  };

  // Toggle kontinuierliches Scannen
  const toggleContinuousScan = () => {
    if (continuousScanActive) {
      stopContinuousScan();
      setError('Kontinuierliches Scannen pausiert');
    } else {
      setError('');
      startContinuousScan();
    }
  };

  // Cleanup beim Unmount
  useEffect(() => {
    // Start camera automatically when component mounts
    startCamera();
    
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="camera-container">
      <video 
        ref={videoRef} 
        className="camera-video"
        style={{ width: '100%', borderRadius: '8px' }}
        playsInline
        muted
      />
      
      {error && <div className="error">{error}</div>}
      
      <div className="scanning-indicator" style={{
        display: continuousScanActive && isScanning ? 'block' : 'none',
        position: 'absolute',
        top: '10px',
        right: '10px',
        backgroundColor: 'rgba(0, 255, 0, 0.8)',
        color: 'black',
        padding: '5px 10px',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 'bold',
        zIndex: 1000,
        border: '2px solid green'
      }}>
        QR-Code wird gesucht...
      </div>
      
      <div className="camera-controls">
        {isScanning && (
          <>
            <button onClick={toggleContinuousScan} className={continuousScanActive ? "secondary" : "default"}>
              {continuousScanActive ? "Scannen pausieren" : "Scannen starten"}
            </button>
            <button onClick={stopCamera} className="secondary">
              Kamera stoppen
            </button>
          </>
        )}
        
        {onClose && (
          <button onClick={() => {
            stopCamera();
            if (onClose) onClose();
          }} className="secondary">
            Schließen
          </button>
        )}
      </div>
    </div>
  );
};

export default Camera;
