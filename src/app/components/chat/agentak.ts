import { onBeforeUnmount, type Ref, shallowRef } from "vue";
import type { ResolvedChat } from "./config.ts";
import { docsPrompt } from "./docs-prompt.ts";
import type {
  AgentakModule,
  AgentakPiModule,
  ChatMount,
  ChatSession,
  MountChatOptions,
} from "./types.ts";

/**
 * The chat behind the widget: the library, the session it runs, and the one call
 * that fetches both.
 *
 * **agentak is not a dependency of undocs.** It is fetched from a CDN, by URL, at
 * the moment a reader first OPENS the chat — so a docs project installs nothing,
 * undocs's own bundle carries the widget's markup and stylesheet alone, and a
 * reader who never takes the button downloads none of it. That laziness is what
 * pays for the widget being on by default: what a page costs at load is the
 * folded-away panel and the button, and nothing else. It is also why the two
 * modules are typed structurally in `types.ts` rather than imported from a
 * package: there is no package here to import from.
 *
 * `/* @vite-ignore *\/` on a URL the bundler is handed at runtime is what keeps
 * it a runtime import: without it the build tries to resolve `https://…` as a
 * module of its own and fails. The docs are server rendered and this is a browser
 * widget, so nothing here runs during SSR — `load()` is reached from `onMounted`
 * and from the button, never from a render.
 *
 * The surface is the FRAMEWORK-FREE entry (`mountChat`), not `agentak/vue`. A vue
 * build off the CDN would arrive with a vue of its own, and two vue runtimes in
 * one page do not share the instance a lifecycle hook is registered against.
 * `mountChat` renders preact into an element undocs owns and never patches, so
 * the two renderers meet at that element and nowhere else.
 */
export function useChatAgent(options: {
  config: ResolvedChat;
  /** The element the preact island is rendered into. Vue never patches inside it. */
  host: Ref<HTMLElement | undefined>;
  /**
   * The props the surface is mounted with, read at mount time rather than taken
   * now: `actions` is the shell's own collapse button, and the shell is built
   * around the `load` this returns.
   */
  props: () => Omit<MountChatOptions, "session">;
}) {
  const { config, host, props } = options;

  /** True once the surface is on the page, which is when the ghost stands down. */
  const ready = shallowRef(false);

  let session: ChatSession | undefined;
  let mounted: ChatMount | undefined;
  /** One fetch, however fast the reader toggles: `load` is awaited by `toggle`. */
  let pending: Promise<void> | undefined;

  async function start() {
    const target = host.value;
    if (!target) return;

    const [{ mountChat }, { browserStorage, createPiSession }] = await Promise.all([
      import(/* @vite-ignore */ config.cdn) as Promise<AgentakModule>,
      import(/* @vite-ignore */ `${config.cdn}/pi`) as Promise<AgentakPiModule>,
    ]);

    // `localStorage`, so the provider, model and key a reader picks are still
    // there on the next page of the documentation — and so are the conversations.
    // A session starts a new conversation; the chat's history page lists the
    // stored ones.
    //
    // `page: true` offers the model whatever this site publishes on
    // `document.modelContext` — the chat is in the document undocs registers its
    // WebMCP tools in, so it reads them directly rather than over a network.
    session = createPiSession({
      // One extra request after the first answer names the conversation, so the
      // history page lists what each one was about.
      generateTitle: true,
      history: true,
      page: true,
      storage: browserStorage(),
      systemPrompt: docsPrompt(config.prompt),
    });

    // The library declares its own `--*` tokens, prepended to the head — every
    // name undocs already defines wins over them, so the chat is drawn in the
    // site's colours and only the names undocs has no opinion about come from
    // the library. See `assets/tokens.css`.
    mounted = mountChat(target, { session, ...props() });
    ready.value = true;
  }

  function load(): Promise<void> {
    if (!pending) pending = start();
    return pending;
  }

  // Whoever makes a session ends it — and the island goes with it, because vue is
  // about to remove the element preact is rendering into.
  onBeforeUnmount(() => {
    mounted?.unmount();
    mounted = undefined;
    session?.dispose?.();
    session = undefined;
  });

  return { load, ready };
}
