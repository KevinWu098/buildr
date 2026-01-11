"""
Data schemas for PC building video parsing pipeline
"""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, HttpUrl
from enum import Enum


class ComponentType(str, Enum):
    """PC component types"""
    CPU = "CPU"
    RAM = "RAM"
    GPU = "GPU"
    MOTHERBOARD = "Motherboard"
    PSU = "PSU"
    COOLER = "Cooler"
    STORAGE = "Storage"
    CABLES = "Cables"


class ActionType(str, Enum):
    """Assembly action types"""
    INSERT = "insert"
    MOUNT = "mount"
    CONNECT = "connect"
    ALIGN = "align"
    LOCK = "lock"
    REMOVE = "remove"


class Platform(str, Enum):
    """CPU/Motherboard platforms"""
    AM4 = "AM4"
    AM5 = "AM5"
    LGA1700 = "LGA1700"
    LGA1200 = "LGA1200"
    UNKNOWN = "unknown"


class FormFactor(str, Enum):
    """Motherboard form factors"""
    ATX = "ATX"
    MATX = "mATX"
    ITX = "ITX"
    EATX = "EATX"
    UNKNOWN = "unknown"


class VideoType(str, Enum):
    """Type of PC building video"""
    FULL_BUILD = "full_build"
    CPU_INSTALL = "cpu_install"
    COOLER_INSTALL = "cooler_install"
    RAM_INSTALL = "ram_install"
    GPU_INSTALL = "gpu_install"
    CABLE_MANAGEMENT = "cable_management"


class SkillLevel(str, Enum):
    """Target skill level"""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class SourceConfidence(str, Enum):
    """Confidence level of extracted information"""
    EXPLICITLY_SHOWN = "explicitly_shown"
    VERBALLY_EXPLAINED = "verbally_explained"
    INFERRED = "inferred"


class VideoMetadata(BaseModel):
    """Metadata for a PC building video"""
    video_id: str = Field(..., description="Unique video identifier")
    title: str = Field(..., description="Video title")
    channel_name: str = Field(..., description="Channel/creator name")
    url: str = Field(..., description="Full video URL")
    video_type: VideoType = Field(..., description="Type of build video")
    skill_level: SkillLevel = Field(..., description="Target skill level")
    platform: Optional[Platform] = Field(None, description="CPU/Motherboard platform")
    form_factor: Optional[FormFactor] = Field(None, description="Motherboard form factor")
    duration_seconds: Optional[float] = Field(None, description="Video duration in seconds")
    upload_date: Optional[str] = Field(None, description="Video upload date")
    description: Optional[str] = Field(None, description="Video description")


class Timestamp(BaseModel):
    """Timestamp range for a video segment"""
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")


class AssemblyStep(BaseModel):
    """
    Schema for one atomic PC assembly step
    This is the core output format for RAG-ready knowledge entries
    """
    component: ComponentType = Field(..., description="PC component being worked on")
    action: ActionType = Field(..., description="Action being performed")
    platform: Platform = Field(Platform.UNKNOWN, description="CPU/Motherboard platform")
    form_factor: FormFactor = Field(FormFactor.UNKNOWN, description="Motherboard form factor")
    step_order: Optional[int] = Field(None, description="Order in the assembly sequence")
    description: str = Field(..., description="Natural language explanation of the step")
    visual_cues: List[str] = Field(
        default_factory=list,
        description="Visual indicators that the step is done correctly"
    )
    common_errors: List[str] = Field(
        default_factory=list,
        description="Frequent mistakes mentioned or shown"
    )
    timestamp: Timestamp = Field(..., description="Time range in the video")
    video_id: str = Field(..., description="Source video identifier")
    source_confidence: SourceConfidence = Field(
        ...,
        description="Confidence level of the extracted information"
    )

    class Config:
        use_enum_values = True


class ProcessedVideo(BaseModel):
    """Complete processed video with metadata and extracted steps"""
    metadata: VideoMetadata
    assembly_steps: List[AssemblyStep]
    twelve_labs_video_id: Optional[str] = Field(
        None,
        description="TwelveLabs internal video ID after upload"
    )
    processing_timestamp: Optional[str] = Field(None, description="When the video was processed")
    total_steps_extracted: int = Field(0, description="Total number of steps extracted")


class SemanticQuery(BaseModel):
    """Semantic query to run against TwelveLabs"""
    query_text: str = Field(..., description="Natural language query")
    component: Optional[ComponentType] = Field(None, description="Expected component")
    action: Optional[ActionType] = Field(None, description="Expected action")
    search_confidence_threshold: float = Field(
        0.7,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold"
    )
