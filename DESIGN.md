---
name: squish
description: Calm night-sky converter. Frosted glass over a muted aurora on near-black, one polar-mint accent for the action, the progress and the saving.
colors:
  polar-mint: "#8fd3c4"
  mint-ink: "#0b1d1a"
  night-ground: "#0b0f15"
  starlight: "#eef1f8"
  mist: "#a3abc0"
  deep-popover: "#141a24"
  glass-fill: "rgb(255 255 255 / 0.055)"
  glass-edge: "rgb(255 255 255 / 0.12)"
  hairline: "rgb(255 255 255 / 0.08)"
  quiet-fill: "rgb(255 255 255 / 0.06)"
  lamp-amber: "#e9cf8f"
  dusk-rose: "#e99aa5"
  aurora-teal: "#1f6a63"
  aurora-slate: "#2b4473"
  aurora-violet: "#4a3a78"
typography:
  figure:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "60px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.06em"
    fontFeature: "tnum"
  figure-compact:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.06em"
    fontFeature: "tnum"
  display:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  display-compact:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  logo:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.55
  lead:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.625
  body-strong:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.43
  label:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.33
  badge:
    fontFamily: "Sora Variable, Onest Variable, ui-sans-serif, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  track: "3px"
  segment: "10px"
  control: "14px"
  tile: "16px"
  dropzone: "18px"
  panel: "24px"
  pill: "9999px"
spacing:
  hairline-gap: "4px"
  row: "11px"
  stack: "14px"
  gutter: "16px"
  panel-x: "20px"
  panel-x-wide: "32px"
  column: "940px"
components:
  button-primary:
    backgroundColor: "{colors.polar-mint}"
    textColor: "{colors.mint-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-light:
    backgroundColor: "{colors.starlight}"
    textColor: "{colors.night-ground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 32px"
    height: "52px"
  button-ghost:
    backgroundColor: "{colors.quiet-fill}"
    textColor: "{colors.starlight}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-icon:
    backgroundColor: "{colors.quiet-fill}"
    textColor: "{colors.starlight}"
    rounded: "{rounded.pill}"
    size: "36px"
  chip-nav:
    backgroundColor: "{colors.quiet-fill}"
    textColor: "{colors.starlight}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  segmented:
    backgroundColor: "{colors.glass-fill}"
    rounded: "{rounded.control}"
    padding: "4px"
  segment-selected:
    backgroundColor: "{colors.starlight}"
    textColor: "{colors.night-ground}"
    typography: "{typography.label}"
    rounded: "{rounded.segment}"
    height: "36px"
  segment-idle:
    textColor: "{colors.mist}"
    typography: "{typography.label}"
    rounded: "{rounded.segment}"
    height: "36px"
  input-field:
    backgroundColor: "{colors.glass-fill}"
    textColor: "{colors.starlight}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "44px"
  glass-panel:
    backgroundColor: "{colors.glass-fill}"
    textColor: "{colors.starlight}"
    rounded: "{rounded.panel}"
    padding: "24px 20px"
  status-pill:
    textColor: "{colors.polar-mint}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "28px"
  thumb:
    backgroundColor: "{colors.hairline}"
    rounded: "{rounded.control}"
    size: "44px"
---

# Design System: squish

## Overview

**Creative North Star: "The Polar Night"**

A calm night sky with a tool in it. The ground is near-black, a muted aurora hangs behind everything, and every working surface is one material: frosted glass that lets the aurora glow through. Colour is spent sparingly so the only things that stand out are the files and the saving. The user asked for nothing that hurts the eyes; that request is a system invariant, not a mood.

Density is moderate and single-column: one centred column of glass panels, each doing one job, with a glass dock pinned to the bottom of the window when there are results. Type is one family throughout, heavy and tightly tracked at display sizes, medium weight for reading. Motion is soft and short: rise-and-fade for the dialog, a small lift when the saving figure changes, a count-up on the figure itself.

The world refuses both the white-box-with-indigo default and loud neon dark mode.

