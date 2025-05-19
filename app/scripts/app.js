// Initialize the app
document.onreadystatechange = function() {
    if (document.readyState === 'interactive') {
        console.log('Document ready, initializing app...');
        app.initialized()
            .then(function getClient(_client) {
                console.log('App initialized successfully');
                window.client = _client;
                initializeApp();
            })
            .catch(function(error) {
                console.error('Error initializing app:', error);
                handleErr(error);
            });
    }
};

// Rate limiting and request tracking
const requestTracker = {
    requests: [],
    maxRequestsPerMinute: 50,
    cleanupInterval: 60000, // 1 minute in milliseconds

    addRequest() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.cleanupInterval);
        this.requests.push(now);
        return this.requests.length <= this.maxRequestsPerMinute;
    },

    canMakeRequest() {
        return this.addRequest();
    }
};

// Request timeout handler
async function makeRequestWithTimeout(requestFn, timeout = 14000) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
    });

    try {
        if (!requestTracker.canMakeRequest()) {
            throw new Error('Rate limit exceeded. Please try again in a moment.');
        }

        return await Promise.race([requestFn(), timeoutPromise]);
    } catch (error) {
        if (error.message === 'Request timeout') {
            throw new Error('Request took too long to complete. Please try again.');
        }
        throw error;
    }
}

// Validate payload size
function validatePayloadSize(payload) {
    const payloadSize = new Blob([JSON.stringify(payload)]).size;
    const maxSize = 100 * 1024; // 100 KB in bytes
    return payloadSize <= maxSize;
}

// Helper function to format date time
function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return 'Not specified';
    const date = new Date(dateTimeStr);
    return date.toLocaleString();
}

// Helper function to get business impact details
function getBusinessImpactDetails() {
    const details = [];
    const businessQuestions = ['businessCriticality', 'customerImpact', 'financialImpact'];
    
    businessQuestions.forEach(questionName => {
        const selectedInput = document.querySelector(`input[name="${questionName}"]:checked`);
        if (selectedInput) {
            const questionLabel = document.querySelector(`label:has(input[name="${questionName}"])`).textContent.trim();
            details.push(`${questionLabel}: ${selectedInput.value.toUpperCase()}`);
        }
    });

    return details.join('\n');
}

// Helper function to get operational impact details
function getOperationalImpactDetails() {
    const details = [];
    const operationalQuestions = ['downtimeRequirement', 'resourceRequirement', 'complianceImpact'];
    
    operationalQuestions.forEach(questionName => {
        const selectedInput = document.querySelector(`input[name="${questionName}"]:checked`);
        if (selectedInput) {
            const questionLabel = document.querySelector(`label:has(input[name="${questionName}"])`).textContent.trim();
            details.push(`${questionLabel}: ${selectedInput.value.toUpperCase()}`);
        }
    });

    return details.join('\n');
}

// Risk and Impact calculation weights
const riskWeights = {
    businessCriticality: { low: 1, medium: 2, high: 3, critical: 4 },
    customerImpact: { none: 0, low: 1, medium: 2, high: 3 },
    financialImpact: { none: 0, low: 1, medium: 2, high: 3 },
    systemComplexity: { low: 1, medium: 2, high: 3 },
    changeReversibility: { easy: 1, moderate: 2, difficult: 3, irreversible: 4 },
    testingCoverage: { comprehensive: 1, partial: 2, minimal: 3, none: 4 },
    downtimeRequirement: { none: 0, scheduled: 1, extended: 2, emergency: 3 },
    resourceRequirement: { minimal: 1, moderate: 2, extensive: 3, critical: 4 },
    complianceImpact: { none: 0, low: 1, medium: 2, high: 3 }
};

// Function to calculate risk and impact levels
function calculateRiskAndImpact(questionnaireInputs) {
    // Declare all variables at the top level
    const scores = {
        business: 0,
        technical: 0,
        operational: 0
    };
    let answeredQuestions = 0;

    // Calculate scores
    questionnaireInputs.forEach(input => {
        if (input.checked) {
            const questionName = input.name;
            const answerValue = input.value;
            const weight = riskWeights[questionName][answerValue];

            if (['businessCriticality', 'customerImpact', 'financialImpact'].includes(questionName)) {
                scores.business += weight;
            } else if (['systemComplexity', 'changeReversibility', 'testingCoverage'].includes(questionName)) {
                scores.technical += weight;
            } else if (['downtimeRequirement', 'resourceRequirement', 'complianceImpact'].includes(questionName)) {
                scores.operational += weight;
            }
            answeredQuestions++;
        }
    });

    if (answeredQuestions === 0) return { risk: null, impact: null };

    // Calculate final scores
    const businessScore = scores.business / 3;
    const technicalScore = scores.technical / 3;
    const operationalScore = scores.operational / 3;

    const riskScore = (businessScore * 0.3 + technicalScore * 0.4 + operationalScore * 0.3);
    const impactScore = (businessScore * 0.6 + operationalScore * 0.4);

    // Determine risk level
    let riskLevel;
    if (riskScore >= 3.0) riskLevel = 'critical';
    else if (riskScore >= 2.0) riskLevel = 'high';
    else if (riskScore >= 1.0) riskLevel = 'medium';
    else riskLevel = 'low';

    // Determine impact level
    let impactLevel;
    if (impactScore >= 3.0) impactLevel = 'high';
    else if (impactScore >= 2.0) impactLevel = 'medium';
    else impactLevel = 'low';

    return { risk: riskLevel, impact: impactLevel };
}

