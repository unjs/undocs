<script setup lang="ts">
import { cn } from "@app/utils/cn.ts";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink.ts";
/**
 * DropdownMenu — the `UDropdownMenu` replacement.
 *
 * Ported from reka-ui's `DropdownMenuRoot`/`Trigger`/`Portal`/`Content`/`Group`/
 * `Item`/`CheckboxItem`/`Separator` (MIT, https://github.com/unovue/reka-ui) and
 * the `Menu` family underneath them. Reka needs ~20 components there because a
 * `MenuContent` has to compose with submenus, radio groups, an inline filter
 * input, a Collection provider and a RovingFocusGroup, all discovered through
 * `provide`/`inject` so a stranger can rearrange them. We render menus from a
 * flat `items` array, so none of that is reachable: the whole family collapses
 * into this one component sitting on the shared primitives — `usePopper`
 * (positioning), `usePresence` (exit animation), `AsChild` (trigger + link-item
 * merge), `useDismissableLayer`, `useFocusScope`, `useBodyScrollLock` and
 * `useHideOthers`.
 *
 * The public API is unchanged. Default slot is scoped (`v-slot="{ open }"`) and
 * IS the trigger (rendered `as-child`, so a `<Button>` trigger keeps its own DOM
 * tag/classes).
 *
 * `items` accepts a flat array OR an array-of-arrays (groups, separated by a
 * separator line). Each item:
 *   `{ label, icon, to, target, type: "checkbox" | "separator", checked,
 *      color, disabled, onSelect }`
 * - `to` renders the item content as a `AppLink` (`as-child`).
 * - `type: "checkbox"` renders `role="menuitemcheckbox"`.
 * - `type: "separator"` (inline, inside a flat list) renders a separator line.
 * - `onSelect` is called on select, with the same CANCELLABLE event reka passed:
 *   `preventDefault()` on it keeps the menu open. It is never dispatched — it is
 *   a veto token, exactly as in reka's `MenuItem`.
 *
 * What is preserved exactly:
 *
 * - **Keyboard navigation lands real DOM focus** on the item, not a
 *   `data-highlighted` attribute. That is what makes the `focus:bg-accent` class
 *   below light up, and it is why `data-highlighted` (which reka also emits, and
 *   which nothing here styles) is dropped rather than tracked.
 * - **Opening with the keyboard focuses the first item; opening with the mouse
 *   focuses the menu container.** Reka reaches that split through a
 *   `RovingFocusGroup` entry-focus event vetoed by a global `useIsUsingKeyboard`
 *   tracker; here the trigger already knows which of its two handlers fired, so
 *   `openedByKeyboard` says it directly and the global goes away.
 * - **`ArrowUp`/`ArrowDown`/`Home`/`End` do not wrap**, matching reka's `loop`
 *   default of `false`, and skip disabled items (the `:not([data-disabled])` in
 *   the item selector does what reka's recursive `findNextFocusableElement` did).
 * - **Letter-key typeahead**, including reka's two subtleties: a repeated
 *   character (`aaa`) is normalized to a single one so it CYCLES through items
 *   starting with it, and the search wraps around the current item so matching
 *   always looks forward. The 1s idle reset is the same.
 * - **The press-drag-release gesture**: pointerdown on the trigger, drag onto an
 *   item, release — the item that never saw the pointerdown synthesises the
 *   click itself.
 * - **The trigger veto on outside-pointerdown.** Clicking an OPEN non-modal
 *   menu's trigger must not dismiss through the layer, or the dismissal and the
 *   trigger's own toggle cancel out and the menu never closes. Reka does this in
 *   `DropdownMenuContent.onInteractOutside`; here it is the `false` returned
 *   from `onPointerDownOutside`.
 * - **`modal` splits the same four ways it does in reka**: focus trap, body
 *   scroll lock, `aria-hidden` on everything else, and outside pointer events —
 *   all on for `modal` (the default), all off for `:modal="false"`.
 * - The ids behind `aria-controls`/`aria-labelledby` use Vue 3.5's `useId()`,
 *   which is SSR-stable and request-scoped — NOT reka's module-level counter
 *   fallback, which would hand two concurrent SSR renders the same id (see
 *   AGENTS.md on per-request state).
 *
 * Added, not in reka:
 *
 * - **`openOnHover`** — reka's `DropdownMenu` is click-only (hover-opening is
 *   `NavigationMenu`, which we do not have). See the hover-intent section below
 *   for the two things that keeps honest: the close delay that spans the
 *   `sideOffset` gap, and `focusSuppressed`, which stops a drifting pointer from
 *   taking focus away from whatever the user is actually using.
 *
 * Dropped, with reasons:
 *
 * - **Submenus** (`MenuSub`/`SubTrigger`/`SubContent`) and with them the grace
 *   area — the pointer-direction polygon that keeps a submenu open while you
 *   travel diagonally into it. No call site nests menus, and the grace area is
 *   the single largest piece of `MenuContentImpl`.
 * - **`MenuRadioGroup`/`RadioItem`, `MenuLabel`, `MenuArrow`, `MenuFilter`,
 *   `MenuItemIndicator`** — no call site renders any of them. (`type: "label"`
 *   in our own item union has never had a branch either; it falls through to a
 *   plain item, as it did before this port.)
 * - **`Collection`.** Reka registers every item through a provide/inject
 *   collection so `getItems()` stays in DOM order across teleports. Every item
 *   here is a direct descendant of the content element, so one
 *   `querySelectorAll("[data-menu-item]")` is the same list, in the same order,
 *   with no per-item registration.
 * - **`useFocusGuards`** (tabbable spans at the document edges, so `focusin`
 *   fires when focus leaves for the browser chrome). Modal menus swallow Tab
 *   outright and non-modal ones are free to lose focus, so neither has a reachable
 *   use for it — the same call `Dialog.vue` made.
 * - **`handleBlur`'s typeahead reset.** `blur` does not bubble, so reka's guard
 *   (`currentTarget.contains(target)`) is true whenever it fires at all and the
 *   search is never cleared by it. The 1s idle reset is the real one.
 * - `forceMount`, `defaultOpen`, `v-model:open`, `dir`/`useDirection`,
 *   `disableUpdateOnLayoutShift` and the rest of the Popper knobs — none are
 *   passed anywhere, and each only selects a non-default branch.
 */
