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

interface TopicSentence {
  text: string;
  start: number;
  end: number;
  speaker: number | null;
}

interface Topic {
  topic_number: number;
  title: string;
  start: number;
  end: number;
  speakers: number[];
  summary: string;
  sentences: TopicSentence[];
}

interface SearchResult {
  text: string;
  start: number;
  end: number;
  speaker: number | null;
  score: number;
  video_id?: string;
  title?: string;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
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
  topics: Topic[];
  steps: {
    download: string;
    transcription: string;
    segmentation: string;
    summarization: string;
    indexing: string;
  };
}

interface LibraryItem {
  video_id: string;
  title: string;
  duration: number;
  topics_count: number;
}


// --- DOM Elements ---
const urlInput      = document.getElementById("urlInput") as HTMLInputElement;
const analyzeBtn    = document.getElementById("analyzeBtn") as HTMLButtonElement;
const currentTabBtn = document.getElementById("currentTabBtn") as HTMLButtonElement;


// --- Tab Navigation ---

function initTabs(): void {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (!tab) return;

      // Update active tab button
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Show/hide tab content
      document.querySelectorAll(".tab-content").forEach(content => {
        (content as HTMLElement).style.display = "none";
      });

      if (tab === "analyze") {
        const analyzeTab = document.getElementById("analyzeTab") as HTMLElement;
        analyzeTab.style.display = "block";
      } else if (tab === "library") {
        const libraryTab = document.getElementById("libraryTab") as HTMLElement;
        libraryTab.style.display = "block";
        loadLibrary();
      }
    });
  });
}


// --- Validation ---

