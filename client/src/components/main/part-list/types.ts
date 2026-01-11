export type PartType = "CPU" | "Memory" | "Case" | "Motherboard";

export interface BasePart {
  id?: number;
  name: string;
  type: PartType;
  image?: string;
  price?: string;
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

export interface CasePart extends BasePart {
  type: "Case";
  formFactor?: string;
}

export interface MotherboardPart extends BasePart {
  type: "Motherboard";
  socket?: string;
  formFactor?: string;
}

export type Part = CPUPart | MemoryPart | CasePart | MotherboardPart;
