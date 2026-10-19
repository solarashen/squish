# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated, with one binding constraint: must be compatible with 21st.dev components. Choice: React + Vite + TypeScript + Tailwind CSS + shadcn/ui conventions, because 21st.dev components are React/Tailwind/shadcn components installed through the shadcn CLI.

## Users

Anyone who needs a quick image conversion or size reduction: an image too large for an email, a form upload limit, a website, or a format a device or service does not accept. Not specialists; they arrive with one or several files and want a smaller or differently formatted file back, fast.

## Product Purpose

squish converts images between formats and compresses them, entirely in the browser using the Canvas API. Success: a user drops images, sets format, quality and size, and downloads results in seconds without creating an account or uploading anything.

The product is a university final thesis (završni rad), so the implementation of the Canvas API pipeline is also something to explain and demonstrate.

## Positioning

All processing happens locally in the browser. No upload, no server, no account. Images never leave the user's device.

## Capabilities and Constraints

- Format conversion between browser-encodable formats via `canvas.toBlob` / `toDataURL` (JPEG, PNG, WebP; others only where the browser supports encoding).
- Compression via quality setting.
- Resizing (dimensions) together with conversion and compression.
- Batch processing of multiple images, with download of all results.
- Local-only processing; no backend.
- Language: English primary, Croatian available through a language switch.
- Undecided: before/after comparison view, ZIP vs individual downloads, maximum file count.

## Brand Commitments

- Name: "squish" (lowercase as given).

## Evidence on Hand

No user counts, testimonials, benchmarks or press exist. Do not invent them. Compression savings shown in demos must be labeled as examples or computed from real files.

## Product Principles

1. Fast path first: drop, adjust, download, with sensible defaults so most users never touch settings.
2. Privacy is the mechanism, not a slogan: show that files stay local.
3. Show the result honestly: original size, new size, and saving per file.
4. Both languages are first-class; no layout breaks when Croatian strings are longer.

## Accessibility & Inclusion

Keyboard-operable drop zone and controls; file input fallback for drag and drop.
