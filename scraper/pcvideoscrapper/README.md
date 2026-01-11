# PC Building Video Scraper & Parser

A complete pipeline for converting PC-building YouTube videos into structured, multimodal, RAG-ready knowledge entries using TwelveLabs.

## 🎯 What This Does

This pipeline processes PC building tutorial videos and extracts:

- **Structured assembly steps** with timestamps
- **Visual cues** for correct installation
- **Common errors** and warnings
- **Component-specific actions** (CPU, RAM, GPU, etc.)
- **Platform-specific details** (AM4, AM5, LGA1700, etc.)

Each video is converted into a clean, queryable knowledge base that can be used by an LLM to provide accurate, grounded, step-by-step PC building guidance.

## 📋 Features

- **Automatic metadata extraction** from YouTube videos
- **Intelligent video validation** (excludes reviews, benchmarks)
- **Multimodal indexing** with TwelveLabs (visual + audio + text)
- **Semantic queries** to extract specific assembly steps
- **Structured output schema** ready for RAG systems
- **Deduplication** across multiple videos
- **Confidence scoring** for extracted information

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd TwelveLabsVideoScrapperTester

# Install dependencies
pip install -r requirements.txt
```

### 2. Configuration

Create a `.env` file with your API keys:

```bash
cp .env.example .env
```

Edit `.env` and add your TwelveLabs API key:

```
TWELVE_LABS_API_KEY=your_api_key_here
TWELVE_LABS_INDEX_ID=your_index_id_here  # Optional - will create new if not provided
```

Get your TwelveLabs API key from: https://playground.twelvelabs.io/

### 3. Process a Video

**Simple method:**

```bash
python simple_process.py
```

Then enter a YouTube URL when prompted.

**Command line:**

```bash
python simple_process.py "https://www.youtube.com/watch?v=VIDEO_ID"
```

**Programmatic usage:**

```python
from pipeline import PCBuildVideoPipeline

pipeline = PCBuildVideoPipeline(
    twelve_labs_api_key="your_key",
    twelve_labs_index_id="your_index_id"  # Optional
)

result = pipeline.process_video("https://youtube.com/watch?v=...")
pipeline.save_results(result, "output.json")
```

## 📊 Output Format

The pipeline outputs a JSON file with this structure:

```json
{
  "metadata": {
    "video_id": "abc123",
    "title": "How to Build a PC - Complete Guide",
    "channel_name": "TechChannel",
    "url": "https://youtube.com/watch?v=...",
    "video_type": "full_build",
    "skill_level": "beginner",
    "platform": "AM5",
    "form_factor": "ATX"
  },
  "assembly_steps": [
    {
      "component": "CPU",
      "action": "insert",
      "platform": "AM5",
      "form_factor": "ATX",
      "step_order": 1,
      "description": "Align CPU with socket using golden triangle marker",
      "visual_cues": [
        "Golden triangle on CPU corner",
        "Socket lever in open position",
        "CPU drops in without force"
      ],
      "common_errors": [
        "Do not apply excessive force",
        "Incorrect orientation"
      ],
      "timestamp": {
        "start": 145.5,
        "end": 178.2
      },
      "video_id": "abc123",
      "source_confidence": "explicitly_shown"
    }
  ],
  "twelve_labs_video_id": "tl_video_id",
  "total_steps_extracted": 24
}
```

## 🔄 Pipeline Steps

### Step 1: Video Selection & Metadata Tagging

- Extracts video metadata from YouTube
- Validates content (excludes reviews, benchmarks)
- Infers video type, skill level, platform, form factor

### Step 2: Ingest Video into TwelveLabs

- Uploads video to TwelveLabs API
- Enables multimodal indexing (visual + text + audio)
- Waits for complete processing

### Step 3: Define Output Schema

- Uses predefined Pydantic schemas
- Ensures consistent data structure
- Ready for RAG systems

### Step 4: Semantic Queries

- Runs semantic searches for specific assembly steps
- Extracts timestamps, transcripts, and visual frames
- Maps results to structured schema

### Step 5: Structure & Store

- Normalizes extracted data
- Assigns step order and confidence scores
- Saves to JSON for downstream use

## 📁 Project Structure

```
TwelveLabsVideoScrapperTester/
├── schemas.py                    # Data models (Pydantic)
├── video_metadata_extractor.py   # YouTube metadata extraction
├── twelve_labs_client.py         # TwelveLabs API client
├── step_extractor.py             # Assembly step extraction
├── pipeline.py                   # Main pipeline orchestration
├── simple_process.py             # Simple CLI interface
├── requirements.txt              # Python dependencies
├── .env.example                  # Environment variables template
├── .gitignore                    # Git ignore rules
└── README.md                     # This file
```

## 🔧 Advanced Usage

### Custom Semantic Queries

```python
from schemas import SemanticQuery, ComponentType, ActionType
from pipeline import PCBuildVideoPipeline

pipeline = PCBuildVideoPipeline(api_key="your_key")

custom_queries = [
    SemanticQuery(
        query_text="Show thermal paste application on CPU",
        component=ComponentType.CPU,
        action=ActionType.MOUNT
    ),
    SemanticQuery(
        query_text="Find cable routing behind motherboard tray",
        component=ComponentType.CABLES,
        action=ActionType.CONNECT
    )
]

result = pipeline.process_video(
    video_url="...",
    custom_queries=custom_queries
)
```

### Batch Processing

```python
from pipeline import PCBuildVideoPipeline

pipeline = PCBuildVideoPipeline(api_key="your_key")

video_urls = [
    "https://youtube.com/watch?v=video1",
    "https://youtube.com/watch?v=video2",
    "https://youtube.com/watch?v=video3"
]

for url in video_urls:
    try:
        result = pipeline.process_video(url)
        pipeline.save_results(result, f"outputs/{result.metadata.video_id}.json")
    except Exception as e:
        print(f"Failed to process {url}: {e}")
```

## 🧪 Supported Video Types

- `full_build` - Complete PC build tutorials
- `cpu_install` - CPU installation guides
- `cooler_install` - CPU cooler installation
- `ram_install` - RAM installation
- `gpu_install` - GPU installation
- `cable_management` - Cable management tutorials

## 🛠️ Supported Platforms

- **AMD**: AM4, AM5
- **Intel**: LGA1700, LGA1200
- Auto-detected from video content

## 📦 Dependencies

- `twelvelabs` - TwelveLabs API client
- `pydantic` - Data validation and schemas
- `yt-dlp` - YouTube metadata extraction
- `python-dotenv` - Environment variable management
- `requests` - HTTP client

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

1. Additional semantic queries for more step types
2. Better error detection and visual cue extraction
3. Support for more platforms and form factors
4. Multi-language support
5. Integration with vector databases (Pinecone, Weaviate)

## 📝 License

MIT License - See LICENSE file for details

## 🙋 Support

For issues or questions:

1. Check the TwelveLabs documentation: https://docs.twelvelabs.io/
2. Open an issue on GitHub
3. Contact the maintainer

## 🎓 Example Videos to Try

Great PC building videos to test with:

- Jay's Two Cents - Full PC build guides
- Linus Tech Tips - PC building tutorials
- Paul's Hardware - Monthly build guides
- Bitwit - PC building guides

Make sure the video shows step-by-step assembly, not just reviews or benchmarks!
