"""
Main pipeline for processing PC building videos
"""
import os
import json
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv

from schemas import VideoMetadata, AssemblyStep, ProcessedVideo
from video_metadata_extractor import VideoMetadataExtractor
from twelve_labs_client import TwelveLabsClient
from step_extractor import StepExtractor


class PCBuildVideoPipeline:
    """
    Complete pipeline for processing PC building videos
    
    Usage:
        pipeline = PCBuildVideoPipeline(api_key="your_key")
        result = pipeline.process_video("https://youtube.com/watch?v=...")
        pipeline.save_results(result, "output.json")
    """
    
    def __init__(
        self,
        twelve_labs_api_key: str,
        twelve_labs_index_id: Optional[str] = None,
        youtube_api_key: Optional[str] = None
    ):
        """
        Initialize the pipeline
        
        Args:
            twelve_labs_api_key: TwelveLabs API key
            twelve_labs_index_id: Existing index ID (creates new if None)
            youtube_api_key: YouTube API key (optional)
        """
        self.metadata_extractor = VideoMetadataExtractor(youtube_api_key)
        self.twelve_labs_client = TwelveLabsClient(
            api_key=twelve_labs_api_key,
            index_id=twelve_labs_index_id
        )
        self.step_extractor = StepExtractor(self.twelve_labs_client)
        
        # Create index if not provided
        if not twelve_labs_index_id:
            self.twelve_labs_client.create_index()
    
    def process_video(
        self,
        video_url: str,
        skip_validation: bool = False
    ) -> ProcessedVideo:
        """
        Process a single video through the complete pipeline
        
        Args:
            video_url: YouTube video URL
            skip_validation: Skip video content validation
            
        Returns:
            ProcessedVideo with metadata and extracted steps
        """
        print("=" * 80)
        print("STEP 1: EXTRACTING VIDEO METADATA")
        print("=" * 80)
        
        # Extract metadata
        metadata = self.metadata_extractor.extract_metadata(video_url)
        print(f"\nVideo: {metadata.title}")
        print(f"Channel: {metadata.channel_name}")
        print(f"Type: {metadata.video_type}")
        print(f"Skill Level: {metadata.skill_level}")
        print(f"Platform: {metadata.platform}")
        print(f"Form Factor: {metadata.form_factor}")
        
        # Validate content
        if not skip_validation:
            if not self.metadata_extractor.validate_video_content(metadata):
                raise ValueError(
                    "Video does not appear to be a PC building tutorial. "
                    "Use skip_validation=True to process anyway."
                )
        
        print("\n" + "=" * 80)
        print("STEP 2: UPLOADING TO TWELVELABS")
        print("=" * 80)
        
        # Upload to TwelveLabs
        twelve_labs_video_id = self.twelve_labs_client.upload_video(
            video_url=video_url,
            metadata=metadata,
            wait_for_completion=True
        )
        
        print("\n" + "=" * 80)
        print("STEP 3 & 4: EXTRACTING ASSEMBLY STEPS")
        print("=" * 80)
        
        # Extract assembly steps
        assembly_steps = self.step_extractor.extract_steps_from_video(
            video_id=twelve_labs_video_id,
            metadata=metadata
        )
        
        print(f"\n✓ Extracted {len(assembly_steps)} assembly steps")
        
        print("\n" + "=" * 80)
        print("STEP 5: STRUCTURING RESULTS")
        print("=" * 80)
        
        # Create processed video result
        result = ProcessedVideo(
            metadata=metadata,
            assembly_steps=assembly_steps,
            twelve_labs_video_id=twelve_labs_video_id,
            processing_timestamp=datetime.now().isoformat(),
            total_steps_extracted=len(assembly_steps)
        )
        
        print(f"\n✓ Processing complete!")
        print(f"  - Total steps: {result.total_steps_extracted}")
        print(f"  - TwelveLabs ID: {result.twelve_labs_video_id}")
        
        return result
    
    def save_results(
        self,
        result: ProcessedVideo,
        output_path: str,
        pretty: bool = True
    ):
        """
        Save processing results to JSON file
        
        Args:
            result: ProcessedVideo result
            output_path: Path to save JSON file
            pretty: Whether to pretty-print the JSON
        """
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(
                result.model_dump(),
                f,
                indent=2 if pretty else None,
                ensure_ascii=False
            )
        
        print(f"\n✓ Results saved to: {output_path}")
    
    def load_results(self, input_path: str) -> ProcessedVideo:
        """
        Load processing results from JSON file
        
        Args:
            input_path: Path to JSON file
            
        Returns:
            ProcessedVideo object
        """
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return ProcessedVideo(**data)
    
    def print_summary(self, result: ProcessedVideo):
        """
        Print a human-readable summary of the results
        
        Args:
            result: ProcessedVideo result
        """
        print("\n" + "=" * 80)
        print("PROCESSING SUMMARY")
        print("=" * 80)
        
        print(f"\nVideo: {result.metadata.title}")
        print(f"Channel: {result.metadata.channel_name}")
        print(f"Duration: {result.metadata.duration_seconds:.0f}s")
        print(f"Type: {result.metadata.video_type}")
        print(f"Skill Level: {result.metadata.skill_level}")
        
        print(f"\nTotal Steps Extracted: {result.total_steps_extracted}")
        
        # Component breakdown
        components = {}
        for step in result.assembly_steps:
            comp = step.component
            components[comp] = components.get(comp, 0) + 1
        
        print("\nSteps by Component:")
        for comp, count in sorted(components.items(), key=lambda x: -x[1]):
            print(f"  - {comp}: {count}")
        
        # Sample steps
        print(f"\nSample Steps:")
        for step in result.assembly_steps[:3]:
            print(f"\n  [{step.timestamp.start:.0f}s - {step.timestamp.end:.0f}s]")
            print(f"  {step.component} - {step.action}")
            print(f"  {step.description[:100]}...")
            if step.common_errors:
                print(f"  ⚠️  Errors: {', '.join(step.common_errors)}")


def main():
    """Example usage of the pipeline"""
    # Load environment variables
    load_dotenv()
    
    api_key = os.getenv("TWELVE_LABS_API_KEY")
    index_id = os.getenv("TWELVE_LABS_INDEX_ID")
    
    if not api_key:
        print("Error: TWELVE_LABS_API_KEY not found in environment")
        print("Please create a .env file with your API key")
        return
    
    # Initialize pipeline
    print("Initializing PC Build Video Pipeline...")
    pipeline = PCBuildVideoPipeline(
        twelve_labs_api_key=api_key,
        twelve_labs_index_id=index_id
    )
    
    # Example video URL (replace with actual PC building video)
    video_url = input("\nEnter YouTube video URL: ").strip()
    
    if not video_url:
        print("No URL provided. Exiting.")
        return
    
    try:
        # Process video
        result = pipeline.process_video(video_url)
        
        # Print summary
        pipeline.print_summary(result)
        
        # Save results
        output_file = f"outputs/processed_{result.metadata.video_id}.json"
        pipeline.save_results(result, output_file)
        
    except Exception as e:
        print(f"\n❌ Error processing video: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