// Function to update risk and impact display
function updateRiskAndImpact(questionnaireInputs, riskSelect) {
    const { risk, impact } = calculateRiskAndImpact(questionnaireInputs);
    if (!risk || !impact) return;

    riskSelect.value = risk;

    const existingIndicators = document.querySelectorAll('.risk-indicator, .impact-indicator');
    existingIndicators.forEach(indicator => indicator.remove());

    const riskIndicator = document.createElement('div');
    riskIndicator.className = `risk-indicator risk-${risk}`;
    
    const riskMessages = {
        low: 'Low Risk: Minimal risk expected. Standard procedures apply. No special approvals required.',
        medium: 'Medium Risk: Moderate risk possible. Additional review recommended. Team lead approval required.',
        high: 'High Risk: Significant risk possible. Requires thorough review and approval. Department head approval required.',
        critical: 'Critical Risk: Major risk possible. Requires executive approval. C-level approval required.'
    };

    riskIndicator.textContent = riskMessages[risk];
    
    const impactIndicator = document.createElement('div');
    impactIndicator.className = `risk-indicator impact-${impact}`;
    
    const impactMessages = {
        low: 'Low Impact: Minimal impact on business operations. Limited scope of affected systems.',
        medium: 'Medium Impact: Moderate impact on business operations. Multiple systems affected.',
        high: 'High Impact: Significant impact on business operations. Critical systems affected.'
    };

    impactIndicator.textContent = impactMessages[impact];
    
    const questionnaire = document.querySelector('.questionnaire');
    questionnaire.insertAdjacentElement('afterend', impactIndicator);
    impactIndicator.insertAdjacentElement('afterend', riskIndicator);

    const impactAnalysisTextarea = document.getElementById('impact');
    impactAnalysisTextarea.value = `Impact Analysis Summary:
Level: ${impact.toUpperCase()}

Business Impact Assessment:
${getBusinessImpactDetails()}

Operational Impact Assessment:
${getOperationalImpactDetails()}

Overall Impact: ${impactMessages[impact]}`;
}

// Cache configuration
const cacheConfig = {
    maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
    cache: new Map(),
    lastRefresh: null
};

// Retry configuration
const retryConfig = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 5000 // 5 seconds
};

// Common headers for all API requests
const commonHeaders = {
    'Content-Type': 'application/json',
    'X-Freshservice-API-Version': '2.0'
};

// Retry logic with exponential backoff
async function retryWithBackoff(fn, retries = retryConfig.maxRetries, delay = retryConfig.initialDelay) {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;
        
        // Don't retry for certain error types
        if (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404) {
            throw error;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        return retryWithBackoff(fn, retries - 1, Math.min(delay * 2, retryConfig.maxDelay));
    }
}

// Enhanced error handling
function handleApiError(error, context) {
    console.error(`Error in ${context}:`, {
        message: error.message,
        status: error.status,
        data: error.data,
        stack: error.stack
    });
    
    const errorMessages = {
        400: 'Invalid request. Please check your input.',
        401: 'Authentication failed. Please refresh the page.',
        403: 'You do not have permission to perform this action.',
        404: 'The requested resource was not found.',
        429: 'Too many requests. Please try again later.',
        500: 'Server error. Please try again later.'
    };
    
    return error.status && errorMessages[error.status] 
        ? errorMessages[error.status] 
        : 'An unexpected error occurred. Please try again.';
}

/**
 * Handle authentication errors with proper error messages
 * @param {Error} error - The error object
 * @returns {Promise<void>}
 */
async function handleAuthError(error) {
    const errorMessage = getAuthErrorMessage(error);
    console.error('Authentication error:', errorMessage);

    await notifyUserOfAuthError(errorMessage);
    await trackAuthError(error, errorMessage);
    await notifyAdminsOfAuthError(error, errorMessage);
    await clearStaleCache();
}

/**
 * Get authentication error message
 * @param {Error} error - The error object
 * @returns {string} Error message
 */
function getAuthErrorMessage(error) {
    if (!error || !error.status) {
        return 'Authentication failed: Unknown error';
    }

    const errorMessages = {
        502: 'Unable to connect to Freshservice. Please check your internet connection and try again.',
        401: 'Invalid API credentials. Please check your API key.',
        403: 'Access denied. Please check your API permissions.'
    };

    return `Authentication failed: ${errorMessages[error.status] || error.message || 'Unknown error'}`;
}

/**
 * Notify user of authentication error
 * @param {string} errorMessage - The error message
 * @returns {Promise<void>}
 */