import { computed, onMounted, onScopeDispose, ref, useId, type ComponentPublicInstance } from "vue";
import AsChild from "./primitives/AsChild.ts";
import { useBodyScrollLock } from "./primitives/useBodyScrollLock.ts";
import { useDismissableLayer } from "./primitives/useDismissableLayer.ts";
import { focus, focusFirst, useFocusScope } from "./primitives/useFocusScope.ts";
import { useHideOthers } from "./primitives/useHideOthers.ts";
import { usePopper } from "./primitives/usePopper.ts";
import { usePresence } from "./primitives/usePresence.ts";
import { useTypeahead } from "./primitives/useTypeahead.ts";

interface DropdownMenuItemType {
  label?: string;
  icon?: string;
  to?: string;
  target?: string;
  type?: "checkbox" | "separator" | "label";
  checked?: boolean;
  color?: string;
  disabled?: boolean;
  onSelect?: (event?: Event) => void;
}

const props = withDefaults(
  defineProps<{
    items?: DropdownMenuItemType[] | DropdownMenuItemType[][];
    content?: {
      align?: "start" | "center" | "end";
      side?: "top" | "right" | "bottom" | "left";
      sideOffset?: number;
      alignOffset?: number;
    };
    modal?: boolean;
    /**
     * Open on mouse hover as well as on click. Only for `:modal="false"` menus —
     * a hover-opened menu that locks body scroll and `aria-hidden`s the page is
     * not something a passing pointer should be able to do.
     */
    openOnHover?: boolean;
    size?: "xs" | "sm" | "md" | "lg";
    ui?: { content?: unknown };
    class?: unknown;
  }>(),
  {
    modal: true,
    size: "md",
  },
);

