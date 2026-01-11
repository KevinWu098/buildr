"""
Extract assembly steps from TwelveLabs search results
"""
from typing import List, Dict, Any, Optional
from schemas import (
    AssemblyStep, ComponentType, ActionType, Platform, FormFactor,
    SourceConfidence, Timestamp, VideoMetadata, SemanticQuery
)
from twelve_labs_client import TwelveLabsClient


class StepExtractor:
    """Extract and structure assembly steps from video analysis"""
    
    # Predefined semantic queries for extracting assembly steps
    SEMANTIC_QUERIES = [
        SemanticQuery(
            query_text="Show when the CPU is inserted into the motherboard socket",
            component=ComponentType.CPU,
            action=ActionType.INSERT
        ),
        SemanticQuery(
            query_text="Find moments where RAM memory modules are installed into slots",
            component=ComponentType.RAM,
            action=ActionType.INSERT
        ),
        SemanticQuery(
            query_text="Show when the GPU graphics card is installed into the PCIe slot",
            component=ComponentType.GPU,
            action=ActionType.INSERT
        ),
        SemanticQuery(
            query_text="Find when the CPU cooler is mounted on top of the processor",
            component=ComponentType.COOLER,
            action=ActionType.MOUNT
        ),
        SemanticQuery(
            query_text="Show when the power supply PSU is installed into the case",
            component=ComponentType.PSU,
            action=ActionType.MOUNT
        ),
        SemanticQuery(
            query_text="Find moments where storage drives or SSDs are being installed",
            component=ComponentType.STORAGE,
            action=ActionType.MOUNT
        ),
        SemanticQuery(
            query_text="Show when cables are being connected to the motherboard or components",
            component=ComponentType.CABLES,
            action=ActionType.CONNECT
        ),
        SemanticQuery(
            query_text="Find when the creator shows correct alignment or orientation of components",
            component=None,
            action=ActionType.ALIGN
        ),
        SemanticQuery(
            query_text="When does the creator warn about mistakes or show incorrect installation",
            component=None,
            action=None
        ),
        SemanticQuery(
            query_text="Find steps where force should not be applied or warnings about damage",
            component=None,
            action=None
        ),
        SemanticQuery(
            query_text="Show moments where locks or latches are being secured",
            component=None,
            action=ActionType.LOCK
        ),
    ]
    
    def __init__(self, twelve_labs_client: TwelveLabsClient):
        """
        Initialize step extractor
        
        Args:
            twelve_labs_client: Configured TwelveLabs client
        """
        self.client = twelve_labs_client
    
    def extract_steps_from_video(
        self,
        video_id: str,
        metadata: VideoMetadata,
        custom_queries: Optional[List[SemanticQuery]] = None
    ) -> List[AssemblyStep]:
        """
        Extract all assembly steps from a video
        
        Args:
            video_id: TwelveLabs video ID
            metadata: Video metadata
            custom_queries: Optional custom queries (uses defaults if not provided)
            
        Returns:
            List of extracted assembly steps
        """
        queries = custom_queries or self.SEMANTIC_QUERIES
        
        all_steps = []
        
        for query in queries:
            print(f"Running query: {query.query_text}")
            
            # Search for relevant segments
            results = self.client.search_semantic(
                query=query,
                video_id=video_id,
                page_limit=10
            )
            
            # Convert each result to an assembly step
            for result in results:
                step = self._result_to_assembly_step(
                    result=result,
                    metadata=metadata,
                    expected_component=query.component,
                    expected_action=query.action
                )
                
                if step:
                    all_steps.append(step)
        
        # Sort by timestamp
        all_steps.sort(key=lambda x: x.timestamp.start)
        
        # Assign step order
        for idx, step in enumerate(all_steps):
            step.step_order = idx + 1
        
        return all_steps
    
    def _result_to_assembly_step(
        self,
        result: Dict[str, Any],
        metadata: VideoMetadata,
        expected_component: Optional[ComponentType],
        expected_action: Optional[ActionType]
    ) -> Optional[AssemblyStep]:
        """
        Convert a search result to an AssemblyStep
        
        Args:
            result: Search result from TwelveLabs
            metadata: Video metadata
            expected_component: Expected component type from query
            expected_action: Expected action type from query
            
        Returns:
            AssemblyStep or None if result doesn't contain useful information
        """
        # Extract timestamp
        timestamp = Timestamp(
            start=result.get("start", 0.0),
            end=result.get("end", 0.0)
        )
        
        # Determine confidence
        score = result.get("score", 0.0)
        confidence = result.get("confidence", "low")
        
        if confidence == "high" or score > 0.8:
            source_confidence = SourceConfidence.EXPLICITLY_SHOWN
        elif confidence == "medium" or score > 0.6:
            source_confidence = SourceConfidence.VERBALLY_EXPLAINED
        else:
            source_confidence = SourceConfidence.INFERRED
        
        # Extract description from modules
        description_parts = []
        visual_cues = []
        
        for module in result.get("modules", []):
            # Extract conversation/transcript
            if "conversation" in module and module["conversation"]:
                for conv in module["conversation"]:
                    if isinstance(conv, dict) and "value" in conv:
                        description_parts.append(conv["value"])
            
            # Extract visual information
            if "visual" in module and module["visual"]:
                for visual in module["visual"]:
                    if isinstance(visual, dict) and "value" in visual:
                        visual_cues.append(visual["value"])
        
        # Build description
        description = " ".join(description_parts) if description_parts else f"Assembly step for {expected_component or 'component'}"
        description = description[:500]  # Limit length
        
        # Detect component and action from description if not provided
        component = expected_component or self._detect_component(description)
        action = expected_action or self._detect_action(description)
        
        # Extract common errors from description
        common_errors = self._extract_errors(description)
        
        # Use metadata platform and form factor as defaults
        platform = metadata.platform or Platform.UNKNOWN
        form_factor = metadata.form_factor or FormFactor.UNKNOWN
        
        try:
            step = AssemblyStep(
                component=component,
                action=action,
                platform=platform,
                form_factor=form_factor,
                step_order=None,  # Will be assigned later
                description=description,
                visual_cues=visual_cues[:5],  # Limit to 5 visual cues
                common_errors=common_errors,
                timestamp=timestamp,
                video_id=metadata.video_id,
                source_confidence=source_confidence
            )
            return step
        except Exception as e:
            print(f"Error creating assembly step: {e}")
            return None
    
    @staticmethod
    def _detect_component(text: str) -> ComponentType:
        """Detect component type from text"""
        text_lower = text.lower()
        
        if any(word in text_lower for word in ["cpu", "processor", "ryzen", "intel"]):
            return ComponentType.CPU
        if any(word in text_lower for word in ["ram", "memory", "dimm"]):
            return ComponentType.RAM
        if any(word in text_lower for word in ["gpu", "graphics card", "video card"]):
            return ComponentType.GPU
        if any(word in text_lower for word in ["cooler", "heatsink", "fan"]):
            return ComponentType.COOLER
        if any(word in text_lower for word in ["psu", "power supply"]):
            return ComponentType.PSU
        if any(word in text_lower for word in ["ssd", "nvme", "storage", "hard drive"]):
            return ComponentType.STORAGE
        if any(word in text_lower for word in ["motherboard", "mobo"]):
            return ComponentType.MOTHERBOARD
        if any(word in text_lower for word in ["cable", "wire", "connector"]):
            return ComponentType.CABLES
        
        return ComponentType.MOTHERBOARD  # Default
    
    @staticmethod
    def _detect_action(text: str) -> ActionType:
        """Detect action type from text"""
        text_lower = text.lower()
        
        if any(word in text_lower for word in ["insert", "installing", "install", "put in", "slot in"]):
            return ActionType.INSERT
        if any(word in text_lower for word in ["mount", "mounting", "screw", "attach"]):
            return ActionType.MOUNT
        if any(word in text_lower for word in ["connect", "plug", "cable", "wire"]):
            return ActionType.CONNECT
        if any(word in text_lower for word in ["align", "orientation", "direction", "arrow"]):
            return ActionType.ALIGN
        if any(word in text_lower for word in ["lock", "latch", "secure", "clip"]):
            return ActionType.LOCK
        if any(word in text_lower for word in ["remove", "take out", "uninstall"]):
            return ActionType.REMOVE
        
        return ActionType.INSERT  # Default
    
    @staticmethod
    def _extract_errors(text: str) -> List[str]:
        """Extract common errors or warnings from text"""
        errors = []
        text_lower = text.lower()
        
        error_phrases = [
            ("don't force", "Do not apply excessive force"),
            ("avoid touching", "Avoid touching sensitive components"),
            ("wrong orientation", "Incorrect orientation"),
            ("pins bent", "Risk of bent pins"),
            ("not aligned", "Component not properly aligned"),
            ("forget to", "May forget this step"),
            ("common mistake", "Common mistake"),
            ("be careful", "Exercise caution"),
            ("damage", "Risk of component damage"),
        ]
        
        for trigger, error_msg in error_phrases:
            if trigger in text_lower:
                errors.append(error_msg)
        
        return errors
