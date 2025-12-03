const { contextBridge, ipcRenderer } = require('electron');

// Expose API to injected page
contextBridge.exposeInMainWorld('adjusterAssistant', {
  trackEvent: (eventData) => {
    ipcRenderer.invoke('track-event', {
      ...eventData,
      timestamp: Date.now()
    });
  },

  trackTabChange: (tabName) => {
    ipcRenderer.invoke('track-event', {
      type: 'tab_change',
      tabName,
      timestamp: Date.now()
    });
  },
  
  trackFieldChange: (fieldName, value) => {
    ipcRenderer.invoke('track-event', {
      type: 'field_change',
      fieldName,
      hasValue: !!value,
      timestamp: Date.now()
    });
  },
  
  validateField: (fieldName, value, rules) => {
    // Client-side validation logic
    const errors = [];
    
    if (rules.required && !value) {
      errors.push(`${fieldName} is required`);
    }
    
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`${fieldName} must be at least ${rules.minLength} characters`);
    }
    
    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      errors.push(`${fieldName} format is invalid`);
    }
    
    const isValid = errors.length === 0;
    
    ipcRenderer.invoke('track-event', {
      type: 'validation',
      fieldName,
      isValid,
      errors
    });
    
    return { isValid, errors };
  }
});

// Inject monitoring script into page
window.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      console.log('=== Adjuster Assistant monitoring active ===');
      console.log('Page URL:', window.location.href);
      console.log('Page Title:', document.title);
      
      // Detect claim/record ID from page
      function detectClaimInfo() {
        // Extract from URL parameters (iVOS specific)
        const urlParams = new URLSearchParams(window.location.search);
        
        // Try to find claim info in any iframe that might have it
        let claimId = urlParams.get('current_claim_id') || urlParams.get('claim_id');
        let claimantId = urlParams.get('current_claimant_id') || urlParams.get('claimant_id');
        let insuranceType = urlParams.get('insurance_type');
        
        // Check iframes for claim info (iVOS loads content in iframes)
        if (!claimId) {
          try {
            const frames = document.querySelectorAll('iframe');
            frames.forEach(frame => {
              try {
                const frameUrl = new URL(frame.src, window.location.href);
                const frameParams = new URLSearchParams(frameUrl.search);
                if (!claimId) claimId = frameParams.get('current_claim_id') || frameParams.get('claim_id');
                if (!claimantId) claimantId = frameParams.get('current_claimant_id') || frameParams.get('claimant_id');
                if (!insuranceType) insuranceType = frameParams.get('insurance_type');
              } catch (e) {
                // Cross-origin iframe, skip
              }
            });
          } catch (e) {
            console.log('Could not check iframes:', e);
          }
        }
        
        // Get claimant name from title
        const claimantName = document.title.trim();
        
        console.log('=== Claim Info Detected ===');
        console.log('URL:', window.location.href);
        console.log('Claim ID:', claimId);
        console.log('Claimant ID:', claimantId);
        console.log('Claimant Name:', claimantName);
        console.log('Insurance Type:', insuranceType);
        
        if ((claimId || claimantName) && window.adjusterAssistant) {
          window.adjusterAssistant.trackEvent({
            type: 'claim_detected',
            claimId: claimId || 'unknown',
            claimantId,
            claimantName,
            insuranceType,
            url: window.location.href,
            title: document.title
          });
        }
      }
      
      // Run detection after page loads
      setTimeout(detectClaimInfo, 1000);
      
      // Helper function to inspect frames (available in console)
      window.inspectFrames = function() {
        console.log('=== Frame Inspector ===');
        console.log('Total frames:', window.frames.length);
        
        document.querySelectorAll('iframe, frame').forEach((frame, i) => {
          console.log(\`\\n--- Frame \${i} ---\`);
          console.log('Name:', frame.name);
          console.log('ID:', frame.id);
          console.log('Src:', frame.src);
          
          try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            console.log('Title:', doc.title);
            console.log('URL:', doc.location.href);
            console.log('Body HTML (first 200 chars):', doc.body?.innerHTML.substring(0, 200));
            
            // Look for tabs in this frame
            const tabs = doc.querySelectorAll('[role="tab"], .tab, a[onclick*="tab"]');
            if (tabs.length > 0) {
              console.log('Tabs found:', tabs.length);
              tabs.forEach((tab, j) => {
                console.log(\`  Tab \${j}: \${tab.textContent.trim()}\`);
              });
            }
          } catch (e) {
            console.log('Cannot access frame content (cross-origin):', e.message);
          }
        });
        
        console.log('\\n=== End Frame Inspector ===');
        console.log('Tip: Use frames[0], frames[1], etc. to access frame windows');
      };
      
      console.log('💡 Tip: Type inspectFrames() in console to see all frames');
      
      // Auto-inspect frames after page loads
      setTimeout(() => {
        const frameCount = document.querySelectorAll('iframe, frame').length;
        if (frameCount > 0) {
          console.log(\`📊 Page has \${frameCount} frame(s). Run inspectFrames() for details.\`);
        }
        
        // Check for tabs in main document and frames
        let totalTabs = 0;
        const tabSelectors = '[role="tab"], .tab, a[onclick*="tab"], li[onclick*="showTab"]';
        
        // Main document
        totalTabs += document.querySelectorAll(tabSelectors).length;
        
        // Check each frame
        document.querySelectorAll('iframe, frame').forEach(frame => {
          try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            const frameTabs = doc.querySelectorAll(tabSelectors).length;
            totalTabs += frameTabs;
            if (frameTabs > 0) {
              console.log(\`  Frame "\${frame.name || frame.id || 'unnamed'}" has \${frameTabs} tabs\`);
            }
          } catch (e) {
            // Cross-origin, skip
          }
        });
        
        if (totalTabs > 10) {
          console.log(\`⚠️ Complex page detected: \${totalTabs} tabs found!\`);
          console.log('💡 This is where a Tab Navigator would be helpful');
        }
      }, 2000);
      
      // Override window.open to track new window attempts
      const originalOpen = window.open;
      window.open = function(url, name, features) {
        console.log('=== window.open intercepted ===');
        console.log('URL:', url);
        console.log('Name:', name);
        console.log('Features:', features);
        
        // Track if available (may not be in page context)
        try {
          if (window.adjusterAssistant && window.adjusterAssistant.trackEvent) {
            window.adjusterAssistant.trackEvent({
              type: 'window_open_attempt',
              url,
              name,
              features
            });
          }
        } catch (e) {
          console.log('Could not track event:', e.message);
        }
        
        // Convert relative URL to absolute
        let fullUrl = url;
        if (url && !url.startsWith('http')) {
          fullUrl = new URL(url, window.location.href).href;
        }
        
        console.log('Full URL:', fullUrl);
        
        // Let Electron's setWindowOpenHandler catch this
        // It will load the URL in a new tab
        const result = originalOpen.call(this, fullUrl, name, features);
        
        // Return a comprehensive mock window object to prevent errors
        const mockWindow = {
          closed: false,
          location: { href: fullUrl },
          document: { title: '', location: { href: fullUrl } },
          
          // Window methods the app might call
          close: function() { this.closed = true; },
          focus: function() {},
          blur: function() {},
          postMessage: function() {},
          
          // Resize methods
          resizeTo: function(width, height) { 
            console.log('Mock resizeTo called:', width, height); 
          },
          resizeBy: function(x, y) { 
            console.log('Mock resizeBy called:', x, y); 
          },
          moveTo: function(x, y) { 
            console.log('Mock moveTo called:', x, y); 
          },
          moveBy: function(x, y) { 
            console.log('Mock moveBy called:', x, y); 
          },
          
          // Scroll methods
          scrollTo: function() {},
          scrollBy: function() {},
          
          // Print
          print: function() {},
          
          // Alert/confirm/prompt
          alert: function(msg) { console.log('Mock alert:', msg); },
          confirm: function(msg) { console.log('Mock confirm:', msg); return true; },
          prompt: function(msg, def) { console.log('Mock prompt:', msg); return def; },
          
          // Properties
          innerWidth: 1920,
          innerHeight: 1080,
          outerWidth: 1920,
          outerHeight: 1080,
          screenX: 0,
          screenY: 0,
          screenLeft: 0,
          screenTop: 0
        };
        
        return result || mockWindow;
      };
      
      // Monitor double-clicks on table rows or list items (common pattern)
      document.addEventListener('dblclick', (e) => {
        console.log('Double-click detected on:', e.target);
        
        // Look for data attributes or links
        const target = e.target.closest('tr, li, [data-id], [data-record-id], .record, .claim');
        if (target) {
          console.log('Double-click on potential record:', target);
          
          // Try to find a link or action
          const link = target.querySelector('a[href]');
          if (link && window.adjusterAssistant) {
            console.log('Found link in record:', link.href);
            window.adjusterAssistant.trackEvent({
              type: 'record_double_click',
              url: link.href,
              element: target.tagName
            });
          }
        }
      });
      
      // Monitor tab clicks
      document.addEventListener('click', (e) => {
        const tab = e.target.closest('[role="tab"], .tab, [class*="tab"]');
        if (tab && window.adjusterAssistant) {
          const tabName = tab.textContent.trim() || tab.getAttribute('aria-label') || 'Unknown Tab';
          window.adjusterAssistant.trackTabChange(tabName);
        }
      });
      
      // Monitor form field changes
      document.addEventListener('change', (e) => {
        if (e.target.matches('input, select, textarea') && window.adjusterAssistant) {
          const fieldName = e.target.name || e.target.id || e.target.placeholder || 'Unknown Field';
          window.adjusterAssistant.trackFieldChange(fieldName, e.target.value);
        }
      });
      
      // Track when user navigates away (claim completed)
      window.addEventListener('beforeunload', () => {
        if (window.adjusterAssistant) {
          window.adjusterAssistant.trackEvent({
            type: 'page_unload',
            url: window.location.href
          });
        }
      });
    })();
  `;
  document.documentElement.appendChild(script);
});
