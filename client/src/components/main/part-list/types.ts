export type PartType = "CPU" | "Memory" | "GPU" | "Case";

export interface BasePart {
  name: string;
  type: PartType;
  image?: string;
}

export interface CPUPart extends BasePart {
  type: "CPU";
  cores?: number;
  clockSpeed?: string;
}

export interface MemoryPart extends BasePart {
  type: "Memory";
  capacity?: string;
  speed?: string;
}

export interface GPUPart extends BasePart {
  type: "GPU";
  vram?: string;
  clockSpeed?: string;
}

export interface CasePart extends BasePart {
  type: "Case";
  formFactor?: string;
}

export type Part = CPUPart | MemoryPart | GPUPart | CasePart;

