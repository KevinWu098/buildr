import { fileURLToPath } from "node:url";
import {
  cli,
  defineAgent,
  type JobContext,
  type JobProcess,
  llm,
  ServerOptions,
  voice,
} from "@livekit/agents";

const { tool } = llm;
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as silero from "@livekit/agents-plugin-silero";
import { BackgroundVoiceCancellation } from "@livekit/noise-cancellation-node";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const RAG_API_URL = process.env.RAG_API_URL || "http://localhost:8001";
const COMPONENTS_API_URL =
  process.env.COMPONENTS_API_URL || "http://localhost:8000";
const ASSEMBLY_API_URL =
  process.env.ASSEMBLY_API_URL || "http://localhost:8002";
const CLIPS_API_URL =
  process.env.CLIPS_API_URL || "http://localhost:8002";

// Track assembly state across the session
// In a typical PC build, RAM should be installed before CPU on the motherboard
type AssemblyComponent = "CPU" | "RAM";
const assembledComponents = new Set<AssemblyComponent>();

// Define the assembly order - RAM first, then CPU
const ASSEMBLY_ORDER: AssemblyComponent[] = ["RAM", "CPU"];

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

ASSEMBLY GUIDANCE:
When users are in the assembly stage and ask what step they should take next, or what to do next:
1. Use the getNextAssemblyStep tool to determine what component should be installed next
2. This tool remembers what has already been assembled and returns the next logical step
3. When providing the next step, say "The next step should be..." followed by a clear instruction
4. Do NOT mention that you are dispatching an action or calling a service - just provide natural guidance

When the user confirms they have completed installing a component, use the markComponentAssembled tool to record it.

VIDEO TUTORIALS:
When users ask how to install or insert a CPU, GPU, or RAM, call the showInstallationVideo tool with the relevant component ("cpu", "gpu", or "ram") to trigger a video tutorial popup in the UI, then provide brief verbal guidance as well.

Be concise and helpful in your responses.`,
      tools: {
        queryCpuKnowledge: tool({
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
        }),
        searchComponents: tool({
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
        }),
        checkCompatibility: tool({
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
        }),
        getNextAssemblyStep: tool({
          description:
            "Get the next assembly step based on what components have already been installed. Use this when the user asks what they should do next during PC assembly. Returns the next component to install (RAM or CPU).",
          parameters: z.object({
            availableComponents: z
              .array(z.enum(["CPU", "RAM"]))
              .optional()
              .describe(
                "List of components the user has available to install. If not provided, assumes both CPU and RAM are available."
              ),
          }),
          execute: async ({
            availableComponents,
          }: {
            availableComponents?: ("CPU" | "RAM")[];
          }) => {
            // Default to both components if not specified
            const available = availableComponents || ["CPU", "RAM"];

            // Find the next component to install based on the assembly order
            const nextComponent = ASSEMBLY_ORDER.find(
              (component) =>
                !assembledComponents.has(component) &&
                available.includes(component)
            );

            if (!nextComponent) {
              // All components have been assembled
              return {
                nextStep: null,
                message: "All components have been assembled!",
                assembledSoFar: Array.from(assembledComponents),
              };
            }

            // Make request to external server with the component value
            try {
              await fetch(`${ASSEMBLY_API_URL}/assembly/next-step`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ component: nextComponent }),
              });
            } catch {
              // Silently continue even if external request fails
              // The guidance should still be provided to the user
            }

            const stepInstructions: Record<AssemblyComponent, string> = {
              RAM: "installing the RAM modules onto the motherboard. Align the notch on the RAM stick with the slot and press down firmly until the clips snap into place.",
              CPU: "installing the CPU onto the motherboard. Lift the retention arm, align the triangle marker on the CPU with the socket, and gently place it in. Then lower the retention arm to secure it.",
            };

            return {
              nextStep: nextComponent,
              instruction: stepInstructions[nextComponent],
              assembledSoFar: Array.from(assembledComponents),
            };
          },
        }),
        markComponentAssembled: tool({
          description:
            "Mark a component as assembled/installed. Use this when the user confirms they have finished installing a component (RAM or CPU).",
          parameters: z.object({
            component: z
              .enum(["CPU", "RAM"])
              .describe("The component that has been assembled"),
          }),
          execute: async ({ component }: { component: "CPU" | "RAM" }) => {
            assembledComponents.add(component);

            // Notify external server that component was assembled
            try {
              await fetch(`${ASSEMBLY_API_URL}/assembly/mark-complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ component }),
              });
            } catch {
              // Silently continue even if external request fails
            }

            return {
              success: true,
              component,
              assembledComponents: Array.from(assembledComponents),
              message: `${component} has been marked as installed.`,
            };
          },
        }),
        showInstallationVideo: tool({
          description:
            "Trigger a video tutorial popup in the UI showing how to install a component. Use this when the user asks how to install or insert a CPU, GPU, or RAM.",
          parameters: z.object({
            component: z
              .enum(["cpu", "gpu", "ram"])
              .describe("The component to show the installation video for"),
          }),
          execute: async ({ component }: { component: "cpu" | "gpu" | "ram" }) => {
            try {
              const encoder = new TextEncoder();
              await ctx.room.localParticipant.publishData(
                encoder.encode(JSON.stringify({ type: "show_video", component })),
                { reliable: true }
              );
              return { success: true, component };
            } catch {
              return { success: false, error: "Failed to send video signal" };
            }
          },
        }),
      },
    });

    const session = new voice.AgentSession({
      vad,
      stt: new deepgram.STT({
        model: "nova-3",
      }),
      llm: "openai/gpt-4.1-mini",
      tts: "cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      turnDetection: "stt",
    });

    await ctx.connect();

    await session.start({
      agent: assistant,
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });

    session.generateReply({
      instructions:
        "Greet the user and let them know you can help with PC building questions, searching for components, and checking compatibility.",
    });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: "pc-builder" }));
