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
    try {
        const cached = CACHE_CONFIG.cache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.maxAge) {
            CACHE_CONFIG.stats.hits++;
            return cached.data;
        }
        CACHE_CONFIG.stats.misses++;
        return null;
    } catch (error) {
        console.error('Error retrieving cached data:', error);
        return null;
    }
}

/**
 * Set data in cache with size management
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
function setCachedData(key, data) {
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
    } catch (error) {
        console.error('Error setting cached data:', error);
    }
}

/**
 * Invalidate cache entries
 * @param {string} [type] - Optional type to invalidate specific cache entries
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
    } catch (error) {
        console.error('Error invalidating cache:', error);
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
        hitRate: CACHE_CONFIG.stats.hitRate
    };
}

/**
 * Clear cache statistics
 */
function clearCacheStats() {
    CACHE_CONFIG.stats.hits = 0;
    CACHE_CONFIG.stats.misses = 0;
}

app.modules.services.cache = {
    getCachedData,
    setCachedData,
    invalidateCache,
    getCacheStats,
    clearCacheStats
}; 