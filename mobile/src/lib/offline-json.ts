// JSON escapes preserve UTF-16 code units, including accents and emoji, without
// depending on TextEncoder or browser base64 globals on native devices.
export function encodeOfflineJson(value: unknown): Uint8Array {
  const ascii = JSON.stringify(value).replace(/[\u007f-\uffff]/g, char =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return Uint8Array.from(ascii, char => char.charCodeAt(0));
}

export function decodeOfflineJson(bytes: Uint8Array): unknown {
  let ascii = '';
  for (const byte of bytes) ascii += String.fromCharCode(byte);
  return JSON.parse(ascii);
}
