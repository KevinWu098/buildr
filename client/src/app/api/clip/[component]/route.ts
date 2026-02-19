import { NextRequest, NextResponse } from "next/server";

const CLIPS_API_URL = process.env.CLIPS_API_URL || "http://localhost:8002";
const VALID_COMPONENTS = ["cpu", "gpu", "ram"] as const;
type Component = (typeof VALID_COMPONENTS)[number];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ component: string }> }
) {
  const { component } = await params;

  if (!VALID_COMPONENTS.includes(component as Component)) {
    return NextResponse.json({ error: "Invalid component" }, { status: 400 });
  }

  const response = await fetch(`${CLIPS_API_URL}/${component}-clip`);
  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch clip URL" },
      { status: 502 }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
