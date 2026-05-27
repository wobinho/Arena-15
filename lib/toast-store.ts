"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";

export type Toast = {
  id: string;
  title: string;
  body?: string;
  tone?: "default" | "success" | "error" | "warning";
};

type ToastState = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
};

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = nanoid(6);
    set({ toasts: [...get().toasts, { id, ...t }] });
    setTimeout(() => get().dismiss(id), 3800);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export function toast(t: Omit<Toast, "id">) {
  return useToasts.getState().push(t);
}
