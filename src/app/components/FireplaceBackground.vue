<script setup lang="ts">
// Hearth backdrop for the landing — a fire line running the FULL WIDTH of the
// page behind the hero. Five layers, bottom to top: a room wash, the fire's own
// near-field glow, nine tongues licking up off one hearth line, embers drifting
// off the top, and a static film grain over the lot.
//
// TWO colour tokens, and the split between them is the whole colour policy.
//
// The FIRE — wash, glow, all nine tongues — is `--fire`, which is `--foreground`.
// It is MONOCHROME, like everything else: Geist is monochrome and
// `assets/tokens.css` is roles-not-scales (see AGENTS.md), so a hue across these
// layers would be the one place the page reached for a large coloured surface.
// The fire is in the MOTION and in the STRUCTURE — the flicker, the shear, the
// stretch, the rise — not in the colour, which is the whole reason it can be
// monochrome at all: a still amber wash has to say "fire" with its hue, a moving
// and layered one does not.
//
// The ASHES — the eight embers, and only them — are `--ash`, which is `--brand`,
// the project's accent. They are 3–4px specks at 26% over a ~13% field, i.e. the
// one mark here with enough alpha and a hard enough edge for a hue to actually
// read, and the one small enough that a hue does not become a cast. So the docs
// project's `themeColor` shows up as coloured sparks lifting out of a grey fire.
// `--brand` defaults to `mono` = `var(--foreground)`, so with no `themeColor` set
// `--ash` collapses onto `--fire` and the whole thing is the monochrome picture it
// was designed as. Spending the accent on the large layers instead is the change
// to resist: at single-digit alpha it buys almost no colour and spreads what it
// buys over the entire hero.
//
// Because `--foreground` and `--brand` are both declared per mode, the fire flips
// on its own inside `.dark`: the glow reads as photographic tone on white and as a
// real bloom on black, the embers as motes of soot and ash in light / sparks in
// dark. Only the grain's two opacities differ per mode — it needs a touch more
// weight on a 4% page.
//
// Mounted ONCE, for the landing only, as the first child of `GridPage`
// (`app.vue`) — the page shell, which is `relative` for exactly this. So it spans
// the WHOLE page vertically: up behind the sticky header (transparent at rest, so
// the firelight reads through it; blurred once scrolled) and down through every
// section to the footer. The shell is full-bleed, so the fire is too.
//
// It is the LANDING's backdrop and nothing else's.
//
// `GridPage` deliberately does NOT `isolate`. The app shell's `relative isolate`
// wrapper stays the stacking context, which is what lets `z-index: -10` sit
// behind content yet above the `html`/`body` background (both paint
// `--background`).
//
// ---------------------------------------------------------------------------
// THE ONE RULE: it has to read as ONE fire.
//
// Everything below is subordinate to that. The failure mode this component keeps
// finding is a set of separable shapes — a bar of light here, a floating blob
// there — and every one of those has the same cause: a layer whose luminance
// does not JOIN its neighbours' at the place they meet. Three ways that happens,
// and all three have bitten this file:
//
//   * A layer with a vertical extent of its own. A short, bright band (a "coal
//     bed" 4rem tall at 11%) sitting where no other layer is carrying anything is
//     a bar of light, however soft its edges are — the eye finds it because
//     nothing else lives at that height. There is now exactly ONE thing supplying
//     the near field, `.fire__core`, and it is 26rem of falloff, not a band.
//   * Tongues that stop overlapping. Nine blobs at ~10rem spacing read as one
//     fire line only while each still carries real alpha where its neighbour's
//     centre is. Narrow them (or mask their sides into a teardrop, which is the
//     same thing done twice) and the fire line scallops, then breaks, and nine
//     separate floating shapes is what is left. The arithmetic that must keep
//     holding is written out under `.fire__flame`.
//   * A speck born outside the light. The embers are the only hard-edged, only
//     high-alpha thing here, and they used to spawn ON `--hearth-line` at 38% —
//     i.e. at the very bottom of the fire, where the tongues' own mass has already
//     fallen to a fifth of its peak, as a row of crisp dots with the fire ABOVE
//     them. Eight bright points below a soft fire is a detached object, and it is
//     the one the eye finds first because it is the only part of the picture with
//     a hard edge. They now spawn 3–9rem UP, inside the brightest part of the
//     glow and inside the tongues' mass, at an alpha closer to the field around
//     them, and ramp in over the first fifth of the climb instead of appearing at
//     full weight. An ember has to leave the fire, not arrive beneath it.
//
// Numbers throughout are quoted for a 1440px viewport: 1rem = 16px, so the page
// is 90rem across and `--flame-unit` is 24vw = 21.6rem.
// ---------------------------------------------------------------------------
//
// Nine things are deliberate:
//
// 1. Full WIDTH, bounded HEIGHT — that asymmetry is the whole layout rule, and it
//    is not an aesthetic choice. This root element is as tall as the DOCUMENT,
//    which has no upper bound: a layer that inherits that height allocates a
//    page-sized texture the moment it is promoted, and a percentage-sized
//    gradient on it resolves against the whole page, so the same fire is a tidy
//    hero glow on a short landing and a full-page smear on a long one. Width has
//    no such problem — it is the viewport, which is bounded and is exactly what
//    "all width" means. So every layer here spans `left: 0; right: 0` and pins its
//    own height in rem. Only `.fire` and `.fire__grain` are `inset: 0`, and
//    neither moves.
// 2. Every gradient reaches `transparent` INSIDE its box vertically, and the one
//    that does not is the fire line itself. A background is clipped to the element
//    box, so a gradient still carrying alpha at the box edge is a hard cut, and a
//    hard cut under a blur is a horizontal seam across the whole page. The wash
//    and the glow both die with rem to spare (the figures are on each rule). The
//    tongues are the deliberate exception — see `.fire__flame`'s foot — and that
//    exception is bounded arithmetic, not a shrug.
//    HORIZONTAL clipping is the opposite case: the wash and the glow are MEANT to
//    still carry tone where they meet the screen edge, because that is what
//    full-width means and there is nothing beyond the edge to see. Which is why
//    neither of them may be scaled on X — a horizontal scale would drag that crop
//    across the viewport edge every frame. `.fire__core` rides `scaleY` alone for
//    exactly this reason.
// 3. Horizontal placement is PERCENTAGE, horizontal size is a viewport-scaled
//    length. A tongue sits at `left: 47%` so the nine of them spread over whatever
//    width they get, and each is `--flame-unit` wide — `clamp(11rem, 24vw, 27rem)`
//    — so they grow with the screen but stop growing at both ends. That clamp is
//    what keeps the fire line CONTINUOUS: the tongues must overlap at every width,
//    and fixed-rem widths would leave gaps on a wide screen while percentage
//    widths would go to threads on a narrow one. `vw` rather than `%` because this
//    has to be a LENGTH — the blur radius is derived from it, and `filter: blur()`
//    takes no percentage. Below 48rem the even tongues are dropped instead of
//    squeezed, and their embers with them.
// 4. A flame is an ELLIPSE, and there is NO mask. A taper mask was tried and it is
//    what broke the fire line: pinching each tongue's sides is precisely the
//    overlap the line is made of, and `filter` applies BEFORE `mask`, so the mask
//    cuts the blurred tongue rather than the shape inside it. The tongue's form
//    comes from its gradient being taller than it is wide and from its mass
//    sitting low in the box; its raggedness comes from the nine boxes being
//    24–44rem tall; its life comes from the animation. Not from its silhouette.
// 5. The fire FLICKERS but does not WANDER, and the tongues' FEET NEVER MOVE.
//    Firelight is an intensity change, not a moving source, so the wash and the
//    glow ride `opacity` (plus a hair of `scaleY` on the glow) on periods that
//    share no small common multiple — the beat between them is what stops it
//    reading as a metronome. The tongues carry no `translate` at all: every
//    keyframe is `scale` + `skewX` about `transform-origin: 50% 100%`, i.e. about
//    the hearth line, so a tongue can stretch, narrow and lean but its root stays
//    welded to the line. A vertical translate here is what lifts nine feet off the
//    fire at once and turns the layer into nine floating shapes. The flicker is
//    slow and shallow on purpose: ~2 Hz at the fastest, at most a third of an
//    already single-digit-alpha layer, i.e. far under any photosensitivity
//    threshold. Speed it up or deepen it and that stops being true.
// 6. Flames SHEAR; they do not swing. A rotation about the base is a pendulum — a
//    rigid body pivoting, the one motion a flame never makes. `skewX` on the same
//    origin holds the base on the line and displaces the tip proportionally to
//    height, which is what air actually does to a column of burning gas. The
//    non-uniform scale is anti-correlated (taller means narrower — a flame
//    conserves its fuel; scaling both axes together is a zoom), and it is also
//    what gives the fire line its horizontal definition: at any instant no two
//    neighbours are the same width or the same brightness, so the licks separate
//    in TIME rather than by being drawn apart in space.
// 7. Everything is `transform`/`opacity` on its own box — never
//    `background-position`, never the gradient stops. A transform on a bounded box
//    is a compositor job with no repaint; animating a gradient's geometry re-paints
//    it. Tongues are centred with a static `margin-left` derived from their own
//    width, not `translate(-50%)`, so the animated transform carries no layout
//    offset a keyframe could drop.
// 8. `filter: blur()` is for the TONGUES and the EMBERS, and nothing else. A
//    radial gradient's falloff is linear in alpha, which still reads as a defined
//    shape with a findable centre — worth paying for on the layers with an EDGE.
//    It is affordable only because each is a height-bounded box with a STATIC
//    filter and an animated transform/opacity, so the offscreen pass happens once
//    per layer and every frame after it is a composite. The wash and the glow go
//    without: at 4–8% over tens of rem there is no edge to hide, and a blur on a
//    box that size is the most expensive thing on the page. Never put one on
//    `.fire__grain` either — that one is `inset: 0`, i.e. as tall as the document,
//    so a blur there is a full-page offscreen pass on every paint (and it would
//    dissolve the specks the mask exists to make).
// 9. The `animation-name`s are written OUT, per element, and MUST stay that way.
//    Vue's scoped-style compiler rewrites `@keyframes fire-flame-a` to
//    `fire-flame-a-<scopeId>` and patches the literal names in `animation` /
//    `animation-name` to match — but it patches TEXT, so a name arriving through a
//    custom property (`animation: var(--flame-path) …`) is left pointing at a
//    keyframes rule that no longer exists. Nothing throws; the fire just goes out.
//    Every other per-element value is fine as a variable — only the name is
//    load-bearing.
//
// Purely decorative: `pointer-events-none` + `aria-hidden`.
</script>

