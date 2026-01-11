"""
Video metadata extraction from YouTube
"""
import re
import requests
from typing import Optional, Dict, Any
from schemas import VideoMetadata, VideoType, SkillLevel, Platform
import yt_dlp


class VideoMetadataExtractor:
    """Extract metadata from YouTube videos"""
    
    def __init__(self, youtube_api_key: Optional[str] = None):
        self.youtube_api_key = youtube_api_key
    
    @staticmethod
    def extract_video_id(url: str) -> str:
        """Extract video ID from YouTube URL"""
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
            r'youtube\.com\/watch\?.*v=([^&\n?#]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        raise ValueError(f"Could not extract video ID from URL: {url}")
    
    def fetch_metadata(self, video_url: str) -> Dict[str, Any]:
        """Fetch video metadata using yt-dlp"""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            return info
    
    @staticmethod
    def infer_video_type(title: str, description: str) -> VideoType:
        """Infer video type from title and description"""
        title_lower = title.lower()
        desc_lower = description.lower() if description else ""
        combined = f"{title_lower} {desc_lower}"
        
        # Check for full build
        if any(keyword in combined for keyword in ["full build", "complete build", "pc build guide", "building a pc"]):
            return VideoType.FULL_BUILD
        
        # Check for specific component installations
        if any(keyword in combined for keyword in ["cpu install", "installing cpu", "processor install"]):
            return VideoType.CPU_INSTALL
        
        if any(keyword in combined for keyword in ["cooler install", "installing cooler", "cpu cooler"]):
            return VideoType.COOLER_INSTALL
        
        if any(keyword in combined for keyword in ["ram install", "installing ram", "memory install"]):
            return VideoType.RAM_INSTALL
        
        if any(keyword in combined for keyword in ["gpu install", "graphics card", "installing gpu"]):
            return VideoType.GPU_INSTALL
        
        if any(keyword in combined for keyword in ["cable management", "cable routing", "cables"]):
            return VideoType.CABLE_MANAGEMENT
        
        # Default to full build if uncertain
        return VideoType.FULL_BUILD
    
    @staticmethod
    def infer_skill_level(title: str, description: str) -> SkillLevel:
        """Infer skill level from title and description"""
        combined = f"{title.lower()} {description.lower() if description else ''}"
        
        if any(keyword in combined for keyword in ["beginner", "first time", "guide for beginners", "easy"]):
            return SkillLevel.BEGINNER
        
        if any(keyword in combined for keyword in ["advanced", "expert", "professional", "custom loop"]):
            return SkillLevel.ADVANCED
        
        return SkillLevel.INTERMEDIATE
    
    @staticmethod
    def infer_platform(title: str, description: str) -> Optional[Platform]:
        """Infer CPU/motherboard platform from title and description"""
        combined = f"{title.lower()} {description.lower() if description else ''}"
        
        if "am5" in combined or "ryzen 7000" in combined or "ryzen 9000" in combined:
            return Platform.AM5
        
        if "am4" in combined or "ryzen 5000" in combined or "ryzen 3000" in combined:
            return Platform.AM4
        
        if "lga1700" in combined or "12th gen" in combined or "13th gen" in combined or "14th gen" in combined:
            return Platform.LGA1700
        
        if "lga1200" in combined or "10th gen" in combined or "11th gen" in combined:
            return Platform.LGA1200
        
        return None
    
    def extract_metadata(self, video_url: str) -> VideoMetadata:
        """
        Extract complete metadata for a video
        
        Args:
            video_url: YouTube video URL
            
        Returns:
            VideoMetadata object with all extracted information
        """
        # Fetch raw metadata
        info = self.fetch_metadata(video_url)
        
        video_id = self.extract_video_id(video_url)
        title = info.get('title', '')
        description = info.get('description', '')
        channel_name = info.get('uploader', '') or info.get('channel', '')
        duration_seconds = info.get('duration', None)
        upload_date = info.get('upload_date', None)
        
        # Infer metadata
        video_type = self.infer_video_type(title, description)
        skill_level = self.infer_skill_level(title, description)
        platform = self.infer_platform(title, description)
        
        return VideoMetadata(
            video_id=video_id,
            title=title,
            channel_name=channel_name,
            url=video_url,
            video_type=video_type,
            skill_level=skill_level,
            platform=platform,
            duration_seconds=duration_seconds,
            upload_date=upload_date,
            description=description
        )
    
    def validate_video_content(self, metadata: VideoMetadata) -> bool:
        """
        Validate that the video is appropriate for processing
        
        Returns:
            True if video should be processed, False otherwise
        """
        title_lower = metadata.title.lower()
        desc_lower = (metadata.description or "").lower()
        combined = f"{title_lower} {desc_lower}"
        
        # Exclude obvious non-PC-building content
        exclude_keywords = [
            "unboxing only", "reaction video", "roast", 
            "fails compilation", "worst builds ever"
        ]
        
        if any(keyword in combined for keyword in exclude_keywords):
            return False
        
        # Very lenient check - just needs PC-related terms
        pc_related = [
            "pc", "computer", "gaming rig", "build",
            "cpu", "gpu", "motherboard", "ram", "graphics",
            "components", "parts", "install", "setup",
            "assembly", "tutorial", "guide", "how to"
        ]
        
        # If any PC-related term is found, it's valid
        if any(keyword in combined for keyword in pc_related):
            return True
        
        return False
