"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { LoaderIcon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PanelHeader } from "@/components/main/panel-header";
import { PanelShell, PanelContent } from "@/components/main/panel-shell";
import { PartCard } from "./part-card";
import { PartGroup } from "./part-group";
import type { Part, PartType } from "./types";

const API_BASE_URL = "http://localhost:8000";

const mapApiTypeToPartType = (apiType: string): PartType | null => {
  const mapping: Record<string, PartType> = {
    cpu: "CPU",
    memory: "Memory",
    motherboard: "Motherboard",
  };
  return mapping[apiType] ?? null;
};

const mapPartTypeToApiType = (partType: PartType): string | null => {
  const mapping: Record<PartType, string> = {
    CPU: "cpu",
    Memory: "memory",
    Motherboard: "motherboard",
    Case: "case",
  };
  return mapping[partType] ?? null;
};

interface ApiComponent {
  id?: number;
  type: string;
  name: string;
  price?: string;
  image_url?: string;
  core_count?: string;
  clock_speed?: string;
  speed?: string;
  modules?: string;
  socket?: string;
  form_factor?: string;
}

function mapApiComponentToPart(component: ApiComponent): Part | null {
  const partType = mapApiTypeToPartType(component.type);
  if (!partType) return null;

  const basePart = {
    id: component.id,
    name: component.name,
    type: partType,
    price: component.price,
    image: component.image_url,
  };

  if (partType === "CPU") {
    return {
      ...basePart,
      type: "CPU",
      cores: component.core_count ? parseInt(component.core_count) : undefined,
      clockSpeed: component.clock_speed,
    };
  } else if (partType === "Memory") {
    return {
      ...basePart,
      type: "Memory",
      speed: component.speed,
      capacity: component.modules,
    };
  } else if (partType === "Motherboard") {
    return {
      ...basePart,
      type: "Motherboard",
      socket: component.socket,
      formFactor: component.form_factor,
    };
  }

  return null;
}

interface PartSearchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: HTMLElement | null;
  mode: "add" | "edit";
  partType?: PartType;
  editingPart?: Part;
  onSelectPart: (part: Part) => void;
}

export function PartSearchDrawer({
  open,
  onOpenChange,
  container,
  mode,
  partType,
  editingPart,
  onSelectPart,
}: PartSearchDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Part[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Search API call
  const searchParts = useCallback(
    async (query: string) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (partType) {
          const apiType = mapPartTypeToApiType(partType);
          if (apiType) params.set("type", apiType);
        }

        const response = await fetch(
          `${API_BASE_URL}/components/search?${params.toString()}`,
          { signal: abortControllerRef.current.signal }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = (await response.json()) as ApiComponent[];
        const parts = data
          .map(mapApiComponentToPart)
          .filter((p): p is Part => p !== null);

        setSearchResults(parts);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request was cancelled, ignore
          return;
        }
        console.error("Failed to search parts:", error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [partType]
  );

  // Debounced search effect
  useEffect(() => {
    if (!open) return;

    const timeoutId = setTimeout(() => {
      searchParts(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, open, searchParts]);

  // Reset search when drawer opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSearchResults([]);
      // Small delay to ensure drawer is rendered before focusing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Group results by type for display
  const groupedParts = searchResults.reduce(
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
        <PanelShell>
          <PanelHeader
            title={title}
            onBack={() => onOpenChange(false)}
            asDrawerClose
            titleSize="default"
          />

          <PanelContent className="gap-4">
            {/* Search Input */}
            <div className="relative shrink-0">
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
              {isLoading ? (
                <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                  <LoaderIcon className="size-8 animate-spin opacity-50" />
                  <p className="text-sm">Searching...</p>
                </div>
              ) : searchResults.length === 0 ? (
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
                        key={`${part.type}-${part.id ?? part.name}`}
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
          </PanelContent>
        </PanelShell>
      </DrawerContent>
    </Drawer>
  );
}
