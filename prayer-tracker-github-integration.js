// prayer-tracker-data.js

// GitHub Configuration
const githubConfig = {
  repo: 'your-username/prayer-tracker', // Replace with your actual GitHub repository
  branch: 'main',
  filePath: 'prayer-data.json',
  token: '' // Personal access token - do not hardcode in production; use environment variables
};

// Function to fetch prayer data from GitHub
async function fetchPrayerData() {
  try {
    const url = `https://api.github.com/repos/${githubConfig.repo}/contents/${githubConfig.filePath}?ref=${githubConfig.branch}`;
    
    const headers = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    // Add authentication if token is provided
    if (githubConfig.token) {
      headers['Authorization'] = `token ${githubConfig.token}`;
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // GitHub API returns content as base64 encoded
    const content = atob(data.content);
    
    // Parse the JSON content
    return JSON.parse(content);
  } catch (error) {
    console.error('Error fetching prayer data:', error);
    // Return empty object if there's an error
    return {};
  }
}

// Function to save prayer data to GitHub
async function savePrayerData(prayerData) {
  try {
    // First, get the current file to get its SHA
    const url = `https://api.github.com/repos/${githubConfig.repo}/contents/${githubConfig.filePath}?ref=${githubConfig.branch}`;
    
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
    
    if (!githubConfig.token) {
      throw new Error('GitHub token is required for saving data');
    }
    
    headers['Authorization'] = `token ${githubConfig.token}`;
    
    // Try to get current file information
    let sha = null;
    try {
      const getResponse = await fetch(url, { headers });
      if (getResponse.ok) {
        const fileInfo = await getResponse.json();
        sha = fileInfo.sha;
      }
    } catch (e) {
      // File might not exist yet
    }
    
    // Prepare the update/create request
    const content = btoa(JSON.stringify(prayerData, null, 2)); // Base64 encode the JSON
    
    const payload = {
      message: 'Update prayer tracking data',
      content,
      branch: githubConfig.branch
    };
    
    // If file exists, include its SHA for update
    if (sha) {
      payload.sha = sha;
    }
    
    // Make the PUT request to create/update the file
    const putResponse = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (!putResponse.ok) {
      throw new Error(`GitHub API error: ${putResponse.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving prayer data:', error);
    
    // If GitHub API fails, fall back to localStorage
    localStorage.setItem('prayerTracker', JSON.stringify(prayerData));
    return false;
  }
}

// Initialize the prayer tracker with GitHub integration
function initPrayerTrackerWithGitHub() {
  // Update the init function in the existing code
  document.addEventListener('DOMContentLoaded', async function() {
    // Global state
    const state = {
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth(),
      selectedDate: new Date(),
      prayerData: {},
      prayers: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
      people: ['Wife', 'Husband'],
      months: ['January', 'February', 'March', 'April', 'May', 'June', 
               'July', 'August', 'September', 'October', 'November', 'December'],
      dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      isLoading: true,
      lastSyncTime: null
    };
    
    // Show loading indicator
    function showLoading() {
      const container = document.getElementById('prayer-tracker');
      const loadingDiv = document.createElement('div');
      loadingDiv.id = 'loading-indicator';
      loadingDiv.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255,255,255,0.8); display: flex; justify-content: center; align-items: center; z-index: 100;';
      loadingDiv.innerHTML = '<div>Loading prayer data...</div>';
      container.style.position = 'relative';
      container.appendChild(loadingDiv);
    }
    
    // Hide loading indicator
    function hideLoading() {
      const loadingDiv = document.getElementById('loading-indicator');
      if (loadingDiv) {
        loadingDiv.remove();
      }
      state.isLoading = false;
      
      // Update sync time display
      updateSyncTimeDisplay();
    }
    
    // Update sync time display
    function updateSyncTimeDisplay() {
      const syncElement = document.getElementById('last-sync-time');
      if (syncElement && state.lastSyncTime) {
        const timeString = new Date(state.lastSyncTime).toLocaleTimeString();
        syncElement.textContent = `Last synced: ${timeString}`;
      }
    }
    
    // Initialize
    async function init() {
      showLoading();
      
      try {
        // First try to load from GitHub
        const githubData = await fetchPrayerData();
        
        if (Object.keys(githubData).length > 0) {
          state.prayerData = githubData;
          state.lastSyncTime = new Date();
        } else {
          // Fall back to localStorage if GitHub data is empty
          const savedData = localStorage.getItem('prayerTracker');
          if (savedData) {
            state.prayerData = JSON.parse(savedData);
          }
        }
      } catch (error) {
        console.error('Error initializing data:', error);
        // Fall back to localStorage
        const savedData = localStorage.getItem('prayerTracker');
        if (savedData) {
          state.prayerData = JSON.parse(savedData);
        }
      }
      
      // Setup month and year dropdowns
      setupMonthYearSelects();
      
      // Setup calendar header
      setupCalendarHeader();
      
      // Add sync status indicator to the header
      addSyncStatusIndicator();
      
      // Render calendar, progress bars, and prayer detail
      renderCalendar();
      renderProgressBars();
      renderPrayerDetail();
      
      // Setup event listeners
      document.getElementById('prev-month').addEventListener('click', prevMonth);
      document.getElementById('next-month').addEventListener('click', nextMonth);
      document.getElementById('month-select').addEventListener('change', handleMonthChange);
      document.getElementById('year-select').addEventListener('change', handleYearChange);
      document.getElementById('sync-button').addEventListener('click', syncData);
      
      hideLoading();
    }
    
    // Add sync status indicator
    function addSyncStatusIndicator() {
      const header = document.querySelector('.header');
      
      const syncContainer = document.createElement('div');
      syncContainer.className = 'sync-container';
      syncContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
      
      const syncStatus = document.createElement('div');
      syncStatus.id = 'last-sync-time';
      syncStatus.style.cssText = 'font-size: 12px; color: #666;';
      syncStatus.textContent = 'Not synced yet';
      
      const syncButton = document.createElement('button');
      syncButton.id = 'sync-button';
      syncButton.className = 'btn';
      syncButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
      `;
      syncButton.title = 'Sync with GitHub';
      
      syncContainer.appendChild(syncStatus);
      syncContainer.appendChild(syncButton);
      
      header.appendChild(syncContainer);
    }
    
    // Sync data with GitHub
    async function syncData() {
      if (state.isLoading) return;
      
      state.isLoading = true;
      showLoading();
      
      try {
        // Save current data to GitHub
        const success = await savePrayerData(state.prayerData);
        
        if (success) {
          state.lastSyncTime = new Date();
          // Show success message
          const container = document.getElementById('prayer-tracker');
          const message = document.createElement('div');
          message.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: #10b981; color: white; padding: 16px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 1000;';
          message.textContent = 'Prayer data synced successfully!';
          container.appendChild(message);
          
          // Remove the message after 3 seconds
          setTimeout(() => {
            message.remove();
          }, 3000);
        }
      } catch (error) {
        console.error('Error syncing data:', error);
        // Show error message
        const container = document.getElementById('prayer-tracker');
        const message = document.createElement('div');
        message.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: #ef4444; color: white; padding: 16px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 1000;';
        message.textContent = 'Error syncing prayer data. Check console for details.';
        container.appendChild(message);
        
        // Remove the message after 3 seconds
        setTimeout(() => {
          message.remove();
        }, 3000);
      }
      
      hideLoading();
    }
    
    // Modified togglePrayer function to sync with GitHub
    function togglePrayer(prayerIndex, person) {
      const key = getPrayerKey(state.selectedDate, person);
      const currentStatus = getPrayerStatus(state.selectedDate, person);
      const newStatus = [...currentStatus];
      newStatus[prayerIndex] = !newStatus[prayerIndex];
      
      state.prayerData[key] = newStatus;
      
      // Save to localStorage as backup
      localStorage.setItem('prayerTracker', JSON.stringify(state.prayerData));
      
      // Re-render views
      renderCalendar();
      renderProgressBars();
      renderPrayerDetail();
    }
    
    // Initialize the app
    init();
  });
}

// Sample prayer data JSON structure
const samplePrayerData = {
  "2025-3-21-Wife": [true, true, true, true, true],
  "2025-3-21-Husband": [true, true, true, true, true],
  "2025-3-22-Wife": [true, true, false, true, true],
  "2025-3-22-Husband": [true, true, true, true, false]
};

// Export functions for use in the main script
export { fetchPrayerData, savePrayerData, initPrayerTrackerWithGitHub };
