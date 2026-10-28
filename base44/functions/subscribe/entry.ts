import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Public sign-up from the index card. One record per address; signing up again
// after unsubscribing switches the same record back on. Each subscriber gets a
// random token, used for the unsubscribe link in every email.
// POST { email }

const items = (res) => (Array.isArray(res) ? res : res?.items || []);
const valid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const { email: raw } = await req.json().catch(() => ({}));
    const email = String(raw || '').trim().toLowerCase();
    if (!valid(email)) return Response.json({ error: 'That address doesn\'t look right.' }, { status: 400 });

    const db = base44.asServiceRole.entities;
    const [existing] = items(await db.Subscriber.filter({ email }));
    if (existing) {
      if (existing.unsubscribed) await db.Subscriber.update(existing.id, { unsubscribed: false, unsubscribed_at: null });
      return Response.json({ ok: true, already: !existing.unsubscribed });
    }
    await db.Subscriber.create({ email, token: crypto.randomUUID(), unsubscribed: false });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
