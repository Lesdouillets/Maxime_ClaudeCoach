"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getChatHistory,
  sendMessage,
  clearChatHistory,
  loadChatFromSupabase,
  applyPendingPlans,
  type ChatMessage,
} from "@/lib/coachChat";

const SUGGESTIONS = [
  "Développer les épaules",
  "Préparer un marathon",
  "Que penses-tu de ma dernière semaine ?",
];

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(getChatHistory());
    loadChatFromSupabase().then(() => {
      setMessages(getChatHistory());
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);

    // Optimistic: show user message immediately
    const optimisticUser: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    const result = await sendMessage(trimmed);
    // Replace optimistic with persisted history
    setMessages(getChatHistory());

    if (!result) {
      // Show error as system message
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Désolé, une erreur est survenue. Réessaie dans un instant.",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
    setSending(false);
  }, [sending]);

  const handleClear = async () => {
    if (clearing) return;
    setClearing(true);
    await clearChatHistory();
    setMessages([]);
    setClearing(false);
  };

  const [applying, setApplying] = useState<string | null>(null); // msgId being applied

  const handleApply = async (msgId: string) => {
    if (applying) return;
    setApplying(msgId);
    await applyPendingPlans(msgId);
    setMessages(getChatHistory());
    setApplying(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const adjustTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const isEmpty = messages.length === 0 && !sending;

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-safe-top"
        style={{
          paddingTop: `calc(env(safe-area-inset-top, 0px) + 16px)`,
          paddingBottom: "12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,10,0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div>
          <h1
            className="font-display tracking-widest"
            style={{ fontSize: "22px", color: "#39ff14", letterSpacing: "0.12em" }}
          >
            COACH
          </h1>
          <p className="text-xs font-medium" style={{ color: "#444", letterSpacing: "0.08em" }}>
            Alex · Coach personnel
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            disabled={clearing}
            className="press-effect"
            style={{ padding: "8px", opacity: clearing ? 0.4 : 1 }}
            aria-label="Effacer l'historique"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ paddingBottom: "8px" }}
      >
        {isEmpty ? (
          /* Welcome state with suggestion chips */
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="#39ff14" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: "#888" }}>
                Dis-moi ce que tu veux travailler
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="press-effect text-left rounded-2xl px-4 py-3 text-sm"
                  style={{
                    background: "#0a130a",
                    border: "1px solid rgba(57,255,20,0.2)",
                    color: "#aaa",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                  style={{
                    maxWidth: "82%",
                    ...(msg.role === "user"
                      ? {
                          background: "rgba(57,255,20,0.06)",
                          border: "1px solid rgba(57,255,20,0.18)",
                          color: "#ddd",
                          borderBottomRightRadius: "6px",
                        }
                      : {
                          background: "#0a130a",
                          border: "1px solid rgba(57,255,20,0.2)",
                          color: "#aaa",
                          borderBottomLeftRadius: "6px",
                        }),
                  }}
                >
                  {msg.role === "assistant" && (
                    <p
                      className="text-[10px] font-bold tracking-widest mb-1"
                      style={{ color: "#39ff14" }}
                    >
                      ALEX
                    </p>
                  )}
                  <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                  {msg.pendingPlans && msg.pendingPlans.length > 0 && (
                    <button
                      onClick={() => handleApply(msg.id)}
                      disabled={applying === msg.id}
                      className="press-effect flex items-center gap-1.5 mt-2 text-[11px] font-bold px-3 py-1.5 rounded-xl"
                      style={{
                        background: applying === msg.id ? "rgba(57,255,20,0.05)" : "rgba(57,255,20,0.12)",
                        color: applying === msg.id ? "#555" : "#39ff14",
                        border: "1px solid rgba(57,255,20,0.3)",
                        transition: "all 0.2s",
                      }}
                    >
                      {applying === msg.id ? "Application…" : `Appliquer ce plan (${msg.pendingPlans.length} séance${msg.pendingPlans.length > 1 ? "s" : ""}) ✓`}
                    </button>
                  )}
                  {msg.modifiedCount != null && msg.modifiedCount > 0 && (
                    <span
                      className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(57,255,20,0.1)",
                        color: "#39ff14",
                        border: "1px solid rgba(57,255,20,0.25)",
                      }}
                    >
                      {msg.modifiedCount} séance{msg.modifiedCount > 1 ? "s" : ""} créée{msg.modifiedCount > 1 ? "s" : ""}/adaptée{msg.modifiedCount > 1 ? "s" : ""} ✓
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-4 py-3"
                  style={{
                    background: "#0a130a",
                    border: "1px solid rgba(57,255,20,0.2)",
                    borderBottomLeftRadius: "6px",
                  }}
                >
                  <p className="text-[10px] font-bold tracking-widest mb-2" style={{ color: "#39ff14" }}>
                    ALEX
                  </p>
                  <span className="flex gap-1 items-center">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{
                          background: "#39ff14",
                          animation: `pulse-dot 1.2s ${i * 0.25}s ease-in-out infinite`,
                        }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          padding: "12px 16px",
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 80px)`,
        }}
      >
        <div
          className="flex items-end gap-2 rounded-2xl px-3 py-2"
          style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message à Alex..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed"
            style={{
              color: "#ddd",
              caretColor: "#39ff14",
              maxHeight: "120px",
            }}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || sending}
            className="press-effect flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: input.trim() && !sending ? "rgba(57,255,20,0.15)" : "transparent",
              border: `1px solid ${input.trim() && !sending ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.08)"}`,
              transition: "all 0.2s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                stroke={input.trim() && !sending ? "#39ff14" : "#444"}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
