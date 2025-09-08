import { useState, useEffect, useRef, useCallback } from 'react';
import { ScannerService, ScannerOptions, CameraManager } from 'qr-scanner-library';
import startIconUrl from '@/icons/start.svg';
import stopIconUrl from '@/icons/stop.svg';

interface CameraProps {
  onScanComplete: (data: string) => void;
}


const Camera = ({ onScanComplete }: CameraProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  // Removed verbose status UI; keep logic minimal
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isLoadingCameras, setIsLoadingCameras] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerServiceRef = useRef<ScannerService | null>(null);
  const hasAutoStartedRef = useRef<boolean>(false);

  const handleScanSuccess = useCallback((result: string) => {
    setError('');
    if (scannerServiceRef.current) {
      scannerServiceRef.current.stop();
      scannerServiceRef.current = null;
    }
    setIsScanning(false);
    onScanComplete(result);
  }, [onScanComplete]);

  const handleError = useCallback((err: Error) => {
    setError(err.message || 'Unbekannter Fehler beim Scannen');
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async (deviceIdOverride?: string) => {
    if (!videoRef.current) {
      setError('Video-Element ist nicht verfügbar.');
      return;
    }
    if (isScanning) return;

    let deviceIdToUse = deviceIdOverride ?? selectedDeviceId;
    if (!deviceIdToUse && devices.length > 0) {
      deviceIdToUse = devices[0].deviceId;
    }

    setError('');
    setIsScanning(true);

    if (scannerServiceRef.current) {
      scannerServiceRef.current.stop();
      scannerServiceRef.current = null;
    }

    const options: ScannerOptions = {
      videoElement: videoRef.current,
      deviceId: deviceIdToUse,
      onScanSuccess: handleScanSuccess,
      onError: handleError,
      stopOnScan: true
    };

    try {
      scannerServiceRef.current = new ScannerService(options);
      await scannerServiceRef.current.start();
    } catch (err) {
      handleError(err as Error);
      setIsScanning(false);
    }
  }, [devices, handleError, handleScanSuccess, isScanning, selectedDeviceId]);

  const stopScanner = useCallback(() => {
    if (scannerServiceRef.current) {
      scannerServiceRef.current.stop();
      scannerServiceRef.current = null;
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const primeAndList = async () => {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          tmp.getTracks().forEach(t => t.stop());
        }
      } catch {
        // Ignoriere Permission-Fehler beim Priming
      }
      setIsLoadingCameras(true);
      try {
        if (!('mediaDevices' in navigator) || typeof navigator.mediaDevices.enumerateDevices !== 'function') {
          if (cancelled) return;
          setDevices([]);
          setSelectedDeviceId('');
          setError('');
          return;
        }
        const videoDevices = await CameraManager.listDevices();
        if (cancelled) return;
        setDevices(videoDevices);
        setSelectedDeviceId(videoDevices[0]?.deviceId ?? '');
        setError('');
      } catch (err) {
        if (cancelled) return;
        setDevices([]);
        setSelectedDeviceId('');
        setError('');
      } finally {
        if (!cancelled) setIsLoadingCameras(false);
      }
    };

    primeAndList();
    return () => {
      cancelled = true;
      if (scannerServiceRef.current) {
        scannerServiceRef.current.stop();
        scannerServiceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoadingCameras && devices.length > 0 && !isScanning && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      void startScanner(selectedDeviceId || devices[0].deviceId);
    }
  }, [isLoadingCameras, devices, isScanning, selectedDeviceId, startScanner]);

  return (
    <div className="camera-container">
      <div className="controls-row">
        <select
          id="camera-select"
          value={selectedDeviceId}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedDeviceId(id);
            if (isScanning) {
              stopScanner();
            }
            void startScanner(id);
          }}
          disabled={isLoadingCameras || devices.length === 0}
          aria-label="Kamera auswählen"
          className="camera-select"
        >
          {isLoadingCameras && <option>Kameras werden geladen...</option>}
          {!isLoadingCameras && devices.length === 0 && <option>Keine Kameras gefunden</option>}
          {devices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || 'Kamera'}</option>
          ))}
        </select>
        <div className="action-buttons">
          <button
            onClick={() => isScanning ? stopScanner() : void startScanner()}
            className={`icon-button ${isScanning ? 'default' : 'secondary'}`}
            aria-label={isScanning ? 'Scan stoppen' : 'Scan starten'}
            title={isScanning ? 'Scan stoppen' : 'Scan starten'}
            disabled={isLoadingCameras}
          >
            {isScanning ? (
              <img src={stopIconUrl} width={24} height={24} alt="Stop" />
            ) : (
              <img src={startIconUrl} width={24} height={24} alt="Start" />
            )}
          </button>
          {/* Single CTA only, as in qr-scanner-client */}
        </div>
      </div>

      <video
        ref={videoRef}
        className="camera-video"
        style={{ width: '100%', borderRadius: '8px' }}
        playsInline
        muted
        autoPlay
      />

      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default Camera;