<template>
  <div class="fire" aria-hidden="true">
    <div class="fire__hearth" />
    <div class="fire__core" />
    <div class="fire__flames">
      <div class="fire__flame fire__flame--1" />
      <div class="fire__flame fire__flame--2" />
      <div class="fire__flame fire__flame--3" />
      <div class="fire__flame fire__flame--4" />
      <div class="fire__flame fire__flame--5" />
      <div class="fire__flame fire__flame--6" />
      <div class="fire__flame fire__flame--7" />
      <div class="fire__flame fire__flame--8" />
      <div class="fire__flame fire__flame--9" />
    </div>
    <div class="fire__embers">
      <div class="fire__ember fire__ember--1" />
      <div class="fire__ember fire__ember--2" />
      <div class="fire__ember fire__ember--3" />
      <div class="fire__ember fire__ember--4" />
      <div class="fire__ember fire__ember--5" />
      <div class="fire__ember fire__ember--6" />
      <div class="fire__ember fire__ember--7" />
      <div class="fire__ember fire__ember--8" />
    </div>
    <div class="fire__grain" />
  </div>
</template>

<style scoped>
/* Fills the shell: header, main and footer, edge to edge. */
.fire {
  position: absolute;
  inset: 0;
  z-index: -10;
  overflow: hidden;
  pointer-events: none;

  /*
   * The FIRE's colour, and it is monochrome: `--foreground`, per-mode for free, so
   * the tones below are the same numbers in light and dark (at these alphas the two
   * pages want the same weight of ink, and only the grain needs a per-mode nudge).
   *
   * It is deliberately NOT `--brand`. The wash, the glow and the nine tongues are
   * the big surfaces here — 3–9% alpha over tens of rem — and that is the worst
   * possible place to spend a hue twice over: at 5% a hue is barely a hue, so it
   * buys almost no colour, and what little it does buy it spreads across the entire
   * hero, which is exactly the "one large coloured surface" Geist's monochrome
   * (AGENTS.md, `tokens.css` is roles-not-scales) exists to avoid. The accent goes
   * on `--ash` instead — see below.
   */
  --fire: var(--foreground);

  /*
   * The ASHES' colour, and it is the PROJECT's — `--brand`.
   *
   * The embers are the only part of this component with the two properties a hue
   * needs to actually read: real alpha (26%, against a field of ~13%) and a hard
   * edge. So they are where the accent goes, and putting it ONLY here is what makes
   * it worth having — eight coloured sparks lifting out of a grey fire is a colour
   * ACCENT, whereas tinting all eight layers is a colour cast, which reads as the
   * page having gone slightly wrong rather than as the fire having a colour.
   *
   * `--brand` DEFAULTS to `var(--foreground)` — `mono` is the default accent, see
   * `tokens.css` — so a docs project that has not picked a `themeColor` gets
   * exactly the monochrome embers this component was designed with, byte for byte,
   * and `--ash` collapses back onto `--fire`. Set `themeColor` (or let the visitor
   * pick) and only the sparks change, in one declaration, with no `dark:` variant.
   *
   * The grain follows neither: it stays `--foreground` at the bottom of this file,
   * because emulsion is not firelight.
   */
  --ash: var(--brand);

  /*
   * The width every tongue is measured in — see note 3 in the header. `24vw` is
   * the target; the clamp holds the fire line continuous at both extremes. At
   * 1440px this is 21.6rem, against tongue centres 9–10.8rem apart: each tongue
   * is about twice the spacing wide, which is the overlap the line is made of.
   */
  --flame-unit: clamp(11rem, 24vw, 27rem);

  /* The line every tongue and ember starts from, measured from the top of the
     page (so the header's 4rem is inside it). Below the hero's centre, so the
     fire burns UP through the text rather than sitting on top of it. Every
     tongue's box BOTTOM is this line — see `.fire__flame`, which derives its own
     `top` from it so the invariant cannot be typo'd. */
  --hearth-line: 36rem;
}

