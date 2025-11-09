# Cloudflare Deployment Guide for WebLayer SDK

## Prerequisites

1. **Built SDK file**: Run `npm run build` to generate `dist/weblayer-sdk.min.js`
2. **Cloudflare account** with Workers/Pages enabled
3. **Domain** (optional): `sdk.weblayer.ai` or similar

## Option 1: Cloudflare Pages (Simplest)

### Steps:
1. Build the SDK:
   ```bash
   npm run build
   ```

2. Upload `dist/` folder to Cloudflare Pages:
   - Go to Cloudflare Dashboard → Pages
   - Create new project
   - Upload `dist/` folder
   - Set build output directory to `dist`

3. Configure redirects in `dist/_redirects`:
   ```
   /:org_id  /weblayer-sdk.min.js  200
   ```

4. Set custom domain: `sdk.weblayer.ai`

### Usage:
```html
<script src="https://sdk.weblayer.ai/your-org-id"></script>
```

## Option 2: Cloudflare Workers (More Control)

### Steps:

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Upload SDK file to KV** (recommended):
   ```bash
   # Create KV namespace
   wrangler kv:namespace create SDK_KV
   
   # Upload the SDK file
   wrangler kv:key put --binding=SDK_KV weblayer-sdk.min.js --path=dist/weblayer-sdk.min.js
   ```

   Or use **R2** (better for large files):
   ```bash
   # Create R2 bucket
   wrangler r2 bucket create weblayer-sdk
   
   # Upload file
   wrangler r2 object put weblayer-sdk/weblayer-sdk.min.js --file=dist/weblayer-sdk.min.js
   ```

4. **Update `wrangler.toml`** with your KV/R2 binding IDs

5. **Update `worker.js`** to fetch from KV/R2 instead of external URL

6. **Deploy**:
   ```bash
   wrangler deploy
   ```

7. **Configure route** in Cloudflare Dashboard:
   - Pattern: `sdk.weblayer.ai/*`
   - Worker: `weblayer-sdk`

### Usage:
```html
<script src="https://sdk.weblayer.ai/your-org-id"></script>
```

## Option 3: Cloudflare R2 + Public Access (CDN-like)

1. **Create R2 bucket**: `weblayer-sdk`
2. **Upload** `dist/weblayer-sdk.min.js` to R2
3. **Enable public access** on the bucket
4. **Create custom domain**: `sdk.weblayer.ai`
5. **Configure redirects** via Cloudflare Workers or Transform Rules

## Recommended Headers

The SDK should be served with:
- `Content-Type: application/javascript`
- `Cache-Control: public, max-age=31536000, immutable` (1 year cache)
- `Access-Control-Allow-Origin: *` (if needed)
- `X-Content-Type-Options: nosniff`

## Testing

After deployment, test:
```html
<!DOCTYPE html>
<html>
<head>
  <title>SDK Test</title>
</head>
<body>
  <h1>Testing WebLayer SDK</h1>
  <script src="https://sdk.weblayer.ai/your-test-org-id"></script>
  <script>
    // SDK should auto-initialize
    console.log('SDK loaded:', typeof window.WebLayerSDK !== 'undefined');
  </script>
</body>
</html>
```

## Notes

- The SDK auto-extracts `org_id` from URL path (e.g., `sdk.weblayer.ai/org123`)
- Make sure CORS is enabled if serving from different domain
- Use KV or R2 for production (better performance than external fetch)
- Consider versioning: `sdk.weblayer.ai/v1/org_id` for future updates

