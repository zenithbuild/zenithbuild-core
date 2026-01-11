/**
 * Zenith Bundle Generator
 * 
 * Generates the shared client runtime bundle that gets served as:
 * - /assets/bundle.js in production
 * - /runtime.js in development
 * 
 * This is a cacheable, versioned file that contains:
 * - Reactivity primitives (zenSignal, zenState, zenEffect, etc.)
 * - Lifecycle hooks (zenOnMount, zenOnUnmount)
 * - Hydration functions (zenithHydrate)
 * - Event binding utilities
 */

/**
 * Generate the complete client runtime bundle
 * This is served as an external JS file, not inlined
 */
export function generateBundleJS(): string {
  return `/*!
 * Zenith Runtime v0.1.0
 * Shared client-side runtime for hydration and reactivity
 */
(function(global) {
  'use strict';
  
  // ============================================
  // Dependency Tracking System
  // ============================================
  
  let currentEffect = null;
  const effectStack = [];
  let batchDepth = 0;
  const pendingEffects = new Set();
  
  function pushContext(effect) {
    effectStack.push(currentEffect);
    currentEffect = effect;
  }
  
  function popContext() {
    currentEffect = effectStack.pop() || null;
  }
  
  function trackDependency(subscribers) {
    if (currentEffect) {
      subscribers.add(currentEffect);
      currentEffect.dependencies.add(subscribers);
    }
  }
  
  function notifySubscribers(subscribers) {
    const effects = [...subscribers];
    for (const effect of effects) {
      if (batchDepth > 0) {
        pendingEffects.add(effect);
      } else {
        effect.run();
      }
    }
  }
  
  function cleanupEffect(effect) {
    for (const deps of effect.dependencies) {
      deps.delete(effect);
    }
    effect.dependencies.clear();
  }
  
  // ============================================
  // zenSignal - Atomic reactive value
  // ============================================
  
  function zenSignal(initialValue) {
    let value = initialValue;
    const subscribers = new Set();
    
    function signal(newValue) {
      if (arguments.length === 0) {
        trackDependency(subscribers);
        return value;
      }
      if (newValue !== value) {
        value = newValue;
        notifySubscribers(subscribers);
      }
      return value;
    }
    
    return signal;
  }
  
  // ============================================
  // zenState - Deep reactive object with Proxy
  // ============================================
  
  function zenState(initialObj) {
    const subscribers = new Map();
    
    function getSubscribers(path) {
      if (!subscribers.has(path)) {
        subscribers.set(path, new Set());
      }
      return subscribers.get(path);
    }
    
    function createProxy(obj, path) {
      path = path || '';
      if (typeof obj !== 'object' || obj === null) return obj;
      
      return new Proxy(obj, {
        get: function(target, prop) {
          const propPath = path ? path + '.' + String(prop) : String(prop);
          trackDependency(getSubscribers(propPath));
          const value = target[prop];
          if (typeof value === 'object' && value !== null) {
            return createProxy(value, propPath);
          }
          return value;
        },
        set: function(target, prop, value) {
          const propPath = path ? path + '.' + String(prop) : String(prop);
          target[prop] = value;
          notifySubscribers(getSubscribers(propPath));
          if (path) {
            notifySubscribers(getSubscribers(path));
          }
          return true;
        }
      });
    }
    
    return createProxy(initialObj);
  }
  
  // ============================================
  // zenEffect - Auto-tracked side effect
  // ============================================
  
  function zenEffect(fn) {
    const effect = {
      fn: fn,
      dependencies: new Set(),
      run: function() {
        cleanupEffect(this);
        pushContext(this);
        try {
          this.fn();
        } finally {
          popContext();
        }
      },
      dispose: function() {
        cleanupEffect(this);
      }
    };
    
    effect.run();
    return function() { effect.dispose(); };
  }
  
  // ============================================
  // zenMemo - Cached computed value
  // ============================================
  
  function zenMemo(fn) {
    let cachedValue;
    let dirty = true;
    const subscribers = new Set();
    
    const effect = {
      dependencies: new Set(),
      run: function() {
        dirty = true;
        notifySubscribers(subscribers);
      }
    };
    
    function compute() {
      if (dirty) {
        cleanupEffect(effect);
        pushContext(effect);
        try {
          cachedValue = fn();
          dirty = false;
        } finally {
          popContext();
        }
      }
      trackDependency(subscribers);
      return cachedValue;
    }
    
    return compute;
  }
  
  // ============================================
  // zenRef - Non-reactive mutable container
  // ============================================
  
  function zenRef(initialValue) {
    return { current: initialValue !== undefined ? initialValue : null };
  }
  
  // ============================================
  // zenBatch - Batch updates
  // ============================================
  
  function zenBatch(fn) {
    batchDepth++;
    try {
      fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0) {
        const effects = [...pendingEffects];
        pendingEffects.clear();
        for (const effect of effects) {
          effect.run();
        }
      }
    }
  }
  
  // ============================================
  // zenUntrack - Read without tracking
  // ============================================
  
  function zenUntrack(fn) {
    const prevEffect = currentEffect;
    currentEffect = null;
    try {
      return fn();
    } finally {
      currentEffect = prevEffect;
    }
  }
  
  // ============================================
  // Lifecycle Hooks
  // ============================================
  
  const mountCallbacks = [];
  const unmountCallbacks = [];
  let isMounted = false;
  
  function zenOnMount(fn) {
    if (isMounted) {
      const cleanup = fn();
      if (typeof cleanup === 'function') {
        unmountCallbacks.push(cleanup);
      }
    } else {
      mountCallbacks.push(fn);
    }
  }
  
  function zenOnUnmount(fn) {
    unmountCallbacks.push(fn);
  }
  
  function triggerMount() {
    isMounted = true;
    for (let i = 0; i < mountCallbacks.length; i++) {
      try {
        const cleanup = mountCallbacks[i]();
        if (typeof cleanup === 'function') {
          unmountCallbacks.push(cleanup);
        }
      } catch(e) {
        console.error('[Zenith] Mount error:', e);
      }
    }
    mountCallbacks.length = 0;
  }
  
  function triggerUnmount() {
    isMounted = false;
    for (let i = 0; i < unmountCallbacks.length; i++) {
      try { unmountCallbacks[i](); } catch(e) { console.error('[Zenith] Unmount error:', e); }
    }
    unmountCallbacks.length = 0;
  }
  
  // ============================================
  // Expression Registry & Hydration
  // ============================================
  
  const expressionRegistry = new Map();
  
  function registerExpression(id, fn) {
    expressionRegistry.set(id, fn);
  }
  
  function getExpression(id) {
    return expressionRegistry.get(id);
  }
  
  /**
   * Hydrate a page with reactive bindings
   * Called after page HTML is in DOM
   */
  function zenithHydrate(pageState, container) {
    container = container || document;
    
    // Find all data-zen-bind elements
    const bindings = container.querySelectorAll('[data-zen-bind]');
    
    bindings.forEach(function(el) {
      const bindType = el.getAttribute('data-zen-bind');
      const exprId = el.getAttribute('data-zen-expr');
      
      if (bindType === 'text' && exprId) {
        const expr = getExpression(exprId);
        if (expr) {
          zenEffect(function() {
            el.textContent = expr(pageState);
          });
        }
      } else if (bindType === 'attr') {
        const attrName = el.getAttribute('data-zen-attr');
        const expr = getExpression(exprId);
        if (expr && attrName) {
          zenEffect(function() {
            el.setAttribute(attrName, expr(pageState));
          });
        }
      }
    });
    
    // Wire up event handlers
    const handlers = container.querySelectorAll('[data-zen-event]');
    handlers.forEach(function(el) {
      const eventData = el.getAttribute('data-zen-event');
      if (eventData) {
        const parts = eventData.split(':');
        const eventType = parts[0];
        const handlerName = parts[1];
        if (handlerName && global[handlerName]) {
          el.addEventListener(eventType, global[handlerName]);
        }
      }
    });
    
    // Trigger mount
    triggerMount();
  }
  
  // ============================================
  // Export to window.__zenith
  // ============================================
  
  global.__zenith = {
    // Reactivity primitives
    signal: zenSignal,
    state: zenState,
    effect: zenEffect,
    memo: zenMemo,
    ref: zenRef,
    batch: zenBatch,
    untrack: zenUntrack,
    // Lifecycle
    onMount: zenOnMount,
    onUnmount: zenOnUnmount,
    // Internal hooks
    triggerMount: triggerMount,
    triggerUnmount: triggerUnmount,
    // Hydration
    hydrate: zenithHydrate,
    registerExpression: registerExpression,
    getExpression: getExpression
  };
  
  // Expose with zen* prefix for direct usage
  global.zenSignal = zenSignal;
  global.zenState = zenState;
  global.zenEffect = zenEffect;
  global.zenMemo = zenMemo;
  global.zenRef = zenRef;
  global.zenBatch = zenBatch;
  global.zenUntrack = zenUntrack;
  global.zenOnMount = zenOnMount;
  global.zenOnUnmount = zenOnUnmount;
  global.zenithHydrate = zenithHydrate;
  
  // Clean aliases
  global.signal = zenSignal;
  global.state = zenState;
  global.effect = zenEffect;
  global.memo = zenMemo;
  global.ref = zenRef;
  global.batch = zenBatch;
  global.untrack = zenUntrack;
  global.onMount = zenOnMount;
  global.onUnmount = zenOnUnmount;
  
  // ============================================
  // HMR Client (Development Only)
  // ============================================
  
  if (typeof window !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    let socket;
    function connectHMR() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(protocol + '//' + location.host + '/hmr');
      
      socket.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'reload') {
            console.log('[Zenith] HMR: Reloading page...');
            location.reload();
          } else if (data.type === 'style-update') {
            console.log('[Zenith] HMR: Updating style ' + data.url);
            const links = document.querySelectorAll('link[rel="stylesheet"]');
            for (let i = 0; i < links.length; i++) {
              const link = links[i];
              const url = new URL(link.href);
              if (url.pathname === data.url) {
                link.href = data.url + '?t=' + Date.now();
                break;
              }
            }
          }
        } catch (e) {
          console.error('[Zenith] HMR Error:', e);
        }
      };
      
      socket.onclose = function() {
        console.log('[Zenith] HMR: Connection closed. Retrying in 2s...');
        setTimeout(connectHMR, 2000);
      };
    }
    
    // Connect unless explicitly disabled
    if (!window.__ZENITH_NO_HMR__) {
      connectHMR();
    }
  }
  
})(typeof window !== 'undefined' ? window : this);
`
}

/**
 * Generate a minified version of the bundle
 * For production builds
 */
export function generateMinifiedBundleJS(): string {
  // For now, return non-minified
  // TODO: Add minification via terser or similar
  return generateBundleJS()
}

/**
 * Get bundle version for cache busting
 */
export function getBundleVersion(): string {
  return '0.1.0'
}