async function notifyUserOfAuthError(errorMessage) {
    await client.interface.trigger('showNotify', {
        type: 'error',
        message: errorMessage
    });
}

/**
 * Track authentication error
 * @param {Error} error - The error object
 * @param {string} errorMessage - The error message
 */
function trackAuthError(error, errorMessage) {
    if (window.errorTracker) {
        window.errorTracker.trackError('Authentication', {
            message: errorMessage,
            originalError: error
        });
    }
}

/**
 * Notify admins of authentication error
 * @param {Error} error - The error object
 * @param {string} errorMessage - The error message
 * @returns {Promise<void>}
 */
async function notifyAdminsOfAuthError(error, errorMessage) {
    try {
        await client.request.invoke('notifyAdmins', {
            subject: 'Authentication Error',
            message: JSON.stringify({
                error: errorMessage,
                timestamp: new Date().toISOString(),
                stack: error?.stack || 'No stack trace available'
            }, null, 2)
        });
    } catch (notifyError) {
        console.error('Failed to notify admins of auth error:', notifyError);
    }
}

/**
 * Clear stale cache
 */
function clearStaleCache() {
    if (window.cacheService) {
        window.cacheService.clearCache();
    }
}

/**
 * Validate API authentication with retry logic
 * @returns {Promise<boolean>}
 */
async function validateApiAuth() {
    console.log('Validating API authentication...');
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            const response = await client.request.invokeTemplate('validateAuth', {});
            if (!response || response.status !== 200) {
                throw new Error('Authentication validation failed');
            }
            console.log('API authentication successful');
            return true;
        } catch (error) {
            retryCount++;
            console.error(`Authentication attempt ${retryCount} failed:`, error);

            if (retryCount === maxRetries) {
                await handleAuthError(error);
                return false;
            }

            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
    }

    return false;
}

// Validate API configuration
async function validateApiConfig() {
    const { iparams } = await client.data.get('iparams');
    if (!iparams.freshservice_domain || !iparams.api_key) {
        throw new Error('Missing API configuration');
    }
    return iparams;
}

// Process API response
function processApiResponse(response, type) {
    if (response && response.data) {
        window.cacheService.setCachedData(`${type}_all`, response.data);
        console.log(`Cached ${response.data.length} ${type}`);
        return response.data;
    }
    throw new Error(`Invalid response format for ${type}`);
}

// Enhanced fetch and cache with auth check
async function fetchAndCacheData(type, fetchFn) {
    try {
        await validateApiConfig();
        const response = await makeRequestWithTimeout(fetchFn);
        return processApiResponse(response, type);
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            await handleAuthError(error);
        }
        throw new Error(`Failed to fetch ${type}: ${error.message}`);
    }
}

// Configuration for data types
const DATA_TYPES = {
    users: {
        method: 'searchUsers',
        errorMessage: 'Failed to load users'
    },
    departments: {
        method: 'searchGroups',
        errorMessage: 'Failed to load departments'
    },
    services: {
        method: 'searchServices',
        errorMessage: 'Failed to load services'
    },
    assets: {
        method: 'searchAssets',
        errorMessage: 'Failed to load assets'
    }
};

// Fetch single data type
function fetchSingleType(type) {
    const config = DATA_TYPES[type];
    if (!config) return null;

    return fetchAndCacheData(type, async () => {
        return await client.request.invokeTemplate(config.method, {
            context: {
                query: '',
                page: 1,
                per_page: 100
            }
        });
    });
}

// Validate and prepare cache
async function validateAndPrepare() {
    if (!await validateApiAuth()) {
        throw { type: 'AUTH_ERROR', message: 'Authentication failed' };
    }
    return Object.keys(DATA_TYPES);
}

// Process single data type
async function processSingleType(type) {
    try {
        if (!type) {
            throw new Error('Type is required');
        }
        await fetchSingleType(type);
        return { type, success: true };
    } catch (error) {
        console.error(`Error processing type ${type}:`, error);
        return { 
            type, 
            success: false, 
            error: {
                message: error?.message || 'Unknown error',
                stack: error?.stack
            }
        };
    }
}

// Initialize cache
async function initializeCache() {
    try {
        const types = await validateAndPrepare();
        if (!types || !Array.isArray(types)) {
            throw new Error('Invalid types returned from validateAndPrepare');
        }

        const results = await Promise.all(types.map(processSingleType));
        
        const failures = results.filter(r => !r.success);
        if (failures.length > 0) {
            const errorDetails = {
                type: 'CACHE_ERROR',
                message: 'Failed to initialize cache',
                failures: failures.map(f => ({
                    type: f.type,
                    error: f.error?.message || 'Unknown error'
                }))
            };
            throw errorDetails;
        }

        cacheConfig.lastRefresh = Date.now();
        await notifySuccess('Search data loaded successfully');
    } catch (error) {
        console.error('Cache initialization error:', error);
        throw error;
    }
}

