## Summary
This PR fixes repeated runtime crashes in Ollama mode during media analysis and adds capability-aware model handling for image/audio workflows.

## Bug Details
In Ollama mode, media analysis paths were still using Gemini-only calls:
- analyzeAudioFromBase64 and analyzeAudioFile called Gemini generateContent
- analyzeImageFile and image-debug/image-extraction paths could also route to Gemini-only behavior

When Ollama was selected, the Gemini model instance was null by design, which caused:
- TypeError: Cannot read properties of null (reading 'generateContent')

## Root Cause Analysis
1. Provider mismatch in media paths
- Ollama mode sets useOllama=true and does not initialize Gemini model.
- Several media methods still dereferenced this.model.generateContent.

2. Missing capability awareness for Ollama models
- The app fetched model names but had no concept of modality support.
- Image and audio calls did not verify whether the selected Ollama model could process those modalities.

3. No guidance/fallbacks
- Failures surfaced as generic runtime exceptions rather than actionable remediation.

## Fix Implemented
### 1) Provider-safe execution paths
- Added Gemini guard helper to prevent null dereference for Gemini-only invocations.
- Updated generation paths to branch by active provider.

### 2) Ollama image support
- Added Ollama multimodal image handling via /api/chat with messages[].images.
- Image extraction/debug/analysis now work in Ollama mode when the selected model supports vision.

### 3) Ollama audio support path
- Added best-effort Ollama audio analysis via /api/chat.
- Tries compatible payload variants for broader Ollama/model compatibility.
- Returns actionable install guidance if audio is unsupported by current installation/model.

### 4) Capability detection and auto-selection
- Added capability inference from Ollama /api/tags model metadata (name + families/details) for:
  - supportsVision
  - supportsAudio
- Before media analysis, the helper now:
  - validates current model capability
  - auto-switches to an installed capability-matching model when available
  - emits clear install guidance when no capable model exists

### 5) IPC and UI exposure
- Exposed capability metadata through Electron IPC/preload APIs.
- Model selector now shows capability badges (vision/audio), selected model capability summary, and install hints when missing.

## Files Changed
- electron/LLMHelper.ts
- electron/ipcHandlers.ts
- electron/preload.ts
- src/components/ui/ModelSelector.tsx
- src/App.tsx
- src/types/electron.d.ts

## Validation
- Electron typecheck: npx tsc -p electron/tsconfig.json
- Workspace typecheck: npx tsc --noEmit
- Result: no TypeScript errors.

## Behavioral Impact
- Eliminates null dereference crashes in Ollama mode for media-triggered flows.
- Enables image analysis in Ollama mode when a vision-capable model is installed.
- Adds best-effort audio path in Ollama mode, with explicit guidance when unsupported.

## Notes
- Capability detection is heuristic-based from Ollama model metadata and naming.
- Audio support depends on Ollama version and model-specific multimodal support.

## Example Install Guidance
- Vision-capable models:
  - ollama pull llama3.2-vision:11b
  - ollama pull llava:7b
- Audio-capable models (if available in your Ollama build):
  - ollama pull qwen2-audio:7b

## Risk Assessment
Low-to-medium:
- Adds provider checks and fallback logic but keeps existing API surface largely unchanged.
- Main risk is false positives/negatives from capability inference heuristics, mitigated by clear error messaging and install hints.

## Follow-up (Optional)
- Replace heuristic capability inference with explicit capability probing against model metadata when Ollama exposes richer modality attributes.
