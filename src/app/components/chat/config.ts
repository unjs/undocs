import { useAppConfig } from "@app/composables/useAppConfig.ts";

/** Where agentak is fetched from when the docs config names no other place. */
export const DEFAULT_CDN = "https://esm.sh/agentak";

/** The button says what it opens, so this is also its accessible name. */
const DEFAULT_LABEL = "Ask AI";

/**
 * The one thing the empty chat offers to say. The site's own WebMCP tools answer
 * it on whatever page the reader opened the chat from — `get_current_page` and
 * then `read_page` — so it is both a way in and a demonstration of what the chat
 * reads before it answers.
 */
const DEFAULT_PROMPTS = ["Summarize this page"];

/** `docs.chat`, as the widget reads it. */
export interface ResolvedChat {
  cdn: string;
  label: string;
  prompts: string[];
  /** Instructions the docs project adds to the built-in ones. */
  prompt?: string;
}

/**
 * The chat's configuration, or nothing when the docs project has opted out.
 *
 * On by default, the same way `webmcp` is, and for the same reason: it is what
 * the site already knows about itself, offered to the reader who asks. `false`
 * is the opt-out, and it is a real one — the widget is what renders the button,
 * so nothing about the chat reaches a page without it.
 *
 * Being on costs a reader nothing until they take the button: the panel is fixed
 * and folded away, and agentak is fetched from a CDN on the first OPEN rather
 * than on load (see `agentak.ts`). `undefined` and `true` are the same answer, so
 * a docs project that never mentions `chat` gets the defaults below.
 */
export function useChatConfig(): ResolvedChat | undefined {
  const chat = useAppConfig().docs?.chat;
  if (chat === false) return undefined;
  const options = chat === true || !chat ? {} : chat;
  return {
    cdn: options.cdn || DEFAULT_CDN,
    label: options.label || DEFAULT_LABEL,
    prompts: options.prompts?.length ? options.prompts : DEFAULT_PROMPTS,
    prompt: options.prompt,
  };
}
