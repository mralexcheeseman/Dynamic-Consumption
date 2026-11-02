import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// draft-page: turns a Spark (something Alex consumed) plus his one-line reaction into a
// draft daily page, in two passes: a writer, then an editor that scores and rewrites.
// Admin only (or the DC_KEY secret, for testing). Refuses without a reaction: the reaction is the page; the machine only shapes it.
//
// POST { spark, reaction, shape: 'note' | 'page' | 'list', redo_note? }
// -> { title, body, highlight, endings: [3], checks: [...], warnings: [...] }

const MODEL = 'claude_opus_5_5';

const SHAPES = {
  note: `NOTE: 40 to 100 words. One observation that turns once, then stops. Usually 3 to 6 one-line paragraphs. No setup, no explaining the turn after it lands.`,
  page: `PAGE: 150 to 250 words. Open in the physical scene of the spark (what it was, where, the price, the temperature, the texture). Then the turn: what Alex noticed. Then what it means for the reader, in plain words. End on a short line people would repeat. Paragraphs of one to three sentences; about one in four is a single line.`,
  list: `LIST: a short opening line, then 4 to 6 items, each its own paragraph, each a concrete, recognisable thing with a dry aside. Then a one or two line verdict that the list earns. 80 to 180 words. No bullets or numbers: each item is just its own short paragraph.`,
};

const VOICE = `ALEX'S VOICE (Alex Cheeseman, British, makes brands and the things they sell):
- First person for experience, "you" for the reader. Plain, physical, British words. UK spelling.
- The short punch after a longer sentence: one to four words, its own paragraph.
- The two-beat reframe: the old belief, then the sharper picture, in two short sentences.
- Dry wit through specifics: a brand, a price, a place, an object, a number.
- Ends on a short line that lands like a verdict, or a callback to the opening image.`;

const MOVES = `MOVES TO BORROW (from daily-page writers like Seth Godin and Cole Schafer; borrow the move, never a sentence, never imitate a named writer). Use two or three, not all:
1. One sensory, physical detail the reader can see, hear, taste or touch. Not "a coffee": "a £3.80 flat white that tasted of the cup".
2. One outrageous but exact comparison, used once.
3. A bracketed aside that says what the polite sentence wouldn't.
4. Repetition as rhythm: the same opening words three times, then break the pattern.
5. A confession: Alex does this too.
6. Dry understatement instead of outrage.`;

const TRUTH = `TRUTH (the most important rule):
- Use ONLY the facts in the spark and the reaction. Never invent events, people, places, prices, brands, memories, relatives, numbers, studies or quotes. Alex publishes this under his own name; an invented memory is a lie told for him.
- If the page needs a detail you don't have, write it as a [square-bracket prompt] for Alex to fill, e.g. "[what it cost]". Use at most two.
- Keep Alex's argument. Shape it; never swap it for a different or bigger one.`;

const BANNED = `NEVER:
- em dashes or en dashes; use a full stop or a comma.
- "It's not X, it's Y", "Not X, but Y", "The question isn't X. The question is Y."
- filler: leverage, unlock, navigate, landscape, ecosystem, game-changer, journey, in today's world, delve.
- hype words or exclamation marks; stacked rhetorical questions (one question, then an answer).
- headings, bullets, numbering, hashtags, emoji, a sign-off or a call to subscribe.`;

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Two to six words, plain, specific. No colon, no question mark unless it is the whole idea.' },
    body: { type: 'string', description: 'The page. Plain text, a blank line between paragraphs.' },
    highlight: { type: 'string', description: 'One sentence copied exactly, character for character, from the body: the line worth repeating.' },
    endings: { type: 'array', items: { type: 'string' }, description: 'Three alternative final lines, each different in approach.' },
  },
  required: ['title', 'body', 'highlight', 'endings'],
};

