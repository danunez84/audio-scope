// ============================================
// Audio Insight — Background Service Worker
// ============================================

// Open the side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab: chrome.tabs.Tab): void => {
  if (tab.id !== undefined) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});
