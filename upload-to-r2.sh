#!/bin/bash
# Quick setup script to upload SDK to R2 and configure Worker

set -e

echo "🚀 Setting up WebLayer SDK on Cloudflare..."

# 1. Create R2 bucket (if it doesn't exist)
echo "📦 Creating R2 bucket..."
npx wrangler r2 bucket create weblayer-sdk 2>&1 | grep -v "already exists" || echo "Bucket exists or created"

# 2. Upload SDK file to R2
echo "📤 Uploading SDK file to R2..."
npx wrangler r2 object put weblayer-sdk/weblayer-sdk.min.js --file=dist/weblayer-sdk.min.js

echo "✅ SDK file uploaded to R2!"
echo ""
echo "⚠️  Next steps:"
echo "   1. Uncomment the R2 binding in wrangler.toml:"
echo "      [[r2_buckets]]"
echo "      binding = \"SDK_BUCKET\""
echo "      bucket_name = \"weblayer-sdk\""
echo ""
echo "   2. Redeploy the Worker:"
echo "      npx wrangler deploy"
echo ""
echo "   3. Test: https://sdk.weblayer.ai/your-org-id"

