# Cluely

[Cluely](https://cluely.com) - The invisible desktop assistant that provides real-time insights, answers, and support during meetings, interviews, presentations, and professional conversations.

## Sponsored by Recall AI - API for desktop recording
If you’re looking for a hosted desktop recording API, consider checking out [Recall.ai](https://www.recall.ai/product/desktop-recording-sdk?utm_source=github&utm_medium=sponsorship&utm_campaign=prat011-free-cluely), an API that records Zoom, Google Meet, Microsoft Teams, in-person meetings, and more.

## 🚀 Quick Start Guide

### Prerequisites
- Make sure you have Node.js installed on your computer
- Git installed on your computer  
- **Either** a Gemini API key (get it from [Google AI Studio](https://makersuite.google.com/app/apikey))
- **Or** Ollama installed locally for private LLM usage (recommended for privacy)

### Installation Steps

1. Clone the repository:
```bash
git clone [repository-url]
cd free-cluely
```

2. Install dependencies:
```bash
# If you encounter Sharp/Python build errors, use this:
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install --ignore-scripts
npm rebuild sharp

# Or for normal installation:
npm install
```

3. Set up environment variables:
   - Create a file named `.env` in the root folder
   
   **For Gemini (Cloud AI):**
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
   
   **For Ollama (Local/Private AI):**
   ```env
   USE_OLLAMA=true
   OLLAMA_MODEL=llama3.2
   OLLAMA_URL=http://localhost:11434
   ```
   
   - Save the file

### Running the App

#### Method 1: Development Mode (Recommended for first run)
1. Start the development server:
```bash
npm start
```

This command automatically:
- Starts the Vite dev server on port 5180
- Waits for the server to be ready
- Launches the Electron app

#### Method 2: Production Build
```bash
npm run dist
```
The built app will be in the `release` folder.

#### Method 3: Global CLI Command

1. open `package.json` and add :
   ```
   "bin": {
    "start-cluely": "./start.sh"
     }
   ```
2. create a new file start.sh in the root dir, add this in the file 
   ```
   cd "/home/user/Folder/free-cluely"
   npm start
   ```
3. In the terminal, go to folder dir(root) and type :
   ```
   chmod +x start.sh
   npm link
   ```
4. Done! now you can be in any dir in the terminal, you can just type
   ```
   start-cluely
   ```
   to run this application
   
## 🤖 AI Provider Options

### Ollama (Recommended for Privacy)
**Pros:**
- 100% private - data never leaves your computer
- No API costs
- Works offline
- Supports many models: llama3.2, codellama, mistral, etc.

**Setup:**
1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a model: `ollama pull llama3.2`
3. Set environment variables as shown above

### Google Gemini
**Pros:**
- Latest AI technology
- Fastest responses
- Best accuracy for complex tasks

**Cons:**
- Requires API key and internet
- Data sent to Google servers
- Usage costs apply

### ⚠️ Important Notes

1. **Closing the App**: 
   - Press `Cmd + Q` (Mac) or `Ctrl + Q` (Windows/Linux) to quit
   - Or use Activity Monitor/Task Manager to close `Interview Coder`
   - The X button currently doesn't work (known issue)

2. **If the app doesn't start**:
   - Make sure no other app is using port 5180
   - Try killing existing processes:
     ```bash
     # Find processes using port 5180
     lsof -i :5180
     # Kill them (replace [PID] with the process ID)
     kill [PID]
     ```
   - For Ollama users: Make sure Ollama is running (`ollama serve`)

3. **Keyboard Shortcuts**:
   - `Cmd/Ctrl + B`: Toggle window visibility
   - `Cmd/Ctrl + H`: Take screenshot
   - 'Cmd/Enter': Get solution
   - `Cmd/Ctrl + Arrow Keys`: Move window

## 🔧 Troubleshooting

### Windows Issues Fixed 
- **UI not loading**: Port mismatch resolved
- **Electron crashes**: Improved error handling  
- **Build failures**: Production config updated
- **Window focus problems**: Platform-specific fixes applied

### Ubuntu/Linux Issues Fixed 
- **Window interaction**: Fixed focusable settings
- **Installation confusion**: Clear setup instructions
- **Missing dependencies**: All requirements documented

### Common Solutions

#### Sharp/Python Build Errors
If you see `gyp ERR! find Python` or Sharp build errors:
```bash
# Solution 1: Use prebuilt binaries
rm -rf node_modules package-lock.json
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install --ignore-scripts
npm rebuild sharp

# Solution 2: Or install Python (if you prefer building from source)
brew install python3  # macOS
# Then run: npm install
```

#### General Installation Issues
If you see other errors:
1. Delete the `node_modules` folder
2. Delete `package-lock.json` 
3. Run `npm install` again
4. Try running with `npm start`

### Platform-Specific Notes
- **Windows**: App now works on Windows 10/11
- **Ubuntu/Linux**: Tested on Ubuntu 20.04+ and most Linux distros  
- **macOS**: Native support with proper window management

## Key Features

### **Invisible AI Assistant**
- Translucent, always-on-top window that's barely noticeable
- Hide/show instantly with global hotkeys
- Works seamlessly across all applications

### **Smart Screenshot Analysis** 
- Take screenshots of any content with `Cmd/Ctrl + H`
- AI analyzes images, documents, presentations, or problems
- Get instant explanations, answers, and solutions

### **Audio Intelligence**
- Process audio files and recordings
- Real-time transcription and analysis
- Perfect for meeting notes and content review

### **Contextual Chat**
- Chat with AI about anything you see on screen
- Maintains conversation context
- Ask follow-up questions for deeper insights

### **Privacy-First Design**
- **Local AI Option**: Use Ollama for 100% private processing
- **Cloud Option**: Google Gemini for maximum performance
- Screenshots auto-deleted after processing
- No data tracking or storage

### **Cross-Platform Support**
- **Windows 10/11** - Full support with native performance
- **Ubuntu/Linux** - Optimized for all major distributions  
- **macOS** - Native window management and shortcuts

## Use Cases

### **Academic & Learning**
```
✓ Live presentation support during classes
✓ Quick research during online exams  
✓ Language translation and explanations
✓ Math and science problem solving
```

### **Professional Meetings**
```
✓ Sales call preparation and objection handling
✓ Technical interview coaching
✓ Client presentation support
✓ Real-time fact-checking and data lookup
```

### **Development & Tech**
```
✓ Debug error messages instantly
✓ Code explanation and optimization
✓ Documentation and API references
✓ Algorithm and architecture guidance
```

## Why Choose Free Cluely?

| Feature | Free Cluely | Commercial Alternatives |
|---------|-------------|------------------------|
| **Cost** | 100% Free | $29-99/month |
| **Privacy** | Local AI Option | Cloud-only |
| **Open Source** | Full transparency | Closed source |
| **Customization** | Fully customizable | Limited options |
| **Data Control** | You own your data | Third-party servers |
| **Offline Mode** | Yes (with Ollama) | No |

## Technical Details

### **AI Models Supported**
- **Gemini 2.0 Flash** - Latest Google AI with vision capabilities
- **Llama 3.2** - Meta's advanced local model via Ollama
- **CodeLlama** - Specialized coding assistance
- **Mistral** - Lightweight, fast responses
- **Custom Models** - Any Ollama-compatible model

### **System Requirements**
```bash
Minimum:  4GB RAM, Dual-core CPU, 2GB storage
Recommended: 8GB+ RAM, Quad-core CPU, 5GB+ storage
Optimal: 16GB+ RAM for local AI models
```

## 🤝 Contributing

This project welcomes contributions! While I have limited time for active maintenance, I'll review and merge quality PRs.

**Ways to contribute:**
- 🐛 Bug fixes and stability improvements
- ✨ New features and AI model integrations  
- 📚 Documentation and tutorial improvements
- 🌍 Translations and internationalization
- 🎨 UI/UX enhancements

For commercial integrations or custom development, reach out on [Twitter](https://x.com/prathitjoshi_)

## 📄 License

ISC License - Free for personal and commercial use.

---

**⭐ Star this repo if Free Cluely helps you succeed in meetings, interviews, or presentations!**

### 🏷️ Tags
`ai-assistant` `meeting-notes` `interview-helper` `presentation-support` `ollama` `gemini-ai` `electron-app` `cross-platform` `privacy-focused` `open-source` `local-ai` `screenshot-analysis` `academic-helper` `sales-assistant` `coding-companion`
