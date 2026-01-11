"""
Filter and extract specific assembly steps from processed video output.
Allows filtering by component type, action type, timestamp range, etc.
"""
import json
import argparse
from typing import List, Dict, Any, Optional
from pathlib import Path


def load_processed_data(file_path: str) -> Dict[str, Any]:
    """Load processed video JSON data"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def filter_steps(
    steps: List[Dict[str, Any]],
    component: Optional[str] = None,
    action: Optional[str] = None,
    min_timestamp: Optional[float] = None,
    max_timestamp: Optional[float] = None,
    confidence: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Filter assembly steps by various criteria
    
    Args:
        steps: List of assembly step dictionaries
        component: Filter by component type (CPU, RAM, GPU, etc.)
        action: Filter by action type (insert, mount, connect, etc.)
        min_timestamp: Minimum start timestamp in seconds
        max_timestamp: Maximum start timestamp in seconds
        confidence: Filter by source confidence level
        
    Returns:
        Filtered list of steps
    """
    filtered = steps
    
    if component:
        filtered = [s for s in filtered if s.get("component", "").lower() == component.lower()]
    
    if action:
        filtered = [s for s in filtered if s.get("action", "").lower() == action.lower()]
    
    if min_timestamp is not None:
        filtered = [s for s in filtered if s.get("timestamp", {}).get("start", 0) >= min_timestamp]
    
    if max_timestamp is not None:
        filtered = [s for s in filtered if s.get("timestamp", {}).get("start", float('inf')) <= max_timestamp]
    
    if confidence:
        filtered = [s for s in filtered if s.get("source_confidence", "").lower() == confidence.lower()]
    
    return filtered


