import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Reminds Alex to write, but only when today's page isn't up yet. Runs from the
// "Morning nudge" workflow at 07:00 and 20:00 London time; on a day with a page
// published it stays quiet.
// POST { key }                 from the workflow (DC_KEY secret)
// POST { dry: true }           as admin: returns what it would send

const SITE = (Deno.env.get('DC_SITE_URL') || 'https://dynamic-consumption-dee615cf.base44.app').replace(/\/$/, '');
const C = { paper: '#efe4cf', ink: '#1b1915', soft: '#4d463b', pen: '#c8102e' };
const TYPE = "'Courier Prime','Courier New',Courier,monospace";

const items = (res) => (Array.isArray(res) ? res : res?.items || []);
const londonDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);
const londonHour = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(d));

function streakFrom(days, today, doneToday) {
  const set = new Set(days);
  let n = 0;
  const d = new Date(`${today}T12:00:00Z`);
  if (!doneToday) d.setUTCDate(d.getUTCDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) {
    n += 1;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    let admin = null;
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') admin = user;
    } catch (_) {
      admin = null;
    }
    const key = Deno.env.get('DC_KEY');
    if (!admin && !(key && payload?.key === key)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const db = base44.asServiceRole.entities;
    const now = new Date();
    const today = londonDay(now);
    const evening = londonHour(now) >= 16;

    const posts = items(await db.Post.filter({ status: 'published' }, '-number', 400));
    const days = posts.map((p) => p.published_on).filter(Boolean);
    const done = days.includes(today);
    const streak = streakFrom(days, today, done);
    const next = Math.max(0, ...posts.map((p) => p.number || 0)) + 1;
    const drafts = items(await db.Post.filter({ status: 'draft' }, '-updated_date', 20));

    if (done) return Response.json({ sent: false, reason: "Today's page is up.", streak });

    const streakLine = streak > 0 ? `${streak} day${streak === 1 ? '' : 's'} in a row so far` : 'Start a streak today';
    const subject = evening
      ? `Dynamic Consumption · No. ${String(next).padStart(3, '0')} still blank (${streakLine.toLowerCase()})`
      : `Dynamic Consumption · today's page, No. ${String(next).padStart(3, '0')}`;
    const lead = evening
      ? 'Last call. Three lines is a page.'
      : 'One page. Say the thing in the first line, then stop.';
    const draftLine = drafts.length
      ? `<p style="margin:12px 0 0;color:${C.soft}">${drafts.length} draft${drafts.length === 1 ? '' : 's'} waiting, if one is nearly there.</p>`
      : '';

    const body = `<div style="background:${C.paper};color:${C.ink};font-family:${TYPE};font-size:16px;line-height:1.6;padding:28px;max-width:520px">
<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${C.soft}">${today} · ${streakLine}</div>
<p style="margin:16px 0 0">${lead}</p>
${draftLine}
<p style="margin:22px 0 0"><a href="${SITE}/write" style="color:${C.ink};font-weight:700;border-bottom:2px solid ${C.pen};text-decoration:none">Open the desk →</a></p>
<p style="margin:22px 0 0;font-size:12px;color:${C.soft}">This only arrives on days without a page. Publish and it goes quiet.</p>
</div>`;

    if (payload?.dry) return Response.json({ sent: false, dry: true, subject, body, streak });

    const to = Deno.env.get('NUDGE_EMAIL') || admin?.email;
    if (!to) return Response.json({ error: 'Set the NUDGE_EMAIL secret.' }, { status: 500 });
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body, from_name: 'Dynamic Consumption' });
    return Response.json({ sent: true, subject, streak });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