const groups = computed<DropdownMenuItemType[][]>(() => {
  if (!props.items?.length) return [];
  return Array.isArray(props.items[0])
    ? (props.items as DropdownMenuItemType[][])
    : [props.items as DropdownMenuItemType[]];
});

const sizeClasses: Record<string, string> = {
  xs: "text-xs py-1 px-1.5 gap-1.5 [&_svg]:size-3.5",
  sm: "text-xs py-1.5 px-2 gap-2 [&_svg]:size-3.5",
  md: "text-sm py-1.5 px-2 gap-2 [&_svg]:size-4",
  lg: "text-sm py-2 px-2.5 gap-2 [&_svg]:size-4",
};

const itemClass = computed(() =>
  cn(
    "relative flex cursor-pointer select-none items-center rounded-sm outline-none",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    "focus:bg-accent focus:text-foreground",
    sizeClasses[props.size ?? "md"],
  ),
);

function colorClass(color?: string): string {
  return color === "error" || color === "red"
    ? "text-danger focus:text-danger focus:bg-danger/10"
    : "";
}

const triggerId = useId();
const contentId = useId();

const open = ref(false);
const state = computed(() => (open.value ? "open" : "closed"));

const triggerEl = ref<HTMLElement | null>(null);
const wrapperEl = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);

// The trigger can be a plain element or a component (`<Button>`); take the
// element either way.
function setTriggerEl(element: unknown) {
  const resolved =
    element instanceof HTMLElement
      ? element
      : ((element as ComponentPublicInstance | null)?.$el as unknown);
  triggerEl.value = resolved instanceof HTMLElement ? resolved : null;
}

// Which of the trigger's two handlers opened the menu — see the note above.
let openedByKeyboard = false;

/**
 * A hover-opened menu must not take focus, and must not hand it back on close:
 * the pointer may have drifted over the trigger while the user was typing
 * somewhere else entirely. Cleared the moment the menu becomes interactive —
 * a click, a key, or the pointer landing on an item (which focuses it).
 */
let focusSuppressed = false;

function handleTriggerClick(event: MouseEvent) {
  if (event.button !== 0 || event.ctrlKey) return;
  openedByKeyboard = false;
  focusSuppressed = false;
  open.value = !open.value;
}

function handleTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" && event.key !== " " && event.key !== "ArrowDown") return;
  openedByKeyboard = true;
  focusSuppressed = false;
  open.value = event.key === "ArrowDown" ? true : !open.value;
  // Space would scroll the page, and Enter/ArrowDown would reach the menu that
  // is about to take focus.
  event.preventDefault();
}

// --- Hover intent (`openOnHover`) ------------------------------------------
// Closing is delayed so the pointer can cross the `sideOffset` gap between
// trigger and content without the menu vanishing under it. That gap is the only
// dead ground here — a menu sits directly under its trigger, so the diagonal
// travel reka needed a grace-area polygon for (dropped with submenus, see
// above) does not arise, and a timer is the whole of it.
const HOVER_CLOSE_DELAY = 150;

let hoverCloseTimer: ReturnType<typeof setTimeout> | undefined;

function cancelHoverClose() {
  if (hoverCloseTimer === undefined) return;
  clearTimeout(hoverCloseTimer);
  hoverCloseTimer = undefined;
}

// Mouse only: a touch "hover" is the tap that the click handler already owns,
// and opening on it would fight that toggle.
function handleHoverEnter(event: PointerEvent) {
  if (!props.openOnHover || event.pointerType !== "mouse") return;
  cancelHoverClose();
  if (open.value) return;
  openedByKeyboard = false;
  focusSuppressed = true;
  open.value = true;
}

