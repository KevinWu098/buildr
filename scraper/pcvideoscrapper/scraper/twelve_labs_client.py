"""
TwelveLabs API client for video ingestion and semantic search
"""
import time
import os
import tempfile
from typing import List, Dict, Any, Optional
from twelvelabs import TwelveLabs
from schemas import VideoMetadata, SemanticQuery
import yt_dlp


class TwelveLabsClient:
    """Client for interacting with TwelveLabs API"""
    
    def __init__(self, api_key: str, index_id: Optional[str] = None):
        """
        Initialize TwelveLabs client
        
        Args:
            api_key: TwelveLabs API key
            index_id: Existing index ID, or None to create a new one
        """
        self.client = TwelveLabs(api_key=api_key)
        self.index_id = index_id
    
    def create_index(self, index_name: str = "pc_building_videos") -> str:
        """
        Create a new TwelveLabs index with appropriate settings
        
        Args:
            index_name: Name for the index
            
        Returns:
            Index ID
        """
        # Create index with multimodal capabilities using the new SDK
        # Use marengo2.7 for search support (pegasus doesn't support search)
        index = self.client.indexes.create(
            index_name=index_name,
            models=[
                {
                    "model_name": "marengo2.7",
                    "model_options": ["visual", "audio"],
                }
            ]
        )
        
        self.index_id = index.id
        print(f"Created index: {index_name} (ID: {index.id})")
        return index.id
    
    def upload_video(
        self,
        video_url: str,
        metadata: VideoMetadata,
        wait_for_completion: bool = True
    ) -> str:
        """
        Upload a video to TwelveLabs
        
        Args:
            video_url: URL of the video to upload
            metadata: Video metadata
            wait_for_completion: Whether to wait for processing to complete
            
        Returns:
            TwelveLabs video ID
        """
        if not self.index_id:
            raise ValueError("Index ID not set. Create or specify an index first.")
        
        print(f"\n📹 Video: {metadata.title}")
        print(f"🔗 URL: {video_url}")
        
        # Download video first (TwelveLabs doesn't accept YouTube URLs directly)
        print("\n⬇️  Downloading video from YouTube...")
        print("This may take several minutes for large videos...")
        video_file_path = self._download_video(video_url)
        
        try:
            # Create task to upload video using new SDK
            print("\n⬆️  Uploading to TwelveLabs...")
            file_size_mb = os.path.getsize(video_file_path) / (1024*1024)
            print(f"File size: {file_size_mb:.1f} MB")
            
            with open(video_file_path, 'rb') as video_file:
                task = self.client.tasks.create(
                    index_id=self.index_id,
                    video_file=video_file
                )
            
            print(f"✅ Upload task created: {task.id}")
            
            if wait_for_completion:
                # Wait for video to be indexed
                print("\n🔄 Processing video...")
                start_time = time.time()
                
                while True:
                    try:
                        status = self.client.tasks.retrieve(task.id)
                        elapsed = int(time.time() - start_time)
                        
                        if status.status == "ready":
                            video_id = status.video_id
                            print(f"\n✅ Upload complete! (took {elapsed}s)")
                            print(f"   Video ID: {video_id}")
                            
                            # Now wait for video to be fully indexed for search
                            print("\n🔄 Waiting for video to be searchable...")
                            while True:
                                video = self.client.indexes.videos.retrieve(
                                    index_id=self.index_id, 
                                    video_id=video_id
                                )
                                elapsed = int(time.time() - start_time)
                                
                                if video.indexed_at is not None:
                                    print(f"\n✅ Video fully indexed! (total {elapsed}s)")
                                    return video_id
                                
                                print(f"   Still indexing... ({elapsed}s elapsed)")
                                time.sleep(30)  # Check every 30 seconds
                                
                        elif status.status in ["failed", "error"]:
                            error_msg = f"Video upload failed with status: {status.status}"
                            if hasattr(status, 'metadata'):
                                error_msg += f"\nDetails: {status.metadata}"
                            raise Exception(error_msg)
                        
                        # Check every 5 seconds
                        time.sleep(5)
                        
                    except Exception as e:
                        print(f"\n❌ Error checking status: {e}")
                        raise
            else:
                return task.id
        except Exception as e:
            print(f"\n❌ Upload failed: {e}")
            raise
        # Note: We keep the downloaded file in videos/ directory for caching

    
    def _download_video(self, video_url: str) -> str:
        """
        Download video from YouTube with caching
        
        Args:
            video_url: YouTube video URL
            
        Returns:
            Path to downloaded video file
        """
        # Create videos directory for caching
        videos_dir = os.path.join(os.getcwd(), 'videos')
        os.makedirs(videos_dir, exist_ok=True)
        
        output_template = os.path.join(videos_dir, '%(id)s.%(ext)s')
        
        # First, get video info without downloading
        print("Fetching video information...")
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
            info = ydl.extract_info(video_url, download=False)
            video_id = info['id']
        
        # Check if already downloaded
        cached_files = [f for f in os.listdir(videos_dir) if f.startswith(video_id)]
        if cached_files:
            cached_file = os.path.join(videos_dir, cached_files[0])
            file_size_mb = os.path.getsize(cached_file) / (1024*1024)
            print(f"✅ Using cached video: {cached_file} ({file_size_mb:.1f} MB)")
            return cached_file
        
        # Download video with yt-dlp and progress
        print(f"📥 Downloading video ID: {video_id}")
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': output_template,
            'quiet': False,
            'no_warnings': False,
            'progress_hooks': [self._download_progress_hook],
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info['id']
                ext = info['ext']
        except Exception as e:
            print(f"\n❌ Download error: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Find the downloaded file
        video_file = os.path.join(videos_dir, f"{video_id}.{ext}")
        
        if not os.path.exists(video_file):
            raise Exception(f"Failed to download video: {video_file} not found")
        
        file_size_mb = os.path.getsize(video_file) / (1024*1024)
        print(f"\n✅ Downloaded: {video_file} ({file_size_mb:.1f} MB)")
        return video_file
    
    def _download_progress_hook(self, d):
        """Progress hook for yt-dlp downloads"""
        if d['status'] == 'downloading':
            if 'downloaded_bytes' in d and 'total_bytes' in d:
                percent = d['downloaded_bytes'] / d['total_bytes'] * 100
                downloaded_mb = d['downloaded_bytes'] / (1024*1024)
                total_mb = d['total_bytes'] / (1024*1024)
                print(f"\r  Progress: {percent:.1f}% ({downloaded_mb:.1f}/{total_mb:.1f} MB)", end='', flush=True)
        elif d['status'] == 'finished':
            print("\n  ✅ Download complete, processing file...")
    
    def search_semantic(
        self,
        query: SemanticQuery,
        video_id: Optional[str] = None,
        page_limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search on indexed videos
        
        Args:
            query: Semantic query to execute
            video_id: Optional specific video ID to search in
            page_limit: Maximum number of results to return
            
        Returns:
            List of search results with timestamps and metadata
        """
        if not self.index_id:
            raise ValueError("Index ID not set. Create or specify an index first.")
        
        search_options = ["visual", "audio"]
        
        # Build search parameters for new SDK
        search_params = {
            "index_id": self.index_id,
            "query_text": query.query_text,
            "search_options": search_options,
            "page_limit": page_limit
        }
        
        # Filter by specific video if provided (must be stringified JSON with id as array)
        if video_id:
            import json
            search_params["filter"] = json.dumps({"id": [video_id]})
        
        # Execute search using new SDK
        search_results = self.client.search.query(**search_params)
        
        # Parse results - iterate directly over search_results (it's a pager)
        # Enforce page_limit to avoid excessive results
        results = []
        for clip in search_results:
            if len(results) >= page_limit:
                break
                
            result = {
                "video_id": clip.video_id,
                "score": clip.score,
                "confidence": clip.confidence,
                "start": clip.start,
                "end": clip.end,
                "metadata": getattr(clip, 'metadata', []),
                "thumbnail_url": getattr(clip, 'thumbnail_url', None),
                "modules": []
            }
            
            # Extract module-specific data
            if hasattr(clip, 'modules'):
                for module in clip.modules:
                    module_data = {
                        "type": getattr(module, 'type', None),
                    }
                    
                    # Extract visual information
                    if hasattr(module, 'visual') and module.visual:
                        module_data["visual"] = module.visual
                    
                    # Extract conversation/transcript
                    if hasattr(module, 'conversation') and module.conversation:
                        module_data["conversation"] = module.conversation
                    
                    result["modules"].append(module_data)
            
            results.append(result)
        
        return results
    
    def get_video_metadata(self, video_id: str) -> Dict[str, Any]:
        """
        Get metadata for a specific video
        
        Args:
            video_id: TwelveLabs video ID
            
        Returns:
            Video metadata dictionary
        """
        video = self.client.assets.retrieve(video_id)
        return {
            "id": video.id,
            "metadata": getattr(video, 'metadata', {}),
            "duration": getattr(video, 'duration', None),
            "created_at": getattr(video, 'created_at', None),
        }
    
    def get_transcript(
        self,
        video_id: str,
        start: Optional[float] = None,
        end: Optional[float] = None
    ) -> str:
        """
        Get transcript for a video or video segment
        
        Args:
            video_id: TwelveLabs video ID
            start: Start time in seconds (optional)
            end: End time in seconds (optional)
            
        Returns:
            Transcript text
        """
        # Use the generate endpoint to get transcription
        result = self.client.generate.text(
            video_id=video_id,
            prompt="Provide the exact transcript of what is said in this video.",
            temperature=0.0
        )
        
        return result.data
