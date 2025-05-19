/**
 * Cache Service for Freshservice Custom App
 * Implements caching with size limits, statistics, and proper error handling
 */

const CACHE_CONFIG = {
    maxAge: 5 * 60 * 1000, // 5 minutes in milliseconds
    maxSize: 100, // Maximum number of cached items
    cache: new Map(),
    stats: {
        hits: 0,
        misses: 0,
        errors: 0,
        get hitRate() {
            const total = this.hits + this.misses;
            return total ? (this.hits / total) * 100 : 0;
        }
    }
};

/**
 * Get cached data for a given key
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if not found/expired
 */
function getCachedData(key) {
    if (!key) {
        console.warn('Attempted to get cached data with invalid key');
        return null;
    }

    try {
        const cached = CACHE_CONFIG.cache.get(key);
        if (!cached) {
            CACHE_CONFIG.stats.misses++;
            return null;
        }

        if (Date.now() - cached.timestamp > CACHE_CONFIG.maxAge) {
            CACHE_CONFIG.cache.delete(key);
            CACHE_CONFIG.stats.misses++;
            return null;
        }

        CACHE_CONFIG.stats.hits++;
        return cached.data;
    } catch (error) {
        CACHE_CONFIG.stats.errors++;
        console.error('Error retrieving cached data:', error);
        return null;
    }
}

/**
 * Set data in cache with size management
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @returns {boolean} Success status
 */
function setCachedData(key, data) {
    if (!key || data === undefined) {
        console.warn('Attempted to cache invalid data:', { key, data });
        return false;
    }

    try {
        // Check cache size and remove oldest entries if needed
        if (CACHE_CONFIG.cache.size >= CACHE_CONFIG.maxSize) {
            const oldestKey = Array.from(CACHE_CONFIG.cache.entries())
                .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
            CACHE_CONFIG.cache.delete(oldestKey);
        }
        
        CACHE_CONFIG.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        return true;
    } catch (error) {
        CACHE_CONFIG.stats.errors++;
        console.error('Error setting cached data:', error);
        return false;
    }
}

/**
 * Invalidate cache entries
 * @param {string} [type] - Optional type to invalidate specific cache entries
 * @returns {boolean} Success status
 */
function invalidateCache(type = null) {
    try {
        if (type) {
            // Invalidate specific type of cache
            for (const key of CACHE_CONFIG.cache.keys()) {
                if (key.startsWith(`${type}_`)) {
                    CACHE_CONFIG.cache.delete(key);
                }
            }
        } else {
            // Invalidate all cache
            CACHE_CONFIG.cache.clear();
        }
        return true;
    } catch (error) {
        CACHE_CONFIG.stats.errors++;
        console.error('Error invalidating cache:', error);
        return false;
    }
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
    return {
        size: CACHE_CONFIG.cache.size,
        hits: CACHE_CONFIG.stats.hits,
        misses: CACHE_CONFIG.stats.misses,
        errors: CACHE_CONFIG.stats.errors,
        hitRate: CACHE_CONFIG.stats.hitRate
    };
}

/**
 * Clear cache statistics
 */
function clearCacheStats() {
    CACHE_CONFIG.stats.hits = 0;
    CACHE_CONFIG.stats.misses = 0;
    CACHE_CONFIG.stats.errors = 0;
}

// Export the cache service functions
window.cacheService = {
    getCachedData,
    setCachedData,
    invalidateCache,
    getCacheStats,
    clearCacheStats
}; 