import type { ReactNode } from "react";
import type { Part, PartType } from "./types";

interface PartGroupProps {
  partType: PartType;
  parts: Part[];
  renderPart: (part: Part) => ReactNode;
}

export function PartGroup({ partType, parts, renderPart }: PartGroupProps) {
  return (
    <div className="flex max-w-full shrink-0 flex-col">
      <div className="bg-background sticky top-0 z-10 backdrop-blur-sm">
        <h3 className="text-muted-foreground -mx-1 px-2 text-lg font-semibold tracking-wider uppercase">
          {partType}
        </h3>
      </div>

      <div className="flex flex-col gap-2 px-2 pt-1 pb-4">
        {parts.length > 0 ? (
          parts.map((part) => renderPart(part))
        ) : (
          <div className="border-muted-foreground/25 text-muted-foreground box-border rounded-md border border-dashed px-3 py-3 text-center text-sm">
            <div className="flex h-9.5 items-center justify-center text-center leading-1">
              <p>No {partType.toLowerCase()} selected</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
