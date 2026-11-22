import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { SUPABASE_PUBLIC_CONFIG_ID, validateSupabasePublicConfig } from "./public-config";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function getSupabasePublicConfig() {
  if (!import.meta.env.SSR && typeof document !== "undefined") {
    const config = document.getElementById(SUPABASE_PUBLIC_CONFIG_ID)?.textContent;
    if (config) return validateSupabasePublicConfig(JSON.parse(config));
  }

  // SSR knows the active managed backend even when VITE_* build bindings are absent.
  // Only this public URL/key pair is passed to the browser, before module evaluation.
  return validateSupabasePublicConfig({
    url:
      (import.meta.env.SSR ? process.env["SUPABASE_URL"] : undefined) ||
      import.meta.env["VITE_SUPABASE_URL"],
    publishableKey:
      (import.meta.env.SSR ? process.env["SUPABASE_PUBLISHABLE_KEY"] : undefined) ||
      import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
  });
}

function createSupabaseClient() {
  const { url: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY } = getSupabasePublicConfig();

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
