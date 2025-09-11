import { ChangeEvent, useState, useRef, useEffect } from 'react';

interface FileUploadProps {
  onScanComplete: (data: string) => void;
}

// onScanComplete is currently unused since upload scanning is deprecated; prefix with _ to satisfy TS noUnusedParameters
const FileUpload = ({ onScanComplete: _onScanComplete }: FileUploadProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError('');

    try {
      // Upload-basiertes Scannen ist veraltet. Bitte Kamera verwenden.
      setError('Upload-Scanning ist nicht mehr verfügbar. Bitte verwenden Sie die Kamera.');
    } catch (err) {
      console.error('QR-Code Scan Fehler:', err);
      setError('Fehler beim Scannen des QR-Codes');
    } finally {
      setIsProcessing(false);
      // Reset the input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  useEffect(() => {
    // Sofort den Dateidialog öffnen
    setTimeout(triggerFileInput, 100);
  }, []);

  return (
    <>
      {isProcessing ? (
        <div>Verarbeite Bild...</div>
      ) : (
        <>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            ref={fileInputRef}
          />
          {error && (
            <div className="error-container">
              <div className="error">{error}</div>
              <button onClick={triggerFileInput}>
                Erneut versuchen
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default FileUpload;
