import type { CV as TechStarkOpenCv } from "@techstark/opencv-js";

// PaddleOCR.js 0.4.2 imports the old OpenCv type name, while its pinned
// @techstark/opencv-js dependency exports the equivalent type as CV.
declare module "@techstark/opencv-js" {
  export type OpenCv = TechStarkOpenCv;
}
