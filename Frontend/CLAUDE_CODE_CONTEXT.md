# DSA Feedback Tool - Claude Code Development Context

## Project Overview

This is a **student debugging feedback tool** for CSSE 230 (Data Structures & Algorithms). It helps students learn from their own debugging iterations by providing:
- Visual code playback of their submission history
- AI-generated feedback on bug patterns
- Next-step suggestions based on test failures

**Target Demo**: 30-minute professor demo to get approval for full development + IRB study.

---

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Language**: ES2022+ JavaScript (not TypeScript for speed)
- **Code Diffing**: `diff` library for computing changes
- **Syntax Highlighting**: `prism-react-renderer` or `highlight.js`
- **Icons**: `lucide-react`
- **Backend (future)**: Node.js/Express or Python Flask
- **Auth (future)**: RoseFire (Rose-Hulman SSO) - https://rosefire.csse.rose-hulman.edu/

---

## Core Features to Implement

### 1. Code Playback Timeline (CRITICAL - Demo Must-Have)

Inspired by CoderPad's code playback feature:

**Timeline Bar Component**:
- Horizontal timeline showing all submissions
- Color-coded segments:
  - 🟢 **Green**: Tests passed / code ran successfully
  - 🟠 **Orange**: Code changes made (active editing)
  - 🔴 **Red**: Tests failed / errors occurred
  - ⬛ **Dark Gray**: Compilation errors
  - ⬜ **Light Gray**: Time gaps between submissions

**Playback Controls**:
- Play/Pause button
- Speed selector: 0.5x, 1x, 2x, 4x, 8x
- Step forward/backward buttons (navigate one submission at a time)
- Scrubber/slider to jump to any point
- Current timestamp display

**Implementation Notes**:
```javascript
// Timeline data structure
const submission = {
  id: string,
  timestamp: Date,
  code: string,
  testResults: {
    passed: number,
    failed: number,
    errors: string[],
    stackTrace: string
  },
  status: 'pass' | 'fail' | 'error' | 'compile_error',
  diff: {
    additions: number,
    deletions: number,
    hunks: DiffHunk[]
  }
}
```

### 2. Code Diff Viewer (CRITICAL - Demo Must-Have)

**Split View Layout**:
- Left panel: Previous submission code
- Right panel: Current submission code
- Highlighted additions (green background)
- Highlighted deletions (red background)
- Line numbers on both sides
- Synchronized scrolling

**Unified Diff Option**:
- Toggle between split and unified view
- Show +/- prefixes for changes

**Features**:
- Syntax highlighting for Java
- Collapse unchanged regions (show "... X lines unchanged ...")
- Click on diff hunk to expand context

### 3. Test Results Panel (CRITICAL - Demo Must-Have)

**Test Summary Header**:
- Pass/fail ratio: "12/15 tests passed"
- Visual progress bar (green/red proportional)
- Overall status badge

**Failed Test Details**:
- Expandable list of failed tests
- For each failed test:
  - Test name
  - Expected vs. Actual output
  - Stack trace (collapsible)
  - Link to relevant code line (if parseable)

**Test History Sparkline**:
- Mini chart showing pass rate over submissions
- Helps visualize "getting closer" or "regression"

### 4. AI Feedback Panel (HIGH PRIORITY)

**Bug Pattern Analysis**:
- Identifies likely bug category:
  - Off-by-one errors
  - Null pointer exceptions
  - Incorrect base case
  - Wrong comparison operator
  - Uninitialized variables
  - Infinite loop patterns

**Next-Step Suggestions**:
- Numbered checklist of debugging steps
- Example: "1. Check the loop bounds on line 42"
- Example: "2. Verify the base case handles empty input"

**Relevant Concepts**:
- Links to DS concepts involved (e.g., "AVL rotation", "heap property")
- Optional mini-drill suggestions

**Implementation**:
```javascript
// AI feedback structure
const aiFeedback = {
  bugPattern: {
    type: string,
    confidence: number,
    description: string,
    affectedLines: number[]
  },
  nextSteps: [
    { step: number, action: string, priority: 'high' | 'medium' | 'low' }
  ],
  conceptLinks: [
    { concept: string, relevance: string }
  ]
}
```

### 5. Student Selector (For Demo)

**Dropdown/List**:
- Select student by anonymized ID
- Show submission count per student
- Filter by assignment

---

