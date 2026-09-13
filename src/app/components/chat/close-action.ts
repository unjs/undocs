import type { ChatAction } from "./types.ts";

/**
 * The collapse button, on the chat's own status bar.
 *
 * The surface heads itself, so undocs adds no second title bar: `actions` goes at
 * the corner of the chat's own title bar, after the buttons that change which
 * conversation it is. It is a definition and not a node — the site is vue and the
 * surface is preact, so the site says what its button is and the chat draws it
 * with the buttons beside it.
 *
 * A workspace folding into its edge, not a cross: nothing is closed here and
 * nothing is lost — the chat is hidden and not unmounted, so the transcript is
 * there again on the way back. `panel-right-close` is that glyph, and the chat
 * ships it under that name.
 */
export function closeAction(shell: { close: () => void }): ChatAction[] {
  return [
    {
      icon: "panel-right-close",
      id: "close",
      label: "Collapse the assistant",
      onClick: shell.close,
    },
  ];
}
