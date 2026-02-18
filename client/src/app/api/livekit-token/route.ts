import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomName = searchParams.get("room") || "assembly-room";
  const participantName = searchParams.get("name") || `user-${Date.now()}`;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "LiveKit configuration missing" },
      { status: 500 }
    );
  }

  try {
    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    // Dispatch the agent to the room so it joins when the client connects
    const agentDispatch = new AgentDispatchClient(wsUrl, apiKey, apiSecret);
    await agentDispatch.createDispatch(roomName, "pc-builder").catch((err) => {
      console.warn("[AgentDispatch] Failed to dispatch agent:", err?.message);
    });

    return NextResponse.json({
      token: jwt,
      url: wsUrl,
      roomName,
    });
  } catch (err) {
    console.error("Failed to generate LiveKit token:", err);
    return NextResponse.json(
      { error: "Failed to generate token", detail: String(err) },
      { status: 500 }
    );
  }
}
