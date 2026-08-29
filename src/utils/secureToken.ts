/**
 * Cryptographically-strong random hex, for share tokens that are the entire
 * access control for a public page (live tracking, race spectator links).
 *
 * `global.crypto.getRandomValues` is provided by the
 * `react-native-get-random-values` polyfill imported in index.ts (Hermes has
 * no Web Crypto of its own). If it is somehow missing we fall back to
 * Math.random rather than crash — but warn loudly in dev, because that path
 * must never ship.
 */
export function secureRandomHex(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  const webcrypto = (globalThis as { crypto?: Crypto }).crypto;

  if (webcrypto && typeof webcrypto.getRandomValues === 'function') {
    webcrypto.getRandomValues(bytes);
  } else {
    if (__DEV__) {
      console.warn(
        '[secureToken] crypto.getRandomValues unavailable — falling back to Math.random. ' +
          'Ensure `import "react-native-get-random-values"` runs at startup.',
      );
    }
    for (let i = 0; i < byteLength; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  let out = '';
  for (let i = 0; i < byteLength; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}
