"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PanelShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A consistent container shell for drawer panels.
 * Provides proper flexbox layout with overflow handling.
 * 
 * Usage:
 * ```tsx
 * <PanelShell>
 *   <PanelHeader title="Title" onBack={handleBack} />
 *   <PanelContent>
 *     {/* main content *\/}
 *   </PanelContent>
 *   <PanelFooter>
 *     <Button>Action</Button>
 *   </PanelFooter>
 * </PanelShell>
 * ```
 */
const PanelShell = React.forwardRef<HTMLDivElement, PanelShellProps>(
  ({ children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex h-full flex-col overflow-hidden",
          className
        )}
      >
        {children}
      </div>
    );
  }
);
PanelShell.displayName = "PanelShell";

interface PanelContentProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Main scrollable content area within a panel.
 * Handles overflow and provides consistent padding.
 */
function PanelContent({ children, className }: PanelContentProps) {
  return (
    <div
      className={cn(
        "flex max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

interface PanelFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Footer area for action buttons within a panel.
 * Sticks to the bottom with consistent padding.
 */
function PanelFooter({ children, className }: PanelFooterProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-row gap-2 border-t px-4 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export { PanelShell, PanelContent, PanelFooter };

