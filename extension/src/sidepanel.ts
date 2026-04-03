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


// --- Types ---
interface ValidationResult {
  valid: boolean;
  message?: string;
}

interface DownloadResponse {
  status: string;
  title: string;
  duration: number;
  file_id: string;
}

interface AnalyzeResponse {
  status: string;
  file_id: string;
  title: string;
  duration: number;
  steps: {
    download: string;
    transcription: string;
    segmentation: string;
    summarization: string;
    indexing: string;
  };
}


// --- DOM Elements ---
const urlInput      = document.getElementById("urlInput") as HTMLInputElement;
const analyzeBtn    = document.getElementById("analyzeBtn") as HTMLButtonElement;
const currentTabBtn = document.getElementById("currentTabBtn") as HTMLButtonElement;


// --- Validation ---

/**
 * Validates the given URL string.
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
 * Checks if the URL is from a supported source.
 */
function isSupportedSource(url: string): boolean {
  try {
    const parsed = new URL(url);
    return CONFIG.supportedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}


// --- API ---

/**
 * Calls the backend /analyze endpoint.
 */
async function callAnalyzeApi(url: string): Promise<AnalyzeResponse> {
  const response = await fetch(`${CONFIG.apiBaseUrl}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Server error");
  }

  return response.json();
}


// --- UI Helpers ---

/**
 * Shows a validation error on the URL input.
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
 * Clears validation errors.
 */
function clearValidationError(): void {
  urlInput.classList.remove("is-invalid");
}

/**
 * Sets the analyze button to a loading state.
 */
function setLoading(loading: boolean): void {
  analyzeBtn.disabled = loading;
  currentTabBtn.disabled = loading;
  urlInput.disabled = loading;

  if (loading) {
    analyzeBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status"></span>
      Analyzing...
    `;
  } else {
    analyzeBtn.innerHTML = `
      <i class="bi bi-waveform me-2"></i>
      Analyze audio
    `;
  }
}

/**
 * Shows the result in the side panel after a successful analysis.
 */
function showResult(data: AnalyzeResponse): void {
  const main = document.querySelector(".app-body") as HTMLElement;

  main.innerHTML = `
    <div class="result-card">
      <div class="d-flex align-items-center gap-2 mb-2">
        <i class="bi bi-check-circle-fill text-success"></i>
        <span class="fw-semibold">Download complete</span>
      </div>

      <div class="result-meta">
        <p class="result-title">${data.title}</p>
        <p class="result-duration">
          <i class="bi bi-clock me-1"></i>
          ${formatDuration(data.duration)}
        </p>
      </div>

      <div class="pipeline-status mt-3">
        <p class="label-muted mb-2">Pipeline status</p>
        ${Object.entries(data.steps).map(([step, status]) => `
          <div class="d-flex align-items-center justify-content-between py-1">
            <span class="step-name">${formatStepName(step)}</span>
            <span class="badge ${status === 'done' ? 'badge-supported' : 'badge-default'}">
              ${status}
            </span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/**
 * Shows an error message in the side panel.
 */
function showError(message: string): void {
  const main = document.querySelector(".app-body") as HTMLElement;
  const currentContent = main.innerHTML;

  // Insert error alert at the top, keep the form
  const alertHtml = `
    <div class="alert alert-danger d-flex align-items-center gap-2 mb-3" role="alert">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>${message}</span>
    </div>
  `;

  // Remove any existing alert first
  const existingAlert = main.querySelector(".alert");
  if (existingAlert) existingAlert.remove();

  main.insertAdjacentHTML("afterbegin", alertHtml);
}

/**
 * Formats seconds into a readable duration string.
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);

  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/**
 * Formats a pipeline step key into a readable name.
 */
function formatStepName(step: string): string {
  return step.charAt(0).toUpperCase() + step.slice(1);
}


// --- Event Handlers ---

/**
 * Handles the "Analyze audio" button click.
 */
async function handleAnalyze(): Promise<void> {
  const url = urlInput.value.trim();
  const result = validateUrl(url);

  if (!result.valid) {
    showValidationError(result.message ?? "Invalid URL.");
    return;
  }

  // Remove any previous error
  const existingAlert = document.querySelector(".alert");
  if (existingAlert) existingAlert.remove();

  setLoading(true);

  try {
    const data = await callAnalyzeApi(url);
    showResult(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    showError(message);
  } finally {
    setLoading(false);
  }
}

/**
 * Handles the "Use current tab URL" button click.
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

urlInput.addEventListener("keydown", (event: KeyboardEvent): void => {
  if (event.key === "Enter") {
    handleAnalyze();
  }
});