function handleHoverLeave(event: PointerEvent) {
  if (!props.openOnHover || event.pointerType !== "mouse") return;
  cancelHoverClose();
  hoverCloseTimer = setTimeout(() => {
    hoverCloseTimer = undefined;
    close();
  }, HOVER_CLOSE_DELAY);
}

onScopeDispose(cancelHoverClose);

const triggerProps = computed(() => ({
  id: triggerId,
  "aria-haspopup": "menu",
  "aria-expanded": open.value,
  "aria-controls": open.value ? contentId : undefined,
  "data-state": state.value,
  onClick: handleTriggerClick,
  onKeydown: handleTriggerKeydown,
  onPointerenter: handleHoverEnter,
  onPointerleave: handleHoverLeave,
}));

// The portal is client-only; the same hydration-parity gate `Dialog.vue` uses.
const isMounted = ref(false);
onMounted(() => {
  isMounted.value = true;
});

const { shouldRender } = usePresence(open, contentEl);

const { wrapperStyle, contentStyle, placedSide, placedAlign } = usePopper({
  anchor: triggerEl,
  wrapper: wrapperEl,
  content: contentEl,
  // `usePopper`'s own default is tooltip-oriented (`"top"`); a menu opens down.
  side: () => props.content?.side ?? "bottom",
  sideOffset: () => props.content?.sideOffset ?? 6,
  align: () => props.content?.align ?? "start",
  alignOffset: () => props.content?.alignOffset ?? 0,
});

/** Every enabled item, in DOM order — the list all navigation walks. */
function menuItems(): HTMLElement[] {
  const content = contentEl.value;
  if (!content) return [];
  return [...content.querySelectorAll<HTMLElement>("[data-menu-item]:not([data-disabled])")];
}

function close() {
  open.value = false;
}

/**
 * Selection. The event is reka's `menu.itemSelect`: created, handed to the
 * consumer, never dispatched. A consumer that calls `preventDefault()` on it
 * keeps the menu open.
 */
function handleSelect(item: DropdownMenuItemType) {
  if (item.disabled) return;
  const event = new CustomEvent("menu.itemSelect", { bubbles: true, cancelable: true });
  item.onSelect?.(event);
  if (!event.defaultPrevented) close();
}

// Which item received the pointerdown of the current gesture — an item that did
// NOT is one the pointer was dragged onto from the trigger, and it clicks itself
// on release.
let pointerDownItem: EventTarget | null = null;

function handleItemPointerdown(event: PointerEvent) {
  pointerDownItem = event.currentTarget;
}

function handleItemPointerup(event: PointerEvent) {
  if (pointerDownItem !== event.currentTarget) (event.currentTarget as HTMLElement).click();
}

function handleItemKeydown(item: DropdownMenuItemType, event: KeyboardEvent) {
  if (item.disabled) return;
  // Mid-typeahead a space is part of the search string, not a selection.
  if (event.key === " " && typeahead.search !== "") return;
  if (event.key !== "Enter" && event.key !== " ") return;
  (event.currentTarget as HTMLElement).click();
  // Space must not scroll, and Enter must not reach whatever takes focus next —
  // including the browser's own click synthesis on a link item, which would fire
  // `onSelect` twice.
  event.preventDefault();
}

/** Hovering an item focuses it, which is what draws the highlight. */
function handleItemPointermove(item: DropdownMenuItemType, event: PointerEvent) {
  if (event.pointerType !== "mouse") return;
  if (item.disabled) {
    focus(contentEl.value);
    return;
  }
  const element = event.currentTarget as HTMLElement;
  // The menu is being used, not merely hovered — focus may enter, and go back to
  // the trigger on close.
  focusSuppressed = false;
  if (document.activeElement !== element) element.focus({ preventScroll: true });
}

function handleItemPointerleave(event: PointerEvent) {
  if (event.pointerType !== "mouse") return;
  focus(contentEl.value);
}

