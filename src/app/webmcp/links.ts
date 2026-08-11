/**
 * Project links derived from the docs config — the "where do I file a bug /
 * read the source / find the changelog" set an agent needs but can't infer from
 * page content.
 *
 * WebMCP has no `resources` primitive (its `ModelContext` is `registerTool` /
 * `getTools` / `ontoolchange` and nothing else), so links are surfaced as tool
 * RESULTS: `get_project_info` for the project-wide set, and `editUrl` /
 * `markdownUrl` on every page result.
 *
 * The URL conventions here mirror what the UI already renders — `SocialButtons.vue`
 * for socials, `AppFooter.vue` for the repo, `pages/[...slug].vue` for the edit
 * link — so an agent and a visitor are handed the same links.
 */
import { titleCase } from "@app/utils/title";

export interface ProjectLink {
  label: string;
  url: string;
}

/** A repo shorthand (`unjs/undocs`) or a full URL → a repository URL. */
export function repoUrl(github: unknown): string | undefined {
  if (typeof github !== "string" || !github) return undefined;
  const url = /^https?:\/\//.test(github) ? github : `https://github.com/${github}`;
  return url.replace(/\/+$/, "");
}

/**
 * The repository plus its canonical sub-pages. `/issues` and `/releases` are
 * GITHUB's URL shape, and `docs.github` also accepts a full URL — which may
 * point at another forge (GitLab nests both under `/-/`). So the repo URL is
 * always returned, but the two sub-pages only when the host really is GitHub;
 * an invented link is worse for an agent than a missing one.
 */
export function repoLinks(
  github: unknown,
  branch: unknown,
): { url: string; issues?: string; releases?: string; branch: string } | undefined {
  const url = repoUrl(github);
  if (!url) return undefined;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // Not parseable — treat it as an unknown forge (sub-pages omitted).
  }
  const isGitHub = host === "github.com";
  return {
    url,
    issues: isGitHub ? `${url}/issues` : undefined,
    releases: isGitHub ? `${url}/releases` : undefined,
    branch: (typeof branch === "string" && branch) || "main",
  };
}

/**
 * The `socials` config as labelled links. Values are either a bare handle
 * (`{ x: "unjsio" }` → `https://x.com/unjsio`, the key naming the platform) or
 * an explicit URL / link object — the same three shapes `SocialButtons.vue`
 * renders.
 */
export function socialLinks(socials: Record<string, unknown> = {}): ProjectLink[] {
  const links: ProjectLink[] = [];
  for (const [key, value] of Object.entries(socials)) {
    if (!value) continue;
    if (typeof value === "object") {
      const to = (value as { to?: string }).to;
      const label = (value as { label?: string }).label;
      if (to) links.push({ label: label || titleCase(key), url: to });
      continue;
    }
    if (typeof value !== "string") continue;
    // Placeholder entries (undocs' own config carries `discord: "#"`) render as
    // a dead button in the UI; don't hand an agent a URL that goes nowhere.
    if (value === "#" || value === "/") continue;
    links.push({
      label: titleCase(key),
      url: /^https?:\/\//.test(value) ? value : `https://${key}.com/${value}`,
    });
  }
  return links;
}

/**
 * GitHub "edit this page" URL for a page's content id. Mirrors the header link
 * in `pages/[...slug].vue` — including its assumption that the docs live in a
 * `docs/` directory of the repo, which is the only thing the client knows
 * (`generateAppConfig` strips `docs.dir` from the client config).
 */
export function editUrl(
  github: unknown,
  branch: unknown,
  pageId: string | undefined,
): string | undefined {
  const repo = repoUrl(github);
  if (!repo || !pageId) return undefined;
  const rel = pageId.replace(/^content\//, "");
  return `${repo}/edit/${branch || "main"}/docs/${rel}`;
}