function validateUrl(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return { valid: false, message: "Please enter a URL." };
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

function isSupportedSource(url: string): boolean {
  try {
    const parsed = new URL(url);
    return CONFIG.supportedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}


// --- API ---

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

async function callSearchApi(query: string, videoIds: string[] = []): Promise<SearchResponse> {
  const body: any = { query };
  if (videoIds.length > 0) {
    body.video_ids = videoIds;
  }
  const response = await fetch(`${CONFIG.apiBaseUrl}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Search failed");
  }
  return response.json();
}

async function callLibraryApi(): Promise<LibraryItem[]> {
  const response = await fetch(`${CONFIG.apiBaseUrl}/library`);
  if (!response.ok) throw new Error("Failed to load library");
  const data = await response.json();
  return data.library;
}


// --- UI Helpers ---

function showValidationError(message: string): void {
  urlInput.classList.add("is-invalid");
  let feedback = urlInput.parentElement?.querySelector(".invalid-feedback") as HTMLElement | null;
  if (!feedback) {
    feedback = document.createElement("div");
    feedback.className = "invalid-feedback";
    urlInput.parentElement?.appendChild(feedback);
  }
  feedback.textContent = message;
}

function clearValidationError(): void {
  urlInput.classList.remove("is-invalid");
}

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

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}


// --- Topic HTML ---

function buildTopicHtml(topic: Topic): string {
  const timeRange = `${formatTimestamp(topic.start)} — ${formatTimestamp(topic.end)}`;
  const topicId = `topic-${topic.topic_number}`;

  const sentencesHtml = topic.sentences
    .map(s => `<p class="topic-sentence">${s.text}</p>`)
    .join("");

  return `
    <div class="topic-row" data-target="#${topicId}">
      <div class="topic-row-left">
        <span class="topic-num">${topic.topic_number}</span>
        <span class="topic-name">${topic.title || 'Topic ' + topic.topic_number}</span>
      </div>
      <span class="topic-time">${timeRange}</span>
    </div>
    <div class="topic-detail" id="${topicId}" style="display: none;">
      <div class="topic-expanded">
        ${topic.summary ? `<p class="topic-summary">${topic.summary}</p>` : ""}
        <div class="topic-full-text" id="${topicId}-full" style="display: none;">
          ${sentencesHtml}
        </div>
        <button class="btn-show-full" data-target="#${topicId}-full">Show full text</button>
      </div>
    </div>
  `;
}


// --- Search Result HTML ---

function buildSearchResultHtml(result: SearchResult): string {
  const time = formatTimestamp(result.start);
  const score = Math.round(result.score * 100);
  const source = result.title ? `<span class="search-source">${result.title}</span>` : "";

  return `
    <div class="search-result-card">
      <div class="search-result-header">
        <span class="segment-time">${time}</span>
        <span class="search-score">${score}% match</span>
      </div>
      ${source}
      <p class="segment-content">${result.text}</p>
    </div>
  `;
}


// --- Search Handler ---

async function handleSearch(): Promise<void> {
  const searchInput = document.getElementById("searchInput") as HTMLInputElement;
  const searchResults = document.getElementById("searchResults") as HTMLElement;
  const query = searchInput.value.trim();
  if (!query) return;

  searchResults.innerHTML = `
    <div class="d-flex align-items-center gap-2 py-3">
      <span class="spinner-border spinner-border-sm" role="status"></span>
      <span>Searching...</span>
    </div>
  `;

  try {
    const data = await callSearchApi(query);
    if (data.results.length === 0) {
      searchResults.innerHTML = `<p class="text-muted py-2">No results found.</p>`;
      return;
    }
    searchResults.innerHTML = data.results.map(buildSearchResultHtml).join("");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    searchResults.innerHTML = `<div class="alert alert-danger">${message}</div>`;
  }
}


// --- Library ---

async function loadLibrary(): Promise<void> {
  const container = document.getElementById("libraryContent") as HTMLElement;

  try {
    const library = await callLibraryApi();

    if (library.length === 0) {
      container.innerHTML = `
        <div class="empty-library">
          <i class="bi bi-collection"></i>
          <p>No analyzed audios yet</p>
          <p class="label-muted">Switch to the Analyze tab to get started</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <!-- Library Search -->
      <div class="search-section">
        <p class="label-muted mb-2">Search across all audios</p>
        <div class="input-group mb-2">
          <input
            type="text"
            id="librarySearchInput"
            class="form-control"
            placeholder="Search by meaning..."
          />
          <button class="btn btn-analyze" id="librarySearchBtn">
            <i class="bi bi-search"></i>
          </button>
        </div>
        <div id="librarySearchResults"></div>
      </div>

      <!-- Audio List -->
      <div class="library-section">
        <p class="label-muted mb-2">Analyzed audios (${library.length})</p>
        ${library.map(buildLibraryItemHtml).join("")}
      </div>
    `;

    // Library search handler
    document.getElementById("librarySearchBtn")?.addEventListener("click", handleLibrarySearch);
    document.getElementById("librarySearchInput")?.addEventListener("keydown", (e: Event) => {
      if ((e as KeyboardEvent).key === "Enter") handleLibrarySearch();
    });

// Library item click — load cached result (only on info/arrow, not checkbox)
    document.querySelectorAll(".library-item-info, .library-item-arrow").forEach((el) => {
      el.addEventListener("click", () => {
        const videoId = el.getAttribute("data-video-id");
        if (videoId) loadCachedResult(videoId);
      });
    });

  } catch (error) {
    container.innerHTML = `<p class="text-muted">Could not load library. Is the backend running?</p>`;
  }
}

function buildLibraryItemHtml(item: LibraryItem): string {
  return `
    <div class="library-item">
      <label class="library-checkbox">
        <input type="checkbox" class="library-check" value="${item.video_id}" checked />
      </label>
      <div class="library-item-info" data-video-id="${item.video_id}">
        <span class="library-item-title">${item.title}</span>
        <span class="library-item-meta">
          ${formatDuration(item.duration)} · ${item.topics_count} topics
        </span>
      </div>
      <i class="bi bi-chevron-right library-item-arrow" data-video-id="${item.video_id}"></i>
    </div>
  `;
}

async function loadCachedResult(videoId: string): Promise<void> {
  try {
    const response = await fetch(`${CONFIG.apiBaseUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
    });
    if (!response.ok) throw new Error("Failed to load");
    const data = await response.json();

    // Switch to analyze tab and show result
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById("tabAnalyze")?.classList.add("active");
    document.querySelectorAll(".tab-content").forEach(c => {
      (c as HTMLElement).style.display = "none";
    });
    const analyzeTab = document.getElementById("analyzeTab") as HTMLElement;
    analyzeTab.style.display = "block";

    showResult(data);
  } catch (error) {
    console.error("Failed to load cached result:", error);
  }
}

async function handleLibrarySearch(): Promise<void> {
  const searchInput = document.getElementById("librarySearchInput") as HTMLInputElement;
  const searchResults = document.getElementById("librarySearchResults") as HTMLElement;
  const query = searchInput.value.trim();
  if (!query) return;

  // Get only checked video IDs
  const checkedBoxes = document.querySelectorAll(".library-check:checked");
  const videoIds = Array.from(checkedBoxes).map(cb => (cb as HTMLInputElement).value);

  if (videoIds.length === 0) {
    searchResults.innerHTML = `<p class="text-muted py-2">Select at least one audio to search.</p>`;
    return;
  }

  searchResults.innerHTML = `
    <div class="d-flex align-items-center gap-2 py-3">
      <span class="spinner-border spinner-border-sm" role="status"></span>
      <span>Searching ${videoIds.length} audio(s)...</span>
    </div>
  `;

  try {
    const data = await callSearchApi(query, videoIds);
    if (data.results.length === 0) {
      searchResults.innerHTML = `<p class="text-muted py-2">No results found.</p>`;
      return;
    }
    searchResults.innerHTML = data.results.map(buildSearchResultHtml).join("");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    searchResults.innerHTML = `<div class="alert alert-danger">${message}</div>`;
  }
}


// --- Show Results ---

function showResult(data: AnalyzeResponse): void {
  const main = document.getElementById("analyzeTab") as HTMLElement;
  const footer = document.getElementById("appFooter") as HTMLElement;
  if (footer) footer.style.display = "none";

  main.innerHTML = `
    <!-- Header with "New" button -->
    <div class="result-header">
      <div class="result-header-top">
        <p class="result-title">${data.title}</p>
        <button class="btn-new-analysis" id="newAnalysisBtn" title="Analyze another">
          <i class="bi bi-plus-lg"></i> New
        </button>
      </div>
      <div class="result-meta-row">
        <span class="result-meta-item">
          <i class="bi bi-clock me-1"></i>
          ${formatDuration(data.duration)}
        </span>
        <span class="result-meta-item">
          <i class="bi bi-chat-left-text me-1"></i>
          ${data.topics.length} topics
        </span>
        <span class="result-meta-item">
          <i class="bi bi-mic me-1"></i>
          ${data.transcription.segments.length} segments
        </span>
      </div>
    </div>

    <!-- Search -->
    <div class="search-section">
      <p class="label-muted mb-2">Search transcript</p>
      <div class="input-group mb-2">
        <input
          type="text"
          id="searchInput"
          class="form-control"
          placeholder="Search by meaning..."
        />
        <button class="btn btn-analyze" id="searchBtn">
          <i class="bi bi-search"></i>
        </button>
      </div>
      <div id="searchResults"></div>
    </div>

    <!-- Topics -->
    <div class="topics-section">
      <div class="section-toggle" id="topicsToggle">
        <p class="label-muted mb-0">Topics (${data.topics.length})</p>
        <i class="bi bi-chevron-down toggle-icon toggle-open" id="topicsChevron"></i>
      </div>
      <div id="topicsList" style="margin-top: 10px;">
        ${data.topics.map(buildTopicHtml).join("")}
      </div>
    </div>

    <!-- Full transcript -->
    <div class="transcript-section">
      <div class="section-toggle" id="transcriptToggle">
        <p class="label-muted mb-0">Full transcript</p>
        <i class="bi bi-chevron-down toggle-icon" id="transcriptChevron"></i>
      </div>
      <div id="fullTranscript" style="display: none; margin-top: 10px;">
        <div class="full-transcript-box">
          ${data.transcription.full_text}
        </div>
      </div>
    </div>
  `;

  // --- Event Listeners ---

  document.getElementById("newAnalysisBtn")?.addEventListener("click", () => {
    location.reload();
  });

  document.getElementById("searchBtn")?.addEventListener("click", handleSearch);
  document.getElementById("searchInput")?.addEventListener("keydown", (e: Event) => {
    if ((e as KeyboardEvent).key === "Enter") handleSearch();
  });

  document.getElementById("topicsToggle")?.addEventListener("click", () => {
    const list = document.getElementById("topicsList") as HTMLElement;
    const chevron = document.getElementById("topicsChevron") as HTMLElement;
    const isVisible = list.style.display !== "none";
    list.style.display = isVisible ? "none" : "block";
    chevron.classList.toggle("toggle-open", !isVisible);
  });

  document.querySelectorAll(".topic-row").forEach((row) => {
    row.addEventListener("click", () => {
      const targetId = row.getAttribute("data-target");
      if (targetId) {
        const detail = document.querySelector(targetId) as HTMLElement;
        if (detail) {
          const isVisible = detail.style.display !== "none";
          detail.style.display = isVisible ? "none" : "block";
        }
      }
    });
  });

  document.querySelectorAll(".btn-show-full").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetId = btn.getAttribute("data-target");
      if (targetId) {
        const fullText = document.querySelector(targetId) as HTMLElement;
        if (fullText) {
          const isVisible = fullText.style.display !== "none";
          fullText.style.display = isVisible ? "none" : "block";
          btn.textContent = isVisible ? "Show full text" : "Hide full text";
        }
      }
    });
  });

  document.getElementById("transcriptToggle")?.addEventListener("click", () => {
    const transcript = document.getElementById("fullTranscript") as HTMLElement;
    const chevron = document.getElementById("transcriptChevron") as HTMLElement;
    const isVisible = transcript.style.display !== "none";
    transcript.style.display = isVisible ? "none" : "block";
    chevron.classList.toggle("toggle-open", !isVisible);
  });
}


// --- Error Display ---

function showError(message: string): void {
  const main = document.getElementById("analyzeTab") as HTMLElement;
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

async function handleUseCurrentTab(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      urlInput.value = tab.url;
      clearValidationError();
    }
  } catch (error) {
    console.error("Could not get current tab URL:", error);
  }
}


// --- Initialize ---
initTabs();
analyzeBtn.addEventListener("click", handleAnalyze);
currentTabBtn.addEventListener("click", handleUseCurrentTab);
urlInput.addEventListener("input", clearValidationError);
urlInput.addEventListener("keydown", (event: KeyboardEvent): void => {
  if (event.key === "Enter") handleAnalyze();
});