// Application State
let state = {
    releases: [],
    filteredReleases: [],
    filters: {
        search: '',
        type: 'all',
        sort: 'newest'
    },
    activeTweetRelease: null,
    tweetConfig: {
        includeLink: true,
        addHashtags: true
    },
    lastFetched: null
};

// DOM Elements
const elements = {
    refreshBtn: document.getElementById('refresh-btn'),
    lastUpdatedText: document.getElementById('last-updated'),
    searchInput: document.getElementById('search-input'),
    sortSelect: document.getElementById('sort-select'),
    feedTitle: document.getElementById('feed-title'),
    feedCount: document.getElementById('feed-count'),
    feedContent: document.getElementById('feed-content'),
    
    // Stats
    statTotal: document.getElementById('stat-total'),
    statFeatures: document.getElementById('stat-features'),
    statIssues: document.getElementById('stat-issues'),
    statLatestDate: document.getElementById('stat-latest-date'),
    
    // Filter buttons (category pills)
    filterAll: document.getElementById('filter-all'),
    filterFeature: document.getElementById('filter-feature'),
    filterChange: document.getElementById('filter-change'),
    filterDeprecation: document.getElementById('filter-deprecation'),
    filterIssue: document.getElementById('filter-issue'),
    
    // Modal Elements
    modalOverlay: document.getElementById('modal-overlay'),
    closeModalBtn: document.getElementById('close-modal'),
    cancelModalBtn: document.getElementById('cancel-modal'),
    copyTweetBtn: document.getElementById('copy-tweet-btn'),
    postTweetBtn: document.getElementById('post-tweet-btn'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    includeLinkSwitch: document.getElementById('include-link-switch'),
    addHashtagsSwitch: document.getElementById('add-hashtags-switch'),
    charRing: document.getElementById('char-ring-progress'),
    charNum: document.getElementById('char-num'),
    
    // Toast Container
    toastContainer: document.getElementById('toast-container')
};

// SVG icons as strings for easy injection
const icons = {
    calendar: `<svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/></svg>`,
    twitter: `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
    check: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    search: `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
    info: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleases(false);
    setupEventListeners();
});

// Event Listeners Configuration
function setupEventListeners() {
    // Refresh feed
    elements.refreshBtn.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        state.filters.search = e.target.value;
        applyFilters();
    });

    // Sort selection
    elements.sortSelect.addEventListener('change', (e) => {
        state.filters.sort = e.target.value;
        applyFilters();
    });

    // Category Pill Filters
    const filterButtons = [
        { el: elements.filterAll, type: 'all' },
        { el: elements.filterFeature, type: 'feature' },
        { el: elements.filterChange, type: 'change' },
        { el: elements.filterDeprecation, type: 'deprecation' },
        { el: elements.filterIssue, type: 'issue' }
    ];

    filterButtons.forEach(btn => {
        btn.el.addEventListener('click', () => {
            // Remove active class from all
            filterButtons.forEach(b => b.el.classList.remove('active'));
            // Add active class to clicked
            btn.el.classList.add('active');
            
            // Set state and filter
            state.filters.type = btn.type;
            applyFilters();
        });
    });

    // Modal Close
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.cancelModalBtn.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) closeModal();
    });

    // Tweet Input Edit (Char Counter updating)
    elements.tweetTextarea.addEventListener('input', () => {
        updateCharCount(elements.tweetTextarea.value);
    });

    // Tweet configuration toggles
    elements.includeLinkSwitch.addEventListener('change', (e) => {
        state.tweetConfig.includeLink = e.target.checked;
        regenerateTweetDraft();
    });

    elements.addHashtagsSwitch.addEventListener('change', (e) => {
        state.tweetConfig.addHashtags = e.target.checked;
        regenerateTweetDraft();
    });

    // Copy Tweet Draft
    elements.copyTweetBtn.addEventListener('click', copyTweetToClipboard);

    // Post to Twitter
    elements.postTweetBtn.addEventListener('click', postTweetToTwitter);
}

// Fetch Release Notes
async function fetchReleases(forceRefresh = false) {
    showLoading();
    elements.refreshBtn.classList.add('loading');
    
    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            state.releases = result.data;
            state.lastFetched = result.last_fetched;
            
            // Format Last Updated Text
            const dateStr = new Date(state.lastFetched * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            elements.lastUpdatedText.innerHTML = `Last updated: <span>${dateStr}</span>`;
            
            updateStats();
            applyFilters();
            
            if (forceRefresh) {
                showToast("BigQuery releases refreshed successfully!", "success");
            }
        } else {
            showErrorState(result.error || "Failed to parse release notes feed.");
            showToast("Error updating release feed.", "error");
        }
    } catch (error) {
        showErrorState(error.message || "Failed to connect to the backend server.");
        showToast("Network connection error.", "error");
    } finally {
        elements.refreshBtn.classList.remove('loading');
    }
}

