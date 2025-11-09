// Cloudflare Worker to serve weblayer-sdk.min.js
// Supports path-based org_id: sdk.weblayer.ai/org_id
// The SDK will auto-extract org_id from the URL path

async function getSDKFile(env) {
  // Try R2 first (recommended for production)
  if (env.SDK_BUCKET) {
    try {
      const object = await env.SDK_BUCKET.get('weblayer-sdk.min.js');
      if (object) {
        return await object.text();
      }
    } catch (e) {
      console.error('R2 fetch error:', e);
    }
  }

  // Fallback to KV
  if (env.SDK_KV) {
    try {
      const content = await env.SDK_KV.get('weblayer-sdk.min.js', 'text');
      if (content) {
        return content;
      }
    } catch (e) {
      console.error('KV fetch error:', e);
    }
  }

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Get SDK file content
    const sdkContent = await getSDKFile(env);

    if (!sdkContent) {
      return new Response('SDK file not found. Please upload dist/weblayer-sdk.min.js to R2 or KV.', {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain',
        },
      });
    }

    // Response headers for SDK file
    const sdkHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      'X-Content-Type-Options': 'nosniff',
      'X-Content-Type': 'application/javascript',
    };

    // If path is root, show info message
    if (path === '/' || path === '') {
      return new Response('WebLayer SDK\n\nUsage: https://sdk.weblayer.ai/your-org-id\n\nThe SDK will auto-initialize with the org_id from the URL path.', {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain',
        },
      });
    }

    // Extract org_id from path (e.g., /org123 -> org123)
    // Remove leading slash and get first segment
    const pathSegments = path.split('/').filter(p => p);
    const firstSegment = pathSegments[0];

    // If requesting the SDK file directly
    if (path === '/weblayer-sdk.min.js' || path.endsWith('weblayer-sdk.min.js')) {
      return new Response(sdkContent, {
        headers: sdkHeaders,
      });
    }

    // If path looks like an org_id (no file extension, not a known path)
    // Serve the SDK file - it will auto-extract org_id from URL
    if (firstSegment && !firstSegment.includes('.')) {
      return new Response(sdkContent, {
        headers: sdkHeaders,
      });
    }

    // Not found
    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders,
    });
  },
};

