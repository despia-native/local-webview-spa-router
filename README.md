# local-webview-spa-router

A router to allow local routing of the most popular SPA routers in webviews and `file://` protocol. Works with React Router, Vue Router, Angular Router, Framework7, and all popular SPA frameworks. Zero code changes needed - just import and it works!

## Problem

When opening your SPA directly via `file://` protocol (or using a simple static server), routing frameworks like React Router's `BrowserRouter` fail because:

1. `window.location.pathname` contains the full absolute file path (e.g., `/Users/name/Desktop/app/index.html`)
2. The router tries to match this as a route, causing 404 errors
3. Navigation doesn't work without proper server-side routing configuration

## Solution

This library automatically:
- Overrides `window.location.pathname` to return "/" or the route from hash
- Converts all navigation to hash-based routing when running on `file://` protocol
- Works transparently with your existing router setup
- **Only activates for `file://` protocol** - won't interfere with localhost or production
- **Zero code changes needed** - just import/load the script and it works!

## Installation

```bash
npm install local-webview-spa-router
```

**Important**: This package is designed for offline/local webview use. Always bundle it locally via npm or copy to your assets folder. CDN links will not work in offline environments.

## Usage

### Option 1: Script Tag (Simplest)

Add the script **before** your main app script in `index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <div id="root"></div>
  
  <!-- Add this BEFORE your app script -->
  <!-- IMPORTANT: Bundle locally via npm/path for offline use - CDNs won't work offline -->
  <script src="node_modules/local-webview-spa-router/dist/index.umd.js"></script>
  <!-- Or copy to your assets folder: -->
  <!-- <script src="./assets/local-webview-spa-router.js"></script> -->
  
  <script src="your-app.js"></script>
</body>
</html>
```

The library will auto-initialize when loaded via script tag.

**Note**: Always bundle locally (npm/node_modules or copy to assets) for offline use. CDN links won't work in offline/local webview environments.

### Option 2: ES Modules

```javascript
import initWebviewSPARouter from 'local-webview-spa-router';

// Initialize before your router
initWebviewSPARouter();

// Then initialize your router
// React Router, Vue Router, etc.
```

### Option 3: CommonJS

```javascript
const initWebviewSPARouter = require('webview-spa-router');

initWebviewSPARouter();
```

## Configuration

You can customize the behavior with options (optional):

```javascript
import initWebviewSPARouter from 'local-webview-spa-router';

const cleanup = initWebviewSPARouter({
  // Enable debug logging
  debug: true,
  
  // Custom detection (default: only activates for file:// protocol)
  isLocal: () => {
    return window.location.protocol === 'file:';
  },
  
  // Delay before initial popstate event (ms)
  initDelay: 100
});

// Cleanup if needed (restores original behavior)
// cleanup();
```

**Note**: By default, it only activates for `file://` protocol. Localhost and production sites work normally without this fix.

## Framework Examples

### React Router

```javascript
// index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import initLocalRouterFix from 'local-router';
import App from './App';

// Initialize router fix BEFORE React Router
initWebviewSPARouter();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

### Vue Router

```javascript
// main.js
import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import initLocalRouterFix from 'local-router';
import App from './App.vue';
import routes from './routes';

// Initialize router fix BEFORE Vue Router
initWebviewSPARouter();

const router = createRouter({
  history: createWebHistory(),
  routes
});

const app = createApp(App);
app.use(router);
app.mount('#app');
```

### Angular Router

```typescript
// main.ts
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import initLocalRouterFix from 'local-router';

// Initialize router fix BEFORE Angular
initWebviewSPARouter();

platformBrowserDynamic().bootstrapModule(AppModule);
```

### Framework7 Router

```javascript
// main.js
import Framework7 from 'framework7';
import initLocalRouterFix from 'local-router';

// Initialize router fix BEFORE Framework7
initWebviewSPARouter();

// Initialize Framework7 app
const app = new Framework7({
  routes: [
    { path: '/', component: HomePage },
    { path: '/about/', component: AboutPage },
    // ... your routes
  ]
});
```

### SvelteKit / Other Frameworks

```javascript
// app.js or main entry point
import initLocalRouterFix from 'local-router';

// Initialize before your router
initWebviewSPARouter();

// Your router initialization code...
```

## How It Works

1. **Detection**: Automatically detects if running on `file://` protocol (not localhost or production)
2. **Pathname Override**: Overrides `window.location.pathname` getter to return "/" or route from hash
3. **Hash Conversion**: Converts all `pushState`/`replaceState` calls to hash-based routing
4. **Event Conversion**: Converts `hashchange` events to `popstate` events that routers understand
5. **Link Interception**: Intercepts link clicks and converts them to hash navigation

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Any browser that supports ES2020
- **Local webviews** (file:// protocol)
- **Offline environments** (when bundled locally)

**Note**: Always bundle this package locally via npm or copy to your assets folder. CDN links require internet connectivity and won't work in offline/local webview environments.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a PR.

