"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { PartList } from "@/components/main/part-list/part-list";
import { Button } from "@/components/ui/button";
import { PartPhoto } from "@/components/main/part-photo/part-photo";
import { AssemblyList, CameraFeed } from "@/components/main/assembly";
import { VoiceAgentButton } from "@/components/main/voice-agent";
import { LoaderIcon } from "lucide-react";
import type { Part, PartType } from "@/components/main/part-list";
import Image from "next/image";

const STEPS = ["PART_PHOTO", "PART_LIST", "ASSEMBLY"] as const;
const DRAWER_ANIMATION_MS = 300;
// Use relative URLs to hit the Next.js API proxy (works via ngrok from any device)
const API_BASE_URL = "/api";

const mapApiTypeToPartType = (apiType: string): PartType | null => {
  const mapping: Record<string, PartType> = {
    cpu: "CPU",
    memory: "Memory",
    motherboard: "Motherboard",
  };
  return mapping[apiType] ?? null;
};

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

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
  const [detectedParts, setDetectedParts] = useState<Record<
    PartType,
    Part[]
  > | null>(null);
  const [initialCompatibility, setInitialCompatibility] = useState<{
    compatible: boolean;
    message?: string;
  } | null>(null);

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

    try {
      // Convert data URL to Blob and create FormData
      const blob = await dataUrlToBlob(photoDataUrl);
      const formData = new FormData();
      formData.append("components_image", blob, "photo.jpg");

      // Call the backend API
      const response = await fetch(`${API_BASE_URL}/components-image-upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        components: Array<{
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
        }>;
        compatible: boolean;
        message?: string;
      };

      // Map API response to frontend Part types
      const partsMap: Record<PartType, Part[]> = {
        CPU: [],
        Memory: [],
        Case: [],
        Motherboard: [],
      };

      for (const component of data.components) {
        const partType = mapApiTypeToPartType(component.type);
        if (partType) {
          const basePart = {
            id: component.id,
            name: component.name,
            type: partType,
            price: component.price,
            image: component.image_url,
          };

          if (partType === "CPU") {
            partsMap.CPU.push({
              ...basePart,
              type: "CPU",
              cores: component.core_count
                ? parseInt(component.core_count)
                : undefined,
              clockSpeed: component.clock_speed,
            });
          } else if (partType === "Memory") {
            partsMap.Memory.push({
              ...basePart,
              type: "Memory",
              speed: component.speed,
              capacity: component.modules,
            });
          } else if (partType === "Motherboard") {
            partsMap.Motherboard.push({
              ...basePart,
              type: "Motherboard",
              socket: component.socket,
              formFactor: component.form_factor,
            });
          }
        }
      }

      setDetectedParts(partsMap);
      setInitialCompatibility({
        compatible: data.compatible,
        message: data.message,
      });
    } catch (error) {
      console.error("Failed to analyze image:", error);
      // Set empty parts on error so user can still add manually
      setDetectedParts({
        CPU: [],
        Memory: [],
        Case: [],
        Motherboard: [],
      });
      setInitialCompatibility(null);
    }

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

  // Go back from part list to part photo, resetting state
  const handleBackToPartPhoto = useCallback(() => {
    setOpen(false);
    setTimeout(() => {
      setCapturedPhoto(null);
      setDetectedParts(null);
      setCurrentStep("PART_PHOTO");
      setTimeout(() => setOpen(true), 50);
    }, DRAWER_ANIMATION_MS);
  }, []);

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
            onBack={handleBackToPartPhoto}
            onComplete={handleConfirmParts}
            initialParts={detectedParts ?? undefined}
            initialCompatibility={initialCompatibility ?? undefined}
          />
        );
      case "ASSEMBLY":
        return confirmedParts ? <AssemblyList parts={confirmedParts} /> : null;
      default:
        return "UNKNOWN STEP";
    }
  }, [
    currentStep,
    confirmedParts,
    detectedParts,
    initialCompatibility,
    handlePhotoConfirm,
    handleConfirmParts,
    handleBackToPartPhoto,
  ]);

  const isAssemblyMode = currentStep === "ASSEMBLY";

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex grow flex-col justify-end gap-2 overflow-hidden rounded-lg p-4 outline-2",
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
          <LoaderIcon className="size-12 animate-spin text-white" />
          <p className="text-lg font-medium text-white">Analyzing parts...</p>
        </div>
      )}

      {isAssemblyMode && (
        <div className="z-10 mt-auto w-full">
          <VoiceAgentButton />
        </div>
      )}

      {currentStep === "PART_PHOTO" && !isAnalyzing && (
        <div className="z-10 mt-8 mb-auto w-full text-center">
          <div>
            <h1 className="text-8xl font-semibold">Buildr</h1>
            <div className="text-muted-foreground text-2xl">
              PC building made easy
            </div>
          </div>

          <Image
            src="/pc-crop.gif"
            alt="PC Gif"
            width={600}
            height={600}
            unoptimized
            className="w-[800%] max-w-[200%] -translate-x-1/4 pt-8"
          />
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
            "z-10 rounded-lg transition-[opacity,transform] delay-100 duration-500",
            open && "pointer-events-none -translate-y-16 opacity-0"
          )}
          asChild
        >
          <div className="flex flex-col items-center gap-2">
            <Button size="lg" className="border-border w-full border-2 text-lg">
              {DRAWER_ACTION}
            </Button>
          </div>
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
