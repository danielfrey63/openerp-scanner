declare module '@/components/FileUpload' {
  import { FC } from 'react';
  
  interface FileUploadProps {
    onScanComplete: (data: string) => void;
  }

  const FileUpload: FC<FileUploadProps>;
  export default FileUpload;
}

declare module '@/components/Camera' {
  import { FC } from 'react';
  
  interface CameraProps {
    onScanComplete: (data: string) => void;
  }

  const Camera: FC<CameraProps>;
  export default Camera;
}

declare module '@/components/QRCodeScanner' {
  export class QRCodeScanner {
    scanFromImageUrl(imageUrl: string): Promise<string | null>;
    scanFromFile(file: File): Promise<string | null>;
    startScanningFromCamera(
      videoElement: HTMLVideoElement,
      onScan: (result: string) => void,
      onError: (error: Error) => void
    ): Promise<void>;
    stopScanning(): void;
  }

  export const qrCodeScanner: QRCodeScanner;
  
  interface QRCodeScannerProps {
    onScanComplete: (data: string) => void;
  }

  const QRCodeScannerComponent: React.FC<QRCodeScannerProps>;
  export default QRCodeScannerComponent;
}
