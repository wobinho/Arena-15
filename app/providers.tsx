"use client";

import { ConvexProvider } from "convex/react";
import { convex } from "@/lib/convex";
import { AuthBootstrap } from "@/lib/auth-store";
import { AuthGateModal } from "@/components/auth/AuthGateModal";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <AuthBootstrap />
      <AuthGateModal />
      {children}
    </ConvexProvider>
  );
}
