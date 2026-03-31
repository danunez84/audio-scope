# Audio Insight — Chrome Extension

Chrome side-panel extension for transcribing, segmenting, summarizing, and semantically searching audio content.

## Project Structure

```
audio-insight-extension/
├── manifest.json          # Chrome extension manifest (V3)
├── package.json           # Node dependencies & scripts
├── tsconfig.json          # TypeScript configuration
├── sidepanel.html         # Side panel HTML (loads Bootstrap + compiled JS)
├── styles/
│   └── sidepanel.css      # Custom styles
├── src/
│   ├── background.ts      # Service worker (opens side panel)
│   └── sidepanel.ts       # Side panel logic (URL input, validation)
├── dist/                  # Compiled JS output (git-ignored)
│   ├── background.js
│   └── sidepanel.js
└── icons/
    └── (extension icons)
```

## Setup

### Prerequisites
- Node.js 18+
- npm
- Google Chrome

### Install & Build

```bash
# Install dependencies
npm install

# Compile TypeScript (one-time)
npm run build

# Or watch for changes during development
npm run watch
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder (the one containing `manifest.json`)
5. Click the extension icon — the side panel opens on the right

### Development Workflow

1. Run `npm run watch` in a terminal
2. Edit `.ts` files in `src/`
3. TypeScript compiles automatically to `dist/`
4. Go to `chrome://extensions` and click the refresh icon on Audio Insight
5. Reopen the side panel to see changes
