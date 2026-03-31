// ============================================
// Audio Insight — Side Panel Logic
// ============================================

// --- Configuration ---
interface AppConfig {
  apiBaseUrl: string;
  supportedHosts: string[];
}

const CONFIG: AppConfig = {
  apiBaseUrl: "http://localhost:8000",
  supportedHosts: ["www.youtube.com", "youtube.com", "youtu.be"],
};


// --- DOM Elements ---
const urlInput      = document.getElementById("urlInput") as HTMLInputElement;
const analyzeBtn    = document.getElementById("analyzeBtn") as HTMLButtonElement;
const currentTabBtn = document.getElementById("currentTabBtn") as HTMLButtonElement;


// --- Types ---
interface ValidationResult {
  valid: boolean;
  message?: string;
}


// --- Validation ---

/**
 * Validates the given URL string.
 * Returns a result object with valid flag and optional error message.
 */
function validateUrl(input: string): ValidationResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { valid: false, message: "Please enter a URL." };
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { valid: false, message: "URL must start with http or https." };
    }

    return { valid: true };
  } catch {
    return { valid: false, message: "Please enter a valid URL." };
  }
}

/**
 * Checks if the URL is from a supported source (e.g. YouTube).
 */
function isSupportedSource(url: string): boolean {
  try {
    const parsed = new URL(url);
    return CONFIG.supportedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}


// --- UI Helpers ---

/**
 * Shows a validation error on the URL input field.
 */
function showValidationError(message: string): void {
  urlInput.classList.add("is-invalid");

  let feedback = urlInput.parentElement?.querySelector(
    ".invalid-feedback"
  ) as HTMLElement | null;

  if (!feedback) {
    feedback = document.createElement("div");
    feedback.className = "invalid-feedback";
    urlInput.parentElement?.appendChild(feedback);
  }

  feedback.textContent = message;
}

/**
 * Clears any validation error on the URL input field.
 */
function clearValidationError(): void {
  urlInput.classList.remove("is-invalid");
}


// --- Event Handlers ---

/**
 * Handles the "Analyze audio" button click.
 */
function handleAnalyze(): void {
  const url = urlInput.value.trim();
  const result = validateUrl(url);

  if (!result.valid) {
    showValidationError(result.message ?? "Invalid URL.");
    return;
  }

  const supported = isSupportedSource(url);

  if (!supported) {
    console.warn("URL is not from a known supported source:", url);
    // Still allow — might be a direct audio URL
  }

  console.log("Analyzing URL:", url);
  console.log("Supported source:", supported);

  // TODO: Send URL to backend API and switch to processing screen
}

/**
 * Handles the "Use current tab URL" button click.
 * Reads the active tab's URL and populates the input.
 */
async function handleUseCurrentTab(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab?.url) {
      urlInput.value = tab.url;
      clearValidationError();
    }
  } catch (error) {
    console.error("Could not get current tab URL:", error);
  }
}


// --- Event Listeners ---
analyzeBtn.addEventListener("click", handleAnalyze);
currentTabBtn.addEventListener("click", handleUseCurrentTab);
urlInput.addEventListener("input", clearValidationError);

// Allow Enter key to trigger analysis
urlInput.addEventListener("keydown", (event: KeyboardEvent): void => {
  if (event.key === "Enter") {
    handleAnalyze();
  }
});