/** The attributes and handlers every item carries, whatever element renders it. */
function itemProps(item: DropdownMenuItemType, checkbox = false) {
  return {
    role: checkbox ? "menuitemcheckbox" : "menuitem",
    tabindex: -1,
    "data-menu-item": "",
    "aria-disabled": item.disabled || undefined,
    "data-disabled": item.disabled ? "" : undefined,
    "aria-checked": checkbox ? Boolean(item.checked) : undefined,
    "data-state": checkbox ? (item.checked ? "checked" : "unchecked") : undefined,
    onClick: () => handleSelect(item),
    onKeydown: (event: KeyboardEvent) => handleItemKeydown(item, event),
    onPointerdown: handleItemPointerdown,
    onPointerup: handleItemPointerup,
    onPointermove: (event: PointerEvent) => handleItemPointermove(item, event),
    onPointerleave: handleItemPointerleave,
  };
}

// --- Modal behaviours ------------------------------------------------------
// All four are `modal`-gated, exactly as reka splits `MenuRootContentModal` from
// `MenuRootContentNonModal`.

useBodyScrollLock(() => props.modal && shouldRender.value);

useHideOthers(computed(() => (props.modal ? contentEl.value : null)));

// Set when an outside interaction closed the menu: focus has already moved on,
// and dragging it back to the trigger would fight the click that moved it.
let hasInteractedOutside = false;

const { layerProps } = useDismissableLayer({
  element: contentEl,
  disableOutsidePointerEvents: () => props.modal,
  onPointerDownOutside: (event) => {
    // See "the trigger veto" above: let the trigger's own click do the closing.
    if (triggerEl.value?.contains(event.target as Node)) return false;
    const isRightClick = event.button === 2 || (event.button === 0 && event.ctrlKey);
    if (!props.modal || isRightClick) hasInteractedOutside = true;
  },
  onFocusOutside: (event) => {
    // A modal menu traps focus, so focus that escaped is the trap's business,
    // not a dismissal. A non-modal one closes when focus walks away (Tab).
    if (props.modal) return false;
    // The trigger veto again, and it MUST be repeated here: clicking an open
    // menu's trigger fires `focusin` on it BEFORE the `click` that toggles the
    // menu shut, so dismissing on that focus would close and immediately
    // re-open. Reka covers both through one `onInteractOutside`.
    if (triggerEl.value?.contains(event.target as Node)) return false;
    hasInteractedOutside = true;
  },
  onDismiss: close,
});

const { onKeydown: onFocusScopeKeydown } = useFocusScope(contentEl, {
  trapped: () => props.modal && open.value,
  // `document.activeElement` rather than `undefined`: the fallback would be the
  // trigger, and after a click outside the trigger is exactly where focus must
  // NOT go. Re-focusing what already has focus is the no-op we want.
  restoreFocus: () =>
    hasInteractedOutside || focusSuppressed
      ? (document.activeElement as HTMLElement | null)
      : triggerEl.value,
  onMountAutoFocus: () => {
    hasInteractedOutside = false;
    // A hover open leaves focus exactly where it was (see `focusSuppressed`).
    if (focusSuppressed) return false;
    // Keyboard opens enter on the first item; pointer opens park on the
    // container, so nothing is highlighted until the pointer picks something.
    if (!focusFirst(openedByKeyboard ? menuItems() : [])) focus(contentEl.value);
    return false;
  },
});

// --- Keyboard navigation ---------------------------------------------------

const FIRST_KEYS = new Set(["ArrowDown", "Home", "PageUp"]);
const LAST_KEYS = new Set(["ArrowUp", "End", "PageDown"]);

/**
 * Vertical arrow navigation, without wrapping (reka's `loop` default). An
 * unknown current element — the container itself, right after a pointer opened
 * the menu — counts as "outside the list", so ArrowDown enters at the top and
 * ArrowUp at the bottom.
 */
