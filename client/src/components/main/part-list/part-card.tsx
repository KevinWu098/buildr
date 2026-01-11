import type { ReactNode } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PartDetails } from "./part-details";
import type { Part } from "./types";

interface PartCardProps {
  part: Part;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

export function PartCard({
  part,
  onClick,
  className,
  children,
}: PartCardProps) {
  return (
    <Card
      className={cn(
        "hover:bg-accent/50 cursor-pointer rounded-md py-3 transition-colors",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 px-3 py-0">
        {part.image ? (
          <Image
            src={part.image}
            alt={part.name}
            width={100}
            height={100}
            className="size-10 rounded-sm object-cover"
          />
        ) : (
          <div className="bg-muted size-10 shrink-0 rounded-sm" />
        )}

        <div className="mb-auto flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{part.name}</span>
          <PartDetails part={part} />
        </div>

        {children && (
          <div className="ml-auto flex flex-row gap-1">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
