// TheatreSetup.tsx
// ─────────────────────────────────────────────
// PURE Theatre.js setup. No sequence logic here.
// ─────────────────────────────────────────────
"use client";

import { getProject } from "@theatre/core";
import { SheetProvider } from "@theatre/r3f";
import { useEffect, useState, ReactNode } from "react";
import projectState from "../data/MainProject.theatre-project-state.json";

// Uncomment to enable the Studio editor in development:
// import studio from "@theatre/studio";
// import extension from "@theatre/r3f/dist/extension";
// if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
//   studio.initialize();
//   studio.extend(extension);
// }

export const project = getProject("MainProject", { state: projectState as any });
export const mainSheet = project.sheet("MainSheet");

export default function TheatreSetup({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return <SheetProvider sheet={mainSheet}>{children}</SheetProvider>;
}
