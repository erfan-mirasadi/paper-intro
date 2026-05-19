"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  Suspense,
} from "react";
import type { ReactNode } from "react";
import CloudTunnel from "../environment/CloudTunnel";

interface TransitionControllerValue {
  isTunnelActive: boolean;
  showTunnel: () => void;
  hideTunnel: () => void;
  setSystemSpeed: (speed: number) => void;
  resetTunnel: () => void;
}

const TransitionContext = createContext<TransitionControllerValue | null>(null);

interface TransitionProviderProps {
  children: ReactNode;
  initialActive?: boolean;
  defaultSystemSpeed?: number;
  enableTunnel?: boolean;
}

export function TransitionProvider({
  children,
  initialActive = true,
  defaultSystemSpeed = 80,
  enableTunnel = true,
}: TransitionProviderProps) {
  const [isTunnelActive, setIsTunnelActive] = useState(
    enableTunnel && initialActive,
  );
  const [systemSpeed, setSystemSpeed] = useState(defaultSystemSpeed);
  const [resetSignal, setResetSignal] = useState(0);

  const showTunnel = useCallback(() => {
    setIsTunnelActive(true);
  }, []);

  const hideTunnel = useCallback(() => {
    setIsTunnelActive(false);
  }, []);

  const resetTunnel = useCallback(() => {
    setResetSignal((prev) => prev + 1);
  }, []);

  const value = useMemo(
    () => ({
      isTunnelActive,
      showTunnel,
      hideTunnel,
      setSystemSpeed,
      resetTunnel,
    }),
    [isTunnelActive, showTunnel, hideTunnel, setSystemSpeed, resetTunnel],
  );

  return (
    <TransitionContext.Provider value={value}>
      {children}
      {enableTunnel ? (
        <Suspense fallback={null}>
          <CloudTunnel
            isActive={isTunnelActive}
            systemSpeed={systemSpeed}
            resetSignal={resetSignal}
          />
        </Suspense>
      ) : null}
    </TransitionContext.Provider>
  );
}

export function useTransitionController() {
  const ctx = useContext(TransitionContext);
  if (!ctx) {
    throw new Error(
      "useTransitionController must be used within TransitionProvider",
    );
  }
  return ctx;
}
