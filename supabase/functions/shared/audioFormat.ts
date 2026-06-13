export function extensionForAudioBlob(blob: Blob): string {
  const t = blob.type.toLowerCase();
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('mp4') || t.includes('m4a')) return 'm4a';
  if (t.includes('wav')) return 'wav';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('webm')) return 'webm';
  return 'webm';
}

export async function inferAudioUploadName(audioFile: Blob): Promise<string> {
  const magicExt = await inferExtensionFromMagic(audioFile);
  if (!audioFile.type) return `audio.${magicExt}`;

  const mimeExt = extensionForAudioBlob(audioFile);
  const ext = mimeExt === 'm4a' && magicExt !== 'm4a' ? magicExt : mimeExt;
  return `audio.${ext}`;
}

async function inferExtensionFromMagic(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45) return 'webm';
  if (buf.length >= 4 && buf[0] === 0x4f && buf[1] === 0x67) return 'ogg';
  if (buf.length >= 4 && buf[0] === 0x52 && buf[1] === 0x49) return 'wav';
  if (
    buf.length >= 8 &&
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) {
    return 'm4a';
  }
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'mp3';
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'mp3';
  return 'webm';
}