// Error reporting service
const ErrorReporter = {
    captureError(error, context = {}) {
        const errorReport = {
            timestamp: new Date().toISOString(),
            error: {
                type: error.type || 'UNKNOWN',
                message: error.message,
                stack: error.stack
            },
            context: {
                component: 'CacheSystem',
                environment: window.APP_ENV || 'production',
                ...context
            }
        };

        // Send to error tracking service if available
        if (window.errorTracker) {
            window.errorTracker.trackError(errorReport);
        }

        // Log structured error data
        this.logError(errorReport);
    },

    logError(errorReport) {
        const structuredLog = JSON.stringify(errorReport, null, 2);
        
        // Send to logging service or fallback to console
        if (window.loggingService) {
            window.loggingService.error(structuredLog);
        } else {
            // Format console output for better readability
            const formattedError = [
                '=== Error Report ===',
                `Time: ${errorReport.timestamp}`,
                `Type: ${errorReport.error.type}`,
                `Message: ${errorReport.error.message}`,
                `Component: ${errorReport.context.component}`,
                `Environment: ${errorReport.context.environment}`,
                '==================='
            ].join('\n');
            
            // Use console.info for structured logging
            console.info(formattedError);
        }
    }
};

/**
 * Format error message
 * @param {Error|string} err - The error object or message
 * @returns {string} Formatted error message
 */
function formatErrorMessage(err) {
    let errorMessage = 'An error occurred. ';
    
    if (err instanceof Error) {
        errorMessage += err.message || 'Unknown error';
    } else if (typeof err === 'string') {
        errorMessage += err;
    } else if (err && typeof err === 'object') {
        errorMessage += err.message || JSON.stringify(err);
    }

    return errorMessage;
}

/**
 * Show error notification
 * @param {string} errorMessage - The error message to show
 * @returns {Promise<void>}
 */
async function showErrorNotification(errorMessage) {
    if (!client || !client.interface) {
        console.error('Client interface not available for error notification');
        return;
    }

    try {
        await client.interface.trigger('showNotify', {
            type: 'error',
            message: errorMessage
        });
    } catch (notifyError) {
        console.error('Failed to show error notification:', notifyError);
    }
}

/**
 * Handle errors with proper error messages
 * @param {Error|string} err - The error object or message
 * @returns {Promise<void>}
 */
async function handleErr(err = 'None') {
    console.error('Error occurred. Details:', err);
    const errorMessage = formatErrorMessage(err);
    await showErrorNotification(errorMessage);
}

// Notify success
async function notifySuccess(message) {
    await client.interface.trigger('showNotify', {
        type: 'success',
        message
    });
}

// Notify error
async function notifyError(message) {
    await client.interface.trigger('showNotify', {
        type: 'error',
        message
    });
}

// Notify admins
async function notifyAdmins(subject, details) {
    try {
        await client.request.invoke('notifyAdmins', {
            subject,
            message: JSON.stringify(details, null, 2)
        });
    } catch (error) {
        ErrorReporter.captureError({
            type: 'ADMIN_NOTIFY_ERROR',
            message: 'Failed to notify administrators',
            originalError: error
        });
    }
}

// Handle cache errors with recovery attempts
async function handleCacheError(error) {
    try {
        // Clear existing cache
        window.cacheService.clearCache();
        
        // Log detailed error information for debugging
        const errorDetails = {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            cacheState: cacheConfig
        };
        
        console.error('Cache error details:', errorDetails);

        // Notify admins if critical
        if (error.message.includes('API') || error.message.includes('Authentication')) {
            await client.request.invoke('notifyAdmins', {
                subject: 'Cache Initialization Error',
                message: JSON.stringify(errorDetails, null, 2)
            }).catch(e => console.error('Failed to notify admins:', e));
        }

        // Set a flag to retry initialization later
        cacheConfig.needsRetry = true;
        cacheConfig.lastError = errorDetails;
        
    } catch (recoveryError) {
        console.error('Error recovery failed:', recoveryError);
        // Ensure the user is informed of the issue
        await client.interface.trigger('showNotify', {
            type: 'error',
            message: 'Search functionality may be limited. Please refresh the page.'
        });
    }
}

// Check if cache needs refresh
function shouldRefreshCache() {
    if (!cacheConfig.lastRefresh) return true;
    return Date.now() - cacheConfig.lastRefresh > cacheConfig.maxAge;
}

// Enhanced search functions that use cache
async function searchUsers(query) {
    console.log('Starting user search with query:', query);
    try {
        // Check if we need to refresh the cache
        if (shouldRefreshCache()) {
            await initializeCache();
        }

        // Get all users from cache
        const allUsers = window.cacheService.getCachedData('users_all') || [];
        
        // Filter users based on query
        const filteredUsers = allUsers.filter(user => 
            user.name.toLowerCase().includes(query.toLowerCase()) ||
            (user.email && user.email.toLowerCase().includes(query.toLowerCase()))
        );

        console.log(`Found ${filteredUsers.length} matching users`);
        return filteredUsers.slice(0, 10); // Return top 10 matches
    } catch (error) {
        console.error('Error in searchUsers:', error);
        const userMessage = handleApiError(error, 'user search');
        await client.interface.trigger('showNotify', {
            type: 'error',
            message: userMessage
        });
        return [];
    }
}

