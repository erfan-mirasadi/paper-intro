"use client";

import React, { useEffect, useState, useRef } from "react";
import { storyScript, StoryNode } from "./storyData";
import type { SceneId } from "../core/useSceneStore";

interface StoryOverlayProps {
  activeScene: SceneId;
}

export default function StoryOverlay({ activeScene }: StoryOverlayProps) {
  const [activeNode, setActiveNode] = useState<StoryNode | null>(null);
  const [displayNode, setDisplayNode] = useState<StoryNode | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const sceneStartTimeRef = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reference for the text container to track mouse position
  const textContainerRef = useRef<HTMLDivElement>(null);

  // Handle spotlight mouse tracking
  useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (textContainerRef.current) {
        // Calculate mouse position relative to the text container
        const rect = textContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Use requestAnimationFrame for smooth, performant CSS variable updates
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(() => {
          textContainerRef.current?.style.setProperty("--mouse-x", `${x}px`);
          textContainerRef.current?.style.setProperty("--mouse-y", `${y}px`);
        });
      }
    };

    // Attach to window so it tracks even over pointer-events: none elements
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    // Reset timer on scene change
    sceneStartTimeRef.current = Date.now();
    setActiveNode(null);
    setDisplayNode(null);
    setIsVisible(false);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const timeInSeconds = (Date.now() - sceneStartTimeRef.current) / 1000;

      const currentNode = storyScript.find(
        (node) =>
          node.scene === activeScene &&
          timeInSeconds >= node.startTime &&
          timeInSeconds < node.startTime + node.duration,
      );

      setActiveNode(currentNode || null);
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeScene]);

  // Handle smooth transitions
  useEffect(() => {
    if (activeNode) {
      if (displayNode?.id !== activeNode.id) {
        // If we need to switch nodes without hiding first (rare but possible),
        // or just showing a new one.
        setDisplayNode(activeNode);
        // Small delay to allow React to mount the DOM node before fading in
        setTimeout(() => setIsVisible(true), 50);
      }
    } else if (displayNode) {
      // Start fade out
      setIsVisible(false);
      const timeout = setTimeout(() => {
        setDisplayNode(null);
      }, 1500); // Match this with the CSS transition duration
      return () => clearTimeout(timeout);
    }
  }, [activeNode, displayNode]);

  if (!displayNode) return null;

  const showBackdrop = displayNode.hasBackdrop;
  const isTitle = displayNode.type === "title";
  const isTransition = displayNode.type === "transition";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 40, // Between canvas and topmost UI
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor:
          showBackdrop && isVisible ? "rgba(0, 0, 0, 0.55)" : "transparent",
        transition: "background-color 1.5s ease-in-out",
      }}
    >
      <div
        ref={textContainerRef}
        style={{
          textAlign: "center",
          maxWidth: "80%",
          fontFamily: "system-ui, -apple-system, sans-serif",

          // Changed textShadow to drop-shadow filter so it works correctly with transparent text
          filter: "drop-shadow(0px 4px 15px rgba(0,0,0,0.8))",

          // Spotlight Effect Magic
          backgroundImage:
            "radial-gradient(circle 250px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.15) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          color: "transparent", // Fallback

          transform: isVisible ? "translateY(0)" : "translateY(15px)",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 1.5s ease-in-out, transform 1.5s ease-out",
        }}
      >
        {isTitle && (
          <h1
            style={{
              fontSize: "3.5rem",
              letterSpacing: "0.2em",
              margin: 0,
              fontWeight: 300,
              textTransform: "uppercase",
              whiteSpace: "pre-line",
            }}
          >
            {displayNode.text}
          </h1>
        )}
        {displayNode.type === "text" && (
          <p style={{ fontSize: "1.8rem", lineHeight: 1.6, margin: 0, fontWeight: 300, whiteSpace: "pre-line" }}>
            {displayNode.text}
          </p>
        )}
        {isTransition && (
          <h2
            style={{
              fontSize: "2.2rem",
              letterSpacing: "0.1em",
              fontStyle: "italic",
              margin: 0,
              fontWeight: 300,
              whiteSpace: "pre-line",
            }}
          >
            {displayNode.text}
          </h2>
        )}
      </div>
    </div>
  );
}
