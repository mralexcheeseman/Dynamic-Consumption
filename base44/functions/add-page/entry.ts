import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// add-page: Owl Farm's daily page lands here as a draft, waiting in /write.
// Nothing is published or emailed; Alex reads it, edits it and presses Publish.
// POST { key, page: { title, body, highlight, wire_source, wire_url, owl_collision } }
// key is the DC_PAGE_KEY secret, shared with Owl Farm.
//
// Keeps the drafts list tidy: an older Wire draft Alex never touched is removed when a
// new one arrives, so unread suggestions don't pile up. Anything Alex edited stays.

const items = (res) => (Array.isArray(res) ? res : res?.items || []);
const clean = (s, n) => String(s ?? '').replace(/\r/g, '').trim().slice(0, n);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const key = Deno.env.get('DC_PAGE_KEY');
    if (!key || payload?.key !== key) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const p = payload?.page || {};
    const title = clean(p.title, 140);
    const body = clean(p.body, 4000);
    if (!title || body.length < 40) return Response.json({ error: 'A page needs a title and a body.' }, { status: 400 });
    let highlight = clean(p.highlight, 300);
    if (highlight && !body.includes(highlight)) highlight = '';

    const db = base44.asServiceRole.entities;
    const collision = clean(p.owl_collision, 80);
    if (collision) {
      const [same] = items(await db.Post.filter({ owl_collision: collision }));
      if (same) return Response.json({ status: 'exists', id: same.id });
    }

    // Untouched Wire drafts from earlier days make way for the new one.
    let cleared = 0;
    for (const old of items(await db.Post.filter({ from_wire: true, status: 'draft' }, '-created_date', 50))) {
      const touched = Math.abs(new Date(old.updated_date).getTime() - new Date(old.created_date).getTime()) > 60_000;
      if (!touched) {
        await db.Post.delete(old.id);
        cleared += 1;
      }
    }

    const all = items(await db.Post.list('-number', 1000));
    const number = Math.max(0, ...all.filter((x) => x.status === 'published').map((x) => x.number || 0)) + 1;
    const created = await db.Post.create({
      title,
      body,
      highlight,
      status: 'draft',
      number,
      from_wire: true,
      wire_source: clean(p.wire_source, 300),
      wire_url: clean(p.wire_url, 600),
      owl_collision: collision,
    });
    return Response.json({ status: 'created', id: created.id, number, cleared });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
