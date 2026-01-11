"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { SearchIcon, XIcon, ChevronLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PartCard } from "./part-card";
import { PartGroup } from "./part-group";
import type { Part, PartType } from "./types";

interface PartSearchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: HTMLElement | null;
  mode: "add" | "edit";
  partType?: PartType;
  editingPart?: Part;
  allParts: Part[];
  onSelectPart: (part: Part) => void;
}

export function PartSearchDrawer({
  open,
  onOpenChange,
  container,
  mode,
  partType,
  editingPart,
  allParts,
  onSelectPart,
}: PartSearchDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset search when drawer opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      // Small delay to ensure drawer is rendered before focusing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Filter parts based on search query and optional part type filter
  const filteredParts = allParts.filter((part) => {
    const matchesSearch = part.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = partType ? part.type === partType : true;
    return matchesSearch && matchesType;
  });

  // Group filtered parts by type for display
  const groupedParts = filteredParts.reduce(
    (acc, part) => {
      if (!acc[part.type]) {
        acc[part.type] = [];
      }
      acc[part.type].push(part);
      return acc;
    },
    {} as Record<PartType, Part[]>
  );

  const title =
    mode === "add"
      ? partType
        ? `Add ${partType}`
        : "Add Part"
      : `Edit ${editingPart?.type ?? "Part"}`;

  return (
    <>
      <Drawer
        modal={false}
        direction="bottom"
        open={open}
        onOpenChange={onOpenChange}
        container={container}
      >
        <DrawerContent
          className={cn("absolute z-50 h-full w-full rounded-lg")}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DrawerHeader className="pb-0">
            <div className="flex items-center gap-2">
              <DrawerClose asChild>
                <Button variant="ghost" size="icon-xs" className="-ml-1">
                  <ChevronLeftIcon className="size-5" />
                </Button>
              </DrawerClose>
              <DrawerTitle className="text-left text-xl">{title}</DrawerTitle>
            </div>
            <DrawerDescription className="sr-only">
              Search and select a part
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
            {/* Search Input */}
            <div className="relative">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search parts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1/2 right-1.5 -translate-y-1/2"
                  onClick={() => {
                    setSearchQuery("");
                    inputRef.current?.focus();
                  }}
                >
                  <XIcon className="size-3.5" />
                </Button>
              )}
            </div>

            {/* Search Results */}
            <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
              {filteredParts.length === 0 ? (
                <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                  <SearchIcon className="size-8 opacity-50" />
                  <p className="text-sm">
                    {searchQuery
                      ? `No parts found for "${searchQuery}"`
                      : "Start typing to search for parts"}
                  </p>
                </div>
              ) : (
                Object.entries(groupedParts).map(([type, parts]) => (
                  <PartGroup
                    key={type}
                    partType={type as PartType}
                    parts={parts}
                    renderPart={(part) => (
                      <PartCard
                        key={part.name}
                        part={part}
                        className={cn(
                          editingPart?.name === part.name &&
                            "ring-primary ring-2"
                        )}
                        onClick={() => {
                          onSelectPart(part);
                          onOpenChange(false);
                        }}
                      />
                    )}
                  />
                ))
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
