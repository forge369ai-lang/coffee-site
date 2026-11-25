// Live totals for the Prayers & Pushups BackaBuddy campaign.
// Used by /prayers-and-pushups. Reads BackaBuddy's public campaign data and returns
// only the numbers the page needs. Cached at the edge for 2 minutes.
const SRC = 'https://api.backabuddy.co.za/api/v1/campaigns/short/prayers-and-pushups?idType=0';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const r = await fetch(SRC, { headers: { 'Accept': 'application/json', 'User-Agent': 'jaysteenkamp.com/1.0' } });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const d = (await r.json()).data || {};
    const out = {
      raised: Number(d.donationsReceivedTotal) || 0,
      goal: Number(d.donationTarget) || 0,
      donors: Number(d.uniqueDonors) || 0,
      updated: new Date().toISOString(),
    };
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    res.status(200).end(JSON.stringify(out));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).end(JSON.stringify({ error: 'unavailable' }));
  }
};
