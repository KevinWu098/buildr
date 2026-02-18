import * as tf from "@tensorflow/tfjs";

const MODEL_URL = "/yolo-model/model.json";
const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.5;

export const CLASS_NAMES: Record<number, string> = {
  0: "cpu_socket",
  1: "ram_slots",
  2: "ram_module",
  3: "cpu",
};

export const CLASS_COLORS: Record<number, [number, number, number]> = {
  0: [255, 107, 107], // cpu_socket - red
  1: [78, 205, 196], // ram_slots - teal
  2: [69, 183, 209], // ram_module - blue
  3: [255, 160, 122], // cpu - salmon
};

export interface Detection {
  bbox: [number, number, number, number]; // x1, y1, x2, y2 in model input space (640x640)
  classId: number;
  className: string;
  confidence: number;
  maskCoeffs: number[]; // 32 mask coefficients
}

let model: tf.GraphModel | null = null;
let firstFrame = true;

export async function loadModel(): Promise<tf.GraphModel> {
  if (model) return model;
  await tf.setBackend("webgl");
  await tf.ready();
  model = await tf.loadGraphModel(MODEL_URL);

  // Warmup with dummy tensor to compile WebGL shaders
  const dummy = tf.zeros<tf.Rank.R4>([1, INPUT_SIZE, INPUT_SIZE, 3]);
  const warmupResult = model.predict(dummy);
  if (Array.isArray(warmupResult)) {
    warmupResult.forEach((t) => t.dispose());
  } else {
    (warmupResult as tf.Tensor).dispose();
  }
  dummy.dispose();

  firstFrame = true;
  return model;
}

export function disposeModel(): void {
  if (model) {
    model.dispose();
    model = null;
  }
}

/**
 * Preprocess a video frame into a [1, 640, 640, 3] float32 tensor normalized to [0, 1].
 * Uses an offscreen canvas to resize the frame to the model's expected input size.
 */
export function preprocessFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): tf.Tensor4D {
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0, INPUT_SIZE, INPUT_SIZE);

  return tf.tidy(() => {
    return tf.browser
      .fromPixels(canvas)
      .toFloat()
      .div(255.0)
      .expandDims(0) as tf.Tensor4D;
  });
}

/**
 * Run inference and return detections + prototype mask tensor.
 * The proto mask tensor is NOT disposed here — the caller must dispose it after rendering.
 */
export async function runInference(
  inputTensor: tf.Tensor4D,
): Promise<{ detections: Detection[]; protoMasks: tf.Tensor | null }> {
  if (!model) throw new Error("Model not loaded");

  // Request specific output tensors by name
  const results = (await model.executeAsync(inputTensor, [
    "Identity:0",
    "Identity_1:0",
  ])) as tf.Tensor[];

  // Log shapes on first frame for debugging
  if (firstFrame) {
    console.log("[YOLO] Output tensor shapes:");
    results.forEach((t, i) =>
      console.log(`  output[${i}]: [${t.shape.join(", ")}]`),
    );
    console.log("[YOLO] TF.js memory:", tf.memory());
    firstFrame = false;
  }

  // Identify which tensor is detections vs proto masks by shape
  let detTensor: tf.Tensor;
  let protoTensor: tf.Tensor;

  if (results[0].shape.length === 3) {
    // [1, 300, 38] = detections
    detTensor = results[0];
    protoTensor = results[1];
  } else {
    // Fallback: check the other way
    detTensor = results[1];
    protoTensor = results[0];
  }

  const detections = parseDetections(detTensor);

  // Dispose detection tensor, keep proto masks for rendering
  detTensor.dispose();

  // If no detections, dispose proto masks too
  if (detections.length === 0) {
    protoTensor.dispose();
    return { detections, protoMasks: null };
  }

  return { detections, protoMasks: protoTensor };
}

/**
 * Parse the detection tensor into Detection objects.
 * YOLO26 end2end seg output: [1, 300, 38]
 *   - 4 bbox coords (x1, y1, x2, y2)
 *   - 1 confidence score
 *   - 1 class id
 *   - 32 mask coefficients
 */
function parseDetections(detTensor: tf.Tensor): Detection[] {
  const data = detTensor.dataSync();
  const shape = detTensor.shape;
  const numDetections = shape[1] ?? 0;
  const stride = shape[2] ?? 0;

  const detections: Detection[] = [];

  for (let i = 0; i < numDetections; i++) {
    const offset = i * stride;
    const confidence = data[offset + 4];

    if (confidence < CONFIDENCE_THRESHOLD) continue;

    const x1 = data[offset];
    const y1 = data[offset + 1];
    const x2 = data[offset + 2];
    const y2 = data[offset + 3];
    const classId = Math.round(data[offset + 5]);

    // Skip detections with zero-area boxes
    if (x2 <= x1 || y2 <= y1) continue;

    const maskCoeffs: number[] = [];
    for (let j = 6; j < stride; j++) {
      maskCoeffs.push(data[offset + j]);
    }

    detections.push({
      bbox: [x1, y1, x2, y2],
      classId,
      className: CLASS_NAMES[classId] ?? `class_${classId}`,
      confidence,
      maskCoeffs,
    });
  }

  return detections;
}

export { INPUT_SIZE, CONFIDENCE_THRESHOLD };
