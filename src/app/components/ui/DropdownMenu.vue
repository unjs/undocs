<script setup lang="ts">
import { cn } from "@app/utils/cn";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink";
/**
 * DropdownMenu — the `UDropdownMenu` replacement.
 *
 * Reka `DropdownMenuRoot/Trigger/Portal/Content/Item/CheckboxItem/Separator`.
 * Default slot is scoped (`v-slot="{ open }"`) and IS the trigger (rendered
 * `as-child`, so a `<Button>` trigger keeps its own DOM tag/classes).
 *
 * `items` accepts a flat array OR an array-of-arrays (groups, separated by a
 * `DropdownMenuSeparator`). Each item:
 *   `{ label, icon, to, target, type: "checkbox" | "separator", checked,
 *      color, disabled, onSelect }`
 * - `to` renders the item content as a `AppLink` (`as-child`).
 * - `type: "checkbox"` renders a `DropdownMenuCheckboxItem`.
 * - `type: "separator"` (inline, inside a flat list) renders a separator line.
 * - `onSelect` is called on select.
 */
import { computed } from "vue";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "reka-ui";

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
    };
    modal?: boolean;
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
    "focus:bg-accent focus:text-accent-foreground",
    sizeClasses[props.size ?? "md"],
  ),
);

function colorClass(color?: string): string {
  return color === "error" || color === "red"
    ? "text-destructive focus:text-destructive focus:bg-destructive/10"
    : "";
}
</script>

<template>
  <DropdownMenuRoot v-slot="{ open }" :modal="modal">
    <DropdownMenuTrigger as-child>
      <slot :open="open" />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        :align="content?.align ?? 'start'"
        :side="content?.side"
        :side-offset="content?.sideOffset ?? 6"
        :class="
          cn(
            'z-50 min-w-40 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',
            ui?.content,
            props.class,
          )
        "
      >
        <template v-for="(group, gi) in groups" :key="gi">
          <DropdownMenuSeparator v-if="gi > 0" class="-mx-1 my-1 h-px bg-border" />
          <DropdownMenuGroup>
            <template v-for="(item, ii) in group" :key="ii">
              <DropdownMenuSeparator
                v-if="item.type === 'separator'"
                class="-mx-1 my-1 h-px bg-border"
              />

              <DropdownMenuCheckboxItem
                v-else-if="item.type === 'checkbox'"
                :model-value="item.checked"
                :disabled="item.disabled"
                :class="cn(itemClass, colorClass(item.color))"
                @select="item.onSelect?.($event)"
              >
                <Icon v-if="item.icon" :name="item.icon" class="shrink-0" />
                <span class="flex-1 truncate">{{ item.label }}</span>
                <Icon
                  v-if="item.checked"
                  name="i-lucide-check"
                  class="ml-auto shrink-0 text-primary"
                />
              </DropdownMenuCheckboxItem>

              <DropdownMenuItem
                v-else-if="item.to"
                as-child
                :disabled="item.disabled"
                @select="item.onSelect?.($event)"
              >
                <AppLink
                  :to="item.to"
                  :target="item.target"
                  :class="cn(itemClass, colorClass(item.color))"
                >
                  <Icon v-if="item.icon" :name="item.icon" class="shrink-0" />
                  <span class="flex-1 truncate">{{ item.label }}</span>
                </AppLink>
              </DropdownMenuItem>

              <DropdownMenuItem
                v-else
                :disabled="item.disabled"
                :class="cn(itemClass, colorClass(item.color))"
                @select="item.onSelect?.($event)"
              >
                <Icon v-if="item.icon" :name="item.icon" class="shrink-0" />
                <span class="flex-1 truncate">{{ item.label }}</span>
              </DropdownMenuItem>
            </template>
          </DropdownMenuGroup>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
