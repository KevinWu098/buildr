"""
WebRTC Server for YOLO PC Component Segmentation.

Receives video stream from the client (phone camera),
processes it with YOLO segmentation to detect PC components,
and sends back the annotated video stream.

Usage:
    cd server
    uv run python main.py
    uv run python main.py --weights epoch55.pt --conf 0.6
"""

import argparse
import asyncio
import time
from pathlib import Path

import aiohttp_cors
import cv2
import numpy as np
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.contrib.media import MediaRelay
from av import VideoFrame

# Try to import YOLO, fall back to mock mode if not available
try:
    from ultralytics import YOLO

    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("[warn] ultralytics not installed, running in mock mode")

# Global state
pcs = set()
relay = MediaRelay()


def load_class_names(classes_path: str | None) -> list[str] | None:
    """Load class names from a text file."""
    if not classes_path:
        return None
    p = Path(classes_path)
    if not p.exists():
        print(f"[warn] classes file not found: {p}")
        return None
    names = []
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if line:
            names.append(line)
    return names if names else None


class VideoTransformTrack(VideoStreamTrack):
    """
    A video stream track that transforms frames using YOLO segmentation.
    Detects PC components and draws bounding boxes + segmentation masks.
    """

    kind = "video"

    def __init__(self, track, model, class_names, args):
        super().__init__()
        self.track = track
        self.model = model
        self.class_names = class_names
        self.args = args
        self.last_t = time.time()
        self.fps = 0.0
        self.frame_count = 0

    async def recv(self):
        frame = await self.track.recv()
        self.frame_count += 1

        # Convert from VideoFrame to numpy array (BGR)
        img = frame.to_ndarray(format="bgr24")

        if self.model is not None:
            # Run YOLO inference
            results = self.model.predict(
                source=img,
                imgsz=self.args.imgsz,
                conf=self.args.conf,
                device=self.args.device,
                max_det=self.args.max_det,
                verbose=False,
            )
            r = results[0]

            # Debug output for detections
            num_det = len(r.boxes) if r.boxes is not None else 0
            if num_det > 0 and self.frame_count % 30 == 0:  # Log every 30 frames
                print(f"[DETECTED] {num_det} objects:")
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    name = (
                        self.class_names[cls_id]
                        if self.class_names and cls_id < len(self.class_names)
                        else str(cls_id)
                    )
                    print(f"  - {name}: {conf:.2f}")

            # Use YOLO's built-in visualization
            vis = r.plot()
        else:
            # Mock mode: just add a border to show processing is working
            vis = img.copy()
            cv2.rectangle(vis, (5, 5), (vis.shape[1] - 5, vis.shape[0] - 5), (0, 255, 0), 3)
            cv2.putText(
                vis,
                "MOCK MODE - No YOLO Model",
                (20, 60),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 255),
                2,
            )

        # FPS calculation
        now = time.time()
        dt = now - self.last_t
        self.last_t = now
        if dt > 0:
            self.fps = 0.9 * self.fps + 0.1 * (1.0 / dt) if self.fps > 0 else (1.0 / dt)

        # Overlay status
        status = f"FPS: {self.fps:.1f}"
        if self.model is not None:
            status += f" | conf={self.args.conf}"
        cv2.putText(vis, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        # Convert back to VideoFrame
        new_frame = VideoFrame.from_ndarray(vis, format="bgr24")
        new_frame.pts = frame.pts
        new_frame.time_base = frame.time_base

        return new_frame


async def index(request):
    """Serve the test page for browser testing."""
    content = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PC-EZ WebRTC Test</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif; 
            background: linear-gradient(135deg, #0c0c1e 0%, #1a1a3e 50%, #0f0f2a 100%);
            color: #e4e4f7; 
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { 
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #00d4ff, #7c3aed);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 8px;
        }
        .subtitle { color: #8888aa; margin-bottom: 24px; }
        .info { 
            background: rgba(124, 58, 237, 0.1); 
            border: 1px solid rgba(124, 58, 237, 0.3);
            padding: 16px; 
            border-radius: 12px; 
            margin-bottom: 24px;
            font-size: 0.9rem;
        }
        .info code { 
            background: rgba(0, 212, 255, 0.2); 
            padding: 2px 6px; 
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, monospace;
        }
        .controls { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        button { 
            background: linear-gradient(135deg, #7c3aed, #5b21b6);
            color: white; 
            border: none; 
            padding: 14px 28px; 
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer; 
            border-radius: 10px;
            transition: all 0.2s;
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
        }
        button:hover { 
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(124, 58, 237, 0.4);
        }
        button:disabled { 
            opacity: 0.5; 
            cursor: not-allowed;
            transform: none;
        }
        button.stop { 
            background: linear-gradient(135deg, #ef4444, #dc2626);
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
        }
        button.stop:hover {
            box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
        }
        #videos { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px; 
        }
        .video-container { 
            background: rgba(20, 20, 40, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .video-container h3 { 
            padding: 16px 20px;
            font-size: 0.9rem;
            font-weight: 600;
            color: #00d4ff;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .video-container h3::before {
            content: '';
            width: 8px;
            height: 8px;
            background: #00d4ff;
            border-radius: 50%;
        }
        video { 
            width: 100%; 
            aspect-ratio: 4/3;
            object-fit: cover;
            background: #000;
        }
        #status { 
            margin-top: 24px;
            padding: 16px 20px;
            background: rgba(20, 20, 40, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        #status strong { color: #00d4ff; }
        .processing { color: #10b981; }
        .disconnected { color: #8888aa; }
    </style>
</head>
<body>
    <div class="container">
        <h1>PC-EZ Vision Test</h1>
        <p class="subtitle">WebRTC YOLO Component Detection</p>
        
        <div class="info">
            <p>Testing YOLO segmentation for PC components. 
            Detects: <code>cpu</code>, <code>cpu_socket</code>, <code>cooler</code>, 
            <code>ram</code>, <code>ram_slots</code></p>
        </div>
        
        <div class="controls">
            <button id="start">Start Camera</button>
            <button id="stop" class="stop" disabled>Stop</button>
        </div>
        
        <div id="videos">
            <div class="video-container">
                <h3>Local Camera</h3>
                <video id="localVideo" autoplay playsinline muted></video>
            </div>
            <div class="video-container">
                <h3>YOLO Processed</h3>
                <video id="remoteVideo" autoplay playsinline></video>
            </div>
        </div>
        
        <div id="status">
            <strong>Status:</strong> <span id="statusText" class="disconnected">Disconnected</span>
        </div>
    </div>
    
    <script>
        let pc = null;
        let localStream = null;
        const statusEl = document.getElementById('statusText');

        document.getElementById('start').addEventListener('click', start);
        document.getElementById('stop').addEventListener('click', stop);

        function updateStatus(text, className) {
            statusEl.textContent = text;
            statusEl.className = className || '';
        }

        async function start() {
            document.getElementById('start').disabled = true;
            document.getElementById('stop').disabled = false;
            updateStatus('Requesting camera access...');

            try {
                // Get user media with environment camera preference (for phone back camera)
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: { ideal: 'environment' }
                    },
                    audio: false
                });
                document.getElementById('localVideo').srcObject = localStream;
                updateStatus('Camera active, connecting to server...');

                // Create peer connection
                pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });

                // Add local tracks
                localStream.getTracks().forEach(track => {
                    pc.addTrack(track, localStream);
                });

                // Handle remote tracks (processed video from server)
                pc.ontrack = (event) => {
                    document.getElementById('remoteVideo').srcObject = event.streams[0];
                    updateStatus('Connected - Processing video with YOLO', 'processing');
                };

                pc.onconnectionstatechange = () => {
                    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                        updateStatus('Connection lost', 'disconnected');
                    }
                };

                // Create offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                // Wait for ICE gathering to complete
                await new Promise((resolve) => {
                    if (pc.iceGatheringState === 'complete') {
                        resolve();
                    } else {
                        pc.addEventListener('icegatheringstatechange', () => {
                            if (pc.iceGatheringState === 'complete') {
                                resolve();
                            }
                        });
                    }
                });

                // Send offer to server
                const response = await fetch('/offer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sdp: pc.localDescription.sdp,
                        type: pc.localDescription.type
                    })
                });

                const answer = await response.json();
                await pc.setRemoteDescription(new RTCSessionDescription(answer));

            } catch (err) {
                console.error('Error:', err);
                updateStatus('Error: ' + err.message, 'disconnected');
                stop();
            }
        }

        async function stop() {
            document.getElementById('start').disabled = false;
            document.getElementById('stop').disabled = true;

            if (pc) {
                pc.close();
                pc = null;
            }
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
            }
            document.getElementById('localVideo').srcObject = null;
            document.getElementById('remoteVideo').srcObject = null;
            updateStatus('Disconnected', 'disconnected');
        }
    </script>
