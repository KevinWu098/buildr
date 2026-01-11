import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EditIcon, TrashIcon } from "lucide-react";
import Image from "next/image";

type PartType = "CPU" | "Memory" | "GPU" | "Case";

interface BasePart {
  name: string;
  type: PartType;
  image?: string;
}

interface CPUPart extends BasePart {
  type: "CPU";
  cores?: number;
  clockSpeed?: string;
}

interface MemoryPart extends BasePart {
  type: "Memory";
  capacity?: string;
  speed?: string;
}

interface GPUPart extends BasePart {
  type: "GPU";
  vram?: string;
  clockSpeed?: string;
}

interface CasePart extends BasePart {
  type: "Case";
  formFactor?: string;
}

type Part = CPUPart | MemoryPart | GPUPart | CasePart;

function PartDetails({ part }: { part: Part }) {
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

export function PartList() {
  return (
    <>
      <DrawerHeader className="pb-0">
        <DrawerTitle className="text-left text-2xl">Your Part List</DrawerTitle>
        <DrawerDescription className="text-left">{null}</DrawerDescription>
      </DrawerHeader>

      <div className="flex max-w-full flex-1 flex-col justify-between gap-6 p-4">
        <div className="flex max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto">
          {Object.entries(PARTS).map(([partType, parts]) => {
            return (
              <div key={partType} className="flex max-w-full shrink-0 flex-col">
                <div className="bg-background sticky top-0 z-10 backdrop-blur-sm">
                  <h3 className="text-muted-foreground -mx-1 px-2 text-lg font-semibold tracking-wider uppercase">
                    {partType}
                  </h3>
                </div>

                <div className="flex flex-col gap-2 px-2 pt-1 pb-4">
                  {parts.length > 0 ? (
                    parts.map((part) => (
                      <Card
                        key={part.name}
                        className="hover:bg-accent/50 cursor-pointer rounded-md py-3 transition-colors"
                      >
                        <CardContent className="flex items-center gap-3 px-3 py-0">
                          {part.image ? (
                            <Image
                              src={part.image}
                              alt={part.name}
                              width={100}
                              height={100}
                            />
                          ) : (
                            <div className="bg-muted size-10 rounded-sm" />
                          )}

                          <div className="mb-auto flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium">
                              {part.name}
                            </span>
                            <PartDetails part={part} />
                          </div>

                          <div className="ml-auto flex flex-row gap-1">
                            <Button variant="ghost" size="icon-xs">
                              <EditIcon className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon-xs">
                              <TrashIcon className="size-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="border-muted-foreground/25 text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                      No {partType.toLowerCase()} selected
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="shrink-0">
          <Button size="lg" className="w-full text-lg">
            Confirm Part List
          </Button>
        </div>
      </div>
    </>
  );
}
