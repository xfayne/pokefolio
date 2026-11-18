// Issue #2: intentionally inert Cloudflare staging bootstrap.
// This Worker cannot access Firebase, eBay, KV, shipping, or AI providers.
export default {
  fetch() {
    return new Response(JSON.stringify({ error: 'STAGING_NOT_CONFIGURED' }), {
      status: 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  }
};
