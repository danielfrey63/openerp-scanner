import { BrowserQRCodeReader } from '@zxing/browser';

interface QRCodeScannerProps {
  onScanComplete: (data: string) => void;
}

// Klasse für QR-Code-Scanning-Funktionalität
export class QRCodeScanner {
  private reader: BrowserQRCodeReader;

  constructor() {
    this.reader = new BrowserQRCodeReader();
  }

  // Scannt einen QR-Code aus einem Bild-URL
  async scanFromImageUrl(imageUrl: string): Promise<string | null> {
    try {
      const result = await this.reader.decodeFromImageUrl(imageUrl);
      return result ? result.getText() : null;
    } catch (error) {
      console.error('Error scanning QR code from image:', error);
      return null;
    }
  }

  // Scannt einen QR-Code aus einem File-Objekt
  async scanFromFile(file: File): Promise<string | null> {
    try {
      const imageUrl = URL.createObjectURL(file);
      const result = await this.scanFromImageUrl(imageUrl);
      URL.revokeObjectURL(imageUrl); // Aufräumen
      return result;
    } catch (error) {
      console.error('Error scanning QR code from file:', error);
      return null;
    }
  }

  // Startet das Scannen von der Kamera
  async startScanningFromCamera(
    videoElement: HTMLVideoElement,
    onScan: (result: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      await this.reader.decodeFromVideoDevice(
        // 'environment' für die Rückkamera auf Mobilgeräten
        'environment', 
        videoElement,
        (result, error) => {
          if (result) {
            onScan(result.getText());
          }
          if (error && !(error instanceof TypeError)) {
            // TypeError wird oft geworfen, wenn das Scannen beendet wird
            onError(error);
          }
        }
      );
    } catch (error) {
      console.error('Error starting camera scan:', error);
      onError(error instanceof Error ? error : new Error('Unknown error starting camera'));
    }
  }

  // Stoppt das Scannen
  stopScanning(): void {
    this.reader.reset();
  }
}

// Singleton-Instanz für einfachen Zugriff
export const qrCodeScanner = new QRCodeScanner();

// React-Komponente für QR-Code-Scanning (falls benötigt)
const QRCodeScannerComponent: React.FC<QRCodeScannerProps> = ({ onScanComplete }) => {
  return null; // Placeholder, falls wir eine UI-Komponente benötigen
};

export default QRCodeScannerComponent;
