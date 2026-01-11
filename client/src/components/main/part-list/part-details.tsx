import type { Part } from "./types";

export function PartDetails({ part }: { part: Part }) {
  switch (part.type) {
    case "CPU":
      return (
        <span className="text-muted-foreground text-xs">
          {part.cores} cores • {part.clockSpeed}
        </span>
      );
    case "Memory":
      return (
        <span className="text-muted-foreground text-xs">
          {part.capacity} • {part.speed}
        </span>
      );
    case "GPU":
      return (
        <span className="text-muted-foreground text-xs">
          {part.vram} • {part.clockSpeed}
        </span>
      );
    case "Case":
      return (
        <span className="text-muted-foreground text-xs">{part.formFactor}</span>
      );
    default:
      return null;
  }
}

