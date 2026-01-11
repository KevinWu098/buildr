"""
Simple script to process a single video
Just input a URL and get the structured output
"""
import os
import sys
from dotenv import load_dotenv
from pipeline import PCBuildVideoPipeline


def process_video(video_url: str):
    """
    Process a single video and save the results
    
    Args:
        video_url: YouTube video URL
    """
    # Load environment variables
    load_dotenv()
    
    api_key = os.getenv("TWELVE_LABS_API_KEY")
    index_id = os.getenv("TWELVE_LABS_INDEX_ID")
    
    if not api_key:
        print("❌ Error: TWELVE_LABS_API_KEY not found")
        print("Please create a .env file with your API key:")
        print("  TWELVE_LABS_API_KEY=your_key_here")
        sys.exit(1)
    
    # Initialize pipeline
    print("\n🚀 Initializing PC Build Video Pipeline...")
    pipeline = PCBuildVideoPipeline(
        twelve_labs_api_key=api_key,
        twelve_labs_index_id=index_id
    )
    
    try:
        # Process video
        result = pipeline.process_video(video_url)
        
        # Print summary
        pipeline.print_summary(result)
        
        # Save results
        os.makedirs("outputs", exist_ok=True)
        output_file = f"outputs/processed_{result.metadata.video_id}.json"
        pipeline.save_results(result, output_file)
        
        print(f"\n✅ Success! Results saved to: {output_file}")
        
        return result
        
    except Exception as e:
        print(f"\n❌ Error processing video: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # URL provided as command line argument
        video_url = sys.argv[1]
    else:
        # Interactive mode
        print("\n" + "=" * 80)
        print("PC BUILDING VIDEO PROCESSOR")
        print("=" * 80)
        video_url = input("\nEnter YouTube video URL: ").strip()
    
    if not video_url:
        print("❌ No URL provided. Exiting.")
        sys.exit(1)
    
    process_video(video_url)