async function searchDepartments(query) {
    console.log('Starting department search with query:', query);
    try {
        // Check if we need to refresh the cache
        if (shouldRefreshCache()) {
            await initializeCache();
        }

        // Get all departments from cache
        const allDepartments = window.cacheService.getCachedData('departments_all') || [];
        
        // Filter departments based on query
        const filteredDepartments = allDepartments.filter(dept => 
            dept.name.toLowerCase().includes(query.toLowerCase()) ||
            (dept.description && dept.description.toLowerCase().includes(query.toLowerCase()))
        );

        console.log(`Found ${filteredDepartments.length} matching departments`);
        return filteredDepartments.slice(0, 10); // Return top 10 matches
    } catch (error) {
        console.error('Error in searchDepartments:', error);
        const userMessage = handleApiError(error, 'department search');
        await client.interface.trigger('showNotify', {
            type: 'error',
            message: userMessage
        });
        return [];
    }
}

async function searchItems(query) {
    console.log('Starting items search with query:', query);
    try {
        // Check if we need to refresh the cache
        if (shouldRefreshCache()) {
            await initializeCache();
        }

        // Get all services and assets from cache
        const allServices = window.cacheService.getCachedData('services_all') || [];
        const allAssets = window.cacheService.getCachedData('assets_all') || [];
        
        // Filter services and assets based on query
        const filteredServices = allServices.filter(service => 
            service.name.toLowerCase().includes(query.toLowerCase()) ||
            (service.description && service.description.toLowerCase().includes(query.toLowerCase()))
        ).map(service => ({ ...service, type: 'service' }));

        const filteredAssets = allAssets.filter(asset => 
            asset.name.toLowerCase().includes(query.toLowerCase()) ||
            (asset.description && asset.description.toLowerCase().includes(query.toLowerCase()))
        ).map(asset => ({ ...asset, type: 'asset' }));

        const items = [...filteredServices, ...filteredAssets];
        console.log(`Found ${items.length} matching items`);
        return items.slice(0, 10); // Return top 10 matches
    } catch (error) {
        console.error('Error in searchItems:', error);
        const userMessage = handleApiError(error, 'item search');
        await client.interface.trigger('showNotify', {
            type: 'error',
            message: userMessage
        });
        return [];
    }
}

/**
 * Create HTML for a user item
 * @param {Object} item - User item data
 * @returns {string} HTML string
 */
function createUserItemHtml(item) {
    return `
        <div class="user-info">
            <div class="user-name">${item.display_name || item.name}</div>
            <div class="user-type">${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</div>
            ${item.email ? `<div class="user-email">${item.email}</div>` : ''}
        </div>
    `;
}

/**
 * Create HTML for a service/asset item
 * @param {Object} item - Service/asset item data
 * @returns {string} HTML string
 */
function createServiceItemHtml(item) {
    return `
        <div class="user-info">
            <div class="user-name">${item.name}</div>
            <div class="user-email">${item.type}</div>
        </div>
    `;
}

/**
 * Handle item selection
 * @param {Object} item - Selected item
 * @param {HTMLElement} container - Results container
 * @param {Set} selectedList - List of selected items
 */
function handleItemSelection(item, container, selectedList) {
    console.log('Item selected:', item);
    if (selectedList) {
        if (!selectedList.has(item.id)) {
            selectedList.add(item.id);
            updateSelectedServices(selectedList);
        }
    } else {
        // For user selection, update the input value
        const searchInput = container.closest('.form-group').querySelector('input[type="text"]');
        const valueInput = container.closest('.form-group').querySelector('input[type="hidden"]');
        if (searchInput && valueInput) {
            searchInput.value = item.display_name || item.name;
            valueInput.value = item.id;
        }
    }
    container.classList.remove('active');
}

/**
 * Display search results
 * @param {Array} items - Array of items to display
 * @param {HTMLElement} container - Container to display results in
 * @param {Set} selectedList - List of selected items
 */
async function displayItemResults(items, container, selectedList) {
    try {
        await Promise.resolve();
        container.innerHTML = '';
        
        if (!Array.isArray(items)) {
            console.error('Invalid items data:', items);
            container.innerHTML = '<div class="no-results">Error: Invalid data format</div>';
            return;
        }
        
        if (items.length === 0) {
            console.log('No items found to display');
            container.innerHTML = '<div class="no-results">No items found</div>';
            return;
        }

        console.log('Rendering items:', items);
        items.forEach(item => {
            if (!item || !item.id || !item.name) {
                console.error('Invalid item data:', item);
                return;
            }

            const div = document.createElement('div');
            div.className = 'lookup-item';
            div.innerHTML = (item.type === 'agent' || item.type === 'requester') 
                ? createUserItemHtml(item)
                : createServiceItemHtml(item);
            
            div.addEventListener('click', () => handleItemSelection(item, container, selectedList));
            container.appendChild(div);
        });
        
        container.classList.add('active');
    } catch (error) {
        console.error('Error in displayItemResults:', {
            error: error,
            message: error.message,
            stack: error.stack
        });
        container.innerHTML = '<div class="no-results">Error displaying results</div>';
    }
}