// Display Loading State
function showLoading() {
    elements.feedContent.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Fetching latest BigQuery release notes...</p>
        </div>
    `;
}

// Display Error State
function showErrorState(message) {
    elements.feedContent.innerHTML = `
        <div class="empty-state">
            ${icons.info}
            <h3>Unable to load releases</h3>
            <p>${message}</p>
            <button class="btn-refresh" style="margin-top: 1rem;" onclick="fetchReleases(true)">Retry Fetch</button>
        </div>
    `;
}

// Calculate and Update Dashboard Statistics
function updateStats() {
    const total = state.releases.length;
    const features = state.releases.filter(r => r.type.toLowerCase() === 'feature').length;
    const issues = state.releases.filter(r => r.type.toLowerCase() === 'issue' || r.type.toLowerCase() === 'deprecation').length;
    
    // Get latest date from the first entry
    const latestDate = total > 0 ? state.releases[0].date : 'N/A';
    
    elements.statTotal.textContent = total;
    elements.statFeatures.textContent = features;
    elements.statIssues.textContent = issues;
    elements.statLatestDate.textContent = latestDate;
    
    // Update count labels on sidebar pill filters
    document.querySelector('#filter-all .filter-count').textContent = total;
    document.querySelector('#filter-feature .filter-count').textContent = features;
    document.querySelector('#filter-change .filter-count').textContent = state.releases.filter(r => r.type.toLowerCase() === 'change').length;
    document.querySelector('#filter-deprecation .filter-count').textContent = state.releases.filter(r => r.type.toLowerCase() === 'deprecation').length;
    document.querySelector('#filter-issue .filter-count').textContent = state.releases.filter(r => r.type.toLowerCase() === 'issue').length;
}

// Filter and Sort releases according to local state
function applyFilters() {
    let filtered = [...state.releases];
    
    // 1. Search Query Filter
    if (state.filters.search.trim() !== '') {
        const query = state.filters.search.toLowerCase().trim();
        filtered = filtered.filter(r => {
            return r.type.toLowerCase().includes(query) || 
                   r.date.toLowerCase().includes(query) || 
                   r.text.toLowerCase().includes(query);
        });
    }
    
    // 2. Type Category Filter
    if (state.filters.type !== 'all') {
        filtered = filtered.filter(r => r.type.toLowerCase() === state.filters.type);
    }
    
    // 3. Sorting
    if (state.filters.sort === 'oldest') {
        // Sort ascending by date
        // Since dates are parsed from strings, let's parse using Date object
        filtered.sort((a, b) => new Date(a.updated) - new Date(b.updated));
    } else {
        // Sort descending by date (newest first)
        filtered.sort((a, b) => new Date(b.updated) - new Date(a.updated));
    }
    
    state.filteredReleases = filtered;
    elements.feedCount.textContent = `${filtered.length} updates found`;
    
    renderFeed();
}

// Render release card feed list
function renderFeed() {
    if (state.filteredReleases.length === 0) {
        elements.feedContent.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <h3>No release notes match your filters</h3>
                <p>Try clearing your search query or choosing a different category.</p>
            </div>
        `;
        return;
    }
    
    elements.feedContent.innerHTML = '';
    
    state.filteredReleases.forEach(release => {
        const card = document.createElement('div');
        const typeClass = release.type.toLowerCase();
        
        // Match specific types to our styling categories, fallback to 'other'
        const validClasses = ['feature', 'change', 'deprecation', 'issue'];
        const cssClass = validClasses.includes(typeClass) ? typeClass : 'other';
        
        card.className = `release-card ${cssClass}`;
        
        card.innerHTML = `
            <div class="release-card-header">
                <div class="release-meta">
                    <span class="badge-type">${release.type}</span>
                    <span class="release-date">
                        ${icons.calendar}
                        ${release.date}
                    </span>
                </div>
                <div class="card-actions">
                    <button class="btn-icon" title="View official release notes anchor" onclick="window.open('${release.link}', '_blank')">
                        <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                    </button>
                </div>
            </div>
            
            <div class="release-content">
                ${release.html}
            </div>
            
            <div class="release-card-footer">
                <button class="btn-tweet" data-id="${release.id}">
                    ${icons.twitter}
                    Tweet Update
                </button>
            </div>
        `;
        
        // Add click listener specifically to the tweet button
        card.querySelector('.btn-tweet').addEventListener('click', () => {
            openTweetModal(release);
        });
        
        elements.feedContent.appendChild(card);
    });
}

