/**
 * MarkdownRenderer
 * ----------------
 * A from-scratch Vue 3 renderer for the comark AST (produced by md4x).
 *
 * A "body" is an array of nodes. A node is one of:
 *   - a plain string                          -> text
 *   - `[tag, propsObject, ...children]`        -> element (HTML tag or component)
 *   - `[null, {}, "..."]`                      -> HTML comment (skipped)
 *
 * It renders the tree to vnodes with Vue's `h()`, with no runtime rendering
 * dependency — everything here is hand written.
 */
import { defineComponent, h, type Component, type PropType, type VNode } from "vue";
import { kebabCase } from "scule";
import { slugify, textContent } from "../../server/content/utils";
import type { MarkNode, MarkElement } from "../../server/content/types";
import { components as userComponents } from "virtual:undocs/user-components";

// Local (co-located) prose components mapped from AST tag names.
import ProsePre from "./ProsePre.vue";
import ProseCodeGroup from "./ProseCodeGroup.vue";
import CodeTree from "./CodeTree.vue";
import ProseA from "./ProseA.vue";
import Steps from "./Steps.vue";
import Alert from "./Alert.vue";
import Tabs from "./Tabs.vue";
import Tab from "./Tab.vue";
import Card from "./Card.vue";
import CardGroup from "./CardGroup.vue";
// Custom global components used from markdown, mapped explicitly.
import Mermaid from "../components/global/Mermaid.vue";
import ReadMore from "../components/global/ReadMore.vue";
import PmInstall from "../components/global/Pm-Install.vue";
import PmRun from "../components/global/Pm-Run.vue";
import PmX from "../components/global/Pm-x.vue";
// Landing blocks (`::page-hero`/`page-section`/`page-feature`/`page-card`), also
// used directly by the built-in landing/blog pages. Only sync, presentational
// blocks are registered here — async ones (`PageSponsors`/`PageContributors`)
// need a `<Suspense>` boundary and are wired per-theme instead.
import PageHero from "../components/blocks/PageHero.vue";
import PageSection from "../components/blocks/PageSection.vue";
import PageFeature from "../components/blocks/PageFeature.vue";
import PageCard from "../components/blocks/PageCard.vue";

/**
 * Explicit tag -> component registry: every component reachable from a
 * markdown/comark AST tag is imported and mapped here by its (kebab-case) tag
 * name. Unknown tags fall through to the native-tag / `<div>` handling below.
 */
const COMPONENTS: Record<string, Component> = {
  // Prose overrides.
  pre: ProsePre,
  "code-group": ProseCodeGroup,
  "code-tree": CodeTree,
  a: ProseA,
  steps: Steps,
  alert: Alert,
  tabs: Tabs,
  tab: Tab,
  card: Card,
  "card-group": CardGroup,
  // Custom global components authored in markdown.
  mermaid: Mermaid,
  "read-more": ReadMore,
  "pm-install": PmInstall,
  "pm-run": PmRun,
  "pm-x": PmX,
  // Landing blocks.
  "page-hero": PageHero,
  "page-section": PageSection,
  "page-feature": PageFeature,
  "page-card": PageCard,
};

// Merge user `.docs/components/**` (via the `undocs:user-theme` plugin) into the
// registry so they're usable from Markdown by their kebab tag (`:app-hero`) or
// PascalCase name. Built-ins win on a name clash so a stray user file can't
// silently shadow a prose override (`a`, `pre`, `alert`, …).
for (const [name, component] of Object.entries(userComponents)) {
  for (const key of [name, kebabCase(name)]) {
    if (!(key in COMPONENTS)) COMPONENTS[key] = component;
  }
}

/**
 * Container callout tags (`::note`, `::tip`, ...) and GitHub alert aliases all
 * render through the single `Alert` component, which switches styling on `type`.
 */
const CALLOUT_ALIASES = new Set(["note", "tip", "important", "warning", "caution"]);

