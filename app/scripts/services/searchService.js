/**
 * Search Service for Freshservice Custom App
 * Handles all search-related functionality with caching
 */

/**
 * Process API response data for users
 * @param {Array} data - Raw API response data
 * @param {string} type - Type of user ('agent' or 'requester')
 * @returns {Array} Processed user data
 */
function processUserData(data, type) {
    return Array.isArray(data) ? data.map(user => ({
        ...user,
        type,
        display_name: `${user.first_name} ${user.last_name}`.trim(),
        email: user.email || user.contact?.email || '',
        phone: user.phone || user.contact?.phone || '',
        department: user.department || ''
    })) : [];
}

/**
 * Make API request for users
 * @param {Object} client - Freshworks client instance
 * @param {string} endpoint - API endpoint to call
 * @param {string} query - Search query
 * @returns {Promise<Object>} API response
 */
async function makeUserApiRequest(client, endpoint, query) {
    console.log(`Sending request to ${endpoint}...`);
    const response = await client.request.invoke(endpoint, {
        query: {
            query,
            page: 1,
            per_page: 5,
            include: 'contact'
        }
    });
    console.log(`${endpoint} API Response:`, {
        status: response.status,
        data: response.data,
        headers: response.headers
    });
    return response;
}

/**
 * Cache user search results
 * @param {string} cacheKey - Cache key
 * @param {Array} users - User data to cache
 */
function cacheUserResults(cacheKey, users) {
    if (users.length > 0) {
        try {
            window.cacheService.setCachedData(cacheKey, users);
            console.log('Successfully cached user results');
        } catch (cacheError) {
            console.error('Failed to cache users:', cacheError);
        }
    }
}

/**
 * Search users in Freshservice (both agents and requesters)
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

        await client.interface.trigger('showNotify', {
            type: 'info',
            message: 'Searching users...'
        });

        const [agentsResponse, requestersResponse] = await Promise.all([
            makeUserApiRequest(client, 'searchUsers', query),
            makeUserApiRequest(client, 'searchRequesters', query)
        ]);

        if (!agentsResponse || !requestersResponse) {
            throw new Error('Invalid response from API');
        }

        const agents = processUserData(agentsResponse.data, 'agent');
        const requesters = processUserData(requestersResponse.data, 'requester');
        const users = [...agents, ...requesters].sort((a, b) => 
            a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase())
        );

        cacheUserResults(cacheKey, users);
        return users;
    } catch (error) {
        console.error('Error in searchUsers:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response
        });
        await client.interface.trigger('showNotify', {
            type: 'error',
            message: error.message || 'Failed to search users'
        });
        return [];
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
 * Process API response data for items
 * @param {Array} data - Raw API response data
 * @param {string} type - Type of item ('service' or 'asset')
 * @returns {Array} Processed item data
 */
function processItemData(data, type) {
    return Array.isArray(data) ? data.map(item => ({
        ...item,
        type
    })) : [];
}

/**
 * Make API request for items
 * @param {Object} client - Freshworks client instance
 * @param {string} endpoint - API endpoint to call
 * @param {string} query - Search query
 * @returns {Promise<Object>} API response
 */
function makeItemApiRequest(client, endpoint, query) {
    return client.request.invoke(endpoint, {
        query: { query, page: 1, per_page: 5 }
    });
}

/**
 * Cache item search results
 * @param {string} cacheKey - Cache key
 * @param {Array} items - Item data to cache
 */
function cacheItemResults(cacheKey, items) {
    if (items.length > 0) {
        try {
            window.cacheService.setCachedData(cacheKey, items);
        } catch (cacheError) {
            console.error('Failed to cache items:', cacheError);
        }
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

        await client.interface.trigger('showNotify', {
            type: 'info',
            message: 'Searching items...'
        });

        const [servicesResponse, assetsResponse] = await Promise.all([
            makeItemApiRequest(client, 'searchServices', query),
            makeItemApiRequest(client, 'searchAssets', query)
        ]);

        if (!servicesResponse || !assetsResponse) {
            throw new Error('Invalid response from API');
        }

        const services = processItemData(servicesResponse.data, 'service');
        const assets = processItemData(assetsResponse.data, 'asset');
        const items = [...services, ...assets];

        cacheItemResults(cacheKey, items);
        return items;
    } catch (error) {
        console.error('Error in searchItems:', error);
        await client.interface.trigger('showNotify', {
            type: 'error',
            message: error.message || 'Failed to search items'
        });
        return [];
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