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
  const { contributors = [] } = await $fetch<{ contributors: { username: string }[] }>(
    `https://ungh.cc/repos/${docsConfig.github}/contributors`,
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
