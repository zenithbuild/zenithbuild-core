// ---------------------------------------------------------------------------
// index.js — Zenith Core V0
// ---------------------------------------------------------------------------
// Public API. Re-exports all modules.
// ---------------------------------------------------------------------------

export { validateConfig, loadConfig, getDefaults } from './config.js';
export {
    normalizeSeparators,
    fileToRoute,
    extractParams,
    isDynamic,
    validateRouteParams,
    canonicalize
} from './path.js';
export { sortRoutes, sortAlpha, isCorrectOrder } from './order.js';
export { hash, hashShort } from './hash.js';
export { createError, formatError, isZenithError, ErrorCodes } from './errors.js';
export { parseSemver, formatVersion, validateCompatibility } from './version.js';
export {
    containsForbiddenPattern,
    FORBIDDEN_PATTERNS,
    BROWSER_GLOBALS
} from './guards.js';
