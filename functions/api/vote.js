const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

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

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid choice' }, 400);
  }

  const { choice } = body;
  if (choice !== 'connection' && choice !== 'rebel') {
    return jsonResponse({ error: 'Invalid choice' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = new Date();
  const isoNow = now.toISOString();
  const datePart = isoNow.slice(0, 10);
  const minuteBucket = isoNow.slice(0, 16).replace('T', '');
  const rateLimitKey = `ratelimit:${ip}:${minuteBucket}`;

  const rateLimitResults = await pipeline(env, [
    ['INCR', rateLimitKey],
    ['EXPIRE', rateLimitKey, '60'],
  ]);

  if (rateLimitResults[0].result > 10) {
    return jsonResponse({ error: 'Rate limit exceeded' }, 429);
  }

  const connectionKey = `vote:${datePart}:connection`;
  const rebelKey = `vote:${datePart}:rebel`;

  const voteResults = await pipeline(env, [
    ['INCR', `vote:${datePart}:${choice}`],
    ['GET', connectionKey],
    ['GET', rebelKey],
  ]);

  const tomorrowMidnight =
    Math.floor(new Date(datePart + 'T00:00:00Z').getTime() / 1000) + 86400;

  await pipeline(env, [
    ['EXPIREAT', connectionKey, String(tomorrowMidnight)],
    ['EXPIREAT', rebelKey, String(tomorrowMidnight)],
  ]);

  const incrResult = voteResults[0].result;
  let connection, rebel;

  if (choice === 'connection') {
    connection = incrResult;
    rebel = parseInt(voteResults[2].result ?? '0', 10) || 0;
  } else {
    connection = parseInt(voteResults[1].result ?? '0', 10) || 0;
    rebel = incrResult;
  }

  return jsonResponse({
    success: true,
    connection,
    rebel,
    total: connection + rebel,
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