</body>
</html>
    """
    return web.Response(content_type="text/html", text=content)


async def offer(request):
    """Handle WebRTC offer from client."""
    params = await request.json()
    offer_desc = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print(f"[webrtc] Connection state: {pc.connectionState}")
        if pc.connectionState in ("failed", "closed"):
            await pc.close()
            pcs.discard(pc)

    @pc.on("track")
    def on_track(track):
        print(f"[webrtc] Track received: {track.kind}")
        if track.kind == "video":
            local_video = VideoTransformTrack(
                relay.subscribe(track),
                request.app["model"],
                request.app["class_names"],
                request.app["args"],
            )
            pc.addTrack(local_video)

    await pc.setRemoteDescription(offer_desc)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.json_response(
        {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
    )


async def health(request):
    """Health check endpoint."""
    return web.json_response({"status": "ok", "yolo_available": YOLO_AVAILABLE})


async def on_shutdown(app):
    """Cleanup on shutdown."""
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()


def main():
    ap = argparse.ArgumentParser(description="WebRTC YOLO Server for PC-EZ")
    ap.add_argument(
        "--weights",
        type=str,
        default="epoch55.pt",
        help="Path to YOLO segmentation weights.",
    )
    ap.add_argument("--classes", type=str, default="classes.txt", help="classes.txt file.")
    ap.add_argument("--imgsz", type=int, default=640, help="Inference image size.")
    ap.add_argument("--conf", type=float, default=0.6, help="Confidence threshold.")
    ap.add_argument("--device", type=str, default="0", help="Device (0 for GPU, cpu for CPU).")
    ap.add_argument("--max_det", type=int, default=10, help="Max detections per frame.")
    ap.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind to.")
    ap.add_argument("--port", type=int, default=8080, help="Port to bind to.")
    ap.add_argument("--mock", action="store_true", help="Run in mock mode without YOLO.")
    args = ap.parse_args()

    model = None
    class_names = None

    if not args.mock and YOLO_AVAILABLE:
        weights_path = Path(args.weights)
        if weights_path.exists():
            print(f"[info] Loading model: {weights_path}")
            model = YOLO(str(weights_path))
            class_names = load_class_names(args.classes)
            if class_names:
                print(f"[info] Classes: {class_names}")
        else:
            print(f"[warn] Weights not found: {weights_path.resolve()}, running in mock mode")
    else:
        print("[info] Running in mock mode (no YOLO processing)")

    app = web.Application()
    app["model"] = model
    app["class_names"] = class_names
    app["args"] = args

    # Setup CORS for cross-origin requests from Next.js app
    cors = aiohttp_cors.setup(
        app,
        defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods=["GET", "POST", "OPTIONS"],
            )
        },
    )

    app.on_shutdown.append(on_shutdown)

    # Add routes with CORS
    cors.add(app.router.add_get("/", index))
    cors.add(app.router.add_post("/offer", offer))
    cors.add(app.router.add_get("/health", health))

    print(f"[info] Starting WebRTC server on http://{args.host}:{args.port}")
    print(f"[info] Open http://localhost:{args.port} in browser to test")
    print(f"[info] Settings: weights={args.weights}, conf={args.conf}, imgsz={args.imgsz}")
    if model is None:
        print("[info] ⚠️  Running in MOCK mode - video will show green border, no YOLO")

    web.run_app(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()


