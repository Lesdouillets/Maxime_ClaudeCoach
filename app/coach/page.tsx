"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getChatHistory,
  sendMessage,
  clearChatHistory,
  loadChatFromSupabase,
  applyPendingPlans,
  type ChatMessage,
  type ChatAttachments,
} from "@/lib/coachChat";
import type { CompressedImage } from "@/lib/imageCompressor";
import { TrashIcon } from "@/components/icons";
import CoachMessageBubble from "@/components/coach/CoachMessageBubble";
import CoachBottomBar from "@/components/coach/CoachBottomBar";
import { getActiveProfile } from "@/lib/profiles";


export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [adaptMsg, setAdaptMsg] = useState<string | null>(null);
  const [failedMessage, setFailedMessage] = useState<{ id: string; text: string; image: CompressedImage | null } | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("coach-page");
    return () => document.documentElement.classList.remove("coach-page");
  }, []);

  useEffect(() => {
    setProfileName(getActiveProfile()?.name ?? null);
    setMessages(getChatHistory());
    loadChatFromSupabase().then(() => {
      setMessages(getChatHistory());
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);


  const handleSend = useCallback(async (text: string, image?: CompressedImage | null) => {
    const trimmed = text.trim();
    if (!trimmed && !image) return;
    if (sending) return;
    setInput("");
    setAdaptMsg(null);
    setSending(true);
    setFailedMessage(null);

    const attachments: ChatAttachments | undefined = image
      ? { imageBase64: image.base64, imageMimeType: image.mimeType }
      : undefined;

    // Message user affiché immédiatement avant la réponse du coach
    const optimisticUser: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: trimmed,
      ...(image && { imageBase64: image.base64 }),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    const result = await sendMessage(trimmed, attachments);

    if (result) {
      setMessages(getChatHistory());
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticUser.id ? { ...m, error: true } : m))
      );
      setFailedMessage({ id: optimisticUser.id, text: trimmed, image: image ?? null });
    }
    setSending(false);
  }, [sending]);

  const handleRetry = useCallback(async () => {
    if (!failedMessage || sending) return;
    const { id, text, image } = failedMessage;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setFailedMessage(null);
    await handleSend(text, image);
  }, [failedMessage, sending, handleSend]);

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

  const adjustTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const isEmpty = messages.length === 0 && !sending;

  return (
    <div className="flex flex-col" style={{ height: "100dvh", overflow: "hidden", position: "relative" }}>

      {/* Bouton clear — visible uniquement quand il y a des messages */}
      {messages.length > 0 && (
        <div style={{ position: "absolute", top: 16, right: 20, zIndex: 10 }}>
          <button onClick={handleClear} disabled={clearing} className="press-effect" style={{ padding: 8, opacity: clearing ? 0.4 : 1 }} aria-label="Effacer l'historique">
            <TrashIcon size={18} color="var(--color-muted)" />
          </button>
        </div>
      )}

      {/* Zone messages scrollable */}
      {/* Évite une scrollbar fantôme sur l'état vide */}
      <div className="flex-1 px-4" style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 250px)",
        overflowY: isEmpty ? "hidden" : "auto",
        overscrollBehavior: "contain",
      }}>

        {isEmpty ? (
          /* État vide — salutation */
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="text-center">
              <h2
                style={{
                  fontFamily: "var(--font-serif-display)",
                  fontWeight: 700,
                  fontSize: 34,
                  color: "var(--color-neon)",
                  lineHeight: 1.15,
                }}
              >
                Salut {profileName ?? "toi"}&nbsp;!
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-serif-display)",
                  fontWeight: 400,
                  color: "#ffffff",
                  fontSize: 18,
                  marginTop: 12,
                  lineHeight: 1.4,
                }}
              >
                Qu&apos;est-ce que je peux faire pour toi&nbsp;?
              </p>
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
                isError={msg.error === true}
                onRetry={msg.error ? handleRetry : undefined}
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

      <CoachBottomBar
        value={input}
        sending={sending}
        textareaRef={textareaRef}
        onChange={(v) => { setInput(v); adjustTextarea(); }}
        onSend={(image) => handleSend(input, image)}
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
