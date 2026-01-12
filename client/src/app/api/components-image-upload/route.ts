import { type NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const response = await fetch(`${API_BASE_URL}/components-image-upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to proxy image upload:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}


