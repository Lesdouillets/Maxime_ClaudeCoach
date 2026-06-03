"use client";

import { useEffect, useRef, useState } from "react";

const MAX_LENGTH = 500;

interface NoteModalProps {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (note: string) => void;
}

export default function NoteModal({ open, initialValue, onClose, onSave }: NoteModalProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      // Defer focus until after the modal mounts so iOS doesn't fight the keyboard.
      const id = requestAnimationFrame(() => textareaRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open, initialValue]);

  if (!open) return null;

  const handleSave = () => {
    onSave(value.trim());
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "var(--color-overlay)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 64px)",
        paddingLeft: 20,
        paddingRight: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-3xl w-full max-w-md p-4"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-subtle)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onClose}
            className="btn-icon btn-icon-surface press-effect"
            aria-label="Fermer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-bold text-base">Notes</span>
          <button
            onClick={handleSave}
            className="btn-icon btn-icon-white press-effect"
            aria-label="Sauvegarder"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5L20 7" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="Ajouter du texte ici..."
          rows={6}
          maxLength={MAX_LENGTH}
          className="w-full resize-none focus:outline-none rounded-2xl px-4 py-3"
          style={{
            background: "var(--color-surface-3)",
            border: "1px solid var(--color-subtle)",
            color: "var(--color-text)",
            fontSize: 14,
            minHeight: 160,
          }}
        />

        {/* Char counter */}
        <p className="text-right text-xs mt-2 text-muted">
          {value.length}/{MAX_LENGTH}
        </p>
      </div>
    </div>
  );
}
