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
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const RAG_API_URL = process.env.RAG_API_URL || "http://localhost:8001";
const COMPONENTS_API_URL =
  process.env.COMPONENTS_API_URL || "http://localhost:8000";

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad! as silero.VAD;

    const assistant = new voice.Agent({
      instructions: `You are a helpful PC building assistant. You help users understand PC components, check compatibility, and answer questions about CPUs, memory, and motherboards.

When users ask about specific CPUs, prices, or integrated graphics, use the queryCpuKnowledge tool to get accurate information.
When users want to search for components, use the searchComponents tool.
When users want to check if their parts are compatible, use the checkCompatibility tool.

Be concise and helpful in your responses.`,
      tools: {
        queryCpuKnowledge: {
          description:
            "Query the CPU knowledge base to get information about CPU prices, integrated graphics, and specifications. Use this when users ask about specific CPUs or want CPU recommendations.",
          parameters: z.object({
            query: z
              .string()
              .describe(
                "Natural language query about CPUs, e.g. 'What is the price of Ryzen 5 7600X?' or 'Does the i7-14700K have integrated graphics?'"
              ),
          }),
          execute: async ({ query }: { query: string }) => {
            try {
              const response = await fetch(`${RAG_API_URL}/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
              });
              if (!response.ok) {
                return { error: "Failed to query CPU knowledge base" };
              }
              const data = await response.json();
              return {
                answer: data.answer,
                matchedCpu: data.matched_cpu,
              };
            } catch (error) {
              return { error: "CPU knowledge base is unavailable" };
            }
          },
        },
        searchComponents: {
          description:
            "Search for PC components by name. Returns matching CPUs, memory, and motherboards from the database.",
          parameters: z.object({
            query: z.string().describe("Search query for component name"),
            type: z
              .enum(["cpu", "memory", "motherboard"])
              .optional()
              .describe("Filter by component type"),
          }),
          execute: async ({
            query,
            type,
          }: {
            query: string;
            type?: "cpu" | "memory" | "motherboard";
          }) => {
            try {
              const params = new URLSearchParams({ q: query });
              if (type) params.append("type", type);
              const response = await fetch(
                `${COMPONENTS_API_URL}/components/search?${params}`
              );
              if (!response.ok) {
                return { error: "Failed to search components" };
              }
              const data = await response.json();
              return {
                components: data
                  .slice(0, 5)
                  .map((c: Record<string, unknown>) => ({
                    name: c.name,
                    type: c.type,
                    price: c.price,
                  })),
              };
            } catch (error) {
              return { error: "Component search is unavailable" };
            }
          },
        },
        checkCompatibility: {
          description:
            "Check if PC components are compatible with each other. Verifies memory type compatibility with motherboards.",
          parameters: z.object({
            components: z
              .array(
                z.object({
                  type: z.enum(["cpu", "memory", "motherboard"]),
                  name: z.string().describe("Component name"),
                })
              )
              .describe("List of components to check compatibility for"),
          }),
          execute: async ({
            components,
          }: {
            components: Array<{
              type: "cpu" | "memory" | "motherboard";
              name: string;
            }>;
          }) => {
            try {
              const response = await fetch(
                `${COMPONENTS_API_URL}/compatibility-check`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(components),
                }
              );
              if (!response.ok) {
                return { error: "Failed to check compatibility" };
              }
              const data = await response.json();
              return {
                compatible: data.compatible,
                message: data.message || "All components are compatible!",
              };
            } catch (error) {
              return { error: "Compatibility check is unavailable" };
            }
          },
        },
      },
    });

    const session = new voice.AgentSession({
      vad,
      stt: new deepgram.STTv2({
        model: "flux-general-en",
        eagerEotThreshold: 0.4,
      }),
      llm: "openai/gpt-4.1-mini",
      tts: "cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      turnDetection: "stt",
    });

    await session.start({
      agent: assistant,
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });

    await ctx.connect();

    session.generateReply({
      instructions:
        "Greet the user and let them know you can help with PC building questions, searching for components, and checking compatibility.",
    });
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
