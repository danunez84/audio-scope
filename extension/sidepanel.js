// ============================================
// Audio Insight — Side Panel Logic
// ============================================

// --- DOM Elements ---
const urlInput      = document.getElementById("urlInput");
const analyzeBtn    = document.getElementById("analyzeBtn");
const currentTabBtn = document.getElementById("currentTabBtn");


// --- State ---
const API_BASE_URL = "http://localhost:8000"; // FastAPI backend


// --- Event Listeners ---

// Analyze button click
analyzeBtn.addEventListener("click", () => {
  const url = urlInput.value.trim();

  if (!url) {
    showValidationError("Please enter a URL.");
    return;
  }

  if (!isValidUrl(url)) {
    showValidationError("Please enter a valid URL.");
    return;
  }

  console.log("Analyzing URL:", url);
  // TODO: Send URL to backend and switch to processing screen
});

// Use current tab URL
currentTabBtn.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab && tab.url) {
      urlInput.value = tab.url;
      urlInput.classList.remove("is-invalid");
    }
  } catch (error) {
    console.error("Could not get current tab URL:", error);
  }
});

// Clear validation error on input
urlInput.addEventListener("input", () => {
  urlInput.classList.remove("is-invalid");
});


// --- Helpers ---

/**
 * Basic URL validation
 */
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Show a validation error on the URL input
 */
function showValidationError(message) {
  urlInput.classList.add("is-invalid");

  // Add or update the feedback message
  let feedback = urlInput.parentElement.querySelector(".invalid-feedback");
  if (!feedback) {
    feedback = document.createElement("div");
    feedback.className = "invalid-feedback";
    urlInput.parentElement.appendChild(feedback);
  }
  feedback.textContent = message;
}
