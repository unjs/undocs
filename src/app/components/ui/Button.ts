/**
 * `primary` is the monochrome high-contrast role; `brand` is the project accent.
 * Brand washes must stay at or below 15%, the surface assumed by the derived
 * contrast tokens. Solid brand labels must use `--brand-foreground`; that
 * variant is reserved for the landing's lead CTA.
 *
 * Keep token heights in Tailwind's shorthand form: class-like text in comments
 * is scanned too and can emit dead utilities.
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
      {
        color: "primary",
        variant: "solid",
        class: "bg-primary text-primary-foreground shadow-small hover:bg-primary-hover",
      },
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
      {
        color: "primary",
        variant: "link",
        class: "text-brand bg-transparent underline-offset-4 hover:underline",
      },

      {
        color: "brand",
        variant: "solid",
        class: "bg-brand text-brand-foreground shadow-small hover:bg-brand-hover",
      },
      // Brand text may sit only on the page, a card, or a <=15% brand wash.
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

      {
        color: "white",
        variant: "solid",
        // White artwork buttons require a mode-invariant black label.
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
