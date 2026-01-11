"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { PanelHeader } from "@/components/main/panel-header";
import {
  PanelShell,
  PanelContent,
  PanelFooter,
} from "@/components/main/panel-shell";
import {
  PartCard,
  PartGroup,
  PartSearchDrawer,
  type Part,
  type PartType,
} from "@/components/main/part-list/index";

const INITIAL_PARTS: Record<PartType, Part[]> = {
  CPU: [
    {
      name: "Intel Core i5-12400F",
      type: "CPU",
      cores: 12,
      clockSpeed: "3.3 GHz",
    },
    {
      name: "AMD Ryzen 5 5600X",
      type: "CPU",
      cores: 6,
      clockSpeed: "3.7 GHz",
    },
    {
      name: "Intel Core i7-12700K",
      type: "CPU",
      cores: 12,
      clockSpeed: "3.6 GHz",
    },
    {
      name: "AMD Ryzen 7 5800X",
      type: "CPU",
      cores: 8,
      clockSpeed: "3.8 GHz",
    },
    {
      name: "Intel Core i9-12900K",
      type: "CPU",
      cores: 16,
      clockSpeed: "3.2 GHz",
    },
    {
      name: "AMD Ryzen 9 5900X",
      type: "CPU",
      cores: 12,
      clockSpeed: "3.7 GHz",
    },
    {
      name: "Intel Core i3-12100F",
      type: "CPU",
      cores: 4,
      clockSpeed: "3.3 GHz",
    },
  ],
  Memory: [
    {
      name: "Corsair Vengeance LPX 16GB (2x8GB) DDR4 3200MHz",
      type: "Memory",
      capacity: "16GB",
      speed: "3200MHz",
    },
    {
      name: "G.Skill Ripjaws V 32GB (2x16GB) DDR4 3600MHz",
      type: "Memory",
      capacity: "32GB",
      speed: "3600MHz",
    },
    {
      name: "Kingston Fury Beast 8GB (2x4GB) DDR4 2666MHz",
      type: "Memory",
      capacity: "8GB",
      speed: "2666MHz",
    },
  ],
  GPU: [],
  Case: [
    {
      name: "Fractal Design Define S",
      type: "Case",
      formFactor: "ATX",
    },
    {
      name: "NZXT H510",
      type: "Case",
      formFactor: "Mid Tower",
    },
    {
      name: "Corsair 4000D Airflow",
      type: "Case",
      formFactor: "Mid Tower",
    },
  ],
};

// All available parts for search (flattened)
const ALL_PARTS: Part[] = Object.values(INITIAL_PARTS).flat();

interface PartListProps {
  onBack?: () => void;
  onComplete?: (parts: Record<PartType, Part[]>) => void;
}

export function PartList({ onBack, onComplete }: PartListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [parts, setParts] = useState<Record<PartType, Part[]>>(INITIAL_PARTS);
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<"add" | "edit">("add");
  const [selectedPartType, setSelectedPartType] = useState<
    PartType | undefined
  >();
  const [editingPart, setEditingPart] = useState<Part | undefined>();

  const handleAddPart = () => {
    setSearchMode("add");
    setSelectedPartType(undefined);
    setEditingPart(undefined);
    setSearchDrawerOpen(true);
  };

  const handleEditPart = (part: Part) => {
    setSearchMode("edit");
    setSelectedPartType(part.type);
    setEditingPart(part);
    setSearchDrawerOpen(true);
  };

  const handleDeletePart = (partToDelete: Part) => {
    setParts((prev) => ({
      ...prev,
      [partToDelete.type]: prev[partToDelete.type].filter(
        (p) => p.name !== partToDelete.name
      ),
    }));
  };

  const handleSelectPart = (part: Part) => {
    if (searchMode === "edit" && editingPart) {
      // Replace the editing part with the new selection
      setParts((prev) => ({
        ...prev,
        [editingPart.type]: prev[editingPart.type].map((p) =>
          p.name === editingPart.name ? part : p
        ),
      }));
    } else {
      // Add mode: add the part to the appropriate category
      setParts((prev) => ({
        ...prev,
        [part.type]: [...prev[part.type], part],
      }));
    }
    setSearchDrawerOpen(false);
  };

  return (
    <PanelShell ref={containerRef}>
      <PanelHeader title="Your Part List" onBack={onBack} />

      <PanelContent>
        {Object.entries(parts).map(([partType, partsList]) => (
          <PartGroup
            key={partType}
            partType={partType as PartType}
            parts={partsList}
            renderPart={(part) => (
              <PartCard key={part.name} part={part}>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditPart(part);
                  }}
                >
                  <EditIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePart(part);
                  }}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </PartCard>
            )}
          />
        ))}
      </PanelContent>

      <PanelFooter>
        <Button className="text-lg" variant="outline" onClick={handleAddPart}>
          <PlusIcon className="size-4" /> Add Part
        </Button>
        <Button className="grow text-lg" onClick={() => onComplete?.(parts)}>
          <CheckIcon className="size-4" />
          Confirm Part List
        </Button>
      </PanelFooter>

      <PartSearchDrawer
        open={searchDrawerOpen}
        onOpenChange={setSearchDrawerOpen}
        container={containerRef.current}
        mode={searchMode}
        partType={selectedPartType}
        editingPart={editingPart}
        allParts={ALL_PARTS}
        onSelectPart={handleSelectPart}
      />
    </PanelShell>
  );
}
