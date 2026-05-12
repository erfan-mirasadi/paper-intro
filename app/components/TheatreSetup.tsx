// TheatreSetup.tsx
"use client";

import { getProject } from "@theatre/core";
import { SheetProvider } from "@theatre/r3f";
import { useEffect, useState, ReactNode } from "react";

// Uncomment these when you want to use the Theatre.js studio
import studio from "@theatre/studio";
import extension from "@theatre/r3f/dist/extension";

// Only run studio in development to avoid issues in production
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  studio.initialize();
  studio.extend(extension);
}

// You can import your state.json later and add it here like: { state: projectState }
const project = getProject("MainProject");
export const mainSheet = project.sheet("MainSheet");

export default function TheatreSetup({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return <SheetProvider sheet={mainSheet}>{children}</SheetProvider>;
}
