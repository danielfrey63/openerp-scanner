import { useState, useEffect, useRef } from 'react';
import { qrCodeScanner } from './QRCodeScanner';

interface CameraProps {
  onScanComplete: (data: string) => void;
  onClose?: () => void;
}

const Camera = ({ onScanComplete, onClose }: CameraProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      console.error('Kamera konnte nicht gestartet werden:', err);
      setError('Kamera konnte nicht gestartet werden: ' + errorMessage);
      setIsScanning(false);
    }
  };

  // Stoppe die Kamera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  };

  // Mache ein Foto und scanne nach QR-Code
  const takePhoto = async () => {
    if (!videoRef.current || !isScanning) return;
    
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
        // Rufe den Callback auf
        onScanComplete(result);
        
        // Stoppe die Kamera (optional, je nach Anforderung)
        // stopCamera();
        
        // Schließe die Kamera-Komponente (optional, je nach Anforderung)
        // if (onClose) onClose();
      } else {
        setError('Kein QR-Code im Bild gefunden');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
      console.error('Fehler beim Scannen:', err);
      setError('Fehler beim Scannen: ' + errorMessage);
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
      
      <div className="camera-controls">
        {isScanning && (
          <>
            <button onClick={takePhoto} className="default">
              Foto aufnehmen
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
