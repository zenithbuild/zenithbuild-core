/**
 * Zenith Core Runtime
 * 
 * This is the foundational layer of the Zenith framework, providing:
 * - Reactive primitives (signals, state, effects, memos)
 * - Lifecycle hooks (onMount, onUnmount)
 * 
 * Design principles:
 * - Auto-tracked reactivity (no dependency arrays)
 * - No VDOM or render loops
 * - Runtime-agnostic (works in browser, SSR, tests)
 * - Hybrid naming: internal `zen*` + public clean names
 * 
 * @example
 * ```ts
 * // Using clean names (recommended for application code)
 * import { signal, effect, onMount } from 'zenith/core'
 * 
 * const count = signal(0)
 * 
 * effect(() => {
 *   console.log('Count:', count())
 * })
 * 
 * onMount(() => {
 *   console.log('Mounted!')
 * })
 * ```
 * 
 * @example
 * ```ts
 * // Using explicit zen* names (for library/internal code)
 * import { zenSignal, zenEffect, zenOnMount } from 'zenith/core'
 * 
 * const count = zenSignal(0)
 * zenEffect(() => console.log(count()))
 * zenOnMount(() => console.log('Ready'))
 * ```
 * 
 * @example
 * ```ts
 * // For navigation, import from router
 * import { navigate, isActive } from 'zenith/router'
 * 
 * navigate('/about')
 * if (isActive('/blog')) {
 *   // Handle active state
 * }
 * ```
 */

// ============================================
// Reactivity Primitives
// ============================================

// Explicit zen* exports (internal naming)
export {
  signal as zenSignal,
  state as zenState,
  effect as zenEffect,
  memo as zenMemo,
  ref as zenRef,
  batch as zenBatch,
  untrack as zenUntrack
} from '@zenithbuild/runtime'

// Types
export type {
  Signal,
  Memo,
  Ref,
  EffectFn,
  DisposeFn,
  Subscriber,
  TrackingContext
} from '@zenithbuild/runtime'

// Clean name exports (public DX)
export {
  signal,
  state,
  effect,
  memo,
  ref,
  batch,
  untrack
} from '@zenithbuild/runtime'

// Internal tracking utilities (advanced use)
export {
  trackDependency,
  notifySubscribers,
  getCurrentContext,
  pushContext,
  popContext,
  cleanupContext,
  runUntracked,
  startBatch,
  endBatch,
  isBatching
} from '@zenithbuild/runtime'

// ============================================
// Lifecycle Hooks
// ============================================

// Explicit zen* exports (internal naming)
export {
  onMount as zenOnMount,
  onUnmount as zenOnUnmount
} from '@zenithbuild/runtime'

// Clean name exports (public DX)
export {
  onMount,
  onUnmount
} from '@zenithbuild/runtime'

// Types
export type {
  MountCallback,
  UnmountCallback
} from '@zenithbuild/runtime'

// Internal lifecycle utilities (for component system)
export {
  triggerMount,
  triggerUnmount,
  executeUnmountCallbacks,
  getIsMounted,
  getUnmountCallbackCount,
  resetMountState,
  resetUnmountState
} from '@zenithbuild/runtime'

// ============================================
// Build-time Modules (Proxied from @zenithbuild/compiler)
// ============================================

export {
  loadZenithConfig
} from '@zenithbuild/compiler/config'

export {
  PluginRegistry,
  createPluginContext,
  getPluginDataByNamespace,
  createBridgeAPI,
  runPluginHooks,
  collectHookReturns,
  buildRuntimeEnvelope,
  clearHooks
} from '@zenithbuild/compiler'

export type { HookContext } from '@zenithbuild/compiler'

// ============================================
// Core Components
// ============================================

export {
  CORE_COMPONENTS,
  getCoreComponentPath
} from './components'