/*
 * Every band spans the width and pins its own height. `.fire__grain` is the
 * one exception — it is the page-tall layer, and it is also the only one that
 * never moves.
 */
.fire__hearth,
.fire__core,
.fire__flames,
.fire__embers {
  position: absolute;
  left: 0;
  right: 0;
}

.fire__grain {
  position: absolute;
  inset: 0;
}

/*
 * The room the fire is lighting: one very large, very faint wash centred on
 * `50% 28rem`, i.e. between the hero's middle and the fire line, so the hero sits
 * INSIDE the light rather than above it.
 *
 * Vertically it is `28rem ± (0.82 × 32rem)` = 1.8rem to 54.2rem, comfortably
 * inside its 0–60rem box, so nothing is clipped (note 2). Horizontally
 * `0.82 × 78%` = 64% of the width from centre, i.e. past both screen edges —
 * deliberate, and safe because this layer only ever animates `opacity`.
 */
.fire__hearth {
  top: 0;
  height: 60rem;
  background: radial-gradient(
    78% 32rem at 50% 28rem,
    color-mix(in oklab, var(--fire) 4.5%, transparent),
    transparent 82%
  );
  background-repeat: no-repeat;
  opacity: 0.86;
  animation: fire-hearth 7.3s ease-in-out -2.6s infinite;
}

