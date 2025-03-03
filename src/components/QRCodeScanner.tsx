import { BarcodeFormat, BrowserMultiFormatReader, DecodeHintType } from '@zxing/library';

// Klasse für QR-Code-Scanning-Funktionalität
export class QRCodeScanner {
  private reader: BrowserMultiFormatReader;

  constructor() {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    this.reader = new BrowserMultiFormatReader(hints);
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
      // Versuche zuerst mit der Umgebungskamera (hinten)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Wenn keine Kamera gefunden wurde
      if (videoDevices.length === 0) {
        throw new Error('Keine Kamera gefunden');
      }

      // Versuche verschiedene Kamera-Einstellungen
      let deviceId = 'environment'; // Standard: Umgebungskamera
      
      // Versuche mit der Standardeinstellung
      try {
        await this.reader.decodeFromVideoDevice(
          deviceId, 
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
        return; // Erfolgreich
      } catch (e) {
        console.log('Erster Versuch fehlgeschlagen, versuche andere Kameras');
        // Erster Versuch fehlgeschlagen, versuche andere Optionen
      }

      // Versuche mit der ersten verfügbaren Kamera
      try {
        await this.reader.decodeFromVideoDevice(
          videoDevices[0].deviceId, 
          videoElement,
          (result, error) => {
            if (result) {
              onScan(result.getText());
            }
            if (error && !(error instanceof TypeError)) {
              onError(error);
            }
          }
        );
        return; // Erfolgreich
      } catch (e) {
        console.log('Zweiter Versuch fehlgeschlagen, versuche ohne deviceId');
        // Zweiter Versuch fehlgeschlagen, versuche ohne deviceId
      }

      // Letzter Versuch: Ohne deviceId
      await this.reader.decodeFromVideoDevice(
        null, // Verwende null statt undefined
        videoElement,
        (result, error) => {
          if (result) {
            onScan(result.getText());
          }
          if (error && !(error instanceof TypeError)) {
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
    try {
      // Beende alle Video-Streams
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach(video => {
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          video.srcObject = null;
        }
      });
    } catch (error) {
      console.error('Error stopping QR scanner:', error);
    }
  }
}

// Singleton-Instanz für einfachen Zugriff
export const qrCodeScanner = new QRCodeScanner();

export default QRCodeScanner;
