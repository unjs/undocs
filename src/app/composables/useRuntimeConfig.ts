/**
 * `useRuntimeConfig` — minimal client stub.
 *
 * Server-side, content routes read the real Nitro `useRuntimeConfig()` (from
 * `nitro/runtime-config`). On the client only `PageHeaderLinks` needs `app.baseURL`, so this
 * returns a small static object. Kept separate from `useAppConfig` since the two
 * are unrelated concerns.
 */
const runtimeConfig = {
  public: {} as Record<string, any>,
  app: { baseURL: "/" },
};

export function useRuntimeConfig(): typeof runtimeConfig {
  return runtimeConfig;
}
