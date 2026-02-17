import { signal, state, zeneffect } from "/assets/runtime.11111111.js";

export const zenSignal = signal;
export const zenState = state;
export const zenEffect = zeneffect;

export function zenOnMount(callback) {
  if (typeof callback !== 'function') {
    throw new Error('[Zenith Core] zenOnMount(callback) requires callback function');
  }

  let cleanup = null;
  const run = () => {
    const maybeCleanup = callback();
    cleanup = typeof maybeCleanup === 'function' ? maybeCleanup : null;
  };

  if (typeof document === 'object') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      queueMicrotask(run);
    }
  } else {
    run();
  }

  return function disposeOnMount() {
    if (typeof cleanup === 'function') {
      cleanup();
      cleanup = null;
    }
  };
}

export { signal, state, zeneffect };
