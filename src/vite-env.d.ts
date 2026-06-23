/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Typed client environment. Only VITE_ prefixed vars are exposed to the client.
// The YouTube API key is intentionally absent here: it must never reach src/.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_MOCK_MODE?: string;
  readonly VITE_EMBED_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
