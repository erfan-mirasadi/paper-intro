// TheatreSetup.tsx
// ─────────────────────────────────────────────
// PURE Theatre.js setup. No sequence logic here.
// ─────────────────────────────────────────────
"use client";

// Theatre.js disabled — temporarily commented out per request.
// import { getProject } from "@theatre/core";
// import { SheetProvider } from "@theatre/r3f";
import { useEffect, useState, ReactNode } from "react";
// import projectState from "../data/MainProject.theatre-project-state.json";

// Studio editor (dev only)
// import studio from "@theatre/studio";
// import extension from "@theatre/r3f/dist/extension";
// if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
//   studio.initialize();
//   studio.extend(extension);
// }

// export const project = getProject("MainProject", { state: projectState as any });
// export const mainSheet = project.sheet("MainSheet");

// Minimal runtime stubs so other modules that import `mainSheet` don't crash
// while Theatre.js is commented out. These are lightweight and safe.
export const project = {
  sheet: (_name: string) => ({
    sequence: {
      position: 0,
      pause: () => {},
      play: (_opts?: any) => {},
      iterationCount: 1,
    },
  }),
} as any;

export const mainSheet = project.sheet("MainSheet");

export default function TheatreSetup({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  // Return children directly while Theatre.js is disabled.
  return <>{children}</>;
}
