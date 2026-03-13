"use client";

import { useEffect, useState, useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

let addToastFn: ((text: string, type?: ToastType) => void) | null = null;

export function toast(text: string, type: ToastType = "success") {
  addToastFn?.(text, type);
}

const typeStyles: Record<ToastType, string> = {
  success: "border-success bg-success-muted text-success",
  error: "border-danger bg-danger-muted text-danger",
  info: "border-accent bg-accent-muted text-accent",
};

let nextId = 0;

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: ToastType = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`border rounded-lg px-4 py-3 text-sm font-medium shadow-lg animate-[slideIn_0.2s_ease-out] ${typeStyles[t.type]}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
