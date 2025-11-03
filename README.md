# WebLayer SDK

Minimal analytics SDK that automatically tracks user behavior and sends events to BigQuery.

## Installation

```bash
npm install weblayer-sdk
```

Or via CDN:

```html
<script src="https://unpkg.com/weblayer-sdk@latest/dist/weblayer-sdk.min.js"></script>
```

## Quick Start

```javascript
import WebLayerSDK from 'weblayer-sdk';

WebLayerSDK.init('your-org-id');
```

That's it! The SDK automatically starts tracking events.

## Usage

### Browser (script tag)

```html
<script src="https://unpkg.com/weblayer-sdk@latest/dist/weblayer-sdk.min.js"></script>
<script>
  WebLayerSDK.init('your-org-id', {
    debug: false,
    apiUrl: 'https://api.weblayer.ai'  // optional
  });
</script>
```

### Browser (ES modules / bundler)

```javascript
import WebLayerSDK from 'weblayer-sdk';

WebLayerSDK.init('your-org-id', {
  debug: false,
  apiUrl: 'https://api.weblayer.ai'  // optional
});
```

## Configuration

### `WebLayerSDK.init(orgId, options)`

- **orgId** (required): Your organization ID
- **options** (optional):
  - `apiUrl` (string): API endpoint URL (default: `https://api.weblayer.ai`)
  - `debug` (boolean): Enable debug logging (default: `false`)
  - `weblayerEnabled` (boolean): Enable/disable tracking (default: `true`)

## Features

- **Automatic event tracking** - No configuration needed
  - Clicks
  - Form interactions
  - Scroll behavior
  - Navigation events
  - Network requests
  - Errors and console warnings
  - Media events
  - Touch events
  - Dead-click detection

- **Cookie-based visitor ID** - Works across subdomains (app.domain, www.domain, docs.domain)
- **Session tracking** - Automatic session management
- **Zero configuration** - Just initialize and it works

## Visitor ID

The SDK automatically creates and stores a visitor ID in a cookie with domain scope (e.g., `.example.com`), allowing the same visitor to be tracked across all subdomains (app.example.com, www.example.com, docs.example.com, etc.).

## How It Works

1. Install the SDK
2. Initialize with your organization ID
3. Events are automatically tracked and batched
4. Events are sent to your backend endpoint (`/qwerty/events`)
5. Backend writes events to BigQuery table `qwerty.events`

## License

ISC
