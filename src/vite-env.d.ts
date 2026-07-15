/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_OPENWA_ENABLED?: string;
  readonly VITE_OPENWA_API_URL?: string;
  readonly VITE_OPENWA_SESSION_ID?: string;
  readonly VITE_OPENWA_API_KEY?: string;
  readonly VITE_WPPCONNECT_ENABLED?: string;
  readonly VITE_WPPCONNECT_API_URL?: string;
  readonly VITE_WPPCONNECT_SESSION?: string;
  readonly VITE_WPPCONNECT_TOKEN?: string;
  readonly VITE_WPPCONNECT_ROTATION?: string;
  readonly VITE_WPPCONNECT_NOTIFY_URL?: string;
  readonly VITE_WPPCONNECT_NOTIFY_KEY?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_BUILD_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