/**
 * Tags we knowingly render as a plain wrapper `<div>` (no matching component in
 * the explicit `COMPONENTS` registry), handled before the generic fallback.
 */
const SILENT_DIV = new Set(["callout"]);

/**
 * Native HTML tags rendered as-is with `h(tag, props, children)`.
 * `a` and `pre` are intentionally NOT here — they are handled by COMPONENTS.
 * `code` is handled specially (inline vs block) below.
 */
// prettier-ignore
const NATIVE_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "ul", "ol", "li", "blockquote",
  "strong", "em", "del", "hr", "br", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "span", "div", "sup", "sub", "kbd",
  "details", "summary", "section", "figure", "figcaption",
  "dl", "dt", "dd", "input", "abbr", "mark", "small", "s", "u",
]);

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** Sticky-header offset for in-page anchor scrolling (matches `DocsToc`). */
const HEADER_OFFSET = 80;

/**
 * Click handler for a heading's `#` deep-link. Mirrors `DocsToc.scrollTo`:
 * smooth-scroll to the heading with the sticky-header offset and update the URL
 * hash via `replaceState` — WITHOUT letting the browser's native fragment jump
 * run, which would push a history entry and trip the router's navigation /
 * view-transition machinery. Plain left-clicks only; modified clicks (open in
 * new tab, etc.) fall through to the browser.
 */
function onAnchorClick(event: MouseEvent, id: string): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
  history.replaceState(null, "", `#${id}`);
}

/** True for element nodes (arrays whose first item is a tag or null). */
function isElement(node: MarkNode): node is MarkElement {
  return Array.isArray(node);
}

/**
 * Build the Vue slots object for a COMPONENT node, honoring named slots.
 * md4x encodes a `#name` block inside a container as a child element
 * `["template", { name }, ...children]`. Each such child is routed to the
 * matching Vue named slot; every other child (and any explicit `#default`) stays
 * in `default`.
 */
function buildComponentSlots(
  children: MarkNode[],
  parentTag: string,
): Record<string, () => (VNode | string)[]> {
  const defaults: MarkNode[] = [];
  const named: Record<string, MarkNode[]> = {};
  for (const child of children) {
    if (
      isElement(child) &&
      child[0] === "template" &&
      typeof (child[1] as any)?.name === "string"
    ) {
      const name = (child[1] as any).name as string;
      const inner = child.slice(2) as MarkNode[];
      if (name === "default") defaults.push(...inner);
      else (named[name] ||= []).push(...inner);
    } else {
      defaults.push(child);
    }
  }
  const render = (nodes: MarkNode[]) => (): (VNode | string)[] =>
    nodes
      .map((n) => renderNode(n, parentTag))
      .filter((c): c is VNode | string => c !== null && c !== undefined);
  const slots: Record<string, () => (VNode | string)[]> = { default: render(defaults) };
  for (const [name, nodes] of Object.entries(named)) slots[name] = render(nodes);
  return slots;
}

/**
 * Render a single AST node to a vnode (or string / null).
 * `parentTag` lets us disambiguate context-sensitive tags such as `code`
 * (inline `<code>` vs. a code block inside `<pre>`).
 */
