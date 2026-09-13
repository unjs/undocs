<script setup lang="ts">
import { ref } from "vue";
import { useChatAgent } from "./agentak.ts";
import { closeAction } from "./close-action.ts";
import type { ResolvedChat } from "./config.ts";
import { useChatResize } from "./use-chat-resize.ts";
import { useChatShell } from "./use-chat-shell.ts";

/**
 * The chat button of the documentation site, and the chat it opens.
 *
 * The chat is the real thing, not a screenshot: agentak's `mountChat` over a Pi
 * session this component makes and ends itself, both of them fetched from a CDN
 * the first time a reader opens the chat — see `agentak.ts`. The first message of
 * a first visit opens the picker, where the free providers need no API key; the
 * choice is kept in `localStorage`, so a reader is asked once. Conversations go to
 * the same store and remain available from the chat's history page; each new
 * session still starts with an empty conversation.
 *
 * The site is in the prompt as well as in the tools: `docs-prompt.ts` names the
 * project and tells the assistant how to search and read its documentation, and
 * the tools it names are undocs's own WebMCP ones (`src/app/webmcp/`), read
 * straight off `document.modelContext` because the chat is in that document.
 *
 * On unless a docs project opts out (`docs.chat: false` — see `config.ts`), and
 * rendered once for the whole site from `app.vue`, so the landing page and every
 * docs page carry the same one.
 *
 * ## Two layouts, one surface
 *
 * The chat is never a box over the page. It is mounted once and only ever
 * restyled, so the transcript survives a resize:
 *
 * - **`lg` and up — a docked rail** on the right, full height, slid in from the
 *   edge by the button. It is chrome of the site rather than a dialog: the page
 *   gives up the room while it is open, so the rail covers nothing. Its own
 *   border is a handle: the reader drags the rail to the width they want it, and
 *   that width is remembered with the state.
 * - **Below `lg` — a sheet** over the whole screen, opened by the button. A small
 *   screen has no room beside the page, so the chat takes all of it and the page
 *   holds still underneath. It grows out of the button: the morph is a `clip-path`
 *   circle centred on it.
 *
 * Either way the button is the way in, and the way back once the chat is
 * minimised. Neither layout opens by itself on a first visit.
 *
 * The rail is the one state that is remembered: a cookie says what the reader
 * left, and a reader who left it out gets it back on the next page they load — it
 * is chrome of the site, and chrome does not fold itself away between pages. The
 * sheet is not restored, because it is the whole screen over a page the reader has
 * just asked for. See `use-chat-shell.ts`.
 *
 * Both layouts are the stylesheet's own defaults, and the classes here only say
 * what the reader changed. `chat-widget.css` holds the rules and the reason they
 * are written that way.
 */
const props = defineProps<{ config: ResolvedChat }>();

const panel = ref<HTMLElement>();
const button = ref<HTMLButtonElement>();
const host = ref<HTMLElement>();

const { load, ready } = useChatAgent({
  config: props.config,
  host,
  // Read at mount time: `actions` is the shell's own collapse button, and the
  // shell is built around the `load` this call returns.
  props: () => ({ actions, prompts: props.config.prompts }),
});

const shell = useChatShell({ button, load, panel });
const { open, state, toggle } = shell;

/**
 * The rail's width, dragged by its own left border. A reader who reads code in the
 * chat gives it more of the screen, and the width they left is what the next page
 * is served into — see `use-chat-resize.ts`.
 */
const resize = useChatResize(panel);

/**
 * The collapse button the chat carries at the corner of its own title bar.
 * Declared once: a new array on every render would redraw the surface for it.
 */
const actions = closeAction(shell);
</script>

<template>
  <!-- Rendered by the server, empty and folded away: the panel is on the page
       before the chat is, so nothing moves when the chat arrives. -->
  <section ref="panel" :class="['chat-panel', state]" :inert="!open" aria-label="Assistant">
    <!-- The border of the rail, which is also what resizes it. A separator and
         not a button: it divides the page from the chat, and the arrow keys
         move it. It is drawn in the wide layout alone. -->
    <div
      class="chat-resize"
      role="separator"
      aria-label="Resize the assistant"
      aria-orientation="vertical"
      tabindex="0"
      @keydown="resize.onKeydown"
      @pointerdown="resize.onPointerDown"
    ></div>

    <!-- Vue's element, preact's children. It is here from the first render so the
         mount has somewhere to go, and `.chat-surface:empty` keeps it out of the
         layout until there is a chat in it. Never given a child in this template:
         vue must not patch what preact drew. -->
    <div ref="host" class="chat-surface"></div>

    <!-- The chat before it arrives: the lines it draws, at the sizes it draws
         them, so it takes this one's place without moving anything. -->
    <div v-if="!ready" class="chat-ghost" aria-hidden="true">
      <div class="chat-ghost-head"></div>
      <div class="chat-ghost-body"></div>
      <div class="chat-ghost-foot"><div></div></div>
      <div class="chat-ghost-bar"></div>
    </div>
  </section>

  <!-- The way back to a minimised chat, and the way into it on a small screen.
       It says what it does, so it needs no label of its own. -->
  <button
    ref="button"
    :class="['chat-button', state]"
    :aria-expanded="open"
    type="button"
    @click="toggle"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <!-- `BrainIcon`, the one the chat marks its own thinking with. -->
      <path d="M12 18V5" />
      <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
      <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
      <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
      <path d="M18 18a4 4 0 0 0 2-7.464" />
      <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
      <path d="M6 18a4 4 0 0 1-2-7.464" />
      <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
    </svg>
    {{ config.label }}
  </button>
</template>

<style src="./chat-widget.css"></style>
