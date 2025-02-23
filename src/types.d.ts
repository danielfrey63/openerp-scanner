declare module '@zxing/browser' {
  interface BrowserMultiFormatReader {
    reset(): void;
  }
}

interface MediaStreamConstraints {
  facingMode?: string;
}