// Tab Assistant - Helps users navigate complex pages with many tabs

class TabAssistant {
    constructor() {
        this.tabs = [];
        this.favorites = new Set();
        this.recentTabs = [];
        this.maxRecent = 10;
        this.categories = {
            general: ['General Info', 'Summary', 'Overview', 'Details'],
            claimant: ['Claimant', 'Injured Worker', 'Employee', 'Personal Info'],
            medical: ['Medical', 'Treatment', 'Diagnosis', 'Injury', 'Doctor', 'Hospital'],
            financial: ['Financial', 'Payment', 'Benefits', 'Compensation', 'Reserve'],
            documents: ['Documents', 'Files', 'Attachments', 'Upload'],
            notes: ['Notes', 'Comments', 'Diary', 'Activity'],
            legal: ['Legal', 'Attorney', 'Litigation', 'Settlement'],
            employer: ['Employer', 'Company', 'Organization']
        };
    }

    detectTabs() {
        const tabs = [];
        
        // Look for tabs in various formats
        const selectors = [
            '[role="tab"]',
            '.tab',
            '[class*="tab"]',
            'a[onclick*="tab"]',
            'li[onclick]',
            '.nav-item',
            '.menu-item'
        ];

        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                const text = el.textContent.trim();
                if (text && text.length > 0 && text.length < 50) {
                    tabs.push({
                        element: el,
                        text: text,
                        category: this.categorizeTab(text),
                        visible: this.isVisible(el)
                    });
                }
            });
        });

        // Check iframes for tabs
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                selectors.forEach(selector => {
                    iframeDoc.querySelectorAll(selector).forEach(el => {
                        const text = el.textContent.trim();
                        if (text && text.length > 0 && text.length < 50) {
                            tabs.push({
                                element: el,
                                text: text,
                                category: this.categorizeTab(text),
                                visible: this.isVisible(el),
                                inFrame: true
                            });
                        }
                    });
                });
            } catch (e) {
                // Cross-origin iframe, skip
            }
        });

        this.tabs = tabs;
        return tabs;
    }

    categorizeTab(tabName) {
        const lower = tabName.toLowerCase();
        for (const [category, keywords] of Object.entries(this.categories)) {
            if (keywords.some(keyword => lower.includes(keyword.toLowerCase()))) {
                return category;
            }
        }
        return 'other';
    }

    isVisible(element) {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    trackTabClick(tabName) {
        // Add to recent tabs
        this.recentTabs = this.recentTabs.filter(t => t !== tabName);
        this.recentTabs.unshift(tabName);
        if (this.recentTabs.length > this.maxRecent) {
            this.recentTabs.pop();
        }

        // Track with metrics
        if (window.adjusterAssistant) {
            window.adjusterAssistant.trackTabChange(tabName);
        }
    }

    toggleFavorite(tabName) {
        if (this.favorites.has(tabName)) {
            this.favorites.delete(tabName);
        } else {
            this.favorites.add(tabName);
        }
        this.saveFavorites();
    }

    saveFavorites() {
        localStorage.setItem('tab_favorites', JSON.stringify([...this.favorites]));
    }

    loadFavorites() {
        try {
            const saved = localStorage.getItem('tab_favorites');
            if (saved) {
                this.favorites = new Set(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to load favorites:', e);
        }
    }

    getTabsByCategory() {
        const grouped = {};
        this.tabs.forEach(tab => {
            const cat = tab.category;
            if (!grouped[cat]) {
                grouped[cat] = [];
            }
            grouped[cat].push(tab);
        });
        return grouped;
    }

    searchTabs(query) {
        const lower = query.toLowerCase();
        return this.tabs.filter(tab => 
            tab.text.toLowerCase().includes(lower)
        );
    }

    createAssistantUI() {
        // Create floating assistant panel
        const panel = document.createElement('div');
        panel.id = 'tab-assistant-panel';
        panel.innerHTML = `
            <div class="assistant-header">
                <span>Tab Navigator</span>
                <button id="assistant-close">×</button>
            </div>
            <div class="assistant-search">
                <input type="text" id="tab-search" placeholder="Search tabs..." />
            </div>
            <div class="assistant-tabs">
                <div class="tab-section">
                    <div class="section-title">⭐ Favorites</div>
                    <div id="favorite-tabs"></div>
                </div>
                <div class="tab-section">
                    <div class="section-title">🕐 Recent</div>
                    <div id="recent-tabs"></div>
                </div>
                <div class="tab-section">
                    <div class="section-title">📁 All Tabs</div>
                    <div id="all-tabs"></div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        this.attachEventListeners();
        this.renderTabs();
    }

    attachEventListeners() {
        const searchInput = document.getElementById('tab-search');
        searchInput.addEventListener('input', (e) => {
            this.renderTabs(e.target.value);
        });

        document.getElementById('assistant-close').addEventListener('click', () => {
            document.getElementById('tab-assistant-panel').style.display = 'none';
        });
    }

    renderTabs(searchQuery = '') {
        const tabs = searchQuery ? this.searchTabs(searchQuery) : this.tabs;
        
        // Render favorites
        const favoritesDiv = document.getElementById('favorite-tabs');
        const favoriteTabs = tabs.filter(t => this.favorites.has(t.text));
        favoritesDiv.innerHTML = favoriteTabs.length > 0 
            ? favoriteTabs.map(t => this.createTabItem(t, true)).join('')
            : '<div class="empty-state">No favorites yet</div>';

        // Render recent
        const recentDiv = document.getElementById('recent-tabs');
        const recentTabs = this.recentTabs
            .map(name => tabs.find(t => t.text === name))
            .filter(Boolean);
        recentDiv.innerHTML = recentTabs.length > 0
            ? recentTabs.map(t => this.createTabItem(t)).join('')
            : '<div class="empty-state">No recent tabs</div>';

        // Render all by category
        const allDiv = document.getElementById('all-tabs');
        const grouped = this.getTabsByCategory();
        allDiv.innerHTML = Object.entries(grouped)
            .map(([category, categoryTabs]) => `
                <div class="category-group">
                    <div class="category-title">${this.getCategoryIcon(category)} ${category}</div>
                    ${categoryTabs.map(t => this.createTabItem(t)).join('')}
                </div>
            `).join('');
    }

    createTabItem(tab, showFavorite = false) {
        const isFavorite = this.favorites.has(tab.text);
        return `
            <div class="tab-item" data-tab="${tab.text}">
                <span class="tab-name">${tab.text}</span>
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-tab="${tab.text}">
                    ${isFavorite ? '⭐' : '☆'}
                </button>
            </div>
        `;
    }

    getCategoryIcon(category) {
        const icons = {
            general: '📋',
            claimant: '👤',
            medical: '🏥',
            financial: '💰',
            documents: '📄',
            notes: '📝',
            legal: '⚖️',
            employer: '🏢',
            other: '📁'
        };
        return icons[category] || '📁';
    }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabAssistant;
}
