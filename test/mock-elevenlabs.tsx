// Test double for @elevenlabs/react: lets a browser test drive messages and tool calls.
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
type Opts = { onConnect?: (x: { conversationId: string }) => void; onMessage?: (x: { message: string; role: string }) => void; onError?: (m: string) => void };
const Ctx = createContext<any>(null);
const tools: Record<string, (p: any) => any> = {};
export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState("disconnected");
  const [isSpeaking, setSpeaking] = useState(false);
  const opts = useRef<Opts>({});
  const api = {
    status, isSpeaking, isMuted: false,
    startSession: (o: Opts) => { opts.current = o; setStatus("connected"); o.onConnect?.({ conversationId: "conv_test" }); },
    endSession: () => setStatus("disconnected"),
    setMuted: () => {},
    getOutputVolume: () => (isSpeaking ? 0.4 + Math.random() * 0.3 : 0),
    getInputVolume: () => 0.2,
  };
  (window as any).__mock = {
    agent: (m: string) => opts.current.onMessage?.({ message: m, role: "agent" }),
    user: (m: string) => opts.current.onMessage?.({ message: m, role: "user" }),
    tool: (name: string, p: any) => tools[name]?.(p),
    speaking: (b: boolean) => setSpeaking(b),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
export const useConversation = () => useContext(Ctx);
export function useConversationClientTool(name: string, fn: (p: any) => any) {
  useEffect(() => { tools[name] = fn; });
}
