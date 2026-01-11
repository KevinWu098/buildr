"""
Simple WebRTC server - receives video, runs YOLO, sends back with bboxes.

Usage:
    python webrtc_server2.py
"""

import argparse
import asyncio
from pathlib import Path

import aiohttp_cors
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.contrib.media import MediaRelay
from av import VideoFrame
from ultralytics import YOLO


pcs = set()
relay = MediaRelay()


class YOLOVideoTrack(VideoStreamTrack):
    kind = "video"

    def __init__(self, track, model, conf, imgsz, device):
        super().__init__()
        self.track = track
        self.model = model
        self.conf = conf
        self.imgsz = imgsz
        self.device = device

    async def recv(self):
        frame = await self.track.recv()
        img = frame.to_ndarray(format="bgr24")

        # Run YOLO
        results = self.model.predict(img, conf=self.conf, imgsz=self.imgsz, device=self.device, verbose=False)
        r = results[0]

        # Log detections
        if r.boxes is not None and len(r.boxes) > 0:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                cls_name = r.names[cls_id] if cls_id in r.names else str(cls_id)
                print(f"[DETECT] {cls_name}: {conf:.2f}")

        # Draw bboxes and masks
        annotated = r.plot()

        # Return annotated frame
        new_frame = VideoFrame.from_ndarray(annotated, format="bgr24")
        new_frame.pts = frame.pts
        new_frame.time_base = frame.time_base
        return new_frame


async def index(request):
    return web.Response(content_type="text/html", text="""
<!DOCTYPE html>
<html>
<head><title>YOLO WebRTC</title></head>
<body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding:20px">
<h1>YOLO WebRTC</h1>
<button onclick="start()">Start</button>
<button onclick="stop()">Stop</button>
<br><br>
<video id="local" autoplay muted playsinline style="width:400px;border:1px solid #444"></video>
<video id="remote" autoplay playsinline style="width:640px;border:2px solid #0f0"></video>
<script>
let pc, stream;
async function start() {
    stream = await navigator.mediaDevices.getUserMedia({video:{width:1280,height:720,frameRate:30}, audio:false});
    document.getElementById('local').srcObject = stream;
    pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    stream.getTracks().forEach(t => {
        const sender = pc.addTrack(t, stream);
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        params.encodings[0].maxBitrate = 5000000;
        sender.setParameters(params);
    });
    pc.ontrack = e => document.getElementById('remote').srcObject = e.streams[0];
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise(r => pc.iceGatheringState === 'complete' ? r() : pc.onicecandidate = e => !e.candidate && r());
    const res = await fetch('/offer', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({sdp:pc.localDescription.sdp, type:pc.localDescription.type})});
    await pc.setRemoteDescription(await res.json());
}
function stop() { pc?.close(); stream?.getTracks().forEach(t => t.stop()); }
</script>
</body>
</html>
""")


async def offer(request):
    params = await request.json()
    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("connectionstatechange")
    async def on_state():
        if pc.connectionState in ("failed", "closed"):
            await pc.close()
            pcs.discard(pc)

    @pc.on("track")
    def on_track(track):
        if track.kind == "video":
            pc.addTrack(YOLOVideoTrack(
                relay.subscribe(track),
                request.app["model"],
                request.app["conf"],
                request.app["imgsz"],
                request.app["device"]
            ))

    await pc.setRemoteDescription(RTCSessionDescription(sdp=params["sdp"], type=params["type"]))
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    return web.json_response({"sdp": pc.localDescription.sdp, "type": pc.localDescription.type})


async def on_shutdown(app):
    await asyncio.gather(*[pc.close() for pc in pcs])
    pcs.clear()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", default="epoch65.pt")
    ap.add_argument("--conf", type=float, default=0.6)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--device", default="0")
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8080)
    args = ap.parse_args()

    if not Path(args.weights).exists():
        raise FileNotFoundError(f"Weights not found: {args.weights}")

    print(f"Loading {args.weights}...")
    model = YOLO(args.weights)

    app = web.Application()
    app["model"] = model
    app["conf"] = args.conf
    app["imgsz"] = args.imgsz
    app["device"] = args.device

    cors = aiohttp_cors.setup(app, defaults={"*": aiohttp_cors.ResourceOptions(allow_headers="*", allow_methods="*")})
    app.on_shutdown.append(on_shutdown)
    cors.add(app.router.add_get("/", index))
    cors.add(app.router.add_post("/offer", offer))

    print(f"Server: http://localhost:{args.port}")
    web.run_app(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
