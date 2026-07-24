import { useAppConfig } from "@app/composables/useAppConfig";
import { docFetch } from "@app/composables/useContent";

export interface Sponsors {
  username: string;
  sponsors: {
    name: string;
    image: string;
    inactive?: boolean;
    website: string;
  }[][];
}

/**
 * Fetch the sponsors list. This goes through the same-origin `/api/docs/sponsors`
 * proxy (which reads the configured `docs.sponsors.api` URL server-side and caches
 * the last-good payload) rather than hitting the third-party host directly, so a
 * network/CORS issue reaching that host never blanks the sponsors section.
 */
export async function useSponsors(): Promise<Sponsors | undefined> {
  const appConfig = useAppConfig();
  // Only fetch when the docs actually configure a sponsors API URL.
  if (!appConfig.docs.sponsors?.api) return undefined;
  return (await docFetch()<Sponsors>("/api/docs/sponsors")) || undefined;
}
