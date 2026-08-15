/**
 * `buttonVariants` — the CVA class matrix for `Button`.
 *
 * Two-axis matrix (the values the codebase passes):
 * `color` (`primary` | `brand` | `neutral` | `white`) × `variant` (`solid` |
 * `outline` | `soft` | `subtle` | `ghost` | `link`), plus a `size` axis
 * (`xs` | `sm` | `md` | `lg`). Exported separately from `Button.vue` (shadcn-vue
 * convention) so sibling components (`ButtonGroup`, ...) can reuse it without
 * importing the whole SFC.
 *
 * Geist has no accent-coloured button: its primary action is the high-contrast
 * one (`--primary`, so near-black on white and near-white on black) and its
 * secondary is a bordered surface. `color: "primary"` therefore renders
 * MONOCHROME here — the project's `themeColor` lives in `--brand` and tints
 * links, active nav, and icons, not button fills.
 *
 * `color: "brand"` is the deliberate exception, and it is a DEPARTURE from
 * Geist rather than a port of it: it fills with the project's accent so the
 * landing hero's primary CTA carries the docs' colour instead of the neutral
 * ramp. Keep it scarce — one call site, `pages/index.vue`. If it spreads to the
 * chrome, `--primary` and `--brand` have collapsed into one role and the
 * monochrome system is gone. Everything else, hero secondary included, stays on
 * `primary`; that contrast is what makes the accented button read as the
 * page's single action.
 *
 * Its fill/label pair is load-bearing and measured — `--brand-foreground` is
 * the only label that clears AA across all seven hues in both modes. See the
 * note on `--brand-foreground` in `tokens.css` before retuning any of it.
 *
 * Sizes are Geist's control ladder, read from the `--size-*` tokens rather
 * than hardcoded — the `h-(--token)` form is Tailwind v4's shorthand for a bare
 * `var()` height, and is what Vercel's own CSS emits. Each height carries the
 * type step Geist pairs with it (14px through medium, 16px at large), because a
 * tall control with small text reads as a stretched medium, not as a large.
 *
 * Write these as the shorthand ONLY. Spelling the bracket-and-`var()` form out
 * anywhere in this file — even inside a comment — makes Tailwind scan it as a
 * class candidate and emit a second, dead rule for it.
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
        brand: "",
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
        xs: "h-(--size-tiny) px-2 text-button-12 gap-1 [&_svg]:size-3.5",
        sm: "h-(--size-small) px-2.5 text-button-14 gap-1.5 [&_svg]:size-4",
        md: "h-(--size-medium) px-3 text-button-14 gap-1.5 [&_svg]:size-4",
        lg: "h-(--size-large) px-4 text-button-16 gap-2 [&_svg]:size-4",
      },
    },
    compoundVariants: [
      // ---- primary (Geist: high-contrast, monochrome) ---------------------
      // `--primary-hover` recedes toward the page in BOTH modes — darker than
      // `--primary` in light, lighter in dark — and keeps AA against the label.
      {
        color: "primary",
        variant: "solid",
        class: "bg-primary text-primary-foreground shadow-small hover:bg-primary-hover",
      },
      // Geist's secondary button: page surface, hairline border, hover fill.
      {
        color: "primary",
        variant: "outline",
        class: "border border-border bg-background text-foreground hover:bg-accent",
      },
      {
        color: "primary",
        variant: "soft",
        class: "bg-muted text-foreground hover:bg-accent",
      },
      {
        color: "primary",
        variant: "subtle",
        class: "bg-muted text-foreground border border-border hover:bg-accent",
      },
      {
        color: "primary",
        variant: "ghost",
        class: "text-foreground bg-transparent hover:bg-accent",
      },
      // The one accented variant: it reads as a link, so it takes the brand.
      {
        color: "primary",
        variant: "link",
        class: "text-brand bg-transparent underline-offset-4 hover:underline",
      },

      // ---- brand (the accent fill — see the header) -----------------------
      {
        color: "brand",
        variant: "solid",
        class: "bg-brand text-brand-foreground shadow-small hover:bg-brand-hover",
      },
      // The tinted variants pair the accent with a 10-15% wash of ITSELF, which
      // is one of the three surfaces `--brand` is derived against (the page, a
      // card, a wash of itself — see `tokens.css`). Those washes are the reason
      // the accent is a shade darker than the page alone would require, and the
      // reason it can be one token instead of three. 15% is the ceiling the
      // derivation assumes: a deeper wash needs a re-derivation, not a tweak.
      // No `dark:` variant — the table is declared per mode.
      //
      // `outline` and `ghost` are in this group for their HOVER state alone:
      // they rest on `--background`, where the wash never appears, but hovering
      // slides a 10% one under text that cannot change colour at the same time.
      {
        color: "brand",
        variant: "outline",
        class: "border border-brand/40 bg-background text-brand hover:bg-brand/10",
      },
      {
        color: "brand",
        variant: "soft",
        class: "bg-brand/10 text-brand hover:bg-brand/15",
      },
      {
        color: "brand",
        variant: "subtle",
        class: "bg-brand/10 text-brand border border-brand/20 hover:bg-brand/15",
      },
      {
        color: "brand",
        variant: "ghost",
        class: "text-brand bg-transparent hover:bg-brand/10",
      },
      {
        color: "brand",
        variant: "link",
        class: "text-brand bg-transparent underline-offset-4 hover:underline",
      },

      // ---- neutral -------------------------------------------------------
      {
        color: "neutral",
        variant: "solid",
        class: "bg-foreground text-background shadow-small hover:bg-primary-hover",
      },
      {
        color: "neutral",
        variant: "outline",
        class:
          "border border-input text-foreground bg-background hover:bg-accent hover:text-foreground",
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
        class: "text-foreground bg-transparent hover:bg-accent hover:text-foreground",
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
        // Mode-INVARIANT: this variant sits on hero/coloured artwork, so its
        // label must stay black even in dark mode (`--foreground` would flip
        // to near-white and vanish against the white fill).
        class: "bg-white text-black shadow-small hover:bg-white/90",
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

/**
 * Fixed square (icon-only) width per size — the same `--size-*` token the
 * matching `size` variant uses for its height, so the two can't drift.
 */
export const buttonSquareSizeClass: Record<NonNullable<ButtonVariants["size"]>, string> = {
  xs: "w-(--size-tiny) px-0",
  sm: "w-(--size-small) px-0",
  md: "w-(--size-medium) px-0",
  lg: "w-(--size-large) px-0",
};
