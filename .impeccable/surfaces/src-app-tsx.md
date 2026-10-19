---
version: 2
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/components/Header.tsx", "src/components/DropCard.tsx", "src/components/SettingsStrip.tsx", "src/components/KindTabs.tsx", "src/components/FileList.tsx", "src/components/Dock.tsx", "src/components/InfoDialog.tsx"]
---

# squish converter (main tool page)

Scope: the single-page converter for images, video and audio, the first and main surface. Mode: Operate.
Audience and job: anyone who needs smaller or differently formatted files fast; drop, adjust, download.
Constraints: React + Vite + Tailwind + shadcn conventions (21st.dev compatible); EN primary, HR switch (č, ć, đ must render); all processing local (Canvas API for images, WebCodecs via mediabunny for video and audio); up to 50 files.
Approved sketch: `.impeccable/mocks/decision/polar-layout-a.html` (screenshot `skice/43-polarna-raspored-A.png`). Replaces the earlier clay/pastel direction, which the user dropped.
Unresolved: none blocking.

## Direction contract

THESIS: A calm night-sky tool: dark, quiet, one soft accent, so the files and the saving are the only things that stand out. Refuses both the white-box-with-indigo default and loud neon dark mode.

OWN-WORLD: Near-black ground #0b0f15 with a muted aurora behind everything (teal #1f6a63, slate blue #2b4473, violet #4a3a78, heavily blurred, low opacity). Frosted glass panels (white 5.5% fill, 12% edge, blur 26px, radius 24px). Text #eef1f8, muted #a3abc0. One accent, polar mint #8fd3c4, for the primary action, progress and saving; warm #e9cf8f for working and "larger than original"; rose #e99aa5 for failures. Status pills are outlined in their colour, never filled. Selected segments and the final download are light pills (foreground on background). Sora for everything, Onest fills the glyphs Sora lacks (− and →). Colours stay discreet: the user asked for nothing that hurts the eyes.

STORY: Visitor sees that nothing is uploaded, drops files, sees the total saving count up in the dock, downloads.

FIRST VIEWPORT: Header with logo, How it works and About chips (open a dialog), local-only note, EN/HR switch. One centred 940px column: glass drop card (headline, three steps, dashed zone with up arrow tile and "Choose files" accent button, limit note and paste button); a horizontal glass settings strip for the active kind; kind tabs Images/Video/Audio with a status tally on the right; the glass file list. A fixed glass dock at the bottom (only when the active tab has files) shows the big saving figure with an accent sign, before → after sizes, "n of m files ready", clear and "Download all (.zip)".

FORM: Layout A from the polar layout round, style A (glass and aurora) from the nine-style overview, in the dark discreet palette. Signature move: the saving figure in the dock counts up as files finish, with only its sign in the accent colour. seed: surface roll key 6ab6b8ce (.impeccable/questions/roll.json) was offered; the user pinned the polar glass world over it, so no rolled world is used.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
