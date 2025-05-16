/**
 * Search Service for Freshservice Custom App
 * Handles all search-related functionality with caching
 */

/**
 * Search users in Freshservice
 * @param {string} query - Search query
 * @param {Object} client - Freshworks client instance
 * @returns {Promise<Array>} Array of user results
 */
async function searchUsers(query, client) {
    console.log('Starting user search with query:', query);
    try {
        const cacheKey = `users_${query}`;
        const cachedData = window.cacheService.getCachedData(cacheKey);
        
        if (cachedData) {
            console.log('Returning cached user data:', cachedData);
            return cachedData;
        }

        console.log('Making API request for users...');
        await client.interface.trigger('showNotify', {
            type: 'info',
            message: 'Searching users...'
        });

        const response = await client.request.invoke('searchUsers', {
            query: {
                query: query,
                page: 1,
                per_page: 10
            }
        });

        if (!response || !response.data) {
            throw new Error('Invalid response format from users API');
        }

        const users = Array.isArray(response.data) ? response.data : [];
        console.log('Processed user search results:', users);
        
        window.cacheService.setCachedData(cacheKey, users);
        return users;
    } catch (error) {
        console.error('Error in searchUsers:', error);
        throw error;
    }
}

/**
 * Search departments in Freshservice
 * @param {string} query - Search query
 * @param {Object} client - Freshworks client instance
 * @returns {Promise<Array>} Array of department results
 */
async function searchDepartments(query, client) {
    console.log('Starting department search with query:', query);
    try {
        const cacheKey = `departments_${query}`;
        const cachedData = window.cacheService.getCachedData(cacheKey);
        
        if (cachedData) {
            console.log('Returning cached department data:', cachedData);
            return cachedData;
        }

        console.log('Making API request for departments...');
        await client.interface.trigger('showNotify', {
            type: 'info',
            message: 'Searching departments...'
        });

        const response = await client.request.invoke('searchGroups', {
            query: {
                query: query,
                page: 1,
                per_page: 10
            }
        });

        if (!response || !response.data) {
            throw new Error('Invalid response format from groups API');
        }

        const departments = Array.isArray(response.data) ? response.data : [];
        console.log('Processed department search results:', departments);
        
        window.cacheService.setCachedData(cacheKey, departments);
        return departments;
    } catch (error) {
        console.error('Error in searchDepartments:', error);
        throw error;
    }
}

/**
 * Search services and assets in Freshservice
 * @param {string} query - Search query
 * @param {Object} client - Freshworks client instance
 * @returns {Promise<Array>} Array of service and asset results
 */
async function searchItems(query, client) {
    console.log('Starting items search with query:', query);
    try {
        const cacheKey = `items_${query}`;
        const cachedData = window.cacheService.getCachedData(cacheKey);
        
        if (cachedData) {
            console.log('Returning cached items data:', cachedData);
            return cachedData;
        }

        console.log('Making API requests for services and assets...');
        await client.interface.trigger('showNotify', {
            type: 'info',
            message: 'Searching items...'
        });

        const [servicesResponse, assetsResponse] = await Promise.all([
            client.request.invoke('searchServices', {
                query: { query, page: 1, per_page: 5 }
            }),
            client.request.invoke('searchAssets', {
                query: { query, page: 1, per_page: 5 }
            })
        ]);

        if (!servicesResponse?.data || !assetsResponse?.data) {
            throw new Error('Invalid response format from services/assets API');
        }

        const services = Array.isArray(servicesResponse.data) ? servicesResponse.data : [];
        const assets = Array.isArray(assetsResponse.data) ? assetsResponse.data : [];

        const items = [
            ...services.map(service => ({ ...service, type: 'service' })),
            ...assets.map(asset => ({ ...asset, type: 'asset' }))
        ];

        window.cacheService.setCachedData(cacheKey, items);
        return items;
    } catch (error) {
        console.error('Error in searchItems:', error);
        throw error;
    }
}

/**
 * Clear all search-related cache
 */
function clearSearchCache() {
    window.cacheService.invalidateCache('users');
    window.cacheService.invalidateCache('departments');
    window.cacheService.invalidateCache('items');
}

// Export the search service functions
window.searchService = {
    searchUsers,
    searchDepartments,
    searchItems,
    clearSearchCache
}; 