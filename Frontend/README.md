# DSA Debugging Coach

A student feedback tool for CSSE 230 (Data Structures & Algorithms) at Rose-Hulman Institute of Technology.

## 🎯 Purpose

This tool helps students learn from their own debugging iterations by providing:
- **Visual code playback** of their submission history
- **AI-generated feedback** on bug patterns
- **Next-step suggestions** based on test failures
- **Concept links** to relevant course material

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The app will open at `http://localhost:3000`

## 📁 Project Structure

```
src/
├── components/
│   ├── Header.jsx              # Top navigation with selectors
│   ├── CodeDiffViewer.jsx      # Split/unified code diff view
│   ├── PlaybackTimeline.jsx    # Timeline controls (CoderPad-style)
│   ├── TestResultsPanel.jsx    # Test pass/fail display
│   └── AIFeedbackPanel.jsx     # AI suggestions display
├── hooks/
│   └── usePlayback.js          # Playback state management
├── data/
│   └── mockData.js             # Demo data (student submissions)
├── utils/
│   ├── diffUtils.js            # Code diff computation
│   └── formatUtils.js          # Time/format utilities
├── App.jsx                     # Main app component
├── main.jsx                    # Entry point
└── index.css                   # Tailwind + custom styles
```

## 🎨 Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **diff** - Code diff computation
- **prism-react-renderer** - Syntax highlighting
- **lucide-react** - Icons

## 📖 Key Features

### Code Playback Timeline
Inspired by [CoderPad's code playback](https://coderpad.io/resources/docs/screen/candidate-reports/code-playback/):
- Color-coded timeline segments (green=pass, red=fail)
- Play/pause with variable speed (0.5x - 8x)
- Step forward/backward through submissions
- Click any segment to jump to that submission

### Code Diff Viewer
- Split view: side-by-side old vs new code
- Unified view: single-column with +/- markers
- Syntax highlighting for Java
- Line numbers and change highlighting

### Test Results Panel
- Pass/fail summary with progress bar
- Expandable failure details
- Stack trace viewer
- Expected vs actual comparison

### AI Feedback Panel
- Bug pattern identification with confidence score
- Prioritized next-step suggestions
- Links to relevant course concepts

## 🔮 Future Development

See `CLAUDE_CODE_CONTEXT.md` for detailed implementation notes and future backend integration points:
- RoseFire authentication
- Real submission ingestion pipeline
- Live AI feedback via Claude API
- Instructor dashboard

## 📝 For Demo

The app includes mock data showing a student's journey debugging an AVL tree implementation across 5 submissions, demonstrating:
1. Initial buggy code (missing balance/rotation)
2. Adding height updates
3. Adding single rotations
4. Fixing double rotation cases
5. Final working implementation

## 🔧 Development Notes

- **JavaScript version**: ES2022+ (not TypeScript for speed)
- **Node.js**: v18+ recommended
- **Browser**: Modern browsers with ES6+ support

## 📄 License

Research project for Rose-Hulman CSSE 230.
