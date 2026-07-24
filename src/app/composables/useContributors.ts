import { useAppConfig } from "@app/composables/useAppConfig";
import { docFetch } from "@app/composables/useContent";
export interface Contributor {
  name: string;
  username: string;
  profile: string;
  avatar: string;
}

export async function useContributors(): Promise<Contributor[] | undefined> {
  const { docs: docsConfig } = useAppConfig();
  if (!docsConfig.github) {
    return;
  }
  // Goes through the same-origin `/api/docs/contributors` proxy (which reads the
  // configured `docs.github` slug server-side, hits ungh.cc, and caches the
  // last-good payload) rather than the third-party host directly — so this can be
  // fetched during SSR and a network/CORS issue never blanks the section.
  const { contributors = [] } = await docFetch()<{ contributors: { username: string }[] }>(
    "/api/docs/contributors",
  );
  return contributors
    .filter((c) => !c.username.includes("bot"))
    .map((c) => ({
      name: `@${c.username}`,
      username: c.username,
      profile: `https://github.com/${c.username}`,
      avatar: `https://github.com/${c.username}.png`,
    }));
}
