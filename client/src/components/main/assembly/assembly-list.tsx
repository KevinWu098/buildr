"use client";

import { useRef } from "react";
import { PanelHeader } from "@/components/main/panel-header";
import { PanelShell, PanelContent } from "@/components/main/panel-shell";
import {
  PartCard,
  PartGroup,
  type Part,
  type PartType,
} from "@/components/main/part-list/index";

interface AssemblyListProps {
  parts: Record<PartType, Part[]>;
}

export function AssemblyList({ parts }: AssemblyListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter out empty categories for cleaner display
  const nonEmptyParts = Object.entries(parts).filter(
    ([, partsList]) => partsList.length > 0
  ) as [PartType, Part[]][];

  return (
    <PanelShell ref={containerRef}>
      <PanelHeader title="Your Parts" />

      <PanelContent>
        {nonEmptyParts.map(([partType, partsList]) => (
          <PartGroup
            key={partType}
            partType={partType}
            parts={partsList}
            renderPart={(part) => (
              <PartCard key={part.name} part={part} />
            )}
          />
        ))}

        {nonEmptyParts.length === 0 && (
          <div className="text-muted-foreground py-8 text-center">
            <p>No parts to assemble.</p>
          </div>
        )}
      </PanelContent>
    </PanelShell>
  );
}
