import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Emails one published page to every subscriber, through Resend.
// Called from /write right after Publish. Admin only.
//
// POST { post_id }               send to all subscribers (once; a second call is skipped)
// POST { post_id, force: true }  send again anyway
// POST { post_id, test: true }   send only to Alex, through Base44's own email (no Resend needed)
// POST { post_id, dry: true }    return the email instead of sending it
//
// Secrets: RESEND_API_KEY, DC_FROM ("Alex Cheeseman <alex@yourdomain>", a domain verified in
// Resend), optional DC_REPLY_TO and DC_SITE_URL. Without RESEND_API_KEY and DC_FROM nothing
// goes to subscribers and the reply says why.

const SITE = (Deno.env.get('DC_SITE_URL') || 'https://dynamic-consumption-dee615cf.base44.app').replace(/\/$/, '');
// Mirrors src/dc.css: paper, ink, ink-soft, pen.
const C = { paper: '#efe4cf', ink: '#1b1915', soft: '#4d463b', pen: '#c8102e', hl: '#f6e94a' };
const TYPE = "'Courier Prime','Courier New',Courier,monospace";

const items = (res) => (Array.isArray(res) ? res : res?.items || []);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (u) => (!u ? '' : /^https?:/.test(u) ? u : `${SITE}${u.startsWith('/') ? '' : '/'}${u}`);
const pad = (n) => String(n ?? 0).padStart(3, '0');
const longDate = (iso) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
const paragraphs = (body) => String(body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

function html(post, signature, unsubUrl) {
  const pageUrl = `${SITE}/p/${post.number}`;
  const paras = paragraphs(post.body).map((p) => {
    let inner = esc(p);
    let note = '';
    if (post.highlight && p.includes(post.highlight)) {
      inner = inner.replace(esc(post.highlight), `<span style="background:${C.hl}">${esc(post.highlight)}</span>`);
      if (post.note_image) {
        const w = Math.round((post.note_width || 380) * 0.4);
        note = `<div style="text-align:right;margin:6px 0 0"><img src="${esc(abs(post.note_image))}" alt="${esc(post.note || '')}" width="${w}" style="width:${w}px;max-width:70%;height:auto"></div>`;
      }
    }
    return `<p style="margin:0 0 18px">${inner}</p>${note}`;
  }).join('');

  return `<!doctype html><html><body style="margin:0;padding:0;background:#17221e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#17221e"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:${C.paper};color:${C.ink};font-family:${TYPE};font-size:16px;line-height:1.7">
<tr><td style="padding:36px 32px 8px;font-size:13px;color:${C.soft}">No. ${pad(post.number)} &nbsp;·&nbsp; ${esc(longDate(post.published_on))}</td></tr>
<tr><td style="padding:8px 32px 6px"><h1 style="margin:0 0 18px;font-family:${TYPE};font-weight:400;font-size:26px;line-height:1.25">${esc(post.title)}</h1>${paras}</td></tr>
<tr><td style="padding:0 32px 30px"><img src="${esc(abs(signature))}" alt="Alex" width="140" style="width:140px;height:auto"></td></tr>
</table>
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;font-family:${TYPE};font-size:12px;line-height:1.6;color:#c4c9bb">
<tr><td style="padding:16px 4px">
<a href="${pageUrl}" style="color:#d9d2bf">Read it on the desk</a> &nbsp;·&nbsp; <a href="${SITE}/archive" style="color:#d9d2bf">Every page</a>
${unsubUrl ? `<br>You signed up for one page a day from Dynamic Consumption. <a href="${unsubUrl}" style="color:#c4c9bb">Unsubscribe</a>.` : ''}
</td></tr></table>
</td></tr></table></body></html>`;
}

function text(post, unsubUrl) {
  return [
    `No. ${pad(post.number)} · ${longDate(post.published_on)}`,
    '',
    post.title,
    '',
    paragraphs(post.body).join('\n\n'),
    '',
    'Alex',
    '',
    `Read it on the desk: ${SITE}/p/${post.number}`,
    unsubUrl ? `Unsubscribe: ${unsubUrl}` : '',
  ].join('\n');
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let admin = null;
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') admin = user;
    } catch (_) {
      admin = null;
    }
    if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { post_id, force, test, dry } = await req.json().catch(() => ({}));
    const db = base44.asServiceRole.entities;
    const post = post_id ? await db.Post.get(post_id) : null;
    if (!post) return Response.json({ error: 'No such page.' }, { status: 404 });
    if (post.status !== 'published') return Response.json({ error: 'Only published pages are emailed.' }, { status: 400 });

    const [sig] = items(await db.Setting.filter({ key: 'signature' }).catch(() => []));
    const signature = sig?.value || '/assets/signature.webp';
    const subject = post.title;

    if (dry) return Response.json({ dry: true, subject, html: html(post, signature, `${SITE}/unsubscribe?t=example`) });

    if (test) {
      await base44.asServiceRole.integrations.Core.SendEmail({ to: admin.email, subject: `[Test] ${subject}`, body: html(post, signature, ''), from_name: 'Dynamic Consumption' });
      return Response.json({ sent: 1, test: true, to: admin.email });
    }

    if (post.emailed_at && !force) return Response.json({ sent: 0, skipped: 'Already emailed.', emailed_at: post.emailed_at });

    const key = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('DC_FROM');
    if (!key || !from) {
      return Response.json({ sent: 0, not_configured: true, reason: 'Emails are off until RESEND_API_KEY and DC_FROM are set (a sending domain verified in Resend).' });
    }

    const subs = items(await db.Subscriber.filter({ unsubscribed: false }, '-created_date', 5000)).filter((s) => s.email && s.token);
    const replyTo = Deno.env.get('DC_REPLY_TO');
    let sent = 0;
    const errors = [];
    for (let i = 0; i < subs.length; i += 100) {
      const batch = subs.slice(i, i + 100).map((s) => {
        const unsubPage = `${SITE}/unsubscribe?t=${encodeURIComponent(s.token)}`;
        const oneClick = `${SITE}/functions/unsubscribe?t=${encodeURIComponent(s.token)}`;
        return {
          from,
          to: [s.email],
          subject,
          html: html(post, signature, unsubPage),
          text: text(post, unsubPage),
          ...(replyTo ? { reply_to: replyTo } : {}),
          headers: { 'List-Unsubscribe': `<${oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        };
      });
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
      else errors.push(`${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    if (sent > 0) await db.Post.update(post.id, { emailed_at: new Date().toISOString(), emailed_count: sent });
    return Response.json({ sent, subscribers: subs.length, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