/**
 * Update search status
 * @param {HTMLElement} statusElement - Status element
 * @param {string} message - Status message
 * @param {string} className - Status class
 */
function updateSearchStatus(statusElement, message, className) {
    statusElement.innerHTML = message;
    statusElement.className = `search-status ${className}`;
}

/**
 * Handle search results
 * @param {Array} results - Search results
 * @param {HTMLElement} resultsContainer - Results container
 * @param {HTMLElement} statusElement - Status element
 * @param {string} type - Search type
 * @param {Set} selectedList - List of selected items
 */
async function handleSearchResults(results, resultsContainer, statusElement, type, selectedList) {
    if (!Array.isArray(results)) {
        throw new Error(`Invalid results format for ${type} search`);
    }

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
        updateSearchStatus(statusElement, 'No results found', '');
    } else {
        await displayItemResults(results, resultsContainer, selectedList);
        updateSearchStatus(statusElement, `Found ${results.length} results`, 'success');
        console.log('Results displayed successfully');
    }
}

/**
 * Handle search input
 * @param {Event} e - Input event
 * @param {HTMLElement} searchInput - Search input element
 * @param {HTMLElement} resultsContainer - Results container
 * @param {HTMLElement} valueInput - Value input element
 * @param {Function} searchFn - Search function
 * @param {string} type - Search type
 * @param {Set} selectedList - List of selected items
 */
async function handleSearchInput(e, searchInput, resultsContainer, valueInput, searchFn, type, selectedList = null) {
    console.log(`Starting search for ${type}...`);
    const query = e.target.value.trim();
    const statusElement = document.getElementById(`${type}Status`);
    
    if (!statusElement) {
        console.warn(`Status element for ${type} not found`);
        return;
    }

    if (query.length < 2) {
        console.log('Query too short, clearing results');
        resultsContainer.innerHTML = '';
        updateSearchStatus(statusElement, '', '');
        return;
    }

    try {
        updateSearchStatus(statusElement, 'Searching...', 'loading');
        console.log(`Making API request for ${type} search...`);
        
        const results = await searchFn(query, client);
        console.log(`Received ${results.length} results for ${type}`);
        
        await handleSearchResults(results, resultsContainer, statusElement, type, selectedList);

        // Log cache statistics
        const cacheStats = window.cacheService.getCacheStats();
        console.log('Cache statistics:', cacheStats);
    } catch (error) {
        console.error(`Error in ${type} search:`, error);
        resultsContainer.innerHTML = '<div class="error">Error performing search</div>';
        updateSearchStatus(statusElement, error.message || 'Error performing search', 'error');
        
        await client.interface.trigger('showNotify', {
            type: 'error',
            message: `Failed to search ${type}: ${error.message || 'Unknown error'}`
        });
    }
}

async function updateSelectedServices(selectedList) {
    await Promise.resolve();
    const container = document.getElementById('selectedServices');
    container.innerHTML = '';
    
    selectedList.forEach(id => {
        const div = document.createElement('div');
        div.className = 'selected-service';
        div.innerHTML = `
            <span>${id}</span>
            <button type="button" class="remove-service" data-id="${id}">×</button>
        `;
        
        div.querySelector('.remove-service').addEventListener('click', () => {
            selectedList.delete(id);
            updateSelectedServices(selectedList);
        });
        
        container.appendChild(div);
    });
}

// Handle form submission
async function handleFormSubmission(formData, calculateRiskAndImpact) {
    const changeRequest = {};
    
    for (const [key, value] of formData.entries()) {
        changeRequest[key] = value;
    }

    // Ensure workspace is set to CXI Change Management
    changeRequest.workspace = 'CXI Change Management';

    const { risk, impact } = calculateRiskAndImpact(document.querySelectorAll('.questionnaire input[type="radio"]'));
    changeRequest.calculatedRisk = risk;
    changeRequest.calculatedImpact = impact;

    const changePayload = {
        change: {
            subject: changeRequest.subject,
            description: changeRequest.description,
            risk: changeRequest.calculatedRisk,
            impact: changeRequest.calculatedImpact,
            change_type: changeRequest.changeType,
            requester_id: parseInt(changeRequest.requester),
            group_id: parseInt(changeRequest.department),
            planned_start_date: changeRequest.plannedStart,
            planned_end_date: changeRequest.plannedEnd,
            custom_fields: {
                workspace: 'CXI Change Management', // Hardcoded value
                implementation_group: changeRequest.implementationGroup,
                maintenance_window: changeRequest.maintenanceWindow,
                associated_assets: JSON.parse(changeRequest.associatedAssets || '[]'),
                impact_analysis: changeRequest.impact,
                rollout_plan: changeRequest.rolloutPlan,
                rollback_plan: changeRequest.rollbackPlan,
                potential_impact: changeRequest.potentialImpact
            }
        }
    };

    if (!validatePayloadSize(changePayload)) {
        throw new Error('Change request payload exceeds size limit. Please reduce the content size.');
    }

    try {
        const response = await client.request.invokeTemplate('createChange', {
            body: JSON.stringify(changePayload)
        });

        if (response.status === 201) {
            return { changeRequest, changePayload, response: response.data };
        } else {
            throw new Error('Failed to create change request');
        }
    } catch (error) {
        console.error('Error creating change request:', error);
        throw error;
    }
}

