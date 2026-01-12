/**
 * Zenith Config Types
 * 
 * Configuration interfaces for zenith.config.ts
 */

// ============================================
// Content Plugin Types
// ============================================

/**
 * Configuration for a content source
 */
export interface ContentSourceConfig {
    /** Root directory relative to project root (e.g., "../zenith-docs" or "content") */
    root: string;
    /** Folders to include from the root (e.g., ["documentation"]). Defaults to all. */
    include?: string[];
    /** Folders to exclude from the root (e.g., ["changelog"]) */
    exclude?: string[];
}

/**
 * Options for the content plugin
 */
export interface ContentPluginOptions {
    /** Named content sources mapped to their configuration */
    sources?: Record<string, ContentSourceConfig>;
    /** Legacy: Single content directory (deprecated, use sources instead) */
    contentDir?: string;
}

// ============================================
// Core Plugin Types
// ============================================

/**
 * Context passed to plugins during setup
 */
export interface PluginContext {
    /** Absolute path to project root */
    projectRoot: string;
    /** Set content data for the runtime */
    setContentData: (data: Record<string, ContentItem[]>) => void;
    /** Additional options passed from config */
    options?: Record<string, unknown>;
}

/**
 * A content item loaded from a source
 */
export interface ContentItem {
    id?: string | number;
    slug?: string | null;
    collection?: string | null;
    content?: string | null;
    [key: string]: unknown;
}

/**
 * A Zenith plugin definition
 */
export interface ZenithPlugin {
    /** Unique plugin name */
    name: string;
    /** Setup function called during initialization */
    setup: (ctx: PluginContext) => void | Promise<void>;
    /** Plugin-specific configuration (preserved for reference) */
    config?: unknown;
}

// ============================================
// Main Config Types
// ============================================

/**
 * Zenith configuration object
 */
export interface ZenithConfig {
    /** List of plugins to load */
    plugins?: ZenithPlugin[];
}

/**
 * Define a Zenith configuration with full type safety
 */
export function defineConfig(config: ZenithConfig): ZenithConfig {
    return config;
}
