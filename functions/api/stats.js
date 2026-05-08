const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

async function pipeline(env, commands) {
  const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  return res.json();
}

export async function onRequestGet({ env }) {
  const results = await pipeline(env, [
    ['GET', 'votes:all:connection'],
    ['GET', 'votes:all:rebel'],
  ]);

  const connection = parseInt(results[0].result ?? '0', 10) || 0;
  const rebel = parseInt(results[1].result ?? '0', 10) || 0;

  return new Response(JSON.stringify({ connection, rebel, total: connection + rebel }), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'public, max-age=3, s-maxage=3',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