## UI Layout Specification

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER: DSA Debugging Coach    [Student: S001 ▼] [Assignment: AVL ▼]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────┐ ┌───────────┐ │
│  │                                                     │ │  TEST     │ │
│  │           CODE DIFF VIEWER                          │ │  RESULTS  │ │
│  │                                                     │ │           │ │
│  │   [Before]              │           [After]         │ │  15/20 ✓  │ │
│  │   - old line            │           + new line      │ │           │ │
│  │     unchanged           │             unchanged     │ │  Failed:  │ │
│  │   - removed             │           + added         │ │  • test1  │ │
│  │                                                     │ │  • test2  │ │
│  │                                                     │ │           │ │
│  └─────────────────────────────────────────────────────┘ │  [Stack]  │ │
│                                                           └───────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ ◀◀  ▶  ▶▶   ═══════●════════════════════════   [1x ▼]  3/12      ││
│  │ PLAYBACK TIMELINE                                                   ││
│  │ 🟢──🟠──🟠──🔴──🔴──🟠──🟠──🟢──🟢──🟠──🔴──🟢                    ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ AI FEEDBACK                                                         ││
│  │                                                                     ││
│  │ 🔍 Likely Bug Pattern: **Off-by-one error** (85% confidence)       ││
│  │                                                                     ││
│  │ 📋 Next Steps:                                                      ││
│  │    1. Check loop bound on line 42 - should be `< n` not `<= n`     ││
│  │    2. Verify array access at line 45 doesn't exceed bounds          ││
│  │                                                                     ││
│  │ 📚 Related Concepts: Array indexing, Loop invariants                ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Mock Data Structure

Location: `src/data/mockData.js`

```javascript
export const mockStudents = [
  { id: 'S001', name: 'Student A', submissionCount: 12 },
  { id: 'S002', name: 'Student B', submissionCount: 8 },
];

export const mockAssignments = [
  { id: 'avl', name: 'AVL Tree Implementation' },
  { id: 'heap', name: 'Binary Heap' },
];

export const mockSubmissions = [
  {
    id: 'sub_001',
    studentId: 'S001',
    assignmentId: 'avl',
    timestamp: '2024-01-15T10:30:00Z',
    code: `public class AVLTree {
    private Node root;
    
    public void insert(int value) {
        root = insertRec(root, value);
    }
    
    private Node insertRec(Node node, int value) {
        if (node == null) {
            return new Node(value);
        }
        // BUG: wrong comparison
        if (value < node.value) {
            node.left = insertRec(node.left, value);
        } else {
            node.right = insertRec(node.right, value);
        }
        return node; // Missing balance call!
    }
}`,
    testResults: {
      passed: 5,
      failed: 3,
      total: 8,
      failures: [
        {
          testName: 'testBalanceAfterInsert',
          expected: 'height difference <= 1',
          actual: 'height difference = 3',
          stackTrace: `java.lang.AssertionError: expected height difference <= 1 but was 3
    at AVLTreeTest.testBalanceAfterInsert(AVLTreeTest.java:45)
    at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)`
        }
      ]
    },
    status: 'fail'
  },
  // ... more submissions showing progression
];

export const mockAIFeedback = {
  bugPattern: {
    type: 'missing_rebalance',
    confidence: 0.92,
    description: 'The AVL tree insert method does not call the balance/rotation methods after insertion, causing the tree to become unbalanced.',
    affectedLines: [15, 16]
  },
  nextSteps: [
    { step: 1, action: 'Add a call to updateHeight(node) before the return statement', priority: 'high' },
    { step: 2, action: 'Add a call to balance(node) or rebalance(node) after updating height', priority: 'high' },
    { step: 3, action: 'Check that rotation methods (rotateLeft, rotateRight) are implemented', priority: 'medium' }
  ],
  conceptLinks: [
    { concept: 'AVL Balance Factor', relevance: 'The balance factor must be -1, 0, or 1 for all nodes' },
    { concept: 'Tree Rotations', relevance: 'Single and double rotations restore balance after insertion' }
  ]
};
```

---

## Component File Structure

```
src/
├── components/
│   ├── Header.jsx              # Top navigation bar
│   ├── StudentSelector.jsx     # Dropdown to pick student/assignment
│   ├── CodeDiffViewer.jsx      # Main diff display (split view)
│   ├── PlaybackTimeline.jsx    # Timeline bar + controls
│   ├── TestResultsPanel.jsx    # Test pass/fail display
│   ├── AIFeedbackPanel.jsx     # AI suggestions display
│   └── StackTraceViewer.jsx    # Expandable stack trace
├── hooks/
│   ├── usePlayback.js          # Playback state management
│   └── useSubmissions.js       # Data fetching (mock for now)
├── data/
│   └── mockData.js             # Mock submission data
├── utils/
│   ├── diffUtils.js            # Code diff computation
│   └── formatUtils.js          # Time formatting, etc.
├── App.jsx                     # Main app component
├── main.jsx                    # Vite entry point
└── index.css                   # Tailwind imports
```

