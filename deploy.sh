#!/bin/bash
# Quick deployment script for WebLayer SDK to Cloudflare

set -e

echo "🚀 Deploying WebLayer SDK to Cloudflare..."

# Build the SDK
echo "📦 Building SDK..."
npm run build

# Check if dist file exists
if [ ! -f "dist/weblayer-sdk.min.js" ]; then
    echo "❌ Error: dist/weblayer-sdk.min.js not found. Build failed?"
    exit 1
fi

echo "✅ Build complete!"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "📥 Installing Wrangler CLI..."
    npm install -g wrangler
fi

# Login check
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Not logged in. Please run: wrangler login"
    exit 1
fi

echo ""
echo "Choose deployment method:"
echo "1) R2 (Recommended - better for large files)"
echo "2) KV (Alternative - for smaller files)"
echo "3) Deploy Worker only (assumes file already uploaded)"
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo "📤 Uploading to R2..."
        # Create bucket if it doesn't exist (will fail silently if exists)
        wrangler r2 bucket create weblayer-sdk 2>/dev/null || true
        wrangler r2 object put weblayer-sdk/weblayer-sdk.min.js --file=dist/weblayer-sdk.min.js
        echo "✅ File uploaded to R2!"
        echo ""
        echo "⚠️  Don't forget to:"
        echo "   1. Uncomment R2 binding in wrangler.toml"
        echo "   2. Update bucket_name if different"
        ;;
    2)
        echo "📤 Uploading to KV..."
        # Create namespace if it doesn't exist
        echo "Creating KV namespace (if needed)..."
        KV_ID=$(wrangler kv:namespace create SDK_KV 2>&1 | grep -oP 'id = "\K[^"]+' || echo "")
        if [ -z "$KV_ID" ]; then
            echo "⚠️  KV namespace might already exist. Using existing namespace."
            echo "   Check wrangler.toml for the correct ID"
        else
            echo "✅ KV namespace created: $KV_ID"
            echo "   Update wrangler.toml with this ID"
        fi
        wrangler kv:key put --binding=SDK_KV weblayer-sdk.min.js --path=dist/weblayer-sdk.min.js
        echo "✅ File uploaded to KV!"
        echo ""
        echo "⚠️  Don't forget to:"
        echo "   1. Uncomment KV binding in wrangler.toml"
        echo "   2. Update the namespace ID"
        ;;
    3)
        echo "⏭️  Skipping file upload..."
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

# Deploy worker
echo ""
echo "🚀 Deploying Worker..."
wrangler deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Configure route in Cloudflare Dashboard:"
echo "      Pattern: sdk.weblayer.ai/*"
echo "      Worker: weblayer-sdk"
echo "   2. Test: https://sdk.weblayer.ai/your-org-id"
echo "   3. The SDK will auto-initialize with org_id from URL"

