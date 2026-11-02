export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const postcode = searchParams.get('postcode') || '5373KB';
  const huisnummer = searchParams.get('huisnummer') || '10';

  const targetUrl = `https://mijnafvalwijzer.nl/nl/${postcode}/${huisnummer}/`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomeDashboard/1.0)',
        'Accept': 'text/html',
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Upstream HTTP ${res.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await res.text();

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=21600', // 6 hours
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
