"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ArrowLeftIcon, EditIcon, TrashIcon } from "lucide-react";
import {
  PartCard,
  PartGroup,
  PartSearchDrawer,
  type Part,
  type PartType,
} from "@/components/main/part-list/index";

const PARTS: Record<PartType, Part[]> = {
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
const ALL_PARTS: Part[] = Object.values(PARTS).flat();

interface PartListProps {
  onBack?: () => void;
}

export function PartList({ onBack }: PartListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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

  const handleSelectPart = (part: Part) => {
    // TODO: Implement part selection logic (add/replace in the list)
    console.log("Selected part:", part);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-full flex-col overflow-hidden"
    >
      <DrawerHeader className="pb-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-xs" onClick={onBack}>
            <ArrowLeftIcon className="size-5" />
          </Button>
          <DrawerTitle className="text-left text-2xl">
            Your Part List
          </DrawerTitle>
        </div>
        <DrawerDescription className="text-left">{null}</DrawerDescription>
      </DrawerHeader>

      <div className="flex max-w-full flex-1 flex-col justify-between gap-6 overflow-hidden p-4">
        <div className="flex max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto">
          {Object.entries(PARTS).map(([partType, parts]) => (
            <PartGroup
              key={partType}
              partType={partType as PartType}
              parts={parts}
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
                  <Button variant="ghost" size="icon-xs">
                    <TrashIcon className="size-4" />
                  </Button>
                </PartCard>
              )}
            />
          ))}
        </div>

        <div className="flex w-full flex-row gap-1">
          <Button className="text-lg" variant="outline" onClick={handleAddPart}>
            Add Part
          </Button>
          <Button className="grow text-lg">Confirm Part List</Button>
        </div>
      </div>

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
    </div>
  );
}
