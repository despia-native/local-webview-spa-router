# Quick Start Guide

## Installation

```bash
npm install local-webview-spa-router
```

## Usage

### Method 1: Script Tag (Easiest)

Add to your `index.html` **before** your app script:

```html
<!-- IMPORTANT: Bundle locally for offline use - CDNs won't work offline -->
<script src="node_modules/local-webview-spa-router/dist/index.umd.js"></script>
<!-- Or copy to your assets: <script src="./assets/local-webview-spa-router.js"></script> -->
<script src="your-app.js"></script>
```

That's it! It auto-initializes.

**Note**: Always bundle locally (npm or copy to assets) for offline/local webview use.

### Method 2: Import in Code

```javascript
import initWebviewSPARouter from 'local-webview-spa-router';

// Call before your router initializes
initWebviewSPARouter();
```

## Testing Locally

1. Build your app
2. Open `index.html` directly in your browser (file:// protocol)
3. Your routing should work!

## Troubleshooting

- **Still getting 404?** Make sure the script loads BEFORE your router
- **Not working?** Enable debug mode: `initWebviewSPARouter({ debug: true })`
- **Production?** The fix only activates when running locally, so it won't affect production

