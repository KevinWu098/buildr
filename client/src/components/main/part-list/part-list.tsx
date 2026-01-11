"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CheckIcon,
  EditIcon,
  LoaderIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

const API_BASE_URL = "http://localhost:8000";

const EMPTY_PARTS: Record<PartType, Part[]> = {
  CPU: [],
  Memory: [],
  Motherboard: [],
  Case: [],
};

const mapPartTypeToApiType = (partType: PartType): string => {
  const mapping: Record<PartType, string> = {
    CPU: "cpu",
    Memory: "memory",
    Motherboard: "motherboard",
    Case: "case",
  };
  return mapping[partType];
};

interface CompatibilityInfo {
  compatible: boolean;
  message?: string;
}

interface PartListProps {
  onBack?: () => void;
  onComplete?: (parts: Record<PartType, Part[]>) => void;
  initialParts?: Record<PartType, Part[]>;
  initialCompatibility?: CompatibilityInfo;
}

export function PartList({
  onBack,
  onComplete,
  initialParts,
  initialCompatibility,
}: PartListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [parts, setParts] = useState<Record<PartType, Part[]>>(
    initialParts ?? EMPTY_PARTS
  );
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<"add" | "edit">("add");
  const [selectedPartType, setSelectedPartType] = useState<
    PartType | undefined
  >();
  const [editingPart, setEditingPart] = useState<Part | undefined>();

  // Compatibility state
  const [compatibility, setCompatibility] = useState<CompatibilityInfo | null>(
    initialCompatibility ?? null
  );
  const [isCheckingCompat, setIsCheckingCompat] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check compatibility whenever parts change
  const checkCompatibility = useCallback(
    async (currentParts: Record<PartType, Part[]>) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Build components list for API
      const components: Array<{ type: string; name: string }> = [];
      for (const [partType, partsList] of Object.entries(currentParts)) {
        const apiType = mapPartTypeToApiType(partType as PartType);
        for (const part of partsList) {
          components.push({ type: apiType, name: part.name });
        }
      }

      // If no parts, clear compatibility
      if (components.length === 0) {
        setCompatibility(null);
        return;
      }

      abortControllerRef.current = new AbortController();
      setIsCheckingCompat(true);

      try {
        const response = await fetch(`${API_BASE_URL}/compatibility-check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(components),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = (await response.json()) as CompatibilityInfo;
        setCompatibility(data);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Failed to check compatibility:", error);
      } finally {
        setIsCheckingCompat(false);
      }
    },
    []
  );

  // Check compatibility when parts change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkCompatibility(parts);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [parts, checkCompatibility]);

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

  // Determine what to show in the compatibility banner
  const showCompatBanner = compatibility?.message || isCheckingCompat;
  const hadIncompatibility = compatibility && !compatibility.compatible;

  return (
    <PanelShell ref={containerRef}>
      <PanelHeader title="Your Part List" onBack={onBack} />

      <PanelContent className="">
        {/* Compatibility Banner */}
        {showCompatBanner && (
          <div
            className={cn(
              "mb-4 flex shrink-0 items-start gap-2 rounded-md p-3 text-sm",
              isCheckingCompat && hadIncompatibility
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : compatibility?.compatible
                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                  : "bg-red-500/10 text-red-700 dark:text-red-400"
            )}
          >
            {isCheckingCompat ? (
              <>
                <LoaderIcon className="mt-0.5 size-4 shrink-0 animate-spin" />
                <p className="line-clamp-3">Checking compatibility...</p>
              </>
            ) : compatibility?.compatible ? (
              <>
                <CheckCircleIcon className="mt-0.5 size-4 shrink-0" />
                <p className="line-clamp-3">
                  {compatibility.message ?? "All parts are compatible!"}
                </p>
              </>
            ) : (
              <>
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                <p className="line-clamp-3">{compatibility?.message}</p>
              </>
            )}
          </div>
        )}

        {Object.entries(parts).map(([partType, partsList]) => (
          <PartGroup
            key={partType}
            partType={partType as PartType}
            parts={partsList}
            renderPart={(part) => (
              <PartCard
                key={`${part.type}-${part.id ?? part.name}`}
                part={part}
              >
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
        onSelectPart={handleSelectPart}
      />
    </PanelShell>
  );
}
