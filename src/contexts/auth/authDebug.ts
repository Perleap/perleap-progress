const enabled = import.meta.env.DEV && import.meta.env.VITE_DEBUG_AUTH === '1';

export function authDebug(...args: unknown[]) {
  if (enabled) {
    console.warn(...args);
  }
}
