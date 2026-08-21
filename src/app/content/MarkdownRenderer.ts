import { defineComponent, h, type Component, type PropType, type VNode } from "vue";
import { kebabCase } from "scule";
import { slugify, textContent } from "../../server/content/utils.ts";
import type { MarkNode, MarkElement } from "../../server/content/types.ts";
import { components as userComponents } from "virtual:undocs/user-components";

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
import Mermaid from "../components/global/Mermaid.vue";
import ReadMore from "../components/global/ReadMore.vue";
import PmInstall from "../components/global/Pm-Install.vue";
import PmRun from "../components/global/Pm-Run.vue";
import PmX from "../components/global/Pm-x.vue";
// Async blocks stay outside this registry because they need a Suspense boundary.
import PageHero from "../components/blocks/PageHero.vue";
import PageSection from "../components/blocks/PageSection.vue";
import PageFeature from "../components/blocks/PageFeature.vue";
import PageCard from "../components/blocks/PageCard.vue";
import I18nMd from "./I18nMd.vue";

const COMPONENTS: Record<string, Component> = {
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
  mermaid: Mermaid,
  "read-more": ReadMore,
  "pm-install": PmInstall,
  "pm-run": PmRun,
  "pm-x": PmX,
  "page-hero": PageHero,
  "page-section": PageSection,
  "page-feature": PageFeature,
  "page-card": PageCard,
  i18n: I18nMd,
  "i18n-t": I18nMd,
  I18nT: I18nMd,
};

// Built-ins win so user components cannot shadow parser-sensitive overrides.
for (const [name, component] of Object.entries(userComponents)) {
  for (const key of [name, kebabCase(name)]) {
    if (!(key in COMPONENTS)) COMPONENTS[key] = component;
  }
}

const CALLOUT_ALIASES = new Set(["note", "tip", "important", "warning", "caution"]);

const SILENT_DIV = new Set(["callout"]);

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

const HEADER_OFFSET = 80;

// Prevent native fragment navigation from bypassing the sticky-header offset.
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

function isElement(node: MarkNode): node is MarkElement {
  return Array.isArray(node);
}

// Route md4x template children into matching Vue named slots.
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

function renderNode(node: MarkNode, _parentTag: string | null): VNode | string | null {
  if (typeof node === "string") {
    return node;
  }
  if (!isElement(node)) {
    return null;
  }

  const [tag, rawProps, ...children] = node;

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

  // Match md4x's footnote IDs and display ordinal IDs rather than source labels.
  if (tag === "footnote-ref") {
    const { id, refId } = rawProps as { id: number; refId: number };
    return h("sup", { class: "md-footnote-ref" }, [
      h("a", { href: `#fn-${id}`, id: `fnref-${id}-${refId}` }, String(id)),
    ]);
  }
  if (tag === "footnotes") {
    return h("section", { class: "md-footnotes" }, [
      h("hr"),
      h(
        "ol",
        null,
        children.map((child) => renderNode(child, tag)).filter(Boolean) as (VNode | string)[],
      ),
    ]);
  }
  if (tag === "footnote") {
    const { id, refCount } = rawProps as { id: number; refCount: number };
    const backrefs = Array.from({ length: Math.max(refCount, 1) }, (_, i) =>
      h(
        "a",
        {
          href: `#fnref-${id}-${i + 1}`,
          class: "md-footnote-backref",
          "aria-label": "Back to content",
        },
        "↩",
      ),
    );
    return h("li", { id: `fn-${id}` }, [
      ...(children.map((child) => renderNode(child, tag)).filter(Boolean) as (VNode | string)[]),
      ...backrefs,
    ]);
  }

  // Do not mutate the cached source AST.
  const props: Record<string, any> = { ...rawProps };

  // Preserve parser IDs shared with the TOC; slugify only ad-hoc ASTs lacking one.
  if (HEADINGS.has(tag) && !props.id) {
    props.id = slugify(textContent(node));
  }

  const renderChildren = (): (VNode | string)[] =>
    children
      .map((child) => renderNode(child, tag))
      .filter((c): c is VNode | string => c !== null && c !== undefined);

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

  const override = COMPONENTS[tag];
  if (override) {
    return h(override as any, props, buildComponentSlots(children, tag));
  }

  if (CALLOUT_ALIASES.has(tag)) {
    return h(
      Alert as any,
      { ...props, type: props.type || tag },
      buildComponentSlots(children, tag),
    );
  }

  if (tag === "code") {
    return h("code", props, renderChildren());
  }

  if (NATIVE_TAGS.has(tag)) {
    return h(tag, props, renderChildren());
  }

  if (SILENT_DIV.has(tag)) {
    return h("div", props, renderChildren());
  }

  return h("div", props, renderChildren());
}

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
    value: {
      type: [Object, Array] as PropType<any>,
      required: false,
      default: undefined,
    },
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
      return h("div", { class: "md-body" }, rendered);
    };
  },
});