// Validation functions
function validateWeight(value) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 1;
}

function validateThreshold(value) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
}

function validateTime(value) {
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

// Split validateConfiguration into smaller functions
async function validateDomain(domain) {
    if (!domain) {
        await client.interface.trigger('showNotify', {
            type: 'error',
            message: 'Freshservice domain is required'
        });
        return false;
    }
    return true;
}

async function validateConfiguration() {
    try {
        const { iparams } = await client.data.get('iparams');
        
        // Validate domain and API key
        if (!iparams.freshservice_domain) {
            await client.interface.trigger('showNotify', {
                type: 'error',
                message: 'Freshservice domain is required'
            });
            return false;
        }

        if (!iparams.api_key) {
            await client.interface.trigger('showNotify', {
                type: 'error',
                message: 'API key is required'
            });
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error validating configuration:', error);
        await client.interface.trigger('showNotify', {
            type: 'error',
            message: 'Error validating configuration'
        });
        return false;
    }
}

// Setup form elements with validation
function setupFormElements() {
    console.log('Setting up form elements...');
    const elements = {
        form: document.getElementById('changeRequestForm'),
        riskSelect: document.getElementById('risk'),
        questionnaireInputs: document.querySelectorAll('.questionnaire input[type="radio"]'),
        requesterSearch: document.getElementById('requesterSearch'),
        requesterInput: document.getElementById('requester'),
        requesterResults: document.getElementById('requesterResults'),
        departmentSearch: document.getElementById('departmentSearch'),
        departmentInput: document.getElementById('department'),
        departmentResults: document.getElementById('departmentResults'),
        serviceSearch: document.getElementById('serviceSearch'),
        serviceResults: document.getElementById('serviceResults')
    };

    // Log missing elements
    Object.entries(elements).forEach(([key, element]) => {
        if (!element) {
            console.warn(`Warning: Element '${key}' not found in DOM`);
        }
    });

    // Validate critical elements
    const criticalElements = ['form', 'requesterInput', 'departmentInput'];
    const missingCriticalElements = criticalElements.filter(key => !elements[key]);
    
    if (missingCriticalElements.length > 0) {
        console.error('Critical elements missing:', missingCriticalElements);
        throw new Error(`Critical elements missing: ${missingCriticalElements.join(', ')}`);
    }

    console.log('Form elements setup complete');
    return elements;
}

function setupWorkspaceField() {
    const workspaceInput = document.getElementById('workspace');
    if (workspaceInput) {
        workspaceInput.value = 'CXI Change Management';
        workspaceInput.readOnly = true;
        workspaceInput.style.backgroundColor = '#f5f5f5';
        workspaceInput.style.cursor = 'not-allowed';
    }
}

/**
 * Setup search event listeners
 * @param {Object} elements - Form elements
 * @param {Set} selectedServicesList - List of selected services
 */
function setupSearchEventListeners(elements, selectedServicesList) {
    console.log('Setting up search event listeners...');
    
    try {
        setupRequesterSearch(elements);
        setupDepartmentSearch(elements);
        setupServiceSearch(elements, selectedServicesList);
    } catch (error) {
        console.error('Error in setupSearchEventListeners:', error);
        throw error;
    }
}

// Setup requester search
function setupRequesterSearch(elements) {
    if (!elements.requesterSearch || !elements.requesterResults || !elements.requesterInput) {
        console.warn('Warning: Missing elements for requester search');
        return;
    }
    
    setupSearchEventListener(
        elements.requesterSearch,
        elements.requesterResults,
        elements.requesterInput,
        searchUsers,
        'user'
    );
}

// Setup department search
function setupDepartmentSearch(elements) {
    if (!elements.departmentSearch || !elements.departmentResults || !elements.departmentInput) {
        console.warn('Warning: Missing elements for department search');
        return;
    }
    
    setupSearchEventListener(
        elements.departmentSearch,
        elements.departmentResults,
        elements.departmentInput,
        searchDepartments,
        'department'
    );
}

// Setup service search
function setupServiceSearch(elements, selectedServicesList) {
    if (!elements.serviceSearch || !elements.serviceResults) {
        console.warn('Warning: Missing elements for service search');
        return;
    }
    
    setupSearchEventListener(
        elements.serviceSearch,
        elements.serviceResults,
        null,
        searchItems,
        'service',
        selectedServicesList
    );
}

// Setup click outside handlers
function setupClickOutsideHandlers(elements) {
    document.addEventListener('click', function(e) {
        if (elements.requesterResults && !e.target.closest('.user-lookup')) {
            elements.requesterResults.classList.remove('active');
        }
        if (elements.departmentResults && !e.target.closest('.department-lookup')) {
            elements.departmentResults.classList.remove('active');
        }
        if (elements.serviceResults && !e.target.closest('.service-lookup')) {
            elements.serviceResults.classList.remove('active');
        }
    });
}

// Setup form submission handler
function setupFormSubmissionHandler(elements, selectedServicesList) {
    if (!elements.form) return;

    elements.form.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!elements.requesterInput.value) {
            await client.interface.trigger('showNotify', {
                type: 'error',
                message: 'Please select a requester'
            });
            return;
        }
        if (!elements.departmentInput.value) {
            await client.interface.trigger('showNotify', {
                type: 'error',
                message: 'Please select a department'
            });
            return;
        }
        try {
            const formData = new FormData(elements.form);
            const { changeRequest, changePayload } = await handleFormSubmission(formData, calculateRiskAndImpact);
            const result = await showChangeConfirmation(changeRequest);
            if (result === "Save") {
                const response = await makeRequestWithTimeout(async () => {
                    return await client.request.invokeTemplate('createChange', {
                        body: JSON.stringify(changePayload)
                    });
                });
                
                if (response.status === 201) {
                    const changeData = response.data;
                    await client.interface.trigger('showNotify', {
                        type: 'success',
                        message: `Change request created successfully with ID: ${changeData.id}`
                    });
                    elements.form.reset();
                    selectedServicesList.clear();
                    updateSelectedServices(selectedServicesList);
                }
            }
        } catch (error) {
            await handleErr(error);
        }
    });
}

