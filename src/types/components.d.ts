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