**Key Characteristics:**
- Near-black ground with a heavily blurred, low-opacity aurora fixed behind the page.
- Frosted glass is the only surface material; panels, tabs, dock and dialog all share it.
- One accent (polar mint) for the primary action, progress and saving; amber and rose only carry status.
- Selection is a light pill (starlight on night), never an accent fill.
- Pills and rounded rectangles only; the edge-pinned dock is the one square-cornered surface.
- Sora for everything, Onest filling the glyphs Sora lacks.

## Colors

A dark, desaturated palette: cool neutrals on near-black, three muted aurora hues kept behind glass, and one soft mint that does all the pointing.

### Primary
- **Polar Mint** (`polar-mint`): the single accent. The "Choose files" button, filled progress bars, the slider fill, the focus ring, the done status, the saving percentage, the sign of the dock figure, the logo dot and the local-only dot. Text on it is **Mint Ink** (`mint-ink`).

### Secondary
- **Lamp Amber** (`lamp-amber`): working state and "larger than original" (a negative saving, its + sign in the dock, the notice line after a drop). A status colour, never decoration.

### Tertiary
- **Dusk Rose** (`dusk-rose`): failures only: failed status pill, error message, retry icon.

### Neutral
- **Night Ground** (`night-ground`): page background and text on light pills.
- **Starlight** (`starlight`): primary text, slider thumb, selected segments and the light download pill.
- **Mist** (`mist`): secondary text, captions, idle segments and tabs.
- **Deep Popover** (`deep-popover`): the dialog surface, used at 85% under a strong backdrop blur.
- **Glass Fill** (`glass-fill`), **Glass Edge** (`glass-edge`): the frosted panel material and its 1px rim.
- **Hairline** (`hairline`): row dividers, chip and segment borders, empty progress track and thumb placeholder.
- **Quiet Fill** (`quiet-fill`): the fill of ghost buttons, nav chips and icon buttons; hover lifts it to white at 10-12%.
- **Aurora Teal / Slate / Violet** (`aurora-teal`, `aurora-slate`, `aurora-violet`): background curtains only, always blurred (70-110px) and at 18-60% opacity. Never applied to a component.

### Named Rules
**The One Mint Rule.** Polar mint is the only accent. It marks the primary action, progress and saving; nothing else gets a hue.

**The Outlined Status Rule.** Status pills are outlined in their status colour on a transparent ground, never filled.

