"use client";

import { useMemo, useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { PartList } from "@/components/main/part-list";

const STEPS = ["PART_LIST"] as const;

export default function Page() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] =
    useState<(typeof STEPS)[number]>("PART_LIST");

  const DRAWER_COMPONENT = useMemo(() => {
    switch (currentStep) {
      case "PART_LIST":
        return <PartList />;
      default:
        return "UNKNOWN STEP";
    }
  }, [currentStep]);

  return (
    <div
      ref={containerRef}
      className="bg-background relative flex grow flex-col rounded-lg outline-2"
      onClick={(e) => {
        if (open && e.target === e.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <Drawer
        modal={false}
        direction="bottom"
        container={containerRef.current}
        open={open}
        onOpenChange={setOpen}
      >
        <DrawerTrigger
          className={cn(
            "mt-auto h-16 rounded-lg outline-2 transition-[opacity,transform] delay-100 duration-500",
            open && "pointer-events-none -translate-y-16 opacity-0"
          )}
        >
          View Parts
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
