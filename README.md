# Audio Insight

Transcribe YouTube audio, break it into topics, and search by meaning.

## Setup

**Backend:**
```bash
cd backend
python -m venv venv_audio
source venv_audio/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Extension:**
```bash
cd extension
npm install
npm run build
```
Load unpacked in chrome://extensions → select the extension/ folder.

**Colab:**
Open `notebooks/vibevoice_asr_colab.ipynb` in Google Colab with a GPU runtime. Copy the ngrok URL into `backend/app/config.py`.

## Pipeline

- [x] Audio download
- [x] Transcription (VibeVoice-ASR)
- [ ] Topic segmentation
- [ ] Summarization
- [ ] Semantic search