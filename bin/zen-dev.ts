#!/usr/bin/env bun
/**
 * Zenith Dev Server with In-Memory Compilation
 * 
 * Features:
 * - In-memory .zen compilation (no disk writes required)
 * - Shared runtime module served at /runtime.js
 * - Page-specific scripts at /__dev_pages/*.js
 * - Automatic hydration injection
 * - File watching for HMR
 * - DefaultLayout injection
 */

import path from 'path'
import fs from 'fs'
import { serve } from 'bun'
import { compileZen, compileZenSource } from '../compiler/index'
import { discoverLayouts } from '../compiler/discovery/layouts'
import { processLayout } from '../compiler/transform/layoutProcessor'
import { discoverPages, generateRouteDefinition, routePathToRegex } from '../router/manifest'
import { generateBundleJS } from '../runtime/bundle-generator'

const projectRoot = process.cwd()

// Support both app/ and src/ directory structures
let appDir = path.join(projectRoot, 'app')
if (!fs.existsSync(appDir)) {
  appDir = path.join(projectRoot, 'src')
}

const pagesDir = path.join(appDir, 'pages')
const port = parseInt(process.env.PORT || '3000', 10)

// File extensions that should be served as static assets
const STATIC_EXTENSIONS = new Set([
  '.js', '.css', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg',
  '.webp', '.woff', '.woff2', '.ttf', '.eot', '.json', '.map'
])

// Page compilation cache
interface CompiledPage {
  html: string
  script: string
  styles: string[]
  route: string
  lastModified: number
}
const pageCache = new Map<string, CompiledPage>()

/**
 * Generate the shared runtime JavaScript
 * Uses the bundle generator for consistency with production builds
 */
function generateRuntimeJS(): string {
  return generateBundleJS()
}

/**
 * Generate inline runtime code (extracted from client-runtime.ts logic)
 */
function generateInlineRuntime(): string {
  return `(function() {
  'use strict';
  
  // Dependency Tracking
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
  
  // zenSignal
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
  
  // zenState
  function zenState(initialObj) {
    const subscribers = new Map();
    
    function getSubscribers(path) {
      if (!subscribers.has(path)) {
        subscribers.set(path, new Set());
      }
      return subscribers.get(path);
    }
    
    function createProxy(obj, parentPath) {
      parentPath = parentPath || '';
      if (obj === null || typeof obj !== 'object') return obj;
      
      return new Proxy(obj, {
        get(target, prop) {
          if (typeof prop === 'symbol') return target[prop];
          const path = parentPath ? parentPath + '.' + String(prop) : String(prop);
          trackDependency(getSubscribers(path));
          const value = target[prop];
          if (value !== null && typeof value === 'object') {
            return createProxy(value, path);
          }
          return value;
        },
        set(target, prop, newValue) {
          if (typeof prop === 'symbol') {
            target[prop] = newValue;
            return true;
          }
          const path = parentPath ? parentPath + '.' + String(prop) : String(prop);
          const oldValue = target[prop];
          if (oldValue !== newValue) {
            target[prop] = newValue;
            const subs = subscribers.get(path);
            if (subs) notifySubscribers(subs);
          }
          return true;
        }
      });
    }
    return createProxy(initialObj);
  }
  
  // zenEffect
  function zenEffect(fn) {
    let cleanup;
    const effect = {
      dependencies: new Set(),
      run() {
        cleanupEffect(effect);
        pushContext(effect);
        try {
          if (cleanup) cleanup();
          cleanup = fn();
        } finally {
          popContext();
        }
      }
    };
    effect.run();
    return () => {
      cleanupEffect(effect);
      if (cleanup) cleanup();
    };
  }
  
  // zenMemo
  function zenMemo(fn) {
    let value;
    let dirty = true;
    const subscribers = new Set();
    const effect = {
      dependencies: new Set(),
      run() {
        cleanupEffect(effect);
        pushContext(effect);
        try {
          value = fn();
          dirty = false;
          notifySubscribers(subscribers);
        } finally {
          popContext();
        }
      }
    };
    return () => {
      trackDependency(subscribers);
      if (dirty) effect.run();
      return value;
    };
  }
  
  // zenRef
  function zenRef(initialValue) {
    return { current: initialValue !== undefined ? initialValue : null };
  }
  
  // zenBatch
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
  
  // zenUntrack
  function zenUntrack(fn) {
    const prevEffect = currentEffect;
    currentEffect = null;
    try {
      return fn();
    } finally {
      currentEffect = prevEffect;
    }
  }
  
  // Lifecycle Hooks
  const mountCallbacks = [];
  const unmountCallbacks = [];
  let isMounted = false;
  
  function zenOnMount(fn) {
    if (isMounted) {
      const cleanup = fn();
      if (typeof cleanup === 'function') unmountCallbacks.push(cleanup);
    } else {
      mountCallbacks.push(fn);
    }
  }
  
  function zenOnUnmount(fn) {
    unmountCallbacks.push(fn);
  }
  
  function triggerMount() {
    isMounted = true;
    for (const cb of mountCallbacks) {
      const cleanup = cb();
      if (typeof cleanup === 'function') unmountCallbacks.push(cleanup);
    }
    mountCallbacks.length = 0;
  }
  
  function triggerUnmount() {
    isMounted = false;
    for (const cb of unmountCallbacks) {
      try { cb(); } catch(e) { console.error('[Zenith] Unmount error:', e); }
    }
    unmountCallbacks.length = 0;
  }
  
  // Expression Registry
  if (!window.__ZENITH_EXPRESSIONS__) {
    window.__ZENITH_EXPRESSIONS__ = new Map();
  }
  
  // Bindings
  const __zen_bindings = [];
  
  // Update text binding
  function updateTextBinding(node, expressionId, state) {
    const expression = window.__ZENITH_EXPRESSIONS__.get(expressionId);
    if (!expression) {
      console.warn('[Zenith] Expression ' + expressionId + ' not found');
      return;
    }
    try {
      const result = expression(state);
      if (result === null || result === undefined || result === false) {
        node.textContent = '';
      } else {
        node.textContent = String(result);
      }
    } catch (error) {
      console.error('[Zenith] Expression error:', error);
    }
  }
  
  // Update attribute binding
  function updateAttributeBinding(element, attrName, expressionId, state) {
    const expression = window.__ZENITH_EXPRESSIONS__.get(expressionId);
    if (!expression) return;
    try {
      const result = expression(state);
      if (attrName === 'class' || attrName === 'className') {
        element.className = String(result != null ? result : '');
      } else if (attrName === 'disabled' || attrName === 'checked') {
        if (result) element.setAttribute(attrName, '');
        else element.removeAttribute(attrName);
      } else {
        if (result === null || result === undefined || result === false) {
          element.removeAttribute(attrName);
        } else {
          element.setAttribute(attrName, String(result));
        }
      }
    } catch (error) {
      console.error('[Zenith] Attribute error:', error);
    }
  }
  
  // Hydrate
  function hydrate(state, loaderData, props, stores, container) {
    container = container || document;
    if (!state) state = {};
    
    window.__ZENITH_STATE__ = state;
    __zen_bindings.length = 0;
    
    // Text bindings
    const textPlaceholders = container.querySelectorAll('[data-zen-text]');
    for (let i = 0; i < textPlaceholders.length; i++) {
      const node = textPlaceholders[i];
      const expressionId = node.getAttribute('data-zen-text');
      if (!expressionId) continue;
      __zen_bindings.push({ node, type: 'text', expressionId });
      updateTextBinding(node, expressionId, state);
    }
    
    // Attribute bindings
    const attrSelectors = ['class', 'style', 'src', 'href', 'disabled', 'checked'];
    for (let s = 0; s < attrSelectors.length; s++) {
      const attrName = attrSelectors[s];
      const attrPlaceholders = container.querySelectorAll('[data-zen-attr-' + attrName + ']');
      for (let i = 0; i < attrPlaceholders.length; i++) {
        const node = attrPlaceholders[i];
        const expressionId = node.getAttribute('data-zen-attr-' + attrName);
        if (!expressionId) continue;
        __zen_bindings.push({ node, type: 'attribute', expressionId, attributeName: attrName });
        updateAttributeBinding(node, attrName, expressionId, state);
      }
    }
    
    // Bind events
    bindEvents(container);
    
    // Trigger mount
    triggerMount();
  }
  
  // Bind events
  function bindEvents(container) {
    container = container || document;
    const eventTypes = ['click', 'change', 'input', 'submit', 'focus', 'blur', 'keyup', 'keydown'];
    
    for (let e = 0; e < eventTypes.length; e++) {
      const eventType = eventTypes[e];
      const elements = container.querySelectorAll('[data-zen-' + eventType + ']');
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const handlerName = element.getAttribute('data-zen-' + eventType);
        if (!handlerName) continue;
        
        const handlerKey = '__zen_' + eventType + '_handler';
        const existingHandler = element[handlerKey];
        if (existingHandler) {
          element.removeEventListener(eventType, existingHandler);
        }
        
        const handler = function(event) {
          try {
            const handlerFunc = window[handlerName];
            if (typeof handlerFunc === 'function') {
              handlerFunc(event, element);
            } else {
              console.warn('[Zenith] Handler "' + handlerName + '" not found');
            }
          } catch (error) {
            console.error('[Zenith] Handler error:', error);
          }
        };
        
        element[handlerKey] = handler;
        element.addEventListener(eventType, handler);
      }
    }
  }
  
  // Update all bindings
  function update(state) {
    if (!state) state = window.__ZENITH_STATE__ || {};
    window.__ZENITH_STATE__ = state;
    
    for (let i = 0; i < __zen_bindings.length; i++) {
      const binding = __zen_bindings[i];
      if (binding.type === 'text') {
        updateTextBinding(binding.node, binding.expressionId, state);
      } else if (binding.type === 'attribute' && binding.attributeName) {
        updateAttributeBinding(binding.node, binding.attributeName, binding.expressionId, state);
      }
    }
  }
  
  // Cleanup
  function cleanup(container) {
    container = container || document;
    const eventTypes = ['click', 'change', 'input', 'submit', 'focus', 'blur', 'keyup', 'keydown'];
    for (let e = 0; e < eventTypes.length; e++) {
      const eventType = eventTypes[e];
      const elements = container.querySelectorAll('[data-zen-' + eventType + ']');
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const handlerKey = '__zen_' + eventType + '_handler';
        const handler = element[handlerKey];
        if (handler) {
          element.removeEventListener(eventType, handler);
          delete element[handlerKey];
        }
      }
    }
    __zen_bindings.length = 0;
    triggerUnmount();
  }
  
  // Export to window
  window.__zenith = {
    signal: zenSignal,
    state: zenState,
    effect: zenEffect,
    memo: zenMemo,
    ref: zenRef,
    batch: zenBatch,
    untrack: zenUntrack,
    onMount: zenOnMount,
    onUnmount: zenOnUnmount,
    triggerMount: triggerMount,
    triggerUnmount: triggerUnmount
  };
  
  window.__zenith_hydrate = hydrate;
  window.__zenith_update = update;
  window.__zenith_bindEvents = bindEvents;
  window.__zenith_cleanup = cleanup;
  
  window.zenithHydrate = hydrate;
  window.zenithUpdate = update;
  window.zenithBindEvents = bindEvents;
  window.zenithCleanup = cleanup;
  
  window.zenSignal = zenSignal;
  window.zenState = zenState;
  window.zenEffect = zenEffect;
  window.zenMemo = zenMemo;
  window.zenRef = zenRef;
  window.zenBatch = zenBatch;
  window.zenUntrack = zenUntrack;
  window.zenOnMount = zenOnMount;
  window.zenOnUnmount = zenOnUnmount;
  
  window.signal = zenSignal;
  window.state = zenState;
  window.effect = zenEffect;
  window.memo = zenMemo;
  window.ref = zenRef;
  window.batch = zenBatch;
  window.untrack = zenUntrack;
  window.onMount = zenOnMount;
  window.onUnmount = zenOnUnmount;
  
})();`
}

/**
 * Compile a .zen page in memory
 */
function compilePageInMemory(pagePath: string): CompiledPage | null {
  try {
    const layoutsDir = path.join(appDir, 'layouts')
    const layouts = discoverLayouts(layoutsDir)

    const source = fs.readFileSync(pagePath, 'utf-8')

    // Find suitable layout
    let processedSource = source
    let layoutToUse = layouts.get('DefaultLayout')

    if (layoutToUse) {
      processedSource = processLayout(source, layoutToUse)
    }

    const result = compileZenSource(processedSource, pagePath)

    if (!result.finalized) {
      throw new Error('Compilation failed: No finalized output')
    }

    const routeDef = generateRouteDefinition(pagePath, pagesDir)

    return {
      html: result.finalized.html,
      script: result.finalized.js,
      styles: result.finalized.styles,
      route: routeDef.path,
      lastModified: Date.now()
    }
  } catch (error: any) {
    console.error(`[Zenith Dev] Compilation error for ${pagePath}:`, error.message)
    return null
  }
}

/**
 * Generate full HTML page from compiled output
 */
function generateDevHTML(page: CompiledPage): string {
  // page.html already contains the full layout (html, head, body)
  // because layoutProcessor.ts merges it.
  // We need to inject the runtime script BEFORE the page script

  // Runtime must load first so zenOnMount etc are available
  const runtimeTag = `<script src="/runtime.js"></script>`
  const scriptTag = `<script>\n${page.script}\n</script>`
  const allScripts = `${runtimeTag}\n${scriptTag}`

  if (page.html.includes('</body>')) {
    return page.html.replace('</body>', `${allScripts}\n</body>`)
  }

  return `${page.html}\n${allScripts}`
}

/**
 * Find .zen page file for a given route
 */
