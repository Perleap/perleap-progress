/** Fetch `/perleap.svg` and return a base64 data URI for offline HTML embedding. */
export async function fetchLogoDataUri(): Promise<string | undefined> {
  try {
    const res = await fetch('/perleap.svg');
    if (!res.ok) return undefined;
    const text = await res.text();
    const encoded = btoa(unescape(encodeURIComponent(text)));
    return `data:image/svg+xml;base64,${encoded}`;
  } catch {
    return undefined;
  }
}
