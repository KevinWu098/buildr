"use client";

import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface PanelHeaderProps {
  title: string;
  description?: string;
  onBack?: () => void;
}

export function PanelHeader({ title, description, onBack }: PanelHeaderProps) {
  return (
    <DrawerHeader className="pb-0">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" size="icon-xs" onClick={onBack}>
            <ArrowLeftIcon className="size-5" />
          </Button>
        )}
        <DrawerTitle className="text-left text-2xl">{title}</DrawerTitle>
      </div>
      <DrawerDescription className="text-left">
        {description ?? null}
      </DrawerDescription>
    </DrawerHeader>
  );
}

