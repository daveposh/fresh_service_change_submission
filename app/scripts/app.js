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
    maxAge: 5 * 60 * 1000, // 5 minutes in milliseconds
    cache: new Map()
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

// Cache management functions
function getCachedData(key) {
    const cached = cacheConfig.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cacheConfig.maxAge) {
        return cached.data;
    }
    return null;
}

function setCachedData(key, data) {
    cacheConfig.cache.set(key, {
        data,
        timestamp: Date.now()
    });
}

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

// Enhanced API request logging
async function makeApiRequest(method, endpoint, options = {}) {
    console.log(`Making API request: ${method} ${endpoint}`, {
        headers: options.headers,
        query: options.query,
        body: options.body
    });

    try {
        const response = await client.request.invoke(method, endpoint, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic <%= iparam.api_key %>`
            },
            ...options
        });

        console.log(`API response for ${method} ${endpoint}:`, {
            status: response.status,
            data: response.data
        });

        if (response.status >= 400) {
            throw { status: response.status, message: response.data };
        }

        return response;
    } catch (error) {
        console.error('API request failed:', {
            method,
            endpoint,
            error: {
                message: error.message,
                status: error.status,
                data: error.data,
                stack: error.stack
            }
        });
        throw error;
    }
}

// User lookup functionality
async function searchUsers(query) {
    console.log('Starting user search with query:', query);
    try {
        const cacheKey = `users_${query}`;
        const cachedData = getCachedData(cacheKey);
        
        if (cachedData) {
            console.log('Returning cached user data:', cachedData);
            return cachedData;
        }

        console.log('Making API request for users...');
        await client.interface.trigger('showNotify', {
            type: 'info',
            message: 'Searching users...'
        });

        const response = await makeRequestWithTimeout(async () => {
            console.log('Initiating user search API call...');
            return await client.request.invoke('searchUsers', {
                query: {
                    query: query,
                    page: 1,
                    per_page: 10
                }
            });
        });

        if (!response || !response.data) {
            console.error('Invalid response format:', response);
            throw new Error('Invalid response format from users API');
        }

        const users = Array.isArray(response.data) ? response.data : [];
        console.log('Processed user search results:', users);
        
        setCachedData(cacheKey, users);
        return users;
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

// Department lookup functionality
async function searchDepartments(query) {
    console.log('Starting department search with query:', query);
    try {
        const cacheKey = `departments_${query}`;
        const cachedData = getCachedData(cacheKey);
        
        if (cachedData) {
            console.log('Returning cached department data:', cachedData);
            return cachedData;
        }

        console.log('Making API request for departments...');
        await client.interface.trigger('showNotify', {
            type: 'info',
            message: 'Searching departments...'
        });

        const response = await makeRequestWithTimeout(async () => {
            console.log('Initiating department search API call...');
            return await client.request.invoke('searchGroups', {
                query: {
                    query: query,
                    page: 1,
                    per_page: 10
                }
            });
        });

        if (!response || !response.data) {
            console.error('Invalid response format:', response);
            throw new Error('Invalid response format from groups API');
        }

        const departments = Array.isArray(response.data) ? response.data : [];
        console.log('Processed department search results:', departments);
        
        setCachedData(cacheKey, departments);
        return departments;
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

// Service and Asset lookup functionality
async function searchItems(query) {
    console.log('Starting items search with query:', query);
    try {
        const cacheKey = `items_${query}`;
        const cachedData = getCachedData(cacheKey);
        
        if (cachedData) {
            console.log('Returning cached items data:', cachedData);
            return cachedData;
        }

        console.log('Making API requests for services and assets...');
        await client.interface.trigger('showNotify', {
            type: 'info',
            message: 'Searching items...'
        });

        const response = await makeRequestWithTimeout(async () => {
            console.log('Initiating services and assets API calls...');
            const [servicesResponse, assetsResponse] = await Promise.all([
                client.request.invoke('searchServices', {
                    query: { query, page: 1, per_page: 5 }
                }),
                client.request.invoke('searchAssets', {
                    query: { query, page: 1, per_page: 5 }
                })
            ]);

            if (!servicesResponse || !servicesResponse.data || !assetsResponse || !assetsResponse.data) {
                throw new Error('Invalid response format from services/assets API');
            }

            const services = Array.isArray(servicesResponse.data) ? servicesResponse.data : [];
            const assets = Array.isArray(assetsResponse.data) ? assetsResponse.data : [];

            const items = [
                ...services.map(service => ({ ...service, type: 'service' })),
                ...assets.map(asset => ({ ...asset, type: 'asset' }))
            ];

            setCachedData(cacheKey, items);
            return items;
        });

        return response;
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

// Display search results with error handling
async function displayItemResults(items, container, selectedList) {
    console.log('Displaying item results:', { items, container, selectedList });
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
        } else {
            console.log('Rendering items:', items);
            items.forEach(item => {
                if (!item || !item.id || !item.name) {
                    console.error('Invalid item data:', item);
                    return;
                }

                const div = document.createElement('div');
                div.className = 'lookup-item';
                div.innerHTML = `
                    <div class="user-info">
                        <div class="user-name">${item.name}</div>
                        <div class="user-email">${item.type}</div>
                    </div>
                `;
                
                div.addEventListener('click', () => {
                    console.log('Item selected:', item);
                    if (!selectedList.has(item.id)) {
                        selectedList.add(item.id);
                        updateSelectedServices(selectedList);
                    }
                    container.classList.remove('active');
                });
                
                container.appendChild(div);
            });
        }
        
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

// Form submission handler
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
        
        // Validate domain
        if (!await validateDomain(iparams.freshservice_domain)) {
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

// Split initializeApp into smaller functions
function setupFormElements() {
    const form = document.getElementById('changeRequestForm');
    const riskSelect = document.getElementById('risk');
    const questionnaireInputs = document.querySelectorAll('.questionnaire input[type="radio"]');
    const requesterSearch = document.getElementById('requesterSearch');
    const requesterInput = document.getElementById('requester');
    const requesterResults = document.getElementById('requesterResults');
    const departmentSearch = document.getElementById('departmentSearch');
    const departmentInput = document.getElementById('department');
    const departmentResults = document.getElementById('departmentResults');
    const serviceSearch = document.getElementById('serviceSearch');
    const serviceResults = document.getElementById('serviceResults');
    
    return {
        form,
        riskSelect,
        questionnaireInputs,
        requesterSearch,
        requesterInput,
        requesterResults,
        departmentSearch,
        departmentInput,
        departmentResults,
        serviceSearch,
        serviceResults
    };
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

// Setup search handlers
function setupSearchHandlers(elements, timeoutManager, selectedServicesList) {
    // Requester search handler
    elements.requesterSearch.addEventListener('input', async function(e) {
        await handleSearchInput(e, elements.requesterSearch, elements.requesterResults, elements.requesterInput, searchUsers, 'user', selectedServicesList);
    });

    // Department search handler
    elements.departmentSearch.addEventListener('input', async function(e) {
        await handleSearchInput(e, elements.departmentSearch, elements.departmentResults, elements.departmentInput, searchDepartments, 'department', selectedServicesList);
    });

    // Service search handler
    elements.serviceSearch.addEventListener('input', async function(e) {
        await handleSearchInput(e, elements.serviceSearch, elements.serviceResults, null, searchItems, 'service', selectedServicesList);
    });
}

// Handle search input
async function handleSearchInput(e, searchInput, resultsContainer, valueInput, searchFn, type, selectedList = null) {
    console.log(`Starting search for ${type}...`);
    const query = e.target.value.trim();
    const statusElement = document.getElementById(`${type}Status`);
    
    if (query.length < 2) {
        console.log('Query too short, clearing results');
        resultsContainer.innerHTML = '';
        statusElement.innerHTML = '';
        statusElement.className = 'search-status';
        return;
    }

    try {
        // Update status to loading
        statusElement.innerHTML = 'Searching...';
        statusElement.className = 'search-status loading';
        console.log(`Making API request for ${type} search...`);
        
        const results = await searchFn(query, client);
        console.log(`Received ${results.length} results for ${type}`);
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
            statusElement.innerHTML = 'No results found';
            statusElement.className = 'search-status';
        } else {
            await displayItemResults(results, resultsContainer, selectedList);
            statusElement.innerHTML = `Found ${results.length} results`;
            statusElement.className = 'search-status success';
            console.log('Results displayed successfully');
        }

        // Log cache statistics
        const cacheStats = getCacheStats();
        console.log('Cache statistics:', cacheStats);
    } catch (error) {
        console.error(`Error in ${type} search:`, error);
        resultsContainer.innerHTML = '<div class="error">Error performing search</div>';
        statusElement.innerHTML = 'Error performing search';
        statusElement.className = 'search-status error';
    }
}

// Setup click outside handlers
function setupClickOutsideHandlers() {
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.user-lookup')) {
            requesterResults.classList.remove('active');
        }
        if (!e.target.closest('.department-lookup')) {
            departmentResults.classList.remove('active');
        }
        if (!e.target.closest('.service-lookup')) {
            serviceResults.classList.remove('active');
        }
    });
}

// Setup form submission handler
function setupFormSubmissionHandler(form, selectedServicesList) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!requesterInput.value) {
            await client.interface.trigger('showNotify', {
                type: 'error',
                message: 'Please select a requester'
            });
            return;
        }
        if (!departmentInput.value) {
            await client.interface.trigger('showNotify', {
                type: 'error',
                message: 'Please select a department'
            });
            return;
        }
        try {
            const formData = new FormData(form);
            const { changeRequest, changePayload } = await handleFormSubmission(formData, calculateRiskAndImpact);
            const result = await showChangeConfirmation(changeRequest);
            if (result === "Save") {
                const response = await makeRequestWithTimeout(async () => {
                    return await makeApiRequest('POST', '/api/v2/changes', {
                        body: changePayload
                    });
                });
                
                if (response.status === 201) {
                    const changeData = response.data;
                    await client.interface.trigger('showNotify', {
                        type: 'success',
                        message: `Change request created successfully with ID: ${changeData.id}`
                    });
                    form.reset();
                    selectedServicesList.clear();
                    updateSelectedServices(selectedServicesList);
                }
            }
        } catch (error) {
            await handleErr(error);
        }
    });
}

function initializeApp() {
    console.log('Starting app initialization...');
    try {
        // Setup form elements
        setupFormElements();
        console.log('Form elements setup complete');

        // Setup workspace field
        setupWorkspaceField();
        console.log('Workspace field setup complete');

        // Setup search handlers
        const timeoutManager = {
            clear() {
                if (this.timeout) {
                    clearTimeout(this.timeout);
                    this.timeout = null;
                }
            },
            set(callback, delay) {
                this.clear();
                this.timeout = setTimeout(callback, delay);
            }
        };

        const selectedServicesList = [];
        const searchElements = [
            {
                input: document.getElementById('requesterSearch'),
                results: document.getElementById('requesterResults'),
                value: document.getElementById('requester'),
                searchFn: searchUsers,
                type: 'user'
            },
            {
                input: document.getElementById('departmentSearch'),
                results: document.getElementById('departmentResults'),
                value: document.getElementById('department'),
                searchFn: searchDepartments,
                type: 'department'
            },
            {
                input: document.getElementById('serviceSearch'),
                results: document.getElementById('serviceResults'),
                value: document.getElementById('associatedAssets'),
                searchFn: searchItems,
                type: 'service',
                selectedList: selectedServicesList
            }
        ];

        console.log('Setting up search handlers...');
        setupSearchHandlers(searchElements, timeoutManager, selectedServicesList);
        console.log('Search handlers setup complete');

        // Setup click outside handlers
        setupClickOutsideHandlers();
        console.log('Click outside handlers setup complete');

        // Setup form submission
        const form = document.getElementById('changeRequestForm');
        setupFormSubmissionHandler(form, selectedServicesList);
        console.log('Form submission handler setup complete');

        // Setup questionnaire listeners
        const questionnaireInputs = document.querySelectorAll('.questionnaire input[type="radio"]');
        const riskSelect = document.getElementById('risk');
        
        questionnaireInputs.forEach(input => {
            input.addEventListener('change', () => {
                console.log('Questionnaire input changed, updating risk and impact...');
                updateRiskAndImpact(questionnaireInputs, riskSelect);
            });
        });
        console.log('Questionnaire listeners setup complete');

    } catch (error) {
        console.error('Error in initializeApp:', error);
        handleErr(error);
    }
}

async function handleErr(err = 'None') {
    console.error(`Error occurred. Details:`, err);
    await client.interface.trigger('showNotify', {
        type: 'error',
        message: 'An error occurred. Please try again.'
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
