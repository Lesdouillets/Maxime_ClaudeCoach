"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { PlusIcon } from "@/components/icons/PlusIcon";
import { ArrowUpIcon } from "@/components/icons/ArrowUpIcon";
import { compressImage, type CompressedImage } from "@/lib/imageCompressor";

interface Props {
  value: string;
  sending: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onSend: (image?: CompressedImage | null) => void;
}

export default function CoachInputBar({
  value,
  sending,
  textareaRef,
  onChange,
  onSend,
}: Props) {
  const [pendingImage, setPendingImage] = useState<CompressedImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingImagePreviewSrc = useMemo(
    () => (pendingImage ? `data:${pendingImage.mimeType};base64,${pendingImage.base64}` : null),
    [pendingImage]
  );

  const handleSend = useCallback(() => {
    if ((!value.trim() && !pendingImage) || sending) return;
    const image = pendingImage;
    setPendingImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onSend(image);
  }, [value, pendingImage, sending, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ padding: "8px 16px 16px" }}>
      {/* Cadre externe */}
      <div
        style={{
          borderRadius: "24px",
          border: "1px solid var(--color-white-25)",
          padding: "8px",
          background: "var(--color-background)",
        }}
      >
        {/* Zone de saisie */}
        <div
          style={{
            borderRadius: "16px",
            background: "var(--color-surface-2)",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrire un message..."
            rows={1}
            className="placeholder:text-white/30"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              boxShadow: "none",
              borderRadius: 0,
              resize: "none",
              padding: 0,
              margin: 0,
              color: "#ffffff",
              caretColor: "#ffffff",
              maxHeight: "120px",
              fontSize: "16px",
              lineHeight: "1.4",
              fontFamily: "inherit",
            }}
          />

          {/* Preview de l'image jointe */}
          {pendingImage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingTop: 6,
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImagePreviewSrc ?? ""}
                alt=""
                style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {pendingImage.name}
              </span>
              <button
                onClick={() => {
                  setPendingImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.12)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  color: "#aaa",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                aria-label="Supprimer l'image"
              >
                ✕
              </button>
            </div>
          )}

          {/* Ligne d'actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Ajouter une image"
            >
              <PlusIcon size={20} color="#ffffff" />
            </button>

            <button
              onClick={handleSend}
              disabled={sending || (!value.trim() && !pendingImage)}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--color-orange)",
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                boxSizing: "border-box",
                opacity: (sending || (!value.trim() && !pendingImage)) ? 0.5 : 1,
              }}
            >
              <ArrowUpIcon size={14} color="#ffffff" />
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const compressed = await compressImage(file);
            setPendingImage(compressed);
          } catch (err) {
            console.warn("Compression image échouée", err);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
