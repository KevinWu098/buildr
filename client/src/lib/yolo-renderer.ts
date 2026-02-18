import * as tf from "@tensorflow/tfjs";
import type { Detection } from "./yolo";
import { CLASS_COLORS, INPUT_SIZE } from "./yolo";

/**
 * Generate and draw segmentation masks for detections onto the canvas.
 * Multiplies each detection's 32 mask coefficients with the [160, 160, 32] prototype masks,
 * applies sigmoid, thresholds at 0.5, crops to bounding box, and renders as a colored overlay.
 */
function drawMasks(
  ctx: CanvasRenderingContext2D,
  detections: Detection[],
  protoMasks: tf.Tensor, // [1, 160, 160, 32]
  scaleX: number,
  scaleY: number,
): void {
  const MASK_SIZE = 160;
  const MASK_THRESHOLD = 0.5;
  const MASK_ALPHA = 0.35;

  // Squeeze batch dim: [160, 160, 32]
  const proto = protoMasks.squeeze([0]) as tf.Tensor3D;
  const protoData = proto.dataSync();
  const numProtos = 32;

  for (const det of detections) {
    const [r, g, b] = CLASS_COLORS[det.classId] ?? [255, 255, 255];
    const coeffs = det.maskCoeffs;

    // Compute mask: [160, 160, 32] @ [32] -> [160, 160], then sigmoid
    // Do this manually for performance (avoid creating tensors per detection)
    const mask = new Float32Array(MASK_SIZE * MASK_SIZE);
    for (let y = 0; y < MASK_SIZE; y++) {
      for (let x = 0; x < MASK_SIZE; x++) {
        let sum = 0;
        const pixOffset = (y * MASK_SIZE + x) * numProtos;
        for (let c = 0; c < numProtos; c++) {
          sum += protoData[pixOffset + c] * coeffs[c];
        }
        // Sigmoid
        mask[y * MASK_SIZE + x] = 1 / (1 + Math.exp(-sum));
      }
    }

    // Map bbox from 640x640 model space to 160x160 mask space
    const [bx1, by1, bx2, by2] = det.bbox;
    const mx1 = Math.max(0, Math.floor((bx1 / INPUT_SIZE) * MASK_SIZE));
    const my1 = Math.max(0, Math.floor((by1 / INPUT_SIZE) * MASK_SIZE));
    const mx2 = Math.min(MASK_SIZE, Math.ceil((bx2 / INPUT_SIZE) * MASK_SIZE));
    const my2 = Math.min(MASK_SIZE, Math.ceil((by2 / INPUT_SIZE) * MASK_SIZE));

    const cropW = mx2 - mx1;
    const cropH = my2 - my1;
    if (cropW <= 0 || cropH <= 0) continue;

    // Create ImageData for the cropped mask region, scaled to display coords
    const dispX = Math.floor(bx1 * scaleX);
    const dispY = Math.floor(by1 * scaleY);
    const dispW = Math.max(1, Math.ceil((bx2 - bx1) * scaleX));
    const dispH = Math.max(1, Math.ceil((by2 - by1) * scaleY));

    // Draw mask using a temporary canvas for proper scaling
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = cropW;
    tmpCanvas.height = cropH;
    const tmpCtx = tmpCanvas.getContext("2d")!;
    const imageData = tmpCtx.createImageData(cropW, cropH);

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const maskVal = mask[(my1 + y) * MASK_SIZE + (mx1 + x)];
        const idx = (y * cropW + x) * 4;
        if (maskVal > MASK_THRESHOLD) {
          imageData.data[idx] = r;
          imageData.data[idx + 1] = g;
          imageData.data[idx + 2] = b;
          imageData.data[idx + 3] = Math.floor(MASK_ALPHA * 255);
        }
      }
    }

    tmpCtx.putImageData(imageData, 0, 0);

    // Scale the cropped mask to display coordinates
    ctx.drawImage(tmpCanvas, dispX, dispY, dispW, dispH);
  }

  proto.dispose();
}

/**
 * Draw bounding boxes with class labels and confidence scores.
 */
function drawBoxes(
  ctx: CanvasRenderingContext2D,
  detections: Detection[],
  scaleX: number,
  scaleY: number,
): void {
  for (const det of detections) {
    const [x1, y1, x2, y2] = det.bbox;
    const sx = x1 * scaleX;
    const sy = y1 * scaleY;
    const sw = (x2 - x1) * scaleX;
    const sh = (y2 - y1) * scaleY;

    const [r, g, b] = CLASS_COLORS[det.classId] ?? [255, 255, 255];
    const color = `rgb(${r}, ${g}, ${b})`;

    // Bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, sw, sh);

    // Label
    const label = `${det.className} ${(det.confidence * 100).toFixed(0)}%`;
    ctx.font = "bold 14px sans-serif";
    const textWidth = ctx.measureText(label).width;

    // Label background
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy - 22, textWidth + 10, 22);

    // Label text
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(label, sx + 5, sy - 6);
  }
}

/**
 * Draw FPS counter in top-left corner.
 */
export function drawFPS(ctx: CanvasRenderingContext2D, fps: number): void {
  ctx.font = "bold 14px monospace";
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, 90, 24);
  ctx.fillStyle = "#00FF00";
  ctx.fillText(`${fps.toFixed(1)} FPS`, 6, 17);
}

/**
 * Main draw function: clears canvas, draws masks, boxes, and FPS.
 */
export function drawDetections(
  ctx: CanvasRenderingContext2D,
  detections: Detection[],
  scaleX: number,
  scaleY: number,
  protoMasks: tf.Tensor | null,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (detections.length === 0) return;

  // Draw segmentation masks first (underneath boxes)
  if (protoMasks) {
    drawMasks(ctx, detections, protoMasks, scaleX, scaleY);
  }

  // Draw bounding boxes and labels on top
  drawBoxes(ctx, detections, scaleX, scaleY);
}
