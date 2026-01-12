import { NextRequest, NextResponse } from "next/server";

// WebRTC server URL - in production, this would be an environment variable
const WEBRTC_SERVER_URL =
  process.env.WEBRTC_SERVER_URL || "http://localhost:8080";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward the WebRTC offer to the Python server
    const response = await fetch(`${WEBRTC_SERVER_URL}/offer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`WebRTC server error: ${response.status}`);
    }

    const answer = await response.json();
    return NextResponse.json(answer);
  } catch (error) {
    console.error("WebRTC offer proxy error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to connect to WebRTC server",
      },
      { status: 502 }
    );
  }
}

export async function GET() {
  // Health check to verify WebRTC server is available
  try {
    const response = await fetch(`${WEBRTC_SERVER_URL}/health`);
    if (!response.ok) {
      throw new Error("WebRTC server not responding");
    }
    const health = await response.json();
    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      {
        status: "unavailable",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}