function arrowNavigate(event: KeyboardEvent): HTMLElement | undefined {
  const forward = FIRST_KEYS.has(event.key);
  if (!forward && !LAST_KEYS.has(event.key)) return;
  const items = menuItems();
  if (items.length === 0) return;
  // Every one of these keys would otherwise scroll the page behind the menu.
  event.preventDefault();
  const isArrow = event.key === "ArrowDown" || event.key === "ArrowUp";
  const index = isArrow ? items.indexOf(document.activeElement as HTMLElement) : -1;
  if (index === -1) return forward ? items[0] : items.at(-1);
  return items[index + (forward ? 1 : -1)];
}

const typeahead = useTypeahead();

function handleContentKeydown(event: KeyboardEvent) {
  onFocusScopeKeydown(event);
  // An item handled it already (Enter/Space on the focused item).
  if (event.defaultPrevented) return;

  const target = arrowNavigate(event);
  if (target) {
    target.focus();
    return;
  }
  // Space is a selection key on the focused item; it must not start a search.
  if (event.code === "Space") return;
  // A modal menu owns the tab sequence outright: items are `tabindex="-1"`, so
  // there is nothing inside for Tab to reach and it would simply walk out.
  if (event.key === "Tab" && props.modal) event.preventDefault();
  const isModifier = event.ctrlKey || event.altKey || event.metaKey;
  if (isModifier || event.key.length !== 1) return;

  const items = menuItems();
  const values = items.map((element) => element.textContent?.trim() ?? "");
  const next = typeahead.next(
    event.key,
    values,
    items.indexOf(document.activeElement as HTMLElement),
  );
  if (next !== -1) items[next]?.focus();
}
</script>

<template>
  <AsChild :element-ref="setTriggerEl" v-bind="triggerProps">
    <slot :open="open" />
  </AsChild>

  <Teleport v-if="isMounted" to="body">
    <div v-if="shouldRender" ref="wrapperEl" :style="wrapperStyle">
      <div
        :id="contentId"
        ref="contentEl"
        role="menu"
        tabindex="-1"
        aria-orientation="vertical"
        :aria-labelledby="triggerId"
        :data-state="state"
        :data-side="placedSide"
        :data-align="placedAlign"
        :style="contentStyle"
        :class="
          cn(
            'z-50 min-w-40 overflow-hidden rounded-md border border-border bg-card p-1 text-foreground shadow-menu',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',
            ui?.content,
            props.class,
          )
        "
        v-bind="layerProps"
        @keydown="handleContentKeydown"
        @pointerenter="handleHoverEnter"
        @pointerleave="handleHoverLeave"
      >
        <template v-for="(group, gi) in groups" :key="gi">
          <div
            v-if="gi > 0"
            role="separator"
            aria-orientation="horizontal"
            class="-mx-1 my-1 h-px bg-border"
          />
          <div role="group">
            <template v-for="(item, ii) in group" :key="ii">
              <div
                v-if="item.type === 'separator'"
                role="separator"
                aria-orientation="horizontal"
                class="-mx-1 my-1 h-px bg-border"
              />

              <div
                v-else-if="item.type === 'checkbox'"
                v-bind="itemProps(item, true)"
                :class="cn(itemClass, colorClass(item.color))"
              >
                <Icon v-if="item.icon" :name="item.icon" class="shrink-0" />
                <span class="flex-1 truncate">{{ item.label }}</span>
                <Icon
                  v-if="item.checked"
                  name="i-lucide-check"
                  class="ml-auto shrink-0 text-brand"
                />
              </div>

              <AsChild v-else-if="item.to" v-bind="itemProps(item)">
                <AppLink
                  :to="item.to"
                  :target="item.target"
                  :class="cn(itemClass, colorClass(item.color))"
                >
                  <Icon v-if="item.icon" :name="item.icon" class="shrink-0" />
                  <span class="flex-1 truncate">{{ item.label }}</span>
                </AppLink>
              </AsChild>

              <div v-else v-bind="itemProps(item)" :class="cn(itemClass, colorClass(item.color))">
                <Icon v-if="item.icon" :name="item.icon" class="shrink-0" />
                <span class="flex-1 truncate">{{ item.label }}</span>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
