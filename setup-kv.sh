#!/bin/bash
# Setup script to create KV namespace and upload SDK file
# Run this ONCE before deploying

set -e

echo "🔧 Setting up KV storage for WebLayer SDK..."

# Build SDK first
echo "📦 Building SDK..."
npm run build

# Create KV namespace
echo "📝 Creating KV namespace..."
KV_OUTPUT=$(npx wrangler kv:namespace create SDK_KV 2>&1)
echo "$KV_OUTPUT"

# Extract namespace IDs from output
PROD_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+' | head -1)
PREVIEW_ID=$(echo "$KV_OUTPUT" | grep -oP 'preview_id = "\K[^"]+' | head -1)

if [ -z "$PROD_ID" ]; then
    echo "⚠️  Could not extract namespace ID. Please check the output above."
    echo "   You'll need to manually update wrangler.toml with the namespace IDs"
    exit 1
fi

echo ""
echo "✅ KV namespace created!"
echo "   Production ID: $PROD_ID"
echo "   Preview ID: $PREVIEW_ID"
echo ""

# Upload SDK file
echo "📤 Uploading SDK file to KV..."
npx wrangler kv:key put --binding=SDK_KV weblayer-sdk.min.js --path=dist/weblayer-sdk.min.js

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Update wrangler.toml with these IDs:"
echo "   id = \"$PROD_ID\""
echo "   preview_id = \"$PREVIEW_ID\""
echo ""
echo "Then commit and push - the deployment will work!"





