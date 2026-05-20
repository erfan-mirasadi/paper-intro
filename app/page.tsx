"use client";

import SceneOrchestrator from "./components/core/SceneOrchestrator";

/**
 * Root page — now a thin shell.
 * SceneOrchestrator owns the Canvas, HTML overlay, and all scene logic.
 */
export default function Home() {
  return <SceneOrchestrator />;
}
