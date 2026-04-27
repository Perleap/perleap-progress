/**
 * Vite logs every HMR apply via console.debug (shows as "Verbose" in Chrome).
 * In folders synced by OneDrive / aggressive watchers, that can mean thousands
 * of identical lines. Filter only the noisy [vite] hot-update lines in development.
 */
if (import.meta.env.DEV) {
  const orig = console.debug.bind(console);
  console.debug = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string') {
      if (first.startsWith('[vite] hot updated:') || first.startsWith('[vite] css hot updated:')) {
        return;
      }
    }
    orig(...args);
  };
}
