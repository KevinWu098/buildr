"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { PartList } from "@/components/main/part-list/part-list";
import { Button } from "@/components/ui/button";
import { PartPhoto } from "@/components/main/part-photo/part-photo";
import { AssemblyList, CameraFeed } from "@/components/main/assembly";
import { LoaderIcon } from "lucide-react";
import type { Part, PartType } from "@/components/main/part-list";

const STEPS = ["PART_PHOTO", "PART_LIST", "ASSEMBLY"] as const;
const DRAWER_ANIMATION_MS = 300;

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
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  // Transition between steps with drawer animation
  const transitionToStep = useCallback(
    (nextStep: (typeof STEPS)[number], reopenDrawer = true) => {
      setOpen(false);
      setTimeout(() => {
        setCurrentStep(nextStep);
        if (reopenDrawer) {
          setTimeout(() => setOpen(true), 50);
        }
      }, DRAWER_ANIMATION_MS);
    },
    []
  );

  // Handle photo confirmation - close drawer, analyze, then open part list
  const handlePhotoConfirm = useCallback(async (photoDataUrl: string) => {
    setCapturedPhoto(photoDataUrl);
    setOpen(false);
    setIsAnalyzing(true);

    // TODO: Replace with actual API call
    // const response = await fetch('/api/analyze-parts', { ... });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    setIsAnalyzing(false);
    setTimeout(() => {
      setCurrentStep("PART_LIST");
      setTimeout(() => setOpen(true), 50);
    }, DRAWER_ANIMATION_MS);
  }, []);

  const handleConfirmParts = useCallback(
    (parts: Record<PartType, Part[]>) => {
      setConfirmedParts(parts);
      transitionToStep("ASSEMBLY", false);
    },
    [transitionToStep]
  );

  const DRAWER_COMPONENT = useMemo(() => {
    switch (currentStep) {
      case "PART_PHOTO":
        return (
          <PartPhoto
            onBack={() => setOpen(false)}
            onConfirm={handlePhotoConfirm}
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
  }, [currentStep, confirmedParts, handlePhotoConfirm, handleConfirmParts]);

  const isAssemblyMode = currentStep === "ASSEMBLY";

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex grow flex-col overflow-hidden rounded-lg p-4 outline-2",
        !capturedPhoto && !isAssemblyMode && "bg-background"
      )}
    >
      {/* Background: captured photo or camera feed */}
      {capturedPhoto && !isAssemblyMode && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${capturedPhoto})` }}
        />
      )}
      <CameraFeed active={isAssemblyMode} />

      {/* Analyzing overlay */}
      {isAnalyzing && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-sm">
          <LoaderIcon className="text-primary size-12 animate-spin" />
          <p className="text-lg font-medium text-white">Analyzing parts...</p>
        </div>
      )}

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
