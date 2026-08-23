/// <reference types="vite/client" />

declare module '@tensorflow-models/coco-ssd' {
  export function load(config?: Record<string, unknown>): Promise<{
    detect(
      img: unknown,
      maxBoxes?: number,
      minScore?: number,
    ): Promise<Array<{ class: string; score: number; bbox: number[] }>>;
  }>;
}

declare module '@tensorflow/tfjs' {}

declare module 'tesseract.js' {
  export function createWorker(options?: Record<string, unknown>): Promise<{
    recognize(img: unknown): Promise<{ data: { text?: string } }>;
    terminate(): Promise<void>;
  }>;
}
