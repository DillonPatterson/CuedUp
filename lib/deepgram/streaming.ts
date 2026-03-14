export type DeepgramStreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "closed";

export function createDeepgramStreamingSession() {
  return {
    status: "idle" as DeepgramStreamStatus,
    start() {
      throw new Error("Deepgram streaming is not implemented in this prototype.");
    },
    stop() {
      return "stopped";
    },
  };
}
