# Dynamic Consumption

One page a day, typed by Alex Cheeseman. Runs on Base44 (app `6ada0d62b25b0173dee615cf`).

## The look

A dark leather desk. Each day is a folded sheet of paper taped to it, typed on a typewriter, then marked up by hand:

- **Typed:** TT2020 (`public/fonts/tt2020.woff2`, Latin subset). Every word sits slightly off the line with uneven ribbon ink (`src/components/marks.jsx`).
- **Hand:** red felt-tip margin note and blue biro signature in Reenie Beanie; one highlighter stroke per page.
- **Marks:** scanned paper, tape, coffee rings and pen circles in `public/assets/`, taken from the Edgework mark library. Each post always gets the same marks (seeded by its number).
- **Masthead:** a Dymo label.

## Pages

- `/` today's page, then the ledger of earlier pages
- `/p/:number` one page
- `/archive`, `/about`
- `/write` Alex's private desk (admin only): title, text, the line to highlight, the margin note

## Data

- `Post`: `number`, `title`, `body` (blank line between paragraphs), `highlight` (exact text from the body), `note`, `published_on`, `status` (`draft` | `published`). Anyone reads; admin writes.
- `Subscriber`: `email`. Anyone can sign up; only admin reads.

`base44/seed/posts.json` holds the first 14 pages.

## In this repo

`src/` and `public/` hold the files that sit on top of Base44's starter template (`App.jsx` routes, pages, components, `dc.css`). The template's own files (SDK client, auth, `ui/`) are not duplicated here.

## How the marks were made (v2)

Following the Edgework learnings: nothing handwritten is set in a font.

- Generated as flatbed scans with Recraft v4.1 (October 2026): the Dymo wordmark, Alex's biro signature, 15 red felt-tip margin notes, a till receipt, a REDUCED sticker, a paperclip, and the leather desk.
- Ink (signature, notes) has the paper removed by un-multiplying (`edgework/tools/unmultiply.py`); objects (Dymo, receipt, sticker, clip) by background removal.
- Paper scans, coffee rings, highlighter and pen circle come from the Edgework mark library (design repo, `brands/edgework/assets/marks`).
- The desk tile is mirrored four ways so it repeats without a seam.
- A post's margin note is a scan (`note_image`). New posts from `/write` have none until a scan is made: no fake handwriting.

## Running it (v3)

**Your own hand.** On `/write`, *Photograph it* under Margin note or Your signature. The ink is lifted off the paper in the browser (`src/lib/ink.js`, a port of `edgework/tools/unmultiply.py`), shown on the page's paper, and only uploaded when you press *Keep this*. Notes are normalised to one 110px line and drawn at 0.025rem per pixel, so they come out at writing size. The signature is stored in the `Setting` entity (`key: signature`) and replaces the stand-in on every page and in the email.

**Emails.** Publishing on `/write` calls `send-page`, which emails the page to every subscriber through Resend in batches of 100, with a visible unsubscribe link and one-click `List-Unsubscribe`. Each page is only emailed once (`emailed_at`). *Send me a test* emails Alex a copy through Base44's own email. Subscribers only exist via the `subscribe` function (deduped, tokenised); the entity is admin-only.

Emails to subscribers stay off until two secrets are set in Base44:
- `RESEND_API_KEY`: a sending-access key from Resend
- `DC_FROM`: e.g. `Alex Cheeseman <alex@yourdomain>`, on a domain verified in Resend
- optional: `DC_REPLY_TO`, `DC_SITE_URL` (once there's a custom domain)

**Morning nudge.** The "Morning nudge" workflow runs `morning-nudge` at 07:00 and 20:00 London time. It emails Alex (`NUDGE_EMAIL`) only when today's page isn't published, with the streak. Secrets: `DC_KEY` (the workflow's shared key), `NUDGE_EMAIL`.
