import type { CV as TechStarkOpenCv } from "@techstark/opencv-js";

// PaddleOCR.js 0.4.2 imports the former OpenCv type name. Its dependency
// exports the equivalent public type as CV.
declare module "@techstark/opencv-js" {
  export type OpenCv = TechStarkOpenCv;
}
