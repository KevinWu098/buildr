import type { Part } from "./types";

function formatDetails(details: (string | undefined)[]): string | null {
  const filtered = details.filter(Boolean);
  return filtered.length > 0 ? filtered.join(" • ") : null;
}

export function PartDetails({ part }: { part: Part }) {
  let details: string | null = null;

  switch (part.type) {
    case "CPU":
      details = formatDetails([
        part.cores ? `${part.cores} cores` : undefined,
        part.clockSpeed,
      ]);
      break;
    case "Memory":
      details = formatDetails([part.speed, part.capacity]);
      break;
    case "GPU":
      details = formatDetails([part.vram, part.clockSpeed]);
      break;
    case "Case":
      details = formatDetails([part.formFactor]);
      break;
    case "Motherboard":
      details = formatDetails([part.socket, part.formFactor]);
      break;
  }

  // Fallback to price if no other details
  if (!details && part.price) {
    details = part.price;
  }

  if (!details) return null;

  return <span className="text-muted-foreground text-xs">{details}</span>;
}