/*
 * The fire's own light: the near field, the base the tongues stand in, and the
 * spill below the line — ONE element, because the moment those are separate
 * elements one of them has a vertical extent the others do not and the eye finds
 * the join. This is the layer that replaced a separate "coal bed", and the reason
 * that bed read as a detached bar is worth keeping written down: it was ~4rem of
 * 11% sitting at y ≈ 32–36rem while the glow above it had already died at 32rem.
 * A bright thing with nothing at its own height above or below it is a bar of
 * light, no matter how soft its own edges are.
 *
 * So this one is a MOUND, not a band: brightest at 35rem (1rem above the line, so
 * the hottest row of the whole composition is the fire line itself) and falling
 * off over 13rem in each direction — up through the tongues' roots, down onto the
 * floor. Measured at x = 50%, the composite runs 14.1% at y = 32rem, 11.8% at the
 * line, 8.5% at 38rem and 5.7% at 41rem: a slope the whole way, with nothing that
 * starts or stops.
 *
 * Three gradients on the one box, not one, and deliberately not concentric: a bed
 * of coals is patchy, and a single symmetric glow at the fire's midpoint is the
 * most obviously drawn thing that can sit there. They are hot SPOTS (3.0–3.6%,
 * 26–30% of the width across), not a second layer — they live entirely inside the
 * main glow's own extent, so they modulate it rather than adding an object.
 *
 * Vertical extents, all inside the 30rem box with room for `scaleY(1.05)`:
 * main `15 ± 0.92×14` = 2.1–27.9rem, spots `15 ± 0.88×8` = 8.0–22.0rem and
 * `16 ± 0.88×7` = 9.8–22.2rem. Horizontally the main glow reaches `0.92 × 80%` =
 * 73.6% of the width from centre, i.e. off both edges on purpose — which is why
 * the flicker is `scaleY` only (note 2).
 */
.fire__core {
  top: 20rem;
  height: 30rem;
  background:
    radial-gradient(
      30% 8rem at 33% 15rem,
      color-mix(in oklab, var(--fire) 3.6%, transparent),
      transparent 88%
    ),
    radial-gradient(
      26% 7rem at 70% 16rem,
      color-mix(in oklab, var(--fire) 3%, transparent),
      transparent 88%
    ),
    radial-gradient(
      80% 14rem at 50% 15rem,
      color-mix(in oklab, var(--fire) 7.5%, transparent),
      transparent 92%
    );
  opacity: 0.84;
  animation: fire-core 4.1s ease-in-out -1.3s infinite;
}

/*
 * Flames: nine tongues sharing one hearth line. The container carries no
 * background, so it has no edge of its own; the tall tongues overflow it upward
 * and `.fire`'s `overflow: hidden` is what ends them.
 */
.fire__flames {
  top: 0;
  height: var(--hearth-line);
}

/*
 * ONE tongue, and the arithmetic that keeps nine of them reading as one fire.
 *
 * GEOMETRY. The box is `--flame-w` × `--flame-h` with its BOTTOM on the hearth
 * line — `top` is derived from `--hearth-line`, so `top + height = --hearth-line`
 * holds by construction rather than by nine correct numbers. Inside it sits a
 * single ellipse, `42% 42% at 50% 76%`: half-reach 0.42 × width horizontally,
 * 0.42 × height vertically, centred 24% of the height above the line.
 *
 * OVERLAP — this is the number that matters. At 1440px `--flame-unit` is 21.6rem,
 * the nine centres are 9–10.8rem apart, and each tongue's horizontal half-reach
 * is 0.42 × its width = 7.8–11.1rem, against a half-spacing of 4.5–5.4rem. So
 * every tongue is still carrying alpha 1.4× to 2.4× past the midpoint to its
 * neighbour — none of them stops short of one — and the summed field along the line
 * runs 5.6% → 12.6% across the width as one broad bell, changing by under a
 * percentage point from one tongue to the next. That is a fire line. Narrowing
 * the ellipse, or masking the sides into a teardrop, drops those shoulders and
 * the line scallops and then breaks — which is exactly the "nine floating blobs"
 * this geometry exists to prevent. Any retune must recompute it.
 *
 * THE FOOT. The ellipse is the one gradient here allowed to still carry alpha at
 * its box edge, because that edge IS the fire line and something has to be bright
 * there. How much is fixed and scale-free: the bottom of the box is
 * (1 − 0.76)/0.42 = 0.571 of the way out along the gradient, which the stop ramp
 * below puts at 0.509 of the peak — the same fraction for every tongue, at every
 * viewport width, and unchanged by `scaleY` (which scales the offset and the
 * radius together about the same origin). So there are not nine feet of nine
 * brightnesses; there is one. The blur then spreads that ~4% step over its own
 * radius, and the glow underneath is at its own maximum right there, so the
 * measured profile across the line is a slope, not a step (the figures are under
 * `.fire__core`).
 *
 * The top is not an exception: the mass ends 0.34 × height below the box top and
 * the largest `scaleY` in the keyframes (1.30) carries it to 0.858 × height from
 * the bottom, still short of it. Sideways, 0.42 × 1.16 = 0.487 of the width from
 * centre at the widest keyframe, still short of the box's own 0.5. Nothing clips
 * but the foot.
 *
 * FOUR STOPS, expressed as fractions of one `--flame-tone` so that retuning a
 * tongue's brightness cannot bend its shape. The ramp is peaked rather than
 * domed — a flame's luminance profile has a heart — and its tail is long, which
 * is what buys the overlap above.
 *
 * BLUR is `min(width, height) / 19`, i.e. the SHORTER radius over 8, whichever
 * axis that happens to be. Taking the min is what lets the nine boxes have any
 * aspect ratio they like without the wide-and-short ones quietly losing peak: the
 * ratio of blur to the feature it is softening is 0.125 for every tongue at every
 * width, so one set of tones serves all nine.
 *
 * Nothing phase-locks. The nine periods share no small common multiple, so the
 * arrangement takes hours to repeat, and the negative delays start each tongue
 * mid-lick so the layer has no visible beginning. Four paths serve nine tongues:
 * nine keyframe blocks would be nine ways to say the same thing.
 */