// Open Tweet Composer Modal
function openTweetModal(release) {
    state.activeTweetRelease = release;
    
    // Set switches state based on config
    elements.includeLinkSwitch.checked = state.tweetConfig.includeLink;
    elements.addHashtagsSwitch.checked = state.tweetConfig.addHashtags;
    
    // Generate initial text
    regenerateTweetDraft();
    
    // Open modal animation
    elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock background scrolling
}

// Close Tweet Composer Modal
function closeModal() {
    elements.modalOverlay.classList.remove('active');
    document.body.style.overflow = ''; // Unlock scrolling
    state.activeTweetRelease = null;
}

// Regenerate default tweet draft when toggles change or opening modal
function regenerateTweetDraft() {
    if (!state.activeTweetRelease) return;
    
    const release = state.activeTweetRelease;
    const typeLabel = release.type.toUpperCase();
    const date = release.date;
    const text = release.text;
    const link = release.link || 'https://docs.cloud.google.com/bigquery/docs/release-notes';
    const tags = "#BigQuery #GoogleCloud";
    
    // Build prefix
    const prefix = `BigQuery ${typeLabel} (${date}): `;
    
    // Calculate space budget for description
    // Twitter character limit = 280
    // Subtract prefix length
    // Subtract link length + newlines (if checked)
    // Subtract tags length + newlines (if checked)
    let budget = 280 - prefix.length;
    
    if (state.tweetConfig.includeLink) {
        budget -= (link.length + 2); // 2 characters for newlines
    }
    
    if (state.tweetConfig.addHashtags) {
        budget -= (tags.length + 2); // 2 characters for newlines
    }
    
    // Fit text content inside remaining budget
    let formattedText = text;
    if (text.length > budget) {
        // Truncate text and add ellipses
        formattedText = text.substring(0, budget - 3) + "...";
    }
    
    // Assemble final tweet text
    let tweetDraft = `${prefix}${formattedText}`;
    
    if (state.tweetConfig.includeLink) {
        tweetDraft += `\n\n${link}`;
    }
    
    if (state.tweetConfig.addHashtags) {
        tweetDraft += `\n\n${tags}`;
    }
    
    elements.tweetTextarea.value = tweetDraft;
    updateCharCount(tweetDraft);
}

// Update Character limit indicators (ring & count text)
function updateCharCount(text) {
    const len = text.length;
    const limit = 280;
    const remaining = limit - len;
    
    elements.charNum.textContent = remaining;
    
    // Update color states
    if (remaining < 0) {
        elements.charNum.className = 'char-num error';
        elements.postTweetBtn.disabled = true;
    } else {
        elements.charNum.className = 'char-num';
        elements.postTweetBtn.disabled = false;
    }
    
    // SVG Progress Ring Animation
    const radius = 10;
    const circumference = 2 * Math.PI * radius; // ~62.83
    
    // Clamp percent between 0 and 100
    const percent = Math.min((len / limit) * 100, 100);
    const strokeOffset = circumference - (percent / 100) * circumference;
    
    elements.charRing.style.strokeDashoffset = strokeOffset;
    
    // Ring Color change based on warnings
    elements.charRing.classList.remove('warning', 'error');
    if (remaining <= 0) {
        elements.charRing.classList.add('error');
    } else if (remaining <= 20) {
        elements.charRing.classList.add('warning');
    }
}

// Copy Tweet Text to Clipboard
async function copyTweetToClipboard() {
    const text = elements.tweetTextarea.value;
    
    try {
        await navigator.clipboard.writeText(text);
        showToast("Tweet draft copied to clipboard!", "success");
        
        // Temporarily change copy button icon to checkmark
        const originalBtnHTML = elements.copyTweetBtn.innerHTML;
        elements.copyTweetBtn.innerHTML = `
            ${icons.check}
            Copied!
        `;
        setTimeout(() => {
            elements.copyTweetBtn.innerHTML = originalBtnHTML;
        }, 2000);
        
    } catch (err) {
        showToast("Failed to copy text automatically.", "error");
    }
}

// Open X/Twitter Web Intent to post the draft
function postTweetToTwitter() {
    const text = elements.tweetTextarea.value;
    if (text.length > 280) {
        showToast("Tweet exceeds the 280 character limit!", "error");
        return;
    }
    
    const encodedText = encodeURIComponent(text);
    const url = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    window.open(url, '_blank');
    showToast("Launching Twitter Web Intent...", "info");
    closeModal();
}

// Toast Notifications System
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = icons.check;
    if (type === 'error') icon = icons.info;
    if (type === 'info') icon = icons.twitter;
    
    toast.innerHTML = `
        ${icon}
        <span class="toast-message">${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Force browser reflow to trigger animation
    toast.offsetHeight;
    
    toast.classList.add('active');
    
    // Auto-remove toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('active');
        // Wait for slide-out transition to finish before removal
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
