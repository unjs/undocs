<script setup lang="ts">
import { cn } from "@app/utils/cn";
import Icon from "@app/components/global/Icon.vue";
import AppLink from "@app/components/app/AppLink";
/**
 * Button — the `UButton` replacement.
 *
 * Renders a `<AppLink :to>` when `to` is set, else a native `<button>`.
 * Accepts the prop values the codebase passes: `variant`
 * (solid|outline|soft|subtle|ghost|link), `color` (primary|neutral|white),
 * `size` (xs|sm|md|lg), `icon`/`trailing-icon` (rendered via `<Icon>`),
 * `square`, `label`, `disabled`, `loading`, and a `:ui` part-class hook for
 * `leadingIcon`/`trailingIcon`.
 *
 * Icon-only detection: when there's no default slot content and no `label`
 * but an `icon`/`trailing-icon` is set, the button auto-squares (matches
 * several call sites — e.g. `PageHeaderLinks`'s chevron trigger — that never
 * pass `square` explicitly).
 */
import { computed, useSlots } from "vue";
import { buttonVariants, buttonSquareSizeClass, type ButtonVariants } from "./Button";

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants["variant"];
    color?: ButtonVariants["color"];
    size?: ButtonVariants["size"];
    icon?: string;
    trailingIcon?: string;
    to?: string | Record<string, any>;
    square?: boolean;
    label?: string;
    disabled?: boolean;
    loading?: boolean;
    ui?: { leadingIcon?: unknown; trailingIcon?: unknown };
    class?: unknown;
  }>(),
  {
    variant: "solid",
    color: "primary",
    size: "md",
  },
);

const slots = useSlots();

const isIconOnly = computed(
  () => !slots.default && !props.label && Boolean(props.icon || props.trailingIcon),
);
const isSquare = computed(() => props.square || isIconOnly.value);
const isDisabled = computed(() => props.disabled || props.loading);

const rootClass = computed(() =>
  cn(
    buttonVariants({ color: props.color, variant: props.variant, size: props.size }),
    isSquare.value ? buttonSquareSizeClass[props.size ?? "md"] : undefined,
    // `<a>` has no native `:disabled`, so fake it visually + for a11y.
    isDisabled.value && props.to ? "pointer-events-none opacity-50" : undefined,
    props.class,
  ),
);
</script>

<template>
  <component
    :is="to ? AppLink : 'button'"
    :to="to"
    :type="to ? undefined : 'button'"
    :disabled="to ? undefined : isDisabled"
    :aria-disabled="to && isDisabled ? true : undefined"
    :tabindex="to && isDisabled ? -1 : undefined"
    :class="rootClass"
  >
    <Icon v-if="loading" name="i-lucide-loader-2" class="animate-spin" />
    <Icon v-else-if="icon" :name="icon" :class="cn(ui?.leadingIcon)" />
    <slot>{{ label }}</slot>
    <Icon v-if="trailingIcon && !loading" :name="trailingIcon" :class="cn(ui?.trailingIcon)" />
  </component>
</template>