// Checks the model can't be trusted to do on its own.
const UK = [
  [/\boptimiz/gi, 'optimis'], [/\borganiz/gi, 'organis'], [/\brealiz/gi, 'realis'], [/\brecogniz/gi, 'recognis'],
  [/\bprioritiz/gi, 'prioritis'], [/\banalyz/gi, 'analys'], [/\bbehavior/gi, 'behaviour'], [/\bcolor/gi, 'colour'],
  [/\bfavorite/gi, 'favourite'], [/\bcenter\b/gi, 'centre'],
];
function tidy(text) {
  let t = String(text || '');
  t = t.replace(/\s*[—–]\s*/g, ', ').replace(/,\s*,/g, ',').replace(/!/g, '.');
  for (const [re, uk] of UK) t = t.replace(re, (m) => (m[0] === m[0].toUpperCase() ? uk[0].toUpperCase() + uk.slice(1) : uk));
  return t.replace(/\n{3,}/g, '\n\n').trim();
}
function warningsFor(body, shape) {
  const w = [];
  const words = body.split(/\s+/).filter(Boolean).length;
  const range = { note: [40, 110], page: [140, 270], list: [70, 200] }[shape];
  if (range && (words < range[0] || words > range[1])) w.push(`${words} words; a ${shape} is usually ${range[0]} to ${range[1]}.`);
  if (/\bnot\b[^.]{1,60}\bbut\b/i.test(body)) w.push('Has a "not X but Y" shape somewhere. Check it reads as you.');
  const brackets = body.match(/\[[^\]]+\]/g) || [];
  if (brackets.length) w.push(`Fill in ${brackets.length === 1 ? 'the bracket' : `${brackets.length} brackets`}: ${brackets.join(', ')}`);
  return w;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let admin = null;
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') admin = user;
    } catch (_) {
      admin = null;
    }
    const payload = await req.json().catch(() => ({}));
    const key = Deno.env.get('DC_KEY');
    if (!admin && !(key && payload?.key === key)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { spark = '', reaction = '', shape = 'page', redo_note = '' } = payload;
    if (String(reaction).trim().split(/\s+/).length < 4) {
      return Response.json({ error: 'Write your reaction first: a line or two on what you noticed. The page is built on it.' }, { status: 400 });
    }
    const shapeRule = SHAPES[shape] || SHAPES.page;

    const brief = `THE SPARK (something Alex consumed today, in his words):
${spark || '(none given; the reaction carries it)'}

ALEX'S REACTION (the spine of the page):
${reaction}
${redo_note ? `\nALEX'S NOTE ON THE LAST DRAFT (do this):\n${redo_note}\n` : ''}`;

    const writer = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: MODEL,
      prompt: `You draft one short daily page for Dynamic Consumption, Alex Cheeseman's daily blog about consuming things with your eyes open: buying, reading, watching, eating, using. Alex will edit it and publish it under his own name.

${brief}

THE SHAPE:
${shapeRule}

${VOICE}

${MOVES}

${TRUTH}

${BANNED}

Write the page now. Then pick the one sentence worth highlighting (copy it exactly from the body), and write three alternative final lines.`,
      response_json_schema: DRAFT_SCHEMA,
    });

    const editor = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: MODEL,
      prompt: `You are the editor for Dynamic Consumption, Alex Cheeseman's daily blog. Score this draft against each check, then rewrite it so every check passes. Keep what works; cut what doesn't. Shorter is usually better.

${brief}

THE SHAPE:
${shapeRule}

THE DRAFT:
TITLE: ${writer?.title}
${writer?.body}

CHECKS:
- opening: starts in the thing itself (the object, the moment), not in a general statement.
- turn: there is one clear turn, and it is Alex's reaction, not a different idea.
- line: one sentence people would repeat; it is the highlight.
- truth: nothing in it is invented beyond the spark and reaction; any missing detail is a [square-bracket prompt].
- voice: sounds like Alex (rules below), not like an AI or a copywriter.
- moves: two or three of the moves, not more.
- banned: none of the banned items.
- ending: lands short, like a verdict, or calls back to the opening.

${VOICE}

${MOVES}

${TRUTH}

${BANNED}

Return the final page, the highlight (copied exactly from the final body), three alternative final lines, and one line per check saying what you changed (or "ok").`,
      response_json_schema: {
        ...DRAFT_SCHEMA,
        properties: { ...DRAFT_SCHEMA.properties, checks: { type: 'array', items: { type: 'string' } } },
      },
    });

    const out = editor?.body ? editor : writer;
    const body = tidy(out.body);
    let highlight = tidy(out.highlight || '');
    if (!body.includes(highlight)) {
      // Fall back to the shortest sentence the model is likely to have meant: the last line.
      const lines = body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
      highlight = lines[lines.length - 1] || '';
    }
    return Response.json({
      title: tidy(out.title || '').replace(/[.:]$/, ''),
      body,
      highlight,
      endings: (out.endings || []).map(tidy).filter(Boolean).slice(0, 3),
      checks: editor?.checks || [],
      warnings: warningsFor(body, shape),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
