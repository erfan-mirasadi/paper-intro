/**
 * useSceneStore.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Module-level event bus for all cross-scene / scene↔orchestrator signals.
 *
 * Design rules:
 *  - Zero React or external dependencies (safe to call from inside Canvas)
 *  - One-way, fire-and-forget: scenes emit, orchestrator decides what to do
 *  - All subscriptions return an unsubscribe function for proper cleanup
 * ──────────────────────────────────────────────────────────────────────────
 */

export type SceneId = "cave" | "palace" | "ocean";
export type TransitionType = "black" | "tunnel";

type TransitionListener = (type: TransitionType, next: SceneId) => void;
type VoidListener = () => void;

/** Creates a typed mini-bus with emit + subscribe. */
function createBus<T extends (...args: any[]) => void>() {
  const listeners = new Set<T>();

  const emit = (...args: Parameters<T>) =>
    listeners.forEach((fn) => (fn as Function)(...args));

  const subscribe = (fn: T): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  return { emit, subscribe };
}

// ── Scene → Orchestrator: request a scene transition ─────────────────────
const _transition = createBus<TransitionListener>();

/**
 * Called by a scene when it wants to transition to another scene.
 * The orchestrator listens and drives the visual transition.
 *
 * @param type  'black'  → use the HTML black overlay (boot / ocean→cave loop)
 *              'tunnel' → use the 3D CloudTunnel (cave→palace, palace→ocean)
 * @param next  The SceneId to transition into.
 */
export const requestTransition = (type: TransitionType, next: SceneId): void =>
  _transition.emit(type, next);

export const onTransitionRequest = _transition.subscribe;

// ── Scene → Orchestrator: scene content is loaded and ready ──────────────
const _ready = createBus<VoidListener>();

/**
 * Called by a scene (in a useEffect) when its content has finished loading
 * and is ready to be revealed.  The orchestrator uses this to decide when
 * to start fading out the black overlay or CloudTunnel.
 */
export const signalSceneReady = _ready.emit;
export const onSceneReady = _ready.subscribe;

// ── Orchestrator → Scene: intro effect has fully resolved ────────────────
const _intro = createBus<VoidListener>();

/**
 * Emitted by the orchestrator when the intro effect (black overlay or
 * CloudTunnel) has fully cleared and the scene is 100 % visible.
 * Scenes listen to start their Theatre.js sequences / camera playback.
 */
export const signalIntroComplete = _intro.emit;
export const onIntroComplete = _intro.subscribe;
