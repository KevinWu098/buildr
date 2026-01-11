"use client";

import * as React from "react";
import { ChevronLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DrawerClose,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface PanelHeaderProps {
  /** Panel title displayed prominently */
  title: string;
  /** Optional description text below the title */
  description?: string;
  /** Callback for back button. If provided, shows back button. */
  onBack?: () => void;
  /**
   * If true, wraps back button in DrawerClose for nested drawers.
   * Use this when the panel is inside a vaul Drawer that should close on back.
   */
  asDrawerClose?: boolean;
  /** Optional actions to render on the right side of the header */
  actions?: React.ReactNode;
  /** Additional className for the header */
  className?: string;
  /** Title text size variant */
  titleSize?: "default" | "lg";
}

export function PanelHeader({
  title,
  description,
  onBack,
  asDrawerClose = false,
  actions,
  className,
  titleSize = "lg",
}: PanelHeaderProps) {
  const BackButton = (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={asDrawerClose ? undefined : onBack}
      className="-ml-1"
    >
      <ChevronLeftIcon className="size-5" />
    </Button>
  );

  return (
    <DrawerHeader className={cn("", className)}>
      <div className="flex items-center gap-2">
        {onBack &&
          (asDrawerClose ? (
            <DrawerClose asChild>{BackButton}</DrawerClose>
          ) : (
            BackButton
          ))}
        <DrawerTitle
          className={cn(
            "text-left",
            titleSize === "lg" ? "text-2xl" : "text-xl"
          )}
        >
          {title}
        </DrawerTitle>
        {actions && (
          <div className="ml-auto flex items-center gap-1">{actions}</div>
        )}
      </div>
      {description ? (
        <DrawerDescription className="text-left">
          {description}
        </DrawerDescription>
      ) : (
        <DrawerDescription className="sr-only">{title}</DrawerDescription>
      )}
    </DrawerHeader>
  );
}