.fire__flame {
  position: absolute;
  top: calc(var(--hearth-line) - var(--flame-h));
  width: var(--flame-w);
  height: var(--flame-h);
  margin-left: calc(var(--flame-w) / -2);
  transform-origin: 50% 100%;
  background: radial-gradient(
    42% 42% at 50% 76%,
    color-mix(in oklab, var(--fire) var(--flame-tone), transparent) 0%,
    color-mix(in oklab, var(--fire) calc(var(--flame-tone) * 0.72), transparent) 36%,
    color-mix(in oklab, var(--fire) calc(var(--flame-tone) * 0.46), transparent) 62%,
    color-mix(in oklab, var(--fire) calc(var(--flame-tone) * 0.22), transparent) 82%,
    transparent 100%
  );
  filter: blur(calc(min(var(--flame-w), var(--flame-h)) / 19));
  animation-duration: var(--flame-period);
  animation-delay: var(--flame-delay);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

/* Each `opacity` below restates its keyframes' 0% pose, so the reduced-motion
   rule at the bottom (which only drops the animation) lands on the same still
   frame the loop starts from. The `left` values are deliberately uneven —
   evenly spaced tongues are a picket fence — and the widths alternate narrow/wide,
   so every gap has a wide tongue on at least one side of it and the one 12% gap
   (80% → 92%) has the 1.16-unit tongue on its right. The heights are the fire's
   whole silhouette: 24rem to 44rem, i.e. visible tips from y ≈ 20rem down to
   y ≈ 7rem. They alternate short/tall, which is also what leaves the five odd
   tongues the mobile query keeps spread over 34–44rem rather than all one size. */
.fire__flame--1 {
  left: 4%;
  opacity: 0.78;
  animation-name: fire-flame-a;
  --flame-w: calc(var(--flame-unit) * 1.1);
  --flame-h: 36rem;
  --flame-tone: 8.8%;
  --flame-period: 5.6s;
  --flame-delay: -2.1s;
}

.fire__flame--2 {
  left: 15%;
  opacity: 0.9;
  animation-name: fire-flame-d;
  --flame-w: calc(var(--flame-unit) * 0.86);
  --flame-h: 26rem;
  --flame-tone: 9.8%;
  --flame-period: 3.7s;
  --flame-delay: -0.7s;
}

.fire__flame--3 {
  left: 26%;
  opacity: 0.72;
  animation-name: fire-flame-c;
  --flame-w: calc(var(--flame-unit) * 1.18);
  --flame-h: 43rem;
  --flame-tone: 8.4%;
  --flame-period: 6.9s;
  --flame-delay: -1.2s;
}

.fire__flame--4 {
  left: 36%;
  opacity: 0.85;
  animation-name: fire-flame-b;
  --flame-w: calc(var(--flame-unit) * 0.9);
  --flame-h: 30rem;
  --flame-tone: 9.2%;
  --flame-period: 4.3s;
  --flame-delay: -3.4s;
}

.fire__flame--5 {
  left: 47%;
  opacity: 0.78;
  animation-name: fire-flame-a;
  --flame-w: calc(var(--flame-unit) * 1.22);
  --flame-h: 44rem;
  --flame-tone: 8.4%;
  --flame-period: 6.2s;
  --flame-delay: -4.6s;
}

.fire__flame--6 {
  left: 58%;
  opacity: 0.85;
  animation-name: fire-flame-b;
  --flame-w: calc(var(--flame-unit) * 0.92);
  --flame-h: 32rem;
  --flame-tone: 9.2%;
  --flame-period: 4.9s;
  --flame-delay: -1.8s;
}

.fire__flame--7 {
  left: 69%;
  opacity: 0.72;
  animation-name: fire-flame-c;
  --flame-w: calc(var(--flame-unit) * 1.06);
  --flame-h: 39rem;
  --flame-tone: 8.8%;
  --flame-period: 7.4s;
  --flame-delay: -5.3s;
}

.fire__flame--8 {
  left: 80%;
  opacity: 0.9;
  animation-name: fire-flame-d;
  --flame-w: calc(var(--flame-unit) * 0.88);
  --flame-h: 24rem;
  --flame-tone: 9.8%;
  --flame-period: 3.4s;
  --flame-delay: -2.6s;
}

.fire__flame--9 {
  left: 92%;
  opacity: 0.78;
  animation-name: fire-flame-a;
  --flame-w: calc(var(--flame-unit) * 1.16);
  --flame-h: 34rem;
  --flame-tone: 8.8%;
  --flame-period: 5.1s;
  --flame-delay: -3.9s;
}

/*
 * Below Geist's `md`, half the tongues go. `--flame-unit` is at or near its 11rem
 * floor by then, so nine tongues at ~11% spacing stop being a fire line and become
 * one opaque slab — the alphas are additive. Dropping the even ones leaves five
 * spread across 4%–92%, which is the same picture at a lower density, and they are
 * the 34–44rem ones, so the silhouette survives. The line stays continuous under
 * them because the glow, not the tongues, is what carries the base.
 *
 * The even EMBERS go with them, and that pairing is the point rather than tidiness:
 * each ember is placed within a rem of a tongue's centre, so leaving all eight
 * behind would strand four of them over the gaps where a tongue used to be — a
 * speck rising out of nothing, which is the same detached-object failure the
 * hearth-line spawn point was. Odd tongues keep odd embers.
 *
 * A plain media query is safe here in a way the grid's column counts are not (see
 * `grid/responsive.ts`): nothing reads it in JS, so SSR and the client's first
 * render cannot disagree about it.
 */
@media (max-width: 48rem) {
  .fire__flame:nth-child(even),
  .fire__ember:nth-child(even) {
    display: none;
  }
}

/*
 * Embers: eight specks lifted OUT OF the fire, rising past the header and out of
 * the top of the shell (`overflow: hidden` clips them — an ember that fades out
 * in mid-air reads as a bug, one that leaves frame reads as a draught).
 *
 * Where they are BORN is the whole thing, and getting it wrong is what made them
 * read as a detached row of dots along the bottom of the picture. They used to
 * start on `--hearth-line` itself: the very bottom edge of the fire, where the
 * tongues have fallen to 0.509 of their peak and are about to end, with all of
 * the fire above them and nothing below. Now each one starts 3–9rem UP — inside
 * the glow's brightest band and inside the tongues' own mass, where the composite
 * is at its 12–16% maximum — and each sits within a rem or so of a tongue's
 * centre, because a spark comes off a flame, not out of the gap between two. The
 * effect is that an ember is already surrounded by light when it appears, so it
 * separates from the fire by CLIMBING rather than by being drawn somewhere else.
 *
 * They are also the only hard-edged, high-alpha thing in the component, which is
 * why 26% and not the 38% they carried: a speck three times the weight of every
 * other mark on the page is a different picture stacked on this one, not a detail
 * in it. 26% against a ~14% field still reads as a spark, and the 0.6px blur
 * takes the pixel edge off. They can afford any weight at all only because they
 * are 3–4px across, so the lit area is negligible.
 *
 * That weight and that edge are also why these, alone in this component, are drawn
 * in `--ash` (= `--brand`) rather than `--fire`: they are the only mark here a hue
 * can survive on. Under the default `mono` theme `--ash` IS `--fire`, so they
 * invert with the page like everything else and both readings are the right one —
 * motes of soot and ash over the light page, sparks over the dark. Under a set
 * `themeColor` they are the accent, and the fire behind them stays grey.
 *
 * They ride `linear` timing, and the DECELERATION is written into the keyframe
 * positions instead: an ember leaves the fire on the plume's buoyancy and loses
 * it as the air around it cools, so the gaps between stops shrink as it climbs.
 * An `ease-out` timing function would do the same thing to the sway, which should
 * not slow down — the higher it gets the more it is at the mercy of the room.
 *
 * The opacity stops are uneven on purpose: a spark tumbles, so it TWINKLES rather
 * than fading monotonically. That irregularity is most of what separates an ember
 * from a dot on a path.
 *
 * Three paths shared by eight embers, with per-ember position, size, period and
 * negative delay — eight independent keyframe blocks would be eight ways to say
 * the same thing, and the eye reads the drift, not the trajectory.
 */
.fire__embers {
  top: 0;
  height: var(--hearth-line);
}

.fire__ember {
  position: absolute;
  /* Never the line itself — see above. `--ember-lift` is how far up INTO the fire
     this one is born, 3–9rem, which on every tongue is well inside its mass (the
     shortest is 24rem tall, so its light reaches 15rem above the line). */
  top: calc(var(--hearth-line) - var(--ember-lift));
  width: var(--ember-size);
  height: var(--ember-size);
  border-radius: 50%;
  /* `--ash`, not `--fire`: the sparks are the one thing here that carries the
     project's accent, and the only one with the alpha and the edge to show it.
     Under the default `mono` theme this resolves to the same `--foreground` the
     rest of the fire is drawn in, so the monochrome render is unchanged. */
  background: color-mix(in oklab, var(--ash) 26%, transparent);
  filter: blur(0.6px);
  /* Driven entirely by the keyframes, so reduced motion leaves nothing behind. */
  opacity: 0;
  animation-duration: var(--ember-period);
  animation-delay: var(--ember-delay);
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.fire__ember--1 {
  left: 5%;
  animation-name: fire-ember-a;
  --ember-lift: 3rem;
  --ember-size: 3px;
  --ember-period: 9.4s;
  --ember-delay: -1.1s;
}

.fire__ember--2 {
  left: 16%;
  animation-name: fire-ember-b;
  --ember-lift: 7rem;
  --ember-size: 4px;
  --ember-period: 12.7s;
  --ember-delay: -6.3s;
}

.fire__ember--3 {
  left: 27%;
  animation-name: fire-ember-c;
  --ember-lift: 4rem;
  --ember-size: 3px;
  --ember-period: 10.1s;
  --ember-delay: -3.8s;
}

.fire__ember--4 {
  left: 37%;
  animation-name: fire-ember-a;
  --ember-lift: 9rem;
  --ember-size: 4px;
  --ember-period: 13.9s;
  --ember-delay: -8.2s;
}

.fire__ember--5 {
  left: 46%;
  animation-name: fire-ember-b;
  --ember-lift: 5rem;
  --ember-size: 3px;
  --ember-period: 8.6s;
  --ember-delay: -4.9s;
}

.fire__ember--6 {
  left: 59%;
  animation-name: fire-ember-c;
  --ember-lift: 8rem;
  --ember-size: 3px;
  --ember-period: 15.3s;
  --ember-delay: -11.4s;
}

.fire__ember--7 {
  left: 70%;
  animation-name: fire-ember-a;
  --ember-lift: 3rem;
  --ember-size: 3px;
  --ember-period: 11.2s;
  --ember-delay: -7.5s;
}

.fire__ember--8 {
  left: 81%;
  animation-name: fire-ember-b;
  --ember-lift: 6rem;
  --ember-size: 4px;
  --ember-period: 14.6s;
  --ember-delay: -2.9s;
}

/*
 * Flicker. Both curves are irregular by design — evenly spaced stops at even
 * amplitudes are a sine wave, and a sine wave reads as breathing, not burning.
 * The wash is shallower and slower than the glow because the room lags the fire.
 * The glow's `scaleY` peaks at 1.05, which is what its 30rem box was sized to
 * absorb (see the extents on the rule); there is no `scaleX`, because scaling the
 * one layer that is meant to bleed past the screen edge would drag that crop
 * across the viewport every frame.
 */
@keyframes fire-hearth {
  0%,
  100% {
    opacity: 0.86;
  }
  14% {
    opacity: 0.96;
  }
  27% {
    opacity: 0.8;
  }
  41% {
    opacity: 1;
  }
  58% {
    opacity: 0.84;
  }
  73% {
    opacity: 0.94;
  }
  88% {
    opacity: 0.82;
  }
}

@keyframes fire-core {
  0%,
  100% {
    opacity: 0.84;
    transform: scaleY(1);
  }
  9% {
    opacity: 1;
    transform: scaleY(1.04);
  }
  21% {
    opacity: 0.74;
    transform: scaleY(0.98);
  }
  34% {
    opacity: 0.96;
    transform: scaleY(1.03);
  }
  47% {
    opacity: 0.78;
    transform: scaleY(1);
  }
  63% {
    opacity: 1;
    transform: scaleY(1.05);
  }
  78% {
    opacity: 0.82;
    transform: scaleY(1.01);
  }
  91% {
    opacity: 0.92;
    transform: scaleY(1.02);
  }
}

/*
 * The tongue paths. Every stop is `scale` + `skewX` about the bottom centre, and
 * there is NO translate anywhere — see note 5. That is the difference between a
 * fire and nine shapes bobbing near a fire: the root of every tongue is welded to
 * `--hearth-line` at all times, so the line the eye is tracking never moves, and
 * all the motion happens above it.
 *
 * The scale is NON-UNIFORM and anti-correlated (taller means narrower) because
 * that is what a flame conserving its fuel does; scaling both axes together is a
 * zoom. `scaleY` ranges 0.85–1.30, which on a 36rem tongue moves the tip by about
 * 5rem — the amplitude is large on purpose, because what the eye picks up is
 * luminance CHANGE over time and these are single-digit-alpha greys: a rem over
 * five seconds produces a per-frame delta below the threshold where anything
 * reads as moving at all. `scaleX` ranges 0.85–1.16, i.e. the overlap between
 * neighbours breathes without ever failing (the worst case is two adjacent
 * tongues both at 0.85, which still leaves each carrying alpha past the midpoint).
 *
 * The shear is the lean. It is an angle, so it scales with the tongue for free,
 * and hinged on the hearth line it displaces the tip in proportion to height —
 * which is why the tall tongues visibly lean and the short ones barely do.
 *
 * Five stops, not four. A four-stop loop at these periods is slow enough to read
 * as a shape being tweened between poses; the fifth breaks the cadence without
 * touching the frequency the photosensitivity note in the header bounds. Each
 * path returns to its own origin at 100%, so the loop closes without a rewind.
 */
@keyframes fire-flame-a {
  0%,
  100% {
    transform: scale(1, 1) skewX(0deg);
    opacity: 0.78;
  }
  23% {
    transform: scale(0.88, 1.18) skewX(-5deg);
    opacity: 1;
  }
  44% {
    transform: scale(1.12, 0.92) skewX(3.5deg);
    opacity: 0.82;
  }
  66% {
    transform: scale(0.9, 1.24) skewX(-6.5deg);
    opacity: 0.95;
  }
  85% {
    transform: scale(1.06, 0.96) skewX(2deg);
    opacity: 0.68;
  }
}

@keyframes fire-flame-b {
  0%,
  100% {
    transform: scale(1, 1) skewX(0deg);
    opacity: 0.85;
  }
  19% {
    transform: scale(1.14, 0.88) skewX(4.5deg);
    opacity: 0.68;
  }
  41% {
    transform: scale(0.86, 1.28) skewX(-5.5deg);
    opacity: 1;
  }
  60% {
    transform: scale(1.06, 0.95) skewX(2.5deg);
    opacity: 0.78;
  }
  82% {
    transform: scale(0.92, 1.16) skewX(-3.5deg);
    opacity: 0.92;
  }
}

@keyframes fire-flame-c {
  0%,
  100% {
    transform: scale(1, 1) skewX(0deg);
    opacity: 0.72;
  }
  26% {
    transform: scale(0.9, 1.2) skewX(-6deg);
    opacity: 0.95;
  }
  45% {
    transform: scale(1.04, 1.04) skewX(1.5deg);
    opacity: 0.76;
  }
  64% {
    transform: scale(1.1, 0.9) skewX(5deg);
    opacity: 1;
  }
  87% {
    transform: scale(0.94, 1.14) skewX(-2.5deg);
    opacity: 0.84;
  }
}

@keyframes fire-flame-d {
  0%,
  100% {
    transform: scale(1, 1) skewX(0deg);
    opacity: 0.9;
  }
  21% {
    transform: scale(0.85, 1.3) skewX(4deg);
    opacity: 0.66;
  }
  38% {
    transform: scale(1.16, 0.88) skewX(-3deg);
    opacity: 1;
  }
  61% {
    transform: scale(0.9, 1.2) skewX(6deg);
    opacity: 0.76;
  }
  83% {
    transform: scale(1.08, 0.94) skewX(-2deg);
    opacity: 0.92;
  }
}

/*
 * Ember paths. Each RAMPS IN over the first fifth of its climb rather than
 * appearing — it is born inside the fire's own light (see `.fire__ember`), so the
 * first several rem of the rise happen while it is still surrounded by tone, and
 * by the time it is unmistakably a separate speck it is already 5rem clear of the
 * flames. Going straight to full weight in the first tenth is what made these
 * arrive rather than leave.
 *
 * Then it sways as it climbs — the sway is what makes it air rather than a
 * projectile — and is gone before it reaches the clip, so the fade does the ending
 * and the clip is only insurance. The shrink is perspective, not burnout; the
 * uneven opacity is the tumble, and none of the peaks reach 1 any more because the
 * dot's own alpha already sits closer to the field it is leaving.
 */
@keyframes fire-ember-a {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0;
  }
  18% {
    transform: translate3d(0.5rem, -5rem, 0) scale(0.98);
    opacity: 0.72;
  }
  36% {
    transform: translate3d(-0.7rem, -11rem, 0) scale(0.92);
    opacity: 0.42;
  }
  55% {
    transform: translate3d(-1.4rem, -17rem, 0) scale(0.84);
    opacity: 0.88;
  }
  78% {
    transform: translate3d(1.2rem, -24rem, 0) scale(0.7);
    opacity: 0.34;
  }
  100% {
    transform: translate3d(-0.4rem, -30rem, 0) scale(0.55);
    opacity: 0;
  }
}

@keyframes fire-ember-b {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0;
  }
  21% {
    transform: translate3d(-0.6rem, -5.6rem, 0) scale(0.96);
    opacity: 0.66;
  }
  40% {
    transform: translate3d(0.9rem, -12rem, 0) scale(0.9);
    opacity: 0.4;
  }
  58% {
    transform: translate3d(1.6rem, -17.6rem, 0) scale(0.84);
    opacity: 0.9;
  }
  80% {
    transform: translate3d(-1rem, -23rem, 0) scale(0.72);
    opacity: 0.44;
  }
  100% {
    transform: translate3d(1.4rem, -28rem, 0) scale(0.58);
    opacity: 0;
  }
}