function findPageForRoute(route: string): string | null {
  // Try exact match
  const exactPath = path.join(pagesDir, route === '/' ? 'index.zen' : `${route.slice(1)}.zen`)
  if (fs.existsSync(exactPath)) {
    return exactPath
  }

  // Try with /index.zen suffix
  const indexPath = path.join(pagesDir, route === '/' ? 'index.zen' : `${route.slice(1)}/index.zen`)
  if (fs.existsSync(indexPath)) {
    return indexPath
  }

  return null
}

/**
 * Find user-defined 404 page (if any)
 * Checks for: 404.zen, +404.zen, not-found.zen
 */
function find404Page(): string | null {
  const candidates = ['404.zen', '+404.zen', 'not-found.zen']
  for (const candidate of candidates) {
    const pagePath = path.join(pagesDir, candidate)
    if (fs.existsSync(pagePath)) {
      return pagePath
    }
  }
  return null
}

/**
 * Generate default 404 HTML (used when no user-defined 404 exists)
 */
function generateDefault404HTML(requestedPath: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found | Zenith</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .error-code {
      font-size: 8rem;
      font-weight: 800;
      background: linear-gradient(135deg, #3b82f6, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #e2e8f0;
    }
    .path {
      font-family: monospace;
      background: rgba(255, 255, 255, 0.1);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      color: #94a3b8;
      margin-bottom: 2rem;
      display: inline-block;
    }
    a {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      text-decoration: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 500;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    a:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-code">404</div>
    <h1>Page Not Found</h1>
    <div class="path">${requestedPath}</div>
    <p style="color: #94a3b8; margin-bottom: 2rem;">The page you're looking for doesn't exist.</p>
    <a href="/">← Go Home</a>
  </div>
</body>
</html>`
}

// Cached runtime JS
let cachedRuntimeJS: string | null = null

async function main() {
  console.log('🚀 Starting Zenith Dev Server...')
  console.log(`   Project: ${projectRoot}`)

  // Pre-generate runtime
  cachedRuntimeJS = generateRuntimeJS()

  serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)
      const pathname = url.pathname
      const ext = path.extname(pathname).toLowerCase()

      // Serve runtime.js and /assets/bundle.js
      if (pathname === '/runtime.js' || pathname === '/assets/bundle.js') {
        return new Response(cachedRuntimeJS, {
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        })
      }

      // Serve styles from /assets/ or /app/styles/
      if (pathname === '/assets/styles.css' || pathname === '/styles/global.css' || pathname === '/app/styles/global.css') {
        const globalCssPath = path.join(appDir, 'styles', 'global.css')
        if (fs.existsSync(globalCssPath)) {
          const css = fs.readFileSync(globalCssPath, 'utf-8')
          return new Response(css, {
            headers: { 'Content-Type': 'text/css; charset=utf-8' }
          })
        }
      }

      // Serve static assets from app/public, app/dist, or app (for /styles, etc.)
      if (STATIC_EXTENSIONS.has(ext)) {
        const publicPath = path.join(appDir, 'public', pathname)
        const distPath = path.join(appDir, 'dist', pathname)
        const appRelativePath = path.join(appDir, pathname)

        for (const filePath of [publicPath, distPath, appRelativePath]) {
          const file = Bun.file(filePath)
          if (await file.exists()) {
            return new Response(file)
          }
        }
        return new Response('Not found', { status: 404 })
      }

      // Handle .zen page routes
      const pagePath = findPageForRoute(pathname)
      if (pagePath) {
        // Check cache
        let cached = pageCache.get(pagePath)
        const stat = fs.statSync(pagePath)

        if (!cached || stat.mtimeMs > cached.lastModified) {
          // Recompile
          const compiled = compilePageInMemory(pagePath)
          if (compiled) {
            pageCache.set(pagePath, compiled)
            cached = compiled
          }
        }

        if (cached) {
          const html = generateDevHTML(cached)
          return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          })
        }
      }

      // Fallback: serve 404 page
      const custom404Path = find404Page()
      if (custom404Path) {
        // Use user-defined 404 page
        let cached = pageCache.get(custom404Path)
        const stat = fs.statSync(custom404Path)

        if (!cached || stat.mtimeMs > cached.lastModified) {
          const compiled = compilePageInMemory(custom404Path)
          if (compiled) {
            pageCache.set(custom404Path, compiled)
            cached = compiled
          }
        }

        if (cached) {
          const html = generateDevHTML(cached)
          return new Response(html, {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          })
        }
      }

      // Use default 404 page
      return new Response(generateDefault404HTML(pathname), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }
  })

  console.log(`✅ Zenith dev server running at http://localhost:${port}`)
  console.log('   • In-memory compilation (no build required)')
  console.log('   • Auto-recompile on file changes')
  console.log('   Press Ctrl+C to stop')
}

main()
