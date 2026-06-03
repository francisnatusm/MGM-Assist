/**
 * Live Montgomery headlines (Google News + AL.com RSS).
 * Runs on the frontend Vercel project so Pulse updates without waiting on backend redeploy.
 */

function decodeXml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripCdata(text) {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function inferCategory(link, title) {
  const u = String(link || '').toLowerCase();
  const t = String(title || '').toLowerCase();
  if (u.includes('mayor') || t.includes('mayor')) return 'mayor';
  if (u.includes('council') || t.includes('council') || t.includes('commission')) return 'council';
  if (u.includes('notice') || t.includes('deadline')) return 'deadline';
  if (u.includes('calendar') || t.includes('meeting')) return 'meeting';
  return 'ordinance';
}

function parseRssXml(xml, seen) {
  const items = [];
  const blocks = String(xml || '').match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks.slice(0, 25)) {
    const rawTitle = stripCdata((block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
    const link = stripCdata((block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]);
    const pubRaw = stripCdata((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1]);
    const title = decodeXml(rawTitle).split(' - ')[0].trim();
    if (!title || title.length < 12 || !link || seen.has(link)) continue;
    seen.add(link);
    const pub = pubRaw ? new Date(pubRaw) : null;
    const publishedAt =
      pub && !Number.isNaN(pub.getTime()) ? pub.toISOString().slice(0, 10) : null;
    const iso = pub && !Number.isNaN(pub.getTime()) ? pub.toISOString() : null;
    items.push({
      id: Buffer.from(link).toString('base64').substring(0, 20),
      category: inferCategory(link, title),
      title: title.slice(0, 120),
      summary: decodeXml(rawTitle),
      publishedAt,
      date: iso,
      actionLink: link,
      actionLabel: 'Read More',
      source: link,
      fromLiveRss: true
    });
  }
  return items;
}

async function fetchFeed(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MGM-Assist/1.0 (Montgomery civic dashboard)' }
  });
  if (!res.ok) return '';
  const text = await res.text();
  return text.includes('<item>') ? text : '';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const feeds = [
    'https://news.google.com/rss/search?q=Montgomery+Alabama+government&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=Montgomery+Alabama&hl=en-US&gl=US&ceid=US:en',
    'https://www.al.com/arc/outboundfeeds/rss/section/montgomery/?outputType=xml'
  ];

  try {
    const seen = new Set();
    const items = [];
    for (const url of feeds) {
      const xml = await fetchFeed(url);
      if (xml) items.push(...parseRssXml(xml, seen));
    }

    items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    res.status(200).json({
      ok: true,
      count: items.length,
      items,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message, items: [] });
  }
};
