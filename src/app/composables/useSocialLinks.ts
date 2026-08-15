import { computed, type ComputedRef } from "vue";
import { useAppConfig } from "@app/composables/useAppConfig.ts";
import { titleCase } from "@app/utils/title.ts";

export interface SocialLink {
  icon: string;
  label: string;
  to: string;
}

/**
 * The site's social links, in config order — GitHub first, then `docs.socials`.
 * A social may be a bare handle (`"unjs"`), a full URL, or an object that is
 * taken as-is.
 *
 * Consumers order for themselves: `SocialButtons` reverses so GitHub lands at
 * the trailing end of the row, `SocialMenu` keeps config order top-to-bottom.
 */
export function useSocialLinks(): ComputedRef<SocialLink[]> {
  const appConfig = useAppConfig();

  return computed(() =>
    Object.entries({ github: appConfig.docs.github, ...appConfig.docs.socials })
      .map(([key, value]) => {
        if (typeof value === "object") {
          return value as SocialLink;
        }
        if (typeof value === "string" && value) {
          return {
            // Workaround: i-simple-icons-x i-simple-icons-github
            icon: `i-simple-icons-${key}`,
            label: titleCase(key),
            to: /^https?:\/\//.test(value) ? value : `https://${key}.com/${value}`,
          };
        }
        return undefined;
      })
      .filter(Boolean as unknown as (v: SocialLink | undefined) => v is SocialLink),
  );
}
