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

interface Segment {
  start: number;
  end: number;
  speaker: number | null;
  content: string;
}

interface AnalyzeResponse {
  status: string;
  file_id: string;
  title: string;
  duration: number;
  transcription: {
    full_text: string;
    segments: Segment[];
    processing_time: number;
  };
  steps: {
    download: string;
    transcription: string;
    segmentation: string;
    summarization: string;
    indexing: string;
  };
  topics: Topic[];
}

interface TopicSentence {
  text: string;
  start: number;
  end: number;
  speaker: number | null;
}

interface Topic {
  topic_number: number;
  start: number;
  end: number;
  speakers: number[];
  summary: string;
  sentences: TopicSentence[];
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
 * Formats seconds into a timestamp string like "1:23" or "0:05".
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Formats seconds into a readable duration string like "3m 20s".
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);

  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/**
 * Builds the HTML for a single transcript segment.
 */
function buildSegmentHtml(segment: Segment): string {
  const timeRange = `${formatTimestamp(segment.start)} — ${formatTimestamp(segment.end)}`;
  const speaker = segment.speaker !== null ? `Speaker ${segment.speaker}` : "";

  return `
    <div class="segment-card">
      <div class="segment-header">
        <span class="segment-time">${timeRange}</span>
        ${speaker ? `<span class="segment-speaker">${speaker}</span>` : ""}
      </div>
      <p class="segment-content">${segment.content}</p>
    </div>
  `;
}


/**
 * Builds the HTML for a single topic card.
 */
function buildTopicHtml(topic: Topic): string {
  const timeRange = `${formatTimestamp(topic.start)} — ${formatTimestamp(topic.end)}`;
  const speakers = topic.speakers.length > 0
    ? topic.speakers.map(s => `Speaker ${s}`).join(", ")
    : "";

  const sentencesHtml = topic.sentences
    .map(s => `<p class="topic-sentence">${s.text}</p>`)
    .join("");

  return `
    <div class="topic-card">
      <div class="topic-header">
        <span class="topic-number">Topic ${topic.topic_number}</span>
        <span class="segment-time">${timeRange}</span>
      </div>
      ${speakers ? `<p class="segment-speaker">${speakers}</p>` : ""}
      ${topic.summary ? `<p class="topic-summary">${topic.summary}</p>` : ""}
      <div class="topic-sentences">
        ${sentencesHtml}
      </div>
    </div>
  `;
}


/**
 * Shows the full results in the side panel.
 */
function showResult(data: AnalyzeResponse): void {
  const main = document.querySelector(".app-body") as HTMLElement;
  const footer = document.querySelector(".app-footer") as HTMLElement;

  // Hide the footer info box
  if (footer) footer.style.display = "none";

  // Build segments HTML
  const segmentsHtml = data.transcription.segments
    .map(buildSegmentHtml)
    .join("");

  main.innerHTML = `
    <!-- Header info -->
    <div class="result-header">
      <p class="result-title">${data.title}</p>
      <div class="result-meta-row">
        <span class="result-meta-item">
          <i class="bi bi-clock me-1"></i>
          ${formatDuration(data.duration)}
        </span>
        <span class="result-meta-item">
          <i class="bi bi-mic me-1"></i>
          ${data.transcription.segments.length} segments
        </span>
      </div>
    </div>

    <!-- Full transcript (collapsible) -->
    <div class="transcript-section">
      <button
        class="btn btn-sm btn-outline-secondary w-100 mb-3"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#fullTranscript"
      >
        <i class="bi bi-text-left me-1"></i>
        Show full transcript
      </button>
      <div class="collapse" id="fullTranscript">
        <div class="full-transcript-box">
          ${data.transcription.full_text}
        </div>
      </div>
    </div>

<!-- Topics -->
    <div class="topics-section">
      <p class="label-muted mb-2">Topics (${data.topics.length} found)</p>
      ${data.topics.map(buildTopicHtml).join("")}
    </div>

    <!-- Raw segments (collapsible) -->
    <div class="segments-section">
      <button
        class="btn btn-sm btn-outline-secondary w-100 mb-3"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#rawSegments"
      >
        <i class="bi bi-list me-1"></i>
        Show raw transcript segments
      </button>
      <div class="collapse" id="rawSegments">
        ${segmentsHtml}
      </div>
    </div>

    <!-- Pipeline status -->
    <div class="pipeline-section">
      <p class="label-muted mb-2">Pipeline status</p>
      ${Object.entries(data.steps).map(([step, status]) => `
        <div class="d-flex align-items-center justify-content-between py-1">
          <span class="step-name">${step.charAt(0).toUpperCase() + step.slice(1)}</span>
          <span class="badge ${status === "done" ? "badge-supported" : "badge-default"}">
            ${status}
          </span>
        </div>
      `).join("")}
    </div>

    <!-- Analyze another -->
    <button class="btn btn-outline-secondary w-100 mt-3" id="newAnalysisBtn">
      <i class="bi bi-arrow-left me-1"></i>
      Analyze another
    </button>
  `;

  // "Analyze another" reloads the panel to start fresh
  document.getElementById("newAnalysisBtn")?.addEventListener("click", () => {
    location.reload();
  });
}

/**
 * Shows an error message in the side panel.
 */
function showError(message: string): void {
  const main = document.querySelector(".app-body") as HTMLElement;

  const alertHtml = `
    <div class="alert alert-danger d-flex align-items-center gap-2 mb-3" role="alert">
      <i class="bi bi-exclamation-triangle-fill"></i>
      <span>${message}</span>
    </div>
  `;

  const existingAlert = main.querySelector(".alert");
  if (existingAlert) existingAlert.remove();

  main.insertAdjacentHTML("afterbegin", alertHtml);
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