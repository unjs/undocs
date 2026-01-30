export interface Sponsors {
  username: string;
  sponsors: {
    name: string;
    image: string;
    inactive?: boolean;
    website: string;
  }[][];
}

export async function useSponsors(): Promise<Sponsors | undefined> {
  const appConfig = useAppConfig();
  const sponsorsAPI = appConfig.docs.sponsors?.api;
  if (sponsorsAPI) {
    return (await $fetch<Sponsors>(sponsorsAPI)) || undefined;
  }
}