function renderNode(node: MarkNode, _parentTag: string | null): VNode | string | null {
  // Plain text node.
  if (typeof node === "string") {
    return node;
  }
  if (!isElement(node)) {
    return null;
  }

  const [tag, rawProps, ...children] = node;

  // `[null, {}, "..."]` is an HTML comment — render nothing.
  if (tag === null) {
    return null;
  }

  // --- Raw HTML lifted from markdown by the server transform (`_html`). The
  // single string child is trusted, already-rendered HTML; inject it via
  // `innerHTML`. Block fences use a <div>, inline fragments a <span> so they
  // sit inside their surrounding paragraph. ---
  if (tag === "_html") {
    const html = typeof children[0] === "string" ? children[0] : "";
    return h((rawProps as any)?.block ? "div" : "span", { innerHTML: html });
  }

  // Clone props so we never mutate the source AST (e.g. when adding heading ids).
  const props: Record<string, any> = { ...rawProps };

  // --- Headings: ensure an `id` for on-page TOC anchor links. ---
  if (HEADINGS.has(tag) && !props.id) {
    props.id = slugify(textContent(node));
  }

  // Render children lazily; `tag` becomes the parent context for them.
  const renderChildren = (): (VNode | string)[] =>
    children
      .map((child) => renderNode(child, tag))
      .filter((c): c is VNode | string => c !== null && c !== undefined);

  // --- Headings: render a clickable `#` anchor link to the heading's own id
  // so readers can grab a deep link. The parent heading is marked as a
  // `group` and the anchor reveals on hover (see `.md-anchor` in main.css). ---
  if (HEADINGS.has(tag) && props.id) {
    props.class = props.class ? `${props.class} md-heading group` : "md-heading group";
    return h(tag, props, [
      h(
        "a",
        {
          href: `#${props.id}`,
          class: "md-anchor",
          "aria-label": "Link to this section",
          onClick: (event: MouseEvent) => onAnchorClick(event, props.id),
        },
        "#",
      ),
      ...renderChildren(),
    ]);
  }

  // --- Explicit component overrides (pre, code-group, a, steps, alert). ---
  const override = COMPONENTS[tag];
  if (override) {
    return h(override as any, props, buildComponentSlots(children, tag));
  }

  // --- Container callout aliases -> Alert (type inferred from the tag). ---
  if (CALLOUT_ALIASES.has(tag)) {
    return h(
      Alert as any,
      { ...props, type: props.type || tag },
      buildComponentSlots(children, tag),
    );
  }

  // --- `code`: native <code>. Inline vs. block share the same element; the
  // block variant lives inside <pre> and is only used as a ProsePre fallback. ---
  if (tag === "code") {
    return h("code", props, renderChildren());
  }

  // --- Native HTML tags. ---
  if (NATIVE_TAGS.has(tag)) {
    return h(tag, props, renderChildren());
  }

  // --- Known no-component tags: render as a wrapper <div> without warning. ---
  if (SILENT_DIV.has(tag)) {
    return h("div", props, renderChildren());
  }

  // --- Fallback: an unknown/custom tag with no entry in the explicit
  // `COMPONENTS` registry (checked at the top of this function) renders as a
  // <div> so its children still show. ---
  return h("div", props, renderChildren());
}

/**
 * Extract the node array from the various shapes callers pass:
 *   - a page object: `{ body: { value: MarkNode[] } }`  (primary)
 *   - a body object: `{ value: MarkNode[] }`
 *   - a raw body array
 *   - an explicit `body` prop
 */
function resolveNodes(value: unknown, body: MarkNode[] | undefined): MarkNode[] {
  const v = value as any;
  if (v?.body?.value && Array.isArray(v.body.value)) return v.body.value;
  if (v?.value && Array.isArray(v.value)) return v.value;
  if (Array.isArray(v)) return v;
  if (Array.isArray(body)) return body;
  return [];
}

export default defineComponent({
  name: "MarkdownRenderer",
  props: {
    /** A page object (`{ body: { value } }`), a body object, or a raw array. */
    value: {
      type: [Object, Array] as PropType<any>,
      required: false,
      default: undefined,
    },
    /** Alternatively, the body node array passed directly. */
    body: {
      type: Array as PropType<MarkNode[]>,
      required: false,
      default: undefined,
    },
  },
  setup(props) {
    return () => {
      const nodes = resolveNodes(props.value, props.body);
      const rendered = nodes
        .map((node) => renderNode(node, null))
        .filter((c): c is VNode | string => c !== null && c !== undefined);
      // A wrapping element keeps the output a single root and gives callers a
      // stable hook for prose typography styles.
      return h("div", { class: "md-body" }, rendered);
    };
  },
});