---

## Key Implementation Details

### Diff Computation

Use the `diff` npm package:
```javascript
import { diffLines, diffWords } from 'diff';

function computeDiff(oldCode, newCode) {
  const changes = diffLines(oldCode, newCode);
  return changes.map(part => ({
    value: part.value,
    type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged'
  }));
}
```

### Playback Hook

```javascript
function usePlayback(submissions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex(i => {
        if (i >= submissions.length - 1) {
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 2000 / speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed, submissions.length]);
  
  return {
    currentIndex,
    currentSubmission: submissions[currentIndex],
    previousSubmission: submissions[currentIndex - 1] || null,
    isPlaying,
    speed,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    setSpeed,
    stepForward: () => setCurrentIndex(i => Math.min(i + 1, submissions.length - 1)),
    stepBackward: () => setCurrentIndex(i => Math.max(i - 1, 0)),
    jumpTo: (index) => setCurrentIndex(index),
    totalCount: submissions.length
  };
}
```

### Syntax Highlighting

Use `prism-react-renderer`:
```javascript
import { Highlight, themes } from 'prism-react-renderer';

function CodeBlock({ code, language = 'java' }) {
  return (
    <Highlight theme={themes.vsDark} code={code} language={language}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre style={style}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              <span className="line-number">{i + 1}</span>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
```

---

## Styling Guidelines

### Color Palette (Tailwind)

- **Background**: `bg-slate-900` (dark mode primary)
- **Panels**: `bg-slate-800` with `border-slate-700`
- **Code Background**: `bg-slate-950`
- **Additions**: `bg-green-900/30` with `border-l-2 border-green-500`
- **Deletions**: `bg-red-900/30` with `border-l-2 border-red-500`
- **Pass**: `text-green-400`, `bg-green-500/20`
- **Fail**: `text-red-400`, `bg-red-500/20`
- **Warning**: `text-amber-400`, `bg-amber-500/20`
- **Accent**: `text-blue-400` for interactive elements

### Typography

- **Headings**: `font-semibold text-slate-100`
- **Body**: `text-slate-300`
- **Muted**: `text-slate-500`
- **Code**: `font-mono text-sm`

---

## Future Backend Integration Points

Mark these as TODO comments for future development:

```javascript
// TODO: Replace with API call to /api/students
const students = mockStudents;

// TODO: Replace with API call to /api/submissions/:studentId/:assignmentId
const submissions = mockSubmissions;

// TODO: Replace with API call to /api/feedback (sends to Claude API)
const feedback = mockAIFeedback;

// TODO: Add RoseFire authentication
// See: https://rosefire.csse.rose-hulman.edu/
```

---

## Demo Script Suggestions

1. **Open with Student S001, AVL assignment**
2. **Play through timeline** - show code evolving
3. **Pause on a red (failing) submission** - highlight the diff
4. **Show test results** - expand stack trace
5. **Show AI feedback** - "here's what the tool suggests"
6. **Step forward** - show how student eventually fixed it
7. **Key message**: "Students can see their own journey and get coached"

---

## Commands Reference

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

---

## Priority Checklist for MVP

- [ ] Basic layout with all panels visible
- [ ] Code diff viewer with syntax highlighting
- [ ] Playback timeline with step controls
- [ ] Test results panel with pass/fail display
- [ ] AI feedback panel (static content OK for demo)
- [ ] Student/assignment selector
- [ ] At least 5-6 mock submissions showing progression
- [ ] Responsive enough to demo on projector

---

## Notes for Claude Code

When continuing development:

1. **Start the dev server** with `npm run dev`
2. **Mock data is in** `src/data/mockData.js` - expand as needed
3. **Components are independent** - can be developed in parallel
4. **Focus on visual polish** - this is a demo, not production
5. **Dark theme is intentional** - matches typical IDE feel
6. **Java syntax highlighting** - CSSE 230 uses Java

If asked to add real backend:
- Express.js for API
- SQLite or PostgreSQL for storage
- Multer for file uploads
- Claude API for AI feedback generation
