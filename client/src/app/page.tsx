"use client";

import { useMemo, useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { PartList } from "@/components/main/part-list/part-list";
import { Button } from "@/components/ui/button";
import { PartPhoto } from "@/components/main/part-photo/part-photo";
import { AssemblyList, CameraFeed } from "@/components/main/assembly";
import type { Part, PartType } from "@/components/main/part-list";

const STEPS = ["PART_PHOTO", "PART_LIST", "ASSEMBLY"] as const;

export default function Page() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<(typeof STEPS)[number]>(
    STEPS[0]
  );
  const [confirmedParts, setConfirmedParts] = useState<Record<
    PartType,
    Part[]
  > | null>(null);

  const DRAWER_ACTION = useMemo(() => {
    switch (currentStep) {
      case "PART_PHOTO":
        return "Upload Parts";
      case "PART_LIST":
        return "View Parts";
      case "ASSEMBLY":
        return "View Parts";
    }
  }, [currentStep]);

  const handleConfirmParts = (parts: Record<PartType, Part[]>) => {
    setConfirmedParts(parts);
    setCurrentStep("ASSEMBLY");
    setOpen(false);
  };

  const DRAWER_COMPONENT = useMemo(() => {
    switch (currentStep) {
      case "PART_PHOTO":
        return (
          <PartPhoto
            onBack={() => setOpen(false)}
            onComplete={() => setCurrentStep("PART_LIST")}
          />
        );
      case "PART_LIST":
        return (
          <PartList
            onBack={() => setOpen(false)}
            onComplete={handleConfirmParts}
          />
        );
      case "ASSEMBLY":
        return confirmedParts ? <AssemblyList parts={confirmedParts} /> : null;
      default:
        return "UNKNOWN STEP";
    }
  }, [currentStep, confirmedParts]);

  const isAssemblyMode = currentStep === "ASSEMBLY";

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex grow flex-col rounded-lg p-4 outline-2",
        isAssemblyMode ? "overflow-hidden" : "bg-background"
      )}
    >
      {/* Camera feed - only active in assembly mode */}
      <CameraFeed active={isAssemblyMode} />

      <Drawer
        modal={false}
        direction="bottom"
        container={containerRef.current}
        open={open}
        onOpenChange={setOpen}
      >
        <DrawerTrigger
          className={cn(
            "border-border z-10 mt-auto rounded-lg border-2 transition-[opacity,transform] delay-100 duration-500",
            open && "pointer-events-none -translate-y-16 opacity-0"
          )}
          asChild
        >
          <Button size="lg" className="text-lg">
            {DRAWER_ACTION}
          </Button>
        </DrawerTrigger>

        <DrawerContent
          className={cn(
            "absolute h-full w-full max-w-sm rounded-lg opacity-100 data-[vaul-drawer-direction=bottom]:inset-x-auto data-[vaul-drawer-direction=bottom]:left-1/2 data-[vaul-drawer-direction=bottom]:mt-4 data-[vaul-drawer-direction=bottom]:-translate-x-1/2",
            "data-[vaul-drawer-direction=bottom]:max-h-[85vh]"
          )}
        >
          {DRAWER_COMPONENT}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
