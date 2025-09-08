// Deprecated stub to keep compatibility while removing ZXing.
// This module is no longer used. All scanning is handled by qr-scanner-library via Camera component.
export class QRCodeScanner {
  async scanFromImageUrl(_imageUrl: string): Promise<string | null> {
    console.warn('[QRCodeScanner] Deprecated: scanFromImageUrl');
    return null;
  }
  async scanFromFile(_file: File): Promise<string | null> {
    console.warn('[QRCodeScanner] Deprecated: scanFromFile');
    return null;
  }
  async startScanningFromCamera(_videoElement: HTMLVideoElement, _onScan: (result: string) => void, _onError: (error: Error) => void): Promise<void> {
    console.warn('[QRCodeScanner] Deprecated: startScanningFromCamera');
  }
  stopScanning(): void {
    console.warn('[QRCodeScanner] Deprecated: stopScanning');
  }
}

export const qrCodeScanner = new QRCodeScanner();
export default QRCodeScanner;
