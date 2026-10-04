import type { Route } from "../types";

/**
 * Returns a high-definition, authentic WebP route background image.
 * Uses explicitly assigned route.imageUrl if available,
 * otherwise selects the matching regional corridor visual.
 */
export function getRouteImage(route?: Partial<Route> | null): string {
  if (route?.imageUrl && route.imageUrl.trim()) {
    return route.imageUrl;
  }

  const dest = (route?.destination || "").toLowerCase();
  const orig = (route?.origin || "").toLowerCase();
  const name = (route?.name || "").toLowerCase();
  const text = `${orig} ${dest} ${name}`;

  if (text.includes("kandy")) {
    return "/images/routes/kandy.webp";
  }
  if (
    text.includes("galle") ||
    text.includes("matara") ||
    text.includes("hambantota") ||
    text.includes("southern")
  ) {
    return "/images/routes/galle.webp";
  }
  if (
    text.includes("jaffna") ||
    text.includes("vavuniya") ||
    text.includes("mannar") ||
    text.includes("yal devi")
  ) {
    return "/images/routes/jaffna.webp";
  }
  if (
    text.includes("ella") ||
    text.includes("badulla") ||
    text.includes("nuwara eliya") ||
    text.includes("bandarawela") ||
    text.includes("tea trail")
  ) {
    return "/images/routes/ella.webp";
  }
  if (
    text.includes("trincomalee") ||
    text.includes("batticaloa") ||
    text.includes("eastern")
  ) {
    return "/images/routes/trincomalee.webp";
  }
  if (
    text.includes("anuradhapura") ||
    text.includes("sigiriya") ||
    text.includes("dambulla") ||
    text.includes("polonnaruwa") ||
    text.includes("cultural")
  ) {
    return "/images/routes/cultural-triangle.webp";
  }
  if (dest.includes("colombo")) {
    return "/images/routes/colombo.webp";
  }
  return "/images/routes/expressway.webp";
}

export interface OptimizedWebPResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  optimizedSize: number;
  width: number;
  height: number;
}

/**
 * Optimizes an uploaded image file into a pristine, high-definition WebP file.
 * Resizes overly massive photos to max HD bounds (1920x1080 standard) using high-quality
 * interpolation, encoding as WebP at 0.90 quality for visually lossless performance.
 */
export async function optimizeImageToWebP(
  inputFile: File,
  maxDimension = 1920,
  quality = 0.90
): Promise<OptimizedWebPResult> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(inputFile);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { naturalWidth: width, naturalHeight: height } = img;

      // Scale dimensions if larger than maxDimension while preserving aspect ratio
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not initialize 2D canvas context."));
        return;
      }

      // Premium smoothing settings
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/webp", quality);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas WebP conversion failed."));
            return;
          }

          const baseName = inputFile.name.replace(/\.[^/.]+$/, "");
          const optimizedFile = new File([blob], `${baseName}.webp`, {
            type: "image/webp",
          });

          resolve({
            file: optimizedFile,
            dataUrl,
            originalSize: inputFile.size,
            optimizedSize: blob.size,
            width,
            height,
          });
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read image file for WebP optimization."));
    };

    img.src = objectUrl;
  });
}
