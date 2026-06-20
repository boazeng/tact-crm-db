// Public Google OAuth Web client ID. A build-time env var (VITE_GOOGLE_CLIENT_ID,
// set by CI) overrides the committed fallback. Both are public, not secrets.
const env = (import.meta as { env?: Record<string, string | undefined> }).env
export const GOOGLE_CLIENT_ID =
  env?.VITE_GOOGLE_CLIENT_ID ||
  '30184743393-bp4v0518a1kk3qq9mkl4gsbnbvlv4r3b.apps.googleusercontent.com'
