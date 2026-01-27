"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { type ReactNode } from "react";
import { ToastProvider } from "./ui/toast";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#8b5cf6", // violet-500
          colorBackground: "#0a0a0b",
          colorInputBackground: "#18181b", // zinc-900
          colorInputText: "#f4f4f5", // zinc-100
          colorText: "#f4f4f5",
          colorTextSecondary: "#a1a1aa", // zinc-400
          borderRadius: "0.5rem",
        },
        elements: {
          card: "bg-[#0a0a0b] border border-zinc-800",
          headerTitle: "text-zinc-100",
          headerSubtitle: "text-zinc-400",
          socialButtonsBlockButton:
            "bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700",
          formButtonPrimary:
            "bg-violet-600 hover:bg-violet-500 text-white",
          footerActionLink: "text-violet-400 hover:text-violet-300",
          identityPreview: "bg-zinc-900 border-zinc-800",
          formFieldInput:
            "bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-violet-500",
          formFieldLabel: "text-zinc-400",
          dividerLine: "bg-zinc-800",
          dividerText: "text-zinc-500",
        },
      }}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ToastProvider>{children}</ToastProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
