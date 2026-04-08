# 🎙️ Voice Recording & Gemini Model Selection Features

## 📋 Overview
This PR introduces the highly anticipated **Voice Recording** feature with live transcription powered by Deepgram, and seamless integration with the Gemini API to analyze the transcribed discussions. It also brings dynamic **Gemini Model Selection** directly to the user interface, alongside major stability improvements for API rate limits and WebSockets.

## ✨ New Features

### 1. Global "Record Voice" Shortcut (`Ctrl+Shift+R`)
- Added a global keyboard shortcut (`Ctrl+Shift+R`) that can be triggered from anywhere to instantly capture system and microphone audio.
- The UI dynamically displays a live transcription feed of the ongoing conversation in real-time.

### 2. Deepgram Live Transcription Integration
- Integrated the Deepgram WebSocket API (`wss://api.deepgram.com/v1/listen`) with the `nova-3` model for state-of-the-art live Speech-to-Text (STT).
- Captures and merges both internal system desktop audio and external microphone input.
- Added live, multi-language translation support directly via Deepgram’s API features.

### 3. Gemini Audio Analysis Pipeline
- Once recording is stopped, the final highly-accurate Deepgram transcript is immediately forwarded to the selected Gemini model.
- Automatically generates AI responses and problem-solving solutions based purely on the spoken conversation.

### 4. Dynamic Gemini Model Selector
- Added a dedicated settings interface for users to select their preferred Gemini model.
- Includes support for the newest high-throughput, free-tier models:
  - **Gemini 2.5 Flash** (5 RPM · 20 RPD)
  - **Gemini 3 Flash** (5 RPM · 20 RPD)
  - **Gemini 2.5 Flash Lite** (10 RPM · 20 RPD)
- Auto-persists the user's model selection and language targets to `localStorage`.

## 🛠️ Stability & Performance Fixes

- **Deepgram Audio Stream Buffering:** Implemented a `pendingChunks` queue to buffer all early audio chunks locally. Once the Deepgram `socket.onopen` fires, the queue is instantaneously flushed. This guarantees that critical **WebM Container Headers** are never silently dropped before the connection opens, ensuring 100% reliable transcription decoding.
- **Robust Mutex for Concurrent Toggles:** Shifted the recording status check to a synchronous React ref (`isRecordingRef`) with a hard mutex (`isTogglingRef`) wrapped in a `try/finally` block. This strictly prevents the `toggleRecording` execution from being double-triggered, eliminating the `Gemini 429 Too Many Requests` API spam bug.
- **Micro-recording Guard:** Implemented a minimum duration tracking metric (1 second). Accidental double-taps on the shortcut will still halt the recording correctly but will gracefully skip submitting the negligible audio payload safely, saving valuable RPM/RPD limits.
