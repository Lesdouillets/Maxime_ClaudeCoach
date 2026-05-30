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
import { TrashIcon } from "@/components/icons";
import CoachMessageBubble from "@/components/coach/CoachMessageBubble";
import CoachInputBar from "@/components/coach/CoachInputBar";
import { getActiveProfile } from "@/lib/profiles";

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
  const [applying, setApplying] = useState<string | null>(null);
  const [adaptMsg, setAdaptMsg] = useState<string | null>(null);
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
    setAdaptMsg(null);
    setSending(true);

    // Message user affiché immédiatement avant la réponse du coach
    const optimisticUser: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    const result = await sendMessage(trimmed);
    // Remplace l'optimistic par l'historique persisté
    setMessages(getChatHistory());

    if (!result) {
      // Affiche l'erreur comme message assistant
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

  const handleApply = async (msgId: string) => {
    if (applying) return;
    setApplying(msgId);
    await applyPendingPlans(msgId);
    setMessages(getChatHistory());
    setApplying(null);
  };

  const handleAdapt = useCallback(() => {
    setAdaptMsg("Décris-moi ce que tu voudrais changer dans ce plan, je l'adapterai en tenant compte de ta demande.");
    // Focus sur l'input après un tick pour laisser le temps au DOM de se mettre à jour
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

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

      {/* Header — sticky avec blur */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(10,10,10,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid var(--color-white-06)", padding: "16px 20px 12px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono font-bold tracking-widest" style={{ fontSize: 13, color: "var(--color-neon)", textTransform: "uppercase" }}>Coach</h1>
            <p style={{ fontSize: 12, color: "var(--color-dim)", letterSpacing: "0.08em" }}>Alex · Coach personnel</p>
          </div>
          {messages.length > 0 && (
            <button onClick={handleClear} disabled={clearing} className="press-effect" style={{ padding: 8, opacity: clearing ? 0.4 : 1 }} aria-label="Effacer l'historique">
              <TrashIcon size={18} color="var(--color-muted)" />
            </button>
          )}
        </div>
      </div>

      {/* Zone messages scrollable */}
      <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: 8 }}>

        {isEmpty ? (
          /* État vide — salutation et suggestions */
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
            <div className="text-center">
              {/* Salutation neon lime */}
              <h2
                className="font-display neon-glow"
                style={{
                  fontWeight: 700,
                  fontVariationSettings: "'wdth' 110",
                  fontSize: 32,
                  color: "var(--color-neon)",
                }}
              >
                Salut {getActiveProfile()?.name ?? "toi"} !
              </h2>
              {/* Sous-titre */}
              <p style={{ color: "#ffffff", fontSize: 15, marginTop: 8 }}>
                Qu&apos;est-ce que je peux faire pour toi ?
              </p>
            </div>
            {/* Chips suggestions — style neutre (pas neon) */}
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="press-effect text-left rounded-2xl px-4 py-3 text-sm"
                  style={{
                    background: "var(--color-white-08)",
                    border: "1px solid var(--color-white-10)",
                    color: "var(--color-secondary)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Liste de messages */
          <div className="flex flex-col gap-3 py-4">
            {messages.map((msg) => (
              <CoachMessageBubble
                key={msg.id}
                message={msg}
                applying={applying === msg.id}
                onApply={() => handleApply(msg.id)}
                onAdapt={handleAdapt}
              />
            ))}

            {/* Message temporaire Adapter (non persisté dans l'historique) */}
            {adaptMsg && (
              <div className="flex justify-start">
                <p style={{ color: "#ffffff", fontSize: 15, whiteSpace: "pre-wrap" }}>{adaptMsg}</p>
              </div>
            )}

            {/* Typing dots — sans bulle, juste les points animés */}
            {sending && (
              <div className="flex justify-start">
                <span className="flex gap-1 items-center" style={{ padding: "12px 4px" }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{
                        background: "var(--color-neon)",
                        animation: `pulse-dot 1.2s ${i * 0.25}s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Barre d'input */}
      <CoachInputBar
        value={input}
        sending={sending}
        textareaRef={textareaRef}
        onChange={(v) => { setInput(v); adjustTextarea(); }}
        onSend={() => handleSend(input)}
        onKeyDown={handleKeyDown}
      />

      <style>{`
        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