@keyframes fire-ember-c {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0;
  }
  16% {
    transform: translate3d(0.3rem, -4.4rem, 0) scale(1);
    opacity: 0.6;
  }
  33% {
    transform: translate3d(-1.1rem, -10.4rem, 0) scale(0.94);
    opacity: 0.34;
  }
  52% {
    transform: translate3d(-1.8rem, -16rem, 0) scale(0.88);
    opacity: 0.86;
  }
  76% {
    transform: translate3d(0.9rem, -22rem, 0) scale(0.76);
    opacity: 0.4;
  }
  100% {
    transform: translate3d(-1.2rem, -27rem, 0) scale(0.6);
    opacity: 0;
  }
}

/*
 * Reduced motion keeps the fire and stops it moving: the wash, the glow and the
 * tongues settle on their 0% pose — which for a tongue is the identity transform
 * and the `opacity` restated on its own rule, so the still frame is the one the
 * loop starts from — and the embers, whose 0% opacity is 0, leave entirely. A
 * frozen spark is the one element here that would read as a rendering artefact
 * rather than as a picture.
 */
@media (prefers-reduced-motion: reduce) {
  .fire__hearth,
  .fire__core,
  .fire__flame,
  .fire__ember {
    animation: none;
  }
}

/*
 * Grain: one flat `--foreground` fill, punched through by tiled noise.
 * `stitchTiles` is what makes the 140px tile seamless; the alpha gamma pushes
 * the flat 50%-grey average down into sparse, crisp specks, so the layer reads
 * as grain rather than as a grey tint. It runs the full height at one weight —
 * at 5.5% behind content there is nothing to fade out for.
 */
.fire__grain {
  background-color: var(--foreground);
  opacity: 0.055;
  --fire-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' exponent='2.4'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)'/%3E%3C/svg%3E");
  -webkit-mask-image: var(--fire-grain);
  mask-image: var(--fire-grain);
  -webkit-mask-size: 140px 140px;
  mask-size: 140px 140px;
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
}

.dark .fire__grain {
  opacity: 0.075;
}
</style>