// Setup questionnaire listeners
function setupQuestionnaireListeners(elements) {
    if (elements.questionnaireInputs && elements.riskSelect) {
        elements.questionnaireInputs.forEach(input => {
            input.addEventListener('change', () => {
                console.log('Questionnaire input changed, updating risk and impact...');
                updateRiskAndImpact(elements.questionnaireInputs, elements.riskSelect);
            });
        });
    }
}

/**
 * Initialize the application with proper error handling
 */
function initializeApp() {
    console.log('Starting app initialization...');
    
    // Validate authentication before proceeding
    validateApiAuth()
        .then(async (isAuthenticated) => {
            if (!isAuthenticated) {
                console.error('Authentication validation failed');
                return;
            }

            try {
                // Initialize cache
                await initializeCache();
                console.log('Cache initialized successfully');

                // Setup form elements with validation
                const elements = setupFormElements();
                if (!elements) {
                    throw new Error('Failed to setup form elements');
                }
                
                // Setup workspace field
                setupWorkspaceField();
                console.log('Workspace field setup complete');

                // Initialize selected services list
                const selectedServicesList = new Set();

                // Setup all event listeners with error handling
                setupSearchEventListeners(elements, selectedServicesList);
                console.log('Search handlers setup complete');

                setupClickOutsideHandlers(elements);
                console.log('Click outside handlers setup complete');

                setupFormSubmissionHandler(elements, selectedServicesList);
                console.log('Form submission handler setup complete');

                setupQuestionnaireListeners(elements);
                console.log('Questionnaire listeners setup complete');
            } catch (error) {
                console.error('Error during app initialization:', error);
                handleErr(error);
            }
        })
        .catch(error => {
            console.error('Error during app initialization:', error);
            handleErr(error);
        });
}

// App lifecycle handlers
async function onInstallHandler() {
    try {
        await client.interface.trigger('showNotify', {
            type: 'success',
            message: 'App installed successfully'
        });
    } catch (error) {
        console.error('Error during app installation:', error);
        await client.interface.trigger('showNotify', {
            type: 'error',
            message: 'Failed to install app. Please check your configuration.'
        });
    }
}

async function onUninstallHandler() {
    try {
        await client.interface.trigger('showNotify', {
            type: 'success',
            message: 'App uninstalled successfully'
        });
    } catch (error) {
        console.error('Error during app uninstallation:', error);
    }
}

async function showChangeConfirmation(changeRequest) {
    let confirmationMessage = `Change Request Details:\nSubject: ${changeRequest.subject}\nChange Type: ${changeRequest.changeType}\nRisk Level: ${changeRequest.calculatedRisk.toUpperCase()}\nImpact Level: ${changeRequest.calculatedImpact.toUpperCase()}\nPlanned Start: ${formatDateTime(changeRequest.plannedStart)}\nPlanned End: ${formatDateTime(changeRequest.plannedEnd)}`;
    if (changeRequest.calculatedRisk === 'high' || changeRequest.calculatedRisk === 'critical') {
        confirmationMessage += `\n\n⚠️ WARNING: This change has been assessed as ${changeRequest.calculatedRisk.toUpperCase()} risk. CAB approval may be required before implementation.`;
    }
    return await client.interface.trigger("showConfirm", {
        title: "Confirm Change Request",
        message: confirmationMessage,
        saveLabel: "Submit",
        cancelLabel: "Cancel"
    });
}

async function showNotify(type, message) {
    await client.interface.trigger('showNotify', { type, message });
}
