/* Auth store — guest-first SaaS account state backed by real API routes. */
"use client";

import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  plan: "free" | "pro" | "business";
}

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  load: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  setPlan: (plan: AuthUser["plan"]) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,

  load: async () => {
    try {
      const res = await fetch("/api/auth", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user ?? null, ready: true });
        return;
      }
    } catch {
      // offline / server unavailable — stay guest
    }
    set({ user: null, ready: true });
  },

  signIn: async (email, password) => {
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Sign in failed");
    set({ user: data.user });
  },

  signUp: async (email, password, name) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Sign up failed");
    set({ user: data.user });
  },

  signOut: async () => {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    set({ user: null });
  },

  setPlan: async (plan) => {
    const res = await fetch("/api/billing/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Plan change failed");
    set({ user: data.user });
  },
}));
