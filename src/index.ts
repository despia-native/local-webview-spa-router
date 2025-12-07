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
    const currentPath = window.location.pathname;
    // Detect if we're on a full file path (contains directory separators or absolute path)
    const isFullFilePath = currentPath && (
      currentPath.includes('/') && currentPath.split('/').length > 2 ||
      currentPath.startsWith('/Users/') ||
      currentPath.startsWith('/home/') ||
      currentPath.startsWith('C:\\') ||
      currentPath.includes('\\')
    );
    
    // Override location.pathname to return route from hash, not file path
    try {
      pathnameOverride = Object.getOwnPropertyDescriptor(window.location, 'pathname');
      
      // Check if the property is configurable before trying to override
      if (pathnameOverride && !pathnameOverride.configurable) {
        log('location.pathname is not configurable on instance, trying to delete and override prototype');
        
        // Try to delete the instance property first (will fail if non-configurable, but worth trying)
        try {
          delete (window.location as any).pathname;
          log('Successfully deleted instance pathname property');
        } catch (deleteError) {
          log('Could not delete instance pathname property (non-configurable)');
        }
        
        // Try to override on Location prototype as fallback
        // Note: This may not work if instance property shadows prototype, but worth trying
        try {
          const LocationPrototype = Object.getPrototypeOf(window.location);
          const prototypePathname = Object.getOwnPropertyDescriptor(LocationPrototype, 'pathname');
          
          if (prototypePathname && prototypePathname.configurable) {
            // Store original getter before overriding
            const originalPathnameGetter = prototypePathname.get;
            
            // Override on prototype
            Object.defineProperty(LocationPrototype, 'pathname', {
              get: function() {
                // Only override for file:// protocol
                if (this.protocol === 'file:') {
                  const hash = this.hash;
                  if (hash && hash !== '#' && hash !== '#/') {
                    return hash.replace(/^#/, '');
                  }
                  return '/';
                }
                // For non-file protocols, use original getter
                if (originalPathnameGetter) {
                  return originalPathnameGetter.call(this);
                }
                // Fallback if no original getter
                return '/';
              },
              configurable: true,
              enumerable: true
            });
            pathnameOverrideSucceeded = true;
            log('Overrode location.pathname getter on Location prototype');
            // Note: This may not work if instance property shadows prototype, but worth trying
          } else {
            log('Location prototype pathname also not configurable');
          }
        } catch (prototypeError) {
          log('Could not override Location prototype pathname:', prototypeError);
        }
        
        // If prototype override also failed, try redirect strategy
        if (!pathnameOverrideSucceeded) {
          // If not configurable and we're on a full file path, redirect to index.html with hash
          const hasHash = window.location.hash && window.location.hash !== '' && window.location.hash !== '#';
          if (isFullFilePath && !hasHash) {
            // Extract directory and redirect to index.html with hash
            const dir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
            const newUrl = dir + 'index.html#/';
            log('Redirecting to hash-based URL:', newUrl);
            window.location.replace(newUrl);
            return () => {}; // Return early - redirect will reload
          }
          // Set hash if not present (after checking if we need to redirect)
          if (!hasHash) {
            window.location.hash = '#/';
            log('Set initial hash to #/');
          }
          // If we already have a hash, continue - routers should use hash routing
          console.warn('[WebviewSPARouter] Could not override location.pathname. Routers that read pathname directly (like BrowserRouter) may not work correctly. Consider using HashRouter instead, or ensure the router reads from window.location.hash.');
          log('Using hash-based routing (pathname not configurable)');
        } else {
          // Set initial hash if not present (after successful prototype override)
          if (!window.location.hash || window.location.hash === '' || window.location.hash === '#') {
            window.location.hash = '#/';
            log('Set initial hash to #/');
          }
        }
      } else {
        // Property is configurable or doesn't exist, try to override on instance
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
        // Set initial hash if not present (after successful override)
        if (!window.location.hash || window.location.hash === '' || window.location.hash === '#') {
          window.location.hash = '#/';
          log('Set initial hash to #/');
        }
      }
    } catch (e) {
      console.warn('[WebviewSPARouter] Could not override location.pathname:', e);
      
      // Last resort: Try Location prototype
      if (!pathnameOverrideSucceeded) {
        try {
          const LocationPrototype = Object.getPrototypeOf(window.location);
          const prototypePathname = Object.getOwnPropertyDescriptor(LocationPrototype, 'pathname');
          
          if (prototypePathname && prototypePathname.configurable) {
            // Store original getter before overriding
            const originalPathnameGetter = prototypePathname.get;
            
            Object.defineProperty(LocationPrototype, 'pathname', {
              get: function() {
                if (this.protocol === 'file:') {
                  const hash = this.hash;
                  if (hash && hash !== '#' && hash !== '#/') {
                    return hash.replace(/^#/, '');
                  }
                  return '/';
                }
                // For non-file protocols, use original getter
                if (originalPathnameGetter) {
                  return originalPathnameGetter.call(this);
                }
                return '/';
              },
              configurable: true,
              enumerable: true
            });
            pathnameOverrideSucceeded = true;
            log('Fallback: Overrode location.pathname getter on Location prototype');
          }
        } catch (prototypeError) {
          log('Could not override Location prototype pathname:', prototypeError);
        }
      }
      
      // Final fallback: redirect strategy
      if (!pathnameOverrideSucceeded) {
        const hasHash = window.location.hash && window.location.hash !== '' && window.location.hash !== '#';
        if (isFullFilePath && !hasHash) {
          const dir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
          const newUrl = dir + 'index.html#/';
          log('Fallback: Redirecting to hash-based URL:', newUrl);
          window.location.replace(newUrl);
          return () => {}; // Return early - redirect will reload
        }
        // Set hash if not present (after checking if we need to redirect)
        if (!hasHash) {
          window.location.hash = '#/';
          log('Set initial hash to #/');
        }
        // If we already have a hash, continue with hash-based routing
        console.warn('[WebviewSPARouter] Could not override location.pathname. Routers that read pathname directly (like BrowserRouter) may not work correctly. Consider using HashRouter instead, or ensure the router reads from window.location.hash.');
        log('Using hash-based routing fallback (pathname override failed)');
      } else {
        // Set initial hash if not present (after successful prototype override)
        if (!window.location.hash || window.location.hash === '' || window.location.hash === '#') {
          window.location.hash = '#/';
          log('Set initial hash to #/');
        }
      }
    }
  }

  // Override pushState to use hash
  history.pushState = function(state: any, title: string, url?: string | URL | null) {
    if (url && typeof url === 'string') {
      const hash = pathToHash(url);
      const route = hashToPath(hash);
      window.location.hash = hash;
      // Always use '/' as base pathname for file protocol to avoid file path issues
      const pathname = isFileProtocol ? '/' : window.location.pathname;
      // Store route information in state so routers can read it if pathname override fails
      const stateWithRoute = { ...state, route: route, pathname: route };
      originalReplaceState(stateWithRoute, title, pathname + hash);
      log('pushState:', url, '->', hash, 'route:', route);
      window.dispatchEvent(new PopStateEvent('popstate', { state: stateWithRoute }));
      return;
    }
    return originalPushState(state, title, url);
  };

  // Override replaceState to use hash
  history.replaceState = function(state: any, title: string, url?: string | URL | null) {
    if (url && typeof url === 'string') {
      const hash = pathToHash(url);
      const route = hashToPath(hash);
      window.location.hash = hash;
      // Always use '/' as base pathname for file protocol to avoid file path issues
      const pathname = isFileProtocol ? '/' : window.location.pathname;
      // Store route information in state so routers can read it if pathname override fails
      const stateWithRoute = { ...state, route: route, pathname: route };
      originalReplaceState(stateWithRoute, title, pathname + hash);
      log('replaceState:', url, '->', hash, 'route:', route);
      return;
    }
    return originalReplaceState(state, title, url);
  };

  // Handle hash changes and convert to popstate
  const hashChangeHandler = function() {
    // Extract route from hash
    const route = hashToPath(window.location.hash);
    // Always use '/' as base pathname for file protocol to avoid file path issues
    const pathname = isFileProtocol ? '/' : window.location.pathname;
    // Store route information in state so routers can read it if pathname override fails
    const stateWithRoute = { ...(history.state || {}), route: route, pathname: route };
    originalReplaceState(stateWithRoute, '', pathname + window.location.hash);
    log('hashchange -> popstate, route:', route);
    window.dispatchEvent(new PopStateEvent('popstate', { 
      state: stateWithRoute 
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
    const route = hashToPath(hash);
    
    log('Link click:', href, '->', hash, 'route:', route);
    
    // Always use '/' as base pathname for file protocol to avoid file path issues
    const pathname = isFileProtocol ? '/' : window.location.pathname;
    // Store route information in state so routers can read it if pathname override fails
    const stateWithRoute = { ...(history.state || {}), route: route, pathname: route };
    
    // Update history state first with the new route
    // This ensures the state is correct when hashchange fires
    originalReplaceState(stateWithRoute, '', pathname + hash);
    
    // Set hash - this will trigger hashchange event, which will call hashChangeHandler
    // The hashchange handler will dispatch popstate with the correct route
    window.location.hash = hash;
    
    // Also dispatch popstate immediately to ensure routers detect the change synchronously
    // Some routers check location immediately, so we need to dispatch right away
    // The hashchange handler will also dispatch, but this ensures immediate detection
    window.dispatchEvent(new PopStateEvent('popstate', { 
      state: stateWithRoute 
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
      const hash = window.location.hash || '#/';
      const route = hashToPath(hash);
      // Always use '/' as base pathname for file protocol to avoid file path issues
      // Store route information in state so routers can read it if pathname override fails
      const stateWithRoute = { route: route, pathname: route };
      originalReplaceState(stateWithRoute, '', '/' + hash);
      log('Initial popstate event, route:', route);
      window.dispatchEvent(new PopStateEvent('popstate', { 
        state: stateWithRoute 
      }));
    }, initDelay);
  } else if (window.location.hash) {
    const path = hashToPath(window.location.hash);
    const route = path;
    // Store route information in state so routers can read it if pathname override fails
    const stateWithRoute = { route: route, pathname: route };
    originalReplaceState(stateWithRoute, '', window.location.pathname + window.location.hash);
    initTimeout = window.setTimeout(function() {
      log('Initial popstate event, route:', route);
      window.dispatchEvent(new PopStateEvent('popstate', { 
        state: stateWithRoute 
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
  // Guard against multiple initializations
  const initKey = '__webview_spa_router_initialized__';
  if (!(window as any)[initKey]) {
    (window as any)[initKey] = true;
    
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
}

// Export for module usage
export default initWebviewSPARouter;