**The Light Pill Rule.** A chosen option (segment, language, final download) is a starlight pill with night text. Mint fills mean on, done or in progress (the primary action, progress bars, slider fill, the switch when on, the active tab's count), never chosen-among-options.

## Typography

**Display Font:** Sora Variable (with Onest Variable, then ui-sans-serif)
**Body Font:** Sora Variable (with Onest Variable, then ui-sans-serif, system-ui)

**Character:** One geometric sans carries the whole page. Display sizes go heavy (700-800) and tight (-0.035em to -0.06em); reading text stays at medium weight (500) so it holds up on the dark ground. Onest is not a second voice: it only fills the glyphs Sora lacks (the minus sign and the right arrow, both used in every saving and every before → after line). Croatian č, ć and đ render in Sora.

### Hierarchy
- **Figure** (800, 60px desktop / 34px mobile, line-height 1, -0.06em, tabular): the saving in the dock. The one oversized number on the page.
- **Display** (700, 34px desktop / 28px mobile, line-height 1.05, -0.035em, balanced): the drop card headline.
- **Headline** (700, 32px, -0.035em): dialog titles.
- **Logo** (800, 26px, line-height 1, -0.04em): the wordmark, followed by a 9px mint dot.
- **Title** (600-700, 18px): drop zone title, dialog section heads.
- **Lead** (500, 17px, relaxed): the About paragraph, max 65ch.
- **Body Strong** (600, 15px): file names, medium buttons, dock size line on desktop; 700 for the per-row saving.
- **Body** (500, 14px): steps, tallies, empty states, notes; 16px only inside the large button.
- **Label** (600, 13px): chips, segments, small buttons, settings notes, the local-only note.
- **Caption** (600, 12px): field captions, status pills, file detail lines (500), the EN/HR switch (700, uppercase).
- **Badge** (700, 11px, tabular): the count inside a kind tab.

### Named Rules
**The Tabular Numbers Rule.** Every size, percentage, count and dimension uses tabular figures so values do not jitter while files finish.

**The Glyph Fallback Rule.** Keep Onest in every Sora stack; the minus (−) and arrow (→) the product prints everywhere come from it.

## Layout

A single centred column, 940px wide, with 16px side gutters (24px from the sm breakpoint). Panels stack with a 14px gap: drop card, settings strip, kind tabs with the status tally on the right, then the file list. The header spans up to 1440px with 40px gutters on wide screens. The dock is fixed to the bottom edge at full width, its content held to the same 940px column, and the page adds bottom padding (144px) when it is present.

Inside panels: the drop card pads 24/20px (28/32px from sm); the settings strip pads 18/20px (22px from sm) and lays out as a grid whose columns follow the active kind; file rows are 11px tall-padded with a 44px thumbnail column and 16px column gaps. On desktop each row is one line (thumb, name and details, progress bar, saving, status pill, actions); on mobile the saving and status move under the name and the progress bar spans the row.

Responsive changes: the header nav drops to its own full-width row below sm and the local-only note below md; the drop zone stacks vertically and centres below sm; kind tabs stretch full width on mobile; the dock figure shrinks from 60px to 34px and the download button collapses to "ZIP".

## Elevation & Depth

Depth comes from translucency, not shadow stacks. Every panel is the same frosted layer: 5.5% white fill, backdrop blur 26px with 1.4 saturation, a 1px 12% rim, a faint inset top highlight and one deep, soft drop shadow. The aurora behind the glass is what makes the layer read. The dialog sits one level higher: a denser popover fill, stronger blur and a larger shadow over a blurred, dimmed backdrop.

### Shadow Vocabulary
- **Glass** (`box-shadow: 0 1px 0 rgb(255 255 255 / 0.08) inset, 0 20px 50px rgb(0 0 0 / 0.35)`): every glass panel, the tabs and the dock.
- **Dialog** (`box-shadow: 0 30px 80px rgb(0 0 0 / 0.5)`): the info dialog only.
- **Knob** (`box-shadow: 0 2px 10px rgb(0 0 0 / 0.5)`; toggle knob `0 2px 6px rgb(0 0 0 / 0.4)`): slider thumb and switch knob, so the light disc sits above its track.

### Named Rules
**The One Material Rule.** Glass is the only surface. New panels use the same fill, rim, blur and shadow; no opaque cards. The only tint is mint at 10% (with a 30% mint border where bordered), reserved for the drop zone while dragging and the privacy note.

**The Aurora Stays Behind Rule.** Aurora colour exists only in the fixed, blurred background layers. It never becomes a fill, border or gradient on a component.

## Shapes

Soft, nested rounding with pills for anything you press. Glass panels are 24px; the dashed drop zone inside the drop card is 18px; the upload tile and the privacy note are 16px; inputs, segmented controls and file thumbnails are 14px; segments inside a segmented control are 10px (the 14px outer minus its 4px inset); the slider track is 3px. Buttons, chips, tabs, status pills, the language switch, progress bars, the switch and the slider thumb are full pills or circles. Borders are 1px hairlines; the only dashed line is the drop zone's 1.5px border. The dock drops its corners and side borders to sit flush with the window edge.

**The Nested Radius Rule.** An inner shape's radius is its container's radius minus the inset, so 24 → 18 → 16 → 14 → 10 steps down as elements nest.

## Components

### Buttons
Quiet, rounded, and pressable: every button is a pill that shrinks to 97% on press.
- **Shape:** full pill; heights 52px (large), 44px (medium), 36px (small and icon).
- **Primary:** polar mint with mint ink, bold, 20px side padding. One per screen: "Choose files".
- **Light:** starlight with night text, bold; the final "Download all (.zip)" in the dock. Hover goes to pure white.
- **Ghost:** quiet fill with a hairline border and starlight text; paste, clear and secondary actions. Hover lifts the fill to white 10%.
- **Icon:** 36px circular ghost (40-44px in the dock and dialog) holding a 16-20px line icon.
- **Focus:** a 2px mint outline offset 3px, globally. Disabled: 40% opacity, no press scale.

### Chips
- **Nav chips** ("How it works", "About"): 36px ghost pills with 13px semibold text; open the info dialog.
- **Language switch:** a ghost pill group with 3px inset; the active language is a light pill, the other is mist text.
- **Status pills:** 24-28px outlined pills in the status colour (mist queued, amber working, mint done, rose failed), 12px semibold, transparent fill.

### Cards / Containers
- **Corner Style:** 24px.
- **Background:** glass fill over the aurora.
- **Shadow Strategy:** the Glass shadow (see Elevation & Depth).
- **Border:** 1px glass edge.
- **Internal Padding:** 20-32px horizontal, 18-28px vertical; the file list pads 16-20px horizontally with rows separated by hairlines.

### Inputs / Fields
- **Segmented control:** a 14px rounded track with glass fill and hairline border, 4px inset; 36px segments at 10px radius. Selected is a light pill; idle is mist, starlight on hover; unavailable formats are struck through at 40%. It is a real radio group.
- **Number field:** 44px tall, 14px radius, glass fill and hairline border, 14px semibold tabular value with a "px" suffix; focus draws the mint outline around the whole field.
- **Quality slider:** a 6px track with 3px radius, filled mint up to the value over white 10%; a 22px starlight thumb that scales to 1.15 while dragged.
- **Switch:** a 56 × 32px pill, hairline border; turns mint when on, with a 24px starlight knob sliding across.
- **Caption:** 12px semibold mist above each control; the current value sits right-aligned in 14px bold.

### Navigation
- **Kind tabs:** a glass pill holding three 36px pill tabs (Images, Video, Audio). Active tab is white 12% with starlight text; idle is mist. A count badge (18px, 11px bold) sits in each tab with files: mint on the active tab, white 10% otherwise. Arrow keys move between tabs.
- **Header:** logo left, nav chips beside it, local-only note and language switch right. On mobile the chips wrap to their own row.

### File Row
Each file is one row: a 44px thumbnail at 14px radius (mint icon on a muted tile for audio, a frame for video), the name at 15px semibold, before → after details at 12px mist, a 6px pill progress bar (mint fill when known, a sliding mint band when not), the saving in 15px bold mint (amber when the file grew), an outlined status pill, and 36px icon buttons for download, retry (rose) and remove.

### Saving Dock
The signature. A full-width glass bar fixed to the bottom of the window, shown only when the active tab has files. The saving figure counts up as files finish and lifts slightly when it changes; only its sign carries colour (mint for a saving, amber for growth), the digits stay starlight. Beside it, the before → after total and "n of m files ready"; on the right a ghost clear button and the light download pill.

### Info Dialog
A native modal sheet up to 720px wide, 24px radius, deep popover at 85% with strong blur and the Dialog shadow, over a backdrop dimmed to 50% black and blurred 6px. It rises 24px and fades in over 260-360ms on the soft ease. Numbered steps use 40px outlined circles with mint numerals; the privacy note is a 16px rounded panel tinted mint at 10% with a 30% mint border.

## Do's and Don'ts

### Do:
- **Do** build every new surface from the glass material: glass fill, 1px glass edge, 26px backdrop blur, 24px radius, the Glass shadow.
- **Do** keep polar mint for the one primary action, progress, saving and focus.
- **Do** show selection as a starlight pill with night text.
- **Do** outline status pills in their status colour: mist queued, amber working, mint done, rose failed.
- **Do** use tabular figures for every size, percentage and count, and keep Onest in the font stack for − and →.
- **Do** nest radii by subtracting the inset (24 → 18 → 16 → 14 → 10) and make anything pressable a pill.
- **Do** keep motion soft and short on the soft ease (cubic-bezier(0.22, 1, 0.36, 1)), and collapse it under reduced motion.

### Don't:
- **Don't** add a second accent or use aurora hues on components; the aurora stays blurred behind the glass.
- **Don't** fill status pills or use amber and rose for anything but working, growth and failure.
- **Don't** use opaque cards, tint panels in any colour but the 10% mint of the drag-over zone and privacy note, or stack extra shadows to create depth.
- **Don't** use sharp corners on buttons, controls or floating panels; only the dock, pinned flush to the window edge, goes square.
- **Don't** go bright or neon: no saturated glows, no high-chroma fills. The palette stays discreet by request.
- **Don't** fall back to a white page with an indigo accent.