def filter_by_semantic_query(
    steps: List[Dict[str, Any]],
    query_component: Optional[str] = None,
    query_action: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Filter steps to match what a specific semantic query would have produced.
    
    Semantic Query Mapping:
    - CPU + INSERT: "Show when the CPU is inserted into the motherboard socket"
    - RAM + INSERT: "Find moments where RAM memory modules are installed into slots"
    - GPU + INSERT: "Show when the GPU graphics card is installed into the PCIe slot"
    - COOLER + MOUNT: "Find when the CPU cooler is mounted on top of the processor"
    - PSU + MOUNT: "Show when the power supply PSU is installed into the case"
    - STORAGE + MOUNT: "Find moments where storage drives or SSDs are being installed"
    - CABLES + CONNECT: "Show when cables are being connected to the motherboard or components"
    - None + ALIGN: "Find when the creator shows correct alignment or orientation"
    - None + LOCK: "Show moments where locks or latches are being secured"
    
    Args:
        steps: List of assembly step dictionaries
        query_component: Component from the semantic query (or None)
        query_action: Action from the semantic query (or None)
        
    Returns:
        Filtered list matching that query's expected output
    """
    filtered = steps
    
    if query_component:
        filtered = [s for s in filtered if s.get("component", "").lower() == query_component.lower()]
    
    if query_action:
        filtered = [s for s in filtered if s.get("action", "").lower() == query_action.lower()]
    
    return filtered


def print_steps(steps: List[Dict[str, Any]], verbose: bool = False):
    """Pretty print filtered steps"""
    print(f"\n{'='*60}")
    print(f"Found {len(steps)} matching steps")
    print(f"{'='*60}\n")
    
    for i, step in enumerate(steps, 1):
        timestamp = step.get("timestamp", {})
        start = timestamp.get("start", 0)
        end = timestamp.get("end", 0)
        
        print(f"Step {i}:")
        print(f"  Component: {step.get('component')}")
        print(f"  Action: {step.get('action')}")
        print(f"  Timestamp: {start:.1f}s - {end:.1f}s")
        print(f"  Confidence: {step.get('source_confidence')}")
        
        if verbose:
            print(f"  Description: {step.get('description', 'N/A')[:100]}...")
            if step.get('visual_cues'):
                print(f"  Visual Cues: {step.get('visual_cues')}")
            if step.get('common_errors'):
                print(f"  Common Errors: {step.get('common_errors')}")
        
        print()


def save_filtered(steps: List[Dict[str, Any]], output_path: str, metadata: Dict[str, Any] = None):
    """Save filtered steps to a new JSON file"""
    output = {
        "metadata": metadata or {},
        "assembly_steps": steps,
        "total_steps": len(steps)
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"Saved {len(steps)} steps to: {output_path}")


# Predefined query mappings for easy reference
SEMANTIC_QUERIES = {
    "cpu_insert": {"component": "CPU", "action": "insert", 
                   "description": "Show when the CPU is inserted into the motherboard socket"},
    "ram_insert": {"component": "RAM", "action": "insert",
                   "description": "Find moments where RAM memory modules are installed into slots"},
    "gpu_insert": {"component": "GPU", "action": "insert",
                   "description": "Show when the GPU graphics card is installed into the PCIe slot"},
    "cooler_mount": {"component": "Cooler", "action": "mount",
                     "description": "Find when the CPU cooler is mounted on top of the processor"},
    "psu_mount": {"component": "PSU", "action": "mount",
                  "description": "Show when the power supply PSU is installed into the case"},
    "storage_mount": {"component": "Storage", "action": "mount",
                      "description": "Find moments where storage drives or SSDs are being installed"},
    "cables_connect": {"component": "Cables", "action": "connect",
                       "description": "Show when cables are being connected to the motherboard"},
    "align": {"component": None, "action": "align",
              "description": "Find when the creator shows correct alignment or orientation"},
    "lock": {"component": None, "action": "lock",
             "description": "Show moments where locks or latches are being secured"},
}


def main():
    parser = argparse.ArgumentParser(description="Filter processed video assembly steps")
    parser.add_argument("input_file", help="Path to processed JSON file")
    parser.add_argument("--query", "-q", choices=list(SEMANTIC_QUERIES.keys()),
                        help="Filter by predefined semantic query name")
    parser.add_argument("--component", "-c", 
                        choices=["CPU", "RAM", "GPU", "Cooler", "PSU", "Storage", "Cables", "Motherboard"],
                        help="Filter by component type")
    parser.add_argument("--action", "-a",
                        choices=["insert", "mount", "connect", "align", "lock", "remove"],
                        help="Filter by action type")
    parser.add_argument("--min-time", type=float, help="Minimum timestamp (seconds)")
    parser.add_argument("--max-time", type=float, help="Maximum timestamp (seconds)")
    parser.add_argument("--confidence", choices=["explicitly_shown", "verbally_explained", "inferred"],
                        help="Filter by confidence level")
    parser.add_argument("--output", "-o", help="Save filtered results to JSON file")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    parser.add_argument("--list-queries", action="store_true", help="List available semantic queries")
    
    args = parser.parse_args()
    
    # List queries option
    if args.list_queries:
        print("\nAvailable Semantic Queries:")
        print("="*60)
        for name, info in SEMANTIC_QUERIES.items():
            print(f"\n  {name}:")
            print(f"    Component: {info['component'] or 'Any'}")
            print(f"    Action: {info['action'] or 'Any'}")
            print(f"    Query: \"{info['description']}\"")
        return
    
    # Load data
    data = load_processed_data(args.input_file)
    steps = data.get("assembly_steps", [])
    metadata = data.get("metadata", {})
    
    print(f"\nLoaded {len(steps)} total steps from: {args.input_file}")
    print(f"Video: {metadata.get('title', 'Unknown')}")
    
    # Apply filters
    if args.query:
        query_info = SEMANTIC_QUERIES[args.query]
        print(f"\nFiltering by query: {args.query}")
        print(f"  -> \"{query_info['description']}\"")
        filtered = filter_by_semantic_query(
            steps,
            query_component=query_info["component"],
            query_action=query_info["action"]
        )
    else:
        filtered = filter_steps(
            steps,
            component=args.component,
            action=args.action,
            min_timestamp=args.min_time,
            max_timestamp=args.max_time,
            confidence=args.confidence
        )
    
    # Print results
    print_steps(filtered, verbose=args.verbose)
    
    # Save if requested
    if args.output:
        save_filtered(filtered, args.output, metadata)


if __name__ == "__main__":
    main()
