import { useState, useEffect, useRef } from 'react';
import { qrCodeScanner } from './QRCodeScanner';

interface CameraProps {
  onScanComplete: (data: string) => void;
}

const Camera = ({ onScanComplete }: CameraProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Starte das Scannen, wenn die Komponente gemountet wird
    startScanning();

    // Cleanup beim Unmount
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    if (!videoRef.current) return;
    
    setIsScanning(true);
    setError('');

    try {
      await qrCodeScanner.startScanningFromCamera(
        videoRef.current,
        (result) => {
          onScanComplete(result);
          stopScanning();
        },
        (error) => {
          console.error('Camera error:', error);
          setError('Fehler bei der Kamera: ' + error.message);
          setIsScanning(false);
        }
      );
    } catch (err) {
      console.error('Failed to start camera:', err);
      setError('Kamera konnte nicht gestartet werden');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    qrCodeScanner.stopScanning();
    setIsScanning(false);
  };

  return (
    <div className="camera-container">
      <video 
        ref={videoRef} 
        className="camera-video"
        style={{ width: '100%', borderRadius: '8px' }}
      />
      {error && <div className="error">{error}</div>}
      {!isScanning && (
        <button onClick={startScanning} className="default">
          Kamera starten
        </button>
      )}
    </div>
  );
};

export default Camera;
