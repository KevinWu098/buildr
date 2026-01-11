"""
Simple API for PC assembly video clips
Downloads and returns video clips from YouTube at specific timestamps
"""
import os
import json
import subprocess
import tempfile
import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="PC Video API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUTS_DIR = os.path.join(SCRIPT_DIR, "outputs")
CLIPS_DIR = os.path.join(SCRIPT_DIR, "clips")

# Ensure clips directory exists
os.makedirs(CLIPS_DIR, exist_ok=True)

VIDEO_MAP = {
    "ram": {
        "video_id": "v3J9VtWMEE8",
        "file": "processed_v3J9VtWMEE8.json"
    },
    "cpu": {
        "video_id": "UTKxMAnFHnw", 
        "file": "processed_UTKxMAnFHnw.json"
    },
    "gpu": {
        "video_id": "d9BWuNHYdbU",
        "file": "processed_d9BWuNHYdbU.json"
    }
}


class VideoInfo(BaseModel):
    video_id: str
    title: str
    channel: str
    youtube_url: str
    timestamp_start: float
    timestamp_end: float
    component: str
    clip_url: str


def load_video_data(filename: str) -> dict:
    """Load a specific JSON file"""
    filepath = os.path.join(OUTPUTS_DIR, filename)
    with open(filepath, "r") as f:
        return json.load(f)


def find_component_step(data: dict, component: str) -> dict:
    """Find the first step matching the component with action=insert"""
    for step in data.get("assembly_steps", []):
        if step.get("component", "").lower() == component.lower() and step.get("action") == "insert":
            return step
    for step in data.get("assembly_steps", []):
        if step.get("component", "").lower() == component.lower():
            return step
    return None


def get_clip_filename(video_id: str, start: float, end: float) -> str:
    """Generate a unique filename for the clip"""
    key = f"{video_id}_{start}_{end}"
    return f"clip_{video_id}_{int(start)}_{int(end)}.mp4"


def download_clip(video_id: str, start: float, end: float) -> str:
    """Download a clip from YouTube using yt-dlp and ffmpeg"""
    clip_filename = get_clip_filename(video_id, start, end)
    clip_path = os.path.join(CLIPS_DIR, clip_filename)
    
    # Return cached clip if it exists and is valid (> 10KB)
    if os.path.exists(clip_path) and os.path.getsize(clip_path) > 10000:
        return clip_path
    
    # Remove any corrupted cached file
    if os.path.exists(clip_path):
        os.remove(clip_path)
    
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
    duration = end - start
    
    with tempfile.TemporaryDirectory() as tmpdir:
        temp_video = os.path.join(tmpdir, "full_video.mp4")
        
        # Download full video with yt-dlp
        dl_cmd = [
            "yt-dlp",
            "-f", "best[ext=mp4][height<=720]/best[ext=mp4]/best",
            "-o", temp_video,
            youtube_url
        ]
        
        try:
            print(f"Downloading video {video_id}...")
            result = subprocess.run(dl_cmd, capture_output=True, text=True, timeout=300)
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail=f"Failed to download video: {result.stderr}")
            
            # Extract clip with ffmpeg
            print(f"Extracting clip from {start}s to {end}s...")
            ffmpeg_cmd = [
                "ffmpeg",
                "-y",
                "-ss", str(start),
                "-i", temp_video,
                "-t", str(duration),
                "-c:v", "libx264",
                "-c:a", "aac",
                "-movflags", "+faststart",
                clip_path
            ]
            
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=120)
            if result.returncode != 0:
                raise HTTPException(status_code=500, detail=f"Failed to extract clip: {result.stderr}")
            
            print(f"Clip saved to {clip_path}")
            return clip_path
            
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="Download timed out")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to download clip: {str(e)}")


def get_video_clip(component: str):
    """Get video clip for a component"""
    component_lower = component.lower()
    if component_lower not in VIDEO_MAP:
        raise HTTPException(status_code=404, detail=f"Unknown component: {component}")
    
    data = load_video_data(VIDEO_MAP[component_lower]["file"])
    metadata = data["metadata"]
    step = find_component_step(data, component)
    
    if not step:
        raise HTTPException(status_code=404, detail=f"No installation step found for {component}")
    
    timestamp = step["timestamp"]
    start = timestamp["start"]
    end = timestamp["end"]
    video_id = metadata["video_id"]
    
    # Download the clip
    clip_path = download_clip(video_id, start, end)
    
    return FileResponse(
        clip_path,
        media_type="video/mp4",
        filename=f"{component.lower()}_installation.mp4",
        headers={
            "Content-Disposition": f'attachment; filename="{component.lower()}_installation.mp4"'
        }
    )


@app.get("/")
async def root():
    return {
        "endpoints": {
            "/getRamVideo": "Get RAM installation video clip (mp4)",
            "/getCpuVideo": "Get CPU installation video clip (mp4)",
            "/getGpuVideo": "Get GPU installation video clip (mp4)",
            "/info/{component}": "Get video info without downloading (ram, cpu, gpu)"
        }
    }


@app.get("/getRamVideo")
async def get_ram_video():
    """Get RAM installation video clip"""
    return get_video_clip("RAM")


@app.get("/getCpuVideo")
async def get_cpu_video():
    """Get CPU installation video clip"""
    return get_video_clip("CPU")


@app.get("/getGpuVideo")
async def get_gpu_video():
    """Get GPU installation video clip"""
    return get_video_clip("GPU")


@app.get("/info/{component}", response_model=VideoInfo)
async def get_video_info(component: str):
    """Get video info without downloading the clip"""
    component_lower = component.lower()
    if component_lower not in VIDEO_MAP:
        raise HTTPException(status_code=404, detail=f"Unknown component: {component}")
    
    data = load_video_data(VIDEO_MAP[component_lower]["file"])
    metadata = data["metadata"]
    step = find_component_step(data, component)
    
    timestamp = step["timestamp"] if step else {"start": 0, "end": 0}
    
    return VideoInfo(
        video_id=metadata["video_id"],
        title=metadata["title"],
        channel=metadata["channel_name"],
        youtube_url=metadata["url"],
        timestamp_start=timestamp["start"],
        timestamp_end=timestamp["end"],
        component=component.upper(),
        clip_url=f"/get{component.capitalize()}Video"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=True)
