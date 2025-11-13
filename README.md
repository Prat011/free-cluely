# 🎯 Horalix Halo - Next-Generation AI Desktop Assistant

> "A silent AI halo around your work: meetings, code, and research."

**Horalix Halo** is a powerful, beautiful desktop AI assistant built with cutting-edge technology. It combines multi-provider LLM support, intelligent mode switching, real-time meeting assistance, and a stunning glassmorphism UI into one seamless experience.

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-33.2-brightgreen.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)

---

## ✨ Key Features

### 🧠 **Multi-Provider AI System**
- **5 AI Providers**: DeepSeek (primary), OpenAI, Anthropic (Claude), Google (Gemini), Ollama
- **15+ Models**: GPT-4, Claude Sonnet 4, Gemini 2.0 Flash, DeepSeek V3, Llama 3.2, and more
- **Real-time Streaming**: SSE streaming with reasoning extraction
- **Smart Caching**: LRU cache with automatic fallback and cost tracking

### 🎯 **Intelligent Mode System**
- **Auto Mode**: AI automatically detects the best approach
- **Coding Mode**: Optimized for development (low temperature, best practices)
- **Meeting Mode**: Real-time transcription + 9 specialized quick actions
- **Research Mode**: Deep analysis with comprehensive responses

### 📝 **Answer Type Control (9 Types)**
Choose exactly how the AI responds:
- Auto, Short, Detailed, Step-by-Step
- Code-Only, ELI5, Concise
- Conversational, Academic

### 🎙️ **Meeting Experience**
9 specialized quick actions:
1. Quick Summary
2. Action Items extraction
3. Key Decisions highlight
4. Follow-up suggestions
5. Explain Technical concepts
6. Clarify Points
7. Counter-Arguments
8. Generate Response
9. Email Draft

### 💎 **Premium UI/UX**
- **Glassmorphism Design**: Beautiful iOS/macOS-inspired aesthetic
- **Purple/Indigo/Teal Gradients**: Professional brand identity
- **Framer Motion Animations**: Smooth, buttery transitions
- **Keyboard-First**: Every action has a shortcut
- **Dark Theme**: Easy on the eyes

### 💾 **Persistent Sessions**
- **SQLite Database**: All conversations saved locally
- **Full-text Search**: Find any message instantly
- **Context Management**: Screenshots, notes, clipboard history
- **Session History**: Resume conversations anytime

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+ recommended)
- At least one AI provider API key (DeepSeek recommended for best cost/performance)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd free-cluely

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys
```

### Environment Setup

Create a `.env` file:

```env
# DeepSeek (Recommended - Best value)
DEEPSEEK_API_KEY=your_deepseek_key_here

# Optional: Other Providers
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key

# Optional: Local AI
OLLAMA_BASE_URL=http://localhost:11434
```

### Run Development Mode

```bash
npm start
```

This will:
1. Start Vite dev server on port 5180
2. Compile TypeScript for Electron
3. Launch the app with hot reload

### Build for Production

```bash
npm run app:build
```

Creates distributable packages in `release/`:
- **macOS**: `.dmg` (x64, arm64)
- **Windows**: `.exe` installer + portable
- **Linux**: AppImage, `.deb`

---

## ⌨️ Keyboard Shortcuts

### Global
- `⌘K` / `Ctrl+K` - **Command Palette** (fuzzy search all commands)
- `⌘,` / `Ctrl+,` - **Settings**
- `⌘B` / `Ctrl+B` - **Toggle Sidebar**
- `⌘⇧Space` - **Toggle Overlay**
- `ESC` - Close dialogs

### Chat
- `Enter` - Send message
- `Shift+Enter` - New line

### Meeting Mode
- `⌘1-9` - Quick actions 1-9

---

## 📖 Full Documentation

For comprehensive documentation including:
- Complete architecture overview
- Detailed file structure
- Code examples
- API reference
- Performance metrics
- Security details

**See: [HORALIX_HALO_COMPLETE.md](./HORALIX_HALO_COMPLETE.md)**

---

## 🎨 Screenshots

### Main Chat Interface
Beautiful glassmorphism design with real-time streaming responses.

### Meeting Mode
Quick action toolbar with 9 specialized meeting assistance features.

### Command Palette
Fuzzy search across all commands with keyboard navigation.

### Context Panel
Manage screenshots, transcripts, notes, and clipboard history.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  Renderer (React + Zustand)                 │
│  ├─ ChatPanel                               │
│  ├─ ContextPanel                            │
│  ├─ MeetingToolbar                          │
│  └─ CommandPalette                          │
└─────────────────────────────────────────────┘
              ↕ IPC (window.horalix)
┌─────────────────────────────────────────────┐
│  Main Process (Electron)                    │
│  ├─ LLM Engine (5 providers)                │
│  ├─ Session Engine (SQLite)                 │
│  └─ IPC Handlers                            │
└─────────────────────────────────────────────┘
```

---

## 🆚 Comparison

### vs. ChatGPT Desktop
✅ Multi-provider (not locked to OpenAI)
✅ Meeting transcription
✅ Screenshot context
✅ Answer type control
✅ Session persistence
✅ Keyboard-first design

### vs. Cursor
✅ Meeting mode
✅ Multi-provider
✅ Context management
✅ Cost tracking
✅ Glassmorphism UI
✅ Command palette

### vs. Free Cluely (Original)
✅ 5 providers (was 2)
✅ SQLite persistence
✅ Beautiful UI
✅ Meeting mode
✅ Answer types
✅ Command palette

---

## 💻 Tech Stack

- **Electron** 33.2 - Desktop app framework
- **React** 18.3 - UI library
- **TypeScript** 5.6 - Type safety
- **Tailwind CSS** 3.4 - Styling
- **Framer Motion** 11 - Animations
- **Zustand** 5.0 - State management
- **better-sqlite3** - Database
- **react-markdown** - Markdown rendering

---

## 🐛 Troubleshooting

### App won't start
```bash
# Kill processes on port 5180
lsof -i :5180
kill <PID>

# Clean install
rm -rf node_modules package-lock.json
npm install
```

### No AI responses
1. Check API keys in `.env`
2. Verify provider is online
3. Check console logs (`⌘⌥I`)

### Build errors
```bash
# Clean build
npm run clean
npm install
npm run build
```

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

**Priority areas:**
- Provider configuration UI
- Screenshot OCR integration
- STT engine for meetings
- Voice input
- Plugin system

---

## 📄 License

ISC License - Free for personal and commercial use.

---

## 🙏 Acknowledgments

Inspired by [Free Cluely](https://cluely.com) by [@prathitjoshi_](https://x.com/prathitjoshi_)

Built with ❤️ using:
- Electron, React, TypeScript
- DeepSeek, OpenAI, Anthropic, Google, Ollama
- Tailwind CSS, Framer Motion
- better-sqlite3, Zustand

---

## 📬 Contact

For questions, feedback, or collaboration:
- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)

---

## ⭐ Support

If Horalix Halo helps you in your work, please consider:
- ⭐ **Starring this repository**
- 🐛 **Reporting bugs**
- 💡 **Suggesting features**
- 🤝 **Contributing code**
- 📢 **Spreading the word**

---

### 🏷️ Tags
`ai-assistant` `electron` `react` `typescript` `llm` `chatbot` `openai` `anthropic` `deepseek` `gemini` `ollama` `meeting-assistant` `coding-assistant` `glassmorphism` `desktop-app` `cross-platform` `multi-provider` `real-time-streaming` `command-palette` `sqlite` `zustand`

---

**Built with 💜 by the Horalix team**
