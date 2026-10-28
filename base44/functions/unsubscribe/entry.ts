import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// The unsubscribe link in each email lands on /unsubscribe?t=<token>, which calls this.
// Also answers the one-click List-Unsubscribe POST that mail apps send.
// POST { t }

const items = (res) => (Array.isArray(res) ? res : res?.items || []);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const t = String(body?.t || url.searchParams.get('t') || '').trim();
    if (!t) return Response.json({ error: 'No token.' }, { status: 400 });

    const db = base44.asServiceRole.entities;
    const [sub] = items(await db.Subscriber.filter({ token: t }));
    if (!sub) return Response.json({ ok: true, unknown: true });
    if (!sub.unsubscribed) await db.Subscriber.update(sub.id, { unsubscribed: true, unsubscribed_at: new Date().toISOString() });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
