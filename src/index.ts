/**
 * Local Webview SPA Router
 * 
 * A router to allow local routing of the most popular SPA routers in webviews and file:// protocol.
 * Works with React Router, Vue Router, Angular Router, Framework7, and all popular SPA frameworks.
 * 
 * This library intercepts navigation and converts paths to hash-based routing
 * when running in local webviews or file:// protocol, ensuring your SPA works correctly without a server.
 */

export interface RouterFixOptions {
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
  
  /**
   * Custom detection function for local environment
   * Return true if running locally
   */
  isLocal?: () => boolean;
  
  /**
   * Delay in milliseconds before triggering initial popstate event
   * @default 100
   */
  initDelay?: number;
}

/**
 * Initialize the router fix
 * Call this function before your SPA framework initializes
 * 
 * @param options Configuration options
 * @returns Cleanup function to disable the fix
 */
export function initWebviewSPARouter(options: RouterFixOptions = {}): () => void {
  const {
    debug = false,
    isLocal,
    initDelay = 100
  } = options;

  const log = debug ? console.log.bind(console, '[WebviewSPARouter]') : () => {};

  // Detect if we're running on file:// protocol (not localhost)
  // Only activate for file:// - localhost works fine with normal routing
  const detectLocal = isLocal || (() => {
    return window.location.protocol === 'file:';
  });

  if (!detectLocal()) {
    log('Not running locally, router fix disabled');
    return () => {}; // No-op cleanup
  }

  log('Initializing local router fix');

  const isFileProtocol = window.location.protocol === 'file:';

  // Store original methods
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  let pathnameOverride: PropertyDescriptor | null | undefined = null;

  // Convert path to hash format
  function pathToHash(path: string): string {
    if (!path || path === '/' || path === '/index.html') {
      return '#/';
    }
    return '#' + path.replace(/^\/+/, '/');
  }

  // Convert hash to path
  function hashToPath(hash: string): string {
    if (!hash) return '/';
    return hash.replace(/^#/, '') || '/';
  }

  // CRITICAL FIX: Override pathname getter for file:// protocol
  let pathnameOverrideSucceeded = false;
  if (isFileProtocol) {
    // Set initial hash if not present
    if (!window.location.hash || window.location.hash === '') {
      window.location.hash = '#/';
      log('Set initial hash to #/');
    }
    
    // Override location.pathname to return route from hash, not file path
    try {
      pathnameOverride = Object.getOwnPropertyDescriptor(window.location, 'pathname');
      Object.defineProperty(window.location, 'pathname', {
        get: function() {
          const hash = window.location.hash;
          if (hash && hash !== '#' && hash !== '#/') {
            return hash.replace(/^#/, '');
          }
          return '/';
        },
        configurable: true,
        enumerable: true
      });
      pathnameOverrideSucceeded = true;
      log('Overrode location.pathname getter');
    } catch (e) {
      console.warn('[WebviewSPARouter] Could not override location.pathname:', e);
      // Fallback: If we can't override pathname, we need to redirect immediately
      // to a URL that uses hash routing, so React Router sees the correct path
      const currentPath = window.location.pathname;
      if (currentPath && !currentPath.endsWith('/index.html') && currentPath !== '/') {
        // Extract the directory and redirect to index.html with hash
        const dir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        const newUrl = dir + 'index.html#/';
        log('Redirecting to:', newUrl);
        window.location.replace(newUrl);
        // Return early - the redirect will reload the page
        return () => {};
      }
    }
  }

  // Override pushState to use hash
  history.pushState = function(state: any, title: string, url?: string | URL | null) {
    if (url && typeof url === 'string') {
      const hash = pathToHash(url);
      window.location.hash = hash;
      const pathname = (isFileProtocol && pathnameOverrideSucceeded) ? '/' : window.location.pathname;
      originalReplaceState(state, title, pathname + hash);
      log('pushState:', url, '->', hash);
      window.dispatchEvent(new PopStateEvent('popstate', { state: state }));
      return;
    }
    return originalPushState(state, title, url);
  };

  // Override replaceState to use hash
  history.replaceState = function(state: any, title: string, url?: string | URL | null) {
    if (url && typeof url === 'string') {
      const hash = pathToHash(url);
      window.location.hash = hash;
      const pathname = (isFileProtocol && pathnameOverrideSucceeded) ? '/' : window.location.pathname;
      originalReplaceState(state, title, pathname + hash);
      log('replaceState:', url, '->', hash);
      return;
    }
    return originalReplaceState(state, title, url);
  };

  // Handle hash changes and convert to popstate
  const hashChangeHandler = function() {
    const pathname = (isFileProtocol && pathnameOverrideSucceeded) ? '/' : window.location.pathname;
    originalReplaceState(null, '', pathname + window.location.hash);
    log('hashchange -> popstate');
    window.dispatchEvent(new PopStateEvent('popstate', { 
      state: history.state 
    }));
  };
  window.addEventListener('hashchange', hashChangeHandler);

  // Intercept link clicks to convert to hash routing
  const clickHandler = function(e: MouseEvent) {
    const link = (e.target as Element)?.closest('a[href]') as HTMLAnchorElement | null;
    if (!link) return;

    const href = link.getAttribute('href');
    
    // Skip if it's already a hash, external link, or special protocol
    if (!href || 
        href.startsWith('#') || 
        href.startsWith('http://') || 
        href.startsWith('https://') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        href.startsWith('data:')) {
      return;
    }

    // Convert internal link to hash-based
    e.preventDefault();
    const hash = pathToHash(href);
    window.location.hash = hash;
    log('Link click:', href, '->', hash);
    
    window.dispatchEvent(new PopStateEvent('popstate', { 
      state: history.state 
    }));
  };
  document.addEventListener('click', clickHandler, true);

  // Ensure initial route is set correctly
  let initTimeout: number | null = null;
  if (isFileProtocol) {
    if (!window.location.hash || window.location.hash === '') {
      window.location.hash = '#/';
    }
    
    initTimeout = window.setTimeout(function() {
      const path = hashToPath(window.location.hash);
      originalReplaceState(null, '', path);
      log('Initial popstate event');
      window.dispatchEvent(new PopStateEvent('popstate', { 
        state: history.state 
      }));
    }, initDelay);
  } else if (window.location.hash) {
    const path = hashToPath(window.location.hash);
    originalReplaceState(null, '', window.location.pathname + window.location.hash);
    initTimeout = window.setTimeout(function() {
      log('Initial popstate event');
      window.dispatchEvent(new PopStateEvent('popstate', { 
        state: history.state 
      }));
    }, initDelay);
  }

  // Cleanup function
  return function cleanup() {
    log('Cleaning up router fix');
    
    // Restore original methods
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    
    // Restore pathname if we overrode it
    if (pathnameOverride && isFileProtocol) {
      try {
        Object.defineProperty(window.location, 'pathname', pathnameOverride);
      } catch (e) {
        console.warn('[WebviewSPARouter] Could not restore location.pathname:', e);
      }
    }
    
    // Remove event listeners
    window.removeEventListener('hashchange', hashChangeHandler);
    document.removeEventListener('click', clickHandler, true);
    
    // Clear timeout
    if (initTimeout !== null) {
      clearTimeout(initTimeout);
    }
  };
}

// Auto-initialize if loaded via script tag (UMD build)
// For UMD builds loaded via <script> tag, auto-initialize immediately
// The UMD wrapper executes this code immediately when the script loads
// We need to initialize BEFORE React Router reads window.location.pathname
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // For UMD builds, initialize immediately when script executes
  // This is critical - we must override pathname before React Router initializes
  // Use a microtask to ensure it runs in the current execution context but before async scripts
  if (document.readyState === 'loading') {
    // DOM still loading - initialize immediately anyway (pathname override doesn't need DOM)
    // Also set up DOMContentLoaded listener as backup
        initWebviewSPARouter();
    document.addEventListener('DOMContentLoaded', function() {
      // Re-trigger popstate after DOM is ready
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    }, { once: true });
  } else {
    // DOM already loaded, initialize immediately
        initWebviewSPARouter();
  }
}

// Export for module usage
export default initWebviewSPARouter;

