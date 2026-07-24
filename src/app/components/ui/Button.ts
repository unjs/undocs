/**
 * `buttonVariants` — the CVA class matrix for `Button`.
 *
 * Two-axis matrix (the values the codebase passes):
 * `color` (`primary` | `neutral` | `white`) × `variant` (`solid` |
 * `outline` | `soft` | `subtle` | `ghost` | `link`), plus a `size` axis
 * (`xs` | `sm` | `md` | `lg`). Exported separately from `Button.vue` (shadcn-vue
 * convention) so sibling components (`ButtonGroup`, ...) can reuse it without
 * importing the whole SFC.
 */
import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium " +
    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap select-none " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      color: {
        primary: "",
        neutral: "",
        white: "",
      },
      variant: {
        solid: "",
        outline: "",
        soft: "",
        subtle: "",
        ghost: "",
        link: "",
      },
      size: {
        xs: "h-7 px-2 text-xs gap-1 [&_svg]:size-3.5",
        sm: "h-8 px-2.5 text-xs gap-1.5 [&_svg]:size-4",
        md: "h-9 px-3 text-sm gap-1.5 [&_svg]:size-4",
        lg: "h-10 px-4 text-sm gap-2 [&_svg]:size-5",
      },
    },
    compoundVariants: [
      // ---- primary ----------------------------------------------------
      {
        color: "primary",
        variant: "solid",
        class: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
      },
      {
        color: "primary",
        variant: "outline",
        class: "border border-primary/50 text-primary bg-transparent hover:bg-primary/10",
      },
      {
        color: "primary",
        variant: "soft",
        class: "bg-primary/10 text-primary hover:bg-primary/15",
      },
      {
        color: "primary",
        variant: "subtle",
        class: "bg-primary/10 text-primary border border-primary/25 hover:bg-primary/15",
      },
      {
        color: "primary",
        variant: "ghost",
        class: "text-primary bg-transparent hover:bg-primary/10",
      },
      {
        color: "primary",
        variant: "link",
        class: "text-primary bg-transparent underline-offset-4 hover:underline",
      },

      // ---- neutral -------------------------------------------------------
      {
        color: "neutral",
        variant: "solid",
        class: "bg-foreground text-background shadow-xs hover:bg-foreground/90",
      },
      {
        color: "neutral",
        variant: "outline",
        class:
          "border border-input text-foreground bg-background hover:bg-accent hover:text-accent-foreground",
      },
      {
        color: "neutral",
        variant: "soft",
        class: "bg-muted text-foreground hover:bg-accent",
      },
      {
        color: "neutral",
        variant: "subtle",
        class: "bg-muted text-foreground border border-border hover:bg-accent",
      },
      {
        color: "neutral",
        variant: "ghost",
        class: "text-foreground bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
      {
        color: "neutral",
        variant: "link",
        class: "text-foreground bg-transparent underline-offset-4 hover:underline",
      },

      // ---- white (pops on colored/hero backgrounds) -----------------------
      {
        color: "white",
        variant: "solid",
        class: "bg-white text-neutral-900 shadow-xs hover:bg-white/90",
      },
      {
        color: "white",
        variant: "outline",
        class: "border border-white/40 text-white bg-transparent hover:bg-white/10",
      },
      {
        color: "white",
        variant: "soft",
        class: "bg-white/10 text-white hover:bg-white/15",
      },
      {
        color: "white",
        variant: "subtle",
        class: "bg-white/10 text-white border border-white/20 hover:bg-white/15",
      },
      {
        color: "white",
        variant: "ghost",
        class: "text-white bg-transparent hover:bg-white/10",
      },
      {
        color: "white",
        variant: "link",
        class: "text-white bg-transparent underline-offset-4 hover:underline",
      },
    ],
    defaultVariants: {
      color: "primary",
      variant: "solid",
      size: "md",
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

/** Fixed square (icon-only) width per size — matches the size's `h-*` class. */
export const buttonSquareSizeClass: Record<NonNullable<ButtonVariants["size"]>, string> = {
  xs: "w-7 px-0",
  sm: "w-8 px-0",
  md: "w-9 px-0",
  lg: "w-10 px-0",
};
