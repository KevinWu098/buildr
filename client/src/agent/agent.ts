import { fileURLToPath } from "node:url";
import {
  cli,
  defineAgent,
  type JobContext,
  type JobProcess,
  voice,
  WorkerOptions,
} from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as silero from "@livekit/agents-plugin-silero";
import { BackgroundVoiceCancellation } from "@livekit/noise-cancellation-node";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad! as silero.VAD;

    const assistant = new voice.Agent({
      instructions: "You are a helpful voice AI assistant.",
    });

    const session = new voice.AgentSession({
      vad,
      stt: new deepgram.STT({
        model: "nova-3",
        endpointing: 25,
      }),
      llm: "openai/gpt-4.1-mini",
      tts: "cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      turnDetection: "stt",
    });

    await session.start({
      agent: assistant,
      room: ctx.room,
      inputOptions: {
        // For telephony applications, use `TelephonyBackgroundVoiceCancellation` for best results
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });

    await ctx.connect();

    const handle = session.generateReply({
      instructions: "Greet the user and offer your assistance.",
    });
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
