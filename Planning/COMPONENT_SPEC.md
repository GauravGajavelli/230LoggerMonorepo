# CSSE 230 Feedback Tool – UI Component Specification

## Overview

Build a React-based playback interface for reviewing student code submissions with AI-powered debugging feedback. The layout uses a **bottom drawer pattern** (Option C) where feedback slides up when a failing test is selected.

**Note:** The CodeViewer component already exists as CodeDiffViewer and should be integrated. Do not implement CodeViewer.

---

## Global Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Header                                                          │
├─────────────────────────────────────────────────────────────────┤
│ TimelineBar                                                     │
├───────────────────────────────────────┬─────────────────────────┤
│                                       │ TestList (scrollable)   │
│                                       │  - Changed Results      │
│   [EXISTING CodeViewer]               │  - Other Results        │
│   (integrate separately)              ├─────────────────────────┤
│                                       │ ProgressChart           │
│                                       │ (fixed height, below)   │
├───────────────────────────────────────┴─────────────────────────┤
│ FeedbackDrawer (slides up from bottom when test selected)       │
│  ┌─────────────────────────┬───────────────────────────────┐    │
│  │ StackTraceViewer        │ FeedbackContent               │    │
│  └─────────────────────────┴───────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Structures

Define these TypeScript interfaces (or equivalent JS shapes):

```typescript
interface Episode {
  id: string;
  startTime: number;        // seconds from start
  endTime: number;          // seconds from start
  label: string;            // e.g., "Fixed null check"
  snapshot: CodeSnapshot;   // reference to code state (for your backend)
}

interface TestResult {
  id: string;
  name: string;                           // e.g., "testInsertDuplicate"
  status: 'pass' | 'fail' | 'error' | 'skip';
  changedThisRun: boolean;                // true if status changed from previous episode
  previousStatus?: 'pass' | 'fail' | 'error' | 'skip';  // what it was before
  errorMessage?: string;                  // short error summary
  stackTrace?: string;                    // full stack trace
}

interface Feedback {
  testId: string;
  pattern: string;                        // e.g., "Off-by-one", "Null reference"
  confidence: 'high' | 'medium' | 'low';
  explanation: string;                    // 2-3 sentence explanation
  nextSteps: string[];                    // ordered list of suggestions
  relatedCodeLocation?: {
    file: string;
    startLine: number;
    endLine: number;
  };
  drills?: {                              // optional practice exercises
    title: string;
    description: string;
  }[];
}

interface PlaybackState {
  currentTime: number;                    // seconds
  isPlaying: boolean;
  playbackSpeed: number;                  // 1, 2, 4
  currentEpisodeId: string;
}

interface SubmissionContext {
  studentId: string;
  studentDisplayName: string;             // anonymized or real
  assignmentName: string;
  assignmentId: string;
  submittedAt: Date;
  totalEpisodes: number;
}
```

---

## Component Specifications

### 1. Header

**Purpose:** Display submission context and overall test status.

**Props:**
```typescript
interface HeaderProps {
  context: SubmissionContext;
  testSummary: {
    passed: number;
    failed: number;
    total: number;
  };
  currentEpisode: Episode;
}
```

**Visual Structure:**
```
┌────────────────────────────────────────────────────────────────────┐
│ CSSE 230 – Assignment 3: Binary Search Trees                       │
│ Student: jsmith123 • Submitted: Oct 15, 2024 11:47 PM              │
│                                          Episode 3/5 │ 4/6 passing │
└────────────────────────────────────────────────────────────────────┘
```

**Styling:**
- Background: `gray-900`
- Border bottom: `gray-800`
- Padding: `px-6 py-4`
- Title: `text-xl font-semibold text-white`
- Subtitle: `text-sm text-gray-400`
- Status badge: `bg-gray-800 rounded px-2 py-1 font-mono text-sm`

---

### 2. TimelineBar

**Purpose:** Scrubber showing episode segments with playback controls.

**Props:**
```typescript
interface TimelineBarProps {
  episodes: Episode[];
  playbackState: PlaybackState;
  totalDuration: number;                  // seconds
  onSeek: (time: number) => void;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onEpisodeClick: (episodeId: string) => void;
}
```

**Visual Structure:**
```
┌──────────────────────────────────────────────────────────────────┐
│ [▶] [1x▼]  │ Ep1: Initial │ Ep2: Fixed │ Ep3: Refactor │  12:34 │
│            │              ▼(playhead)                    │ /60:00 │
└──────────────────────────────────────────────────────────────────┘
```

**Sub-components:**
1. **PlayControls** (left side)
   - Play/Pause button: circular, `bg-blue-600`, 40x40px
   - Speed dropdown: `select` with options 1x, 2x, 4x

2. **EpisodeSegments** (center, flex-grow)
   - Container: `h-8 bg-gray-800 rounded-lg flex overflow-hidden`
   - Each segment: width proportional to `(endTime - startTime) / totalDuration`
   - Alternating colors: `bg-gray-700` / `bg-gray-750` (use `bg-gray-700/80`)
   - Current episode: `ring-2 ring-blue-500 ring-inset`
   - On hover: `brightness-110`
   - Label text: `text-xs text-gray-300 truncate px-2`

3. **Playhead**
   - Absolute positioned `div`, `w-0.5 h-8 bg-red-500`
   - Top circle: `w-3 h-3 bg-red-500 rounded-full`
   - Position: `left: ${(currentTime / totalDuration) * 100}%`

4. **TimeDisplay** (right side)
   - Format: `MM:SS / MM:SS`
   - Style: `text-sm font-mono text-gray-400`

**Interactions:**
- Click on episode segment → jump to start of that episode
- Drag playhead or click timeline → seek to that time
- Play button toggles `isPlaying`

---

### 3. TestList

**Purpose:** Scrollable list of test results, prioritizing changed results.

**Props:**
```typescript
interface TestListProps {
  tests: TestResult[];
  selectedTestId: string | null;
  onTestSelect: (testId: string) => void;
  maxHeight: string;                      // e.g., "300px" or "calc(100vh - 400px)"
}
```

**Visual Structure:**
```
┌─────────────────────────────────────┐
│ Test Results                        │
├─────────────────────────────────────┤
│ ▼ CHANGED THIS RUN                  │  ← section header
│ ┌─────────────────────────────────┐ │
│ │ 🔴 testInsertDuplicate      [↗] │ │  ← was passing, now failing
│ │    was: ✓ passing               │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🟢 testDeleteRoot           [↗] │ │  ← was failing, now passing  
│ │    was: ✗ failing               │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ▼ OTHER TESTS                       │  ← section header
│ ┌─────────────────────────────────┐ │
│ │ 🟢 testInsertEmpty              │ │
│ └─────────────────────────────────┘ │
│ │ 🟢 testInsertSingle             │ │
│ │ 🔴 testBalanceAfterInsert       │ │
│ │ 🟢 testTraversalInOrder         │ │
│                 (scrollable)        │
└─────────────────────────────────────┘
```

**Section Headers:**
- Text: `text-xs font-semibold text-gray-500 uppercase tracking-wide`
- Padding: `px-3 py-2`
- "Changed This Run" section: add left border `border-l-2 border-yellow-500` to container
- Show section only if there are tests in that category

**TestItem Styling:**
- Container: `px-3 py-2 rounded-lg cursor-pointer transition`
- Pass: `bg-green-900/20 hover:bg-green-900/30`
- Fail: `bg-red-900/20 hover:bg-red-900/30`
- Selected: add `ring-2 ring-blue-500`
- Status dot: `w-2 h-2 rounded-full` (green-500 or red-500)
- Test name: `font-mono text-sm text-gray-200`
- "was: X" subtitle: `text-xs text-gray-500 mt-0.5`

**Changed Indicator:**
- Show a small arrow icon or badge indicating direction of change
- `↑` or green arrow for "started passing"
- `↓` or red arrow for "started failing"

**Sorting Logic:**
```typescript
function sortTests(tests: TestResult[]): { changed: TestResult[], other: TestResult[] } {
  const changed = tests.filter(t => t.changedThisRun)
    .sort((a, b) => {
      // Newly failing first, then newly passing
      if (a.status === 'fail' && b.status !== 'fail') return -1;
      if (a.status !== 'fail' && b.status === 'fail') return 1;
      return a.name.localeCompare(b.name);
    });
  
  const other = tests.filter(t => !t.changedThisRun)
    .sort((a, b) => {
      // Failing first, then by name
      if (a.status === 'fail' && b.status !== 'fail') return -1;
      if (a.status !== 'fail' && b.status === 'fail') return 1;
      return a.name.localeCompare(b.name);
    });
  
  return { changed, other };
}
```

**Scrolling:**
- Container: `overflow-y-auto` with `maxHeight` prop
- Show subtle scrollbar: style with `scrollbar-thin scrollbar-thumb-gray-700`

---

### 4. ProgressChart

**Purpose:** Bar chart showing passing test count over time/episodes.

**Props:**
```typescript
interface ProgressChartProps {
  dataPoints: {
    episodeId: string;
    label: string;
    passCount: number;
    totalTests: number;
  }[];
  currentEpisodeId: string;
  height?: number;                        // default 80px
}
```

**Visual Structure:**
```
┌─────────────────────────────────────┐
│ Progress Over Time                  │
│                                     │
│    ██                          ██   │  ← bars, heights proportional
│ ██ ██ ██    ██ ██ ██ ██    ██ ██   │
│ ██ ██ ██ ██ ██ ██ ██ ██ ██ ██ ██   │
│ ────────────────────────────────    │
│ Start                          End  │
└─────────────────────────────────────┘
```

**Styling:**
- Container: `border-t border-gray-800 p-4`
- Title: `text-sm font-medium text-gray-400 mb-3`
- Bar container: `h-16 flex items-end gap-1`
- Bar: `flex-1 rounded-t bg-gray-700 transition-all`
- Current episode bar: `bg-blue-500`
- Bar height: `${(passCount / totalTests) * 100}%`
- X-axis labels: `text-xs text-gray-500`

**Tooltip (optional for MVP):**
- On hover, show: "Episode 3: 4/6 passing"

---

### 5. FeedbackDrawer

**Purpose:** Sliding panel from bottom containing stack trace and AI feedback.

**Props:**
```typescript
interface FeedbackDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTest: TestResult | null;
  feedback: Feedback | null;
  isLoadingFeedback: boolean;
}
```

**Visual Structure:**
```
┌────────────────────────────────────────────────────────────────────┐
│ 🔴 testInsertDuplicate          [Duplicate Handling]          [✕] │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─ Stack Trace ─────────────┐  ┌─ AI Feedback ────────────────┐  │
│  │                           │  │                              │  │
│  │ java.lang.AssertionError  │  │ What's happening             │  │
│  │   at BSTTest.testInsert   │  │ Your insert method adds...   │  │
│  │   at sun.reflect...       │  │                              │  │
│  │                           │  │ Next steps to try            │  │
│  │                           │  │ 1. Add a check: if (value... │  │
│  │                           │  │ 2. Decide: should duplicates │  │
│  │                           │  │ 3. Review: What does the...  │  │
│  └───────────────────────────┘  └──────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Container Styling:**
- Position: `fixed bottom-0 left-0 right-0`
- Height: `320px`
- Background: `bg-gray-900`
- Border: `border-t border-gray-700`
- Transition: `transition-transform duration-300`
- Closed: `translate-y-full`
- Open: `translate-y-0`
- Z-index: `z-50`

**Header:**
- Flex row with: status dot, test name, pattern badge, close button
- Background: slightly darker or border-bottom
- Pattern badge: `px-2 py-0.5 bg-yellow-900/50 text-yellow-300 rounded text-xs font-medium`
- Close button: X icon, `text-gray-400 hover:text-white`

**Content Area:**
- Padding: `p-6`
- Grid: `grid grid-cols-2 gap-6`
- Left column: StackTraceViewer
- Right column: FeedbackContent
- Overflow: `overflow-auto` with max-height accounting for header

**Loading State:**
- Show skeleton or spinner in FeedbackContent area
- Text: "Analyzing error pattern..."

---

### 6. StackTraceViewer

**Purpose:** Display formatted, scrollable stack trace.

**Props:**
```typescript
interface StackTraceViewerProps {
  stackTrace: string;
  errorMessage: string;
  highlightedFile?: string;               // highlight frames from this file
  onLineClick?: (file: string, line: number) => void;  // for "jump to code"
}
```

**Visual Structure:**
```
┌─────────────────────────────────────┐
│ Stack Trace                         │
├─────────────────────────────────────┤
│ java.lang.AssertionError:           │  ← error message in red
│ Expected size 1, got 2              │
│                                     │
│   at BSTTest.testInsertDuplicate    │  ← clickable if matches file
│      (BSTTest.java:45)              │
│   at sun.reflect.Native...          │  ← dimmed (external)
│   ...                               │
│                                     │
│ Caused by:                          │  ← secondary cause
│   at BinarySearchTree.insertHelper  │  ← highlighted (user code)
│      (BinarySearchTree.java:23)     │
└─────────────────────────────────────┘
```

**Styling:**
- Container: `bg-gray-950 rounded-lg p-3 overflow-auto max-h-48`
- Font: `font-mono text-xs`
- Error message: `text-red-400 font-medium`
- User code frames: `text-gray-200` + clickable style
- External frames: `text-gray-600`
- "Caused by": `text-yellow-500`
- Clickable lines: `hover:bg-gray-800 cursor-pointer rounded px-1 -mx-1`

**Parsing Logic:**
```typescript
function parseStackTrace(trace: string, userFiles: string[]): StackFrame[] {
  // Split into lines, identify:
  // - Error message (first line or lines before "at ")
  // - Frame lines (start with "at ")
  // - Caused by lines
  // Mark frames as "user" if filename matches userFiles list
}
```

---

### 7. FeedbackContent

**Purpose:** Display AI-generated explanation and next steps.

**Props:**
```typescript
interface FeedbackContentProps {
  feedback: Feedback;
  compact?: boolean;                      // for inline display (not used in Option C)
  onJumpToCode?: (location: { file: string, line: number }) => void;
}
```

**Visual Structure:**
```
┌─────────────────────────────────────┐
│ What's happening       [High confidence]
│                                     │
│ Your insert method adds nodes even  │
│ when the value already exists.      │
│ BSTs typically either reject        │
│ duplicates or update the existing   │
│ node.                               │
│                                     │
│ Next steps to try                   │
│                                     │
│ 1. Add a check: if (value.equals    │
│    (current.data)) before creating  │
│    new node                         │
│                                     │
│ 2. Decide: should duplicates go     │
│    left, right, or be rejected?     │
│                                     │
│ 3. Review: What does the assignment │
│    spec say about duplicates?       │
│                                     │
├─────────────────────────────────────┤
│ Related: Line 23-25 in              │
│ BinarySearchTree.java    [Jump →]   │
└─────────────────────────────────────┘
```

**Styling:**
- Section spacing: `space-y-4`
- Section title: `font-medium text-gray-200`
- Confidence badge: `px-1.5 py-0.5 rounded text-xs`
  - High: `bg-green-900/50 text-green-300`
  - Medium: `bg-yellow-900/50 text-yellow-300`
  - Low: `bg-gray-700 text-gray-400`
- Explanation text: `text-sm text-gray-400`
- Next steps: ordered list with `text-sm text-gray-400`
- Step numbers: `text-blue-400 font-medium`
- Related code section: `pt-2 border-t border-gray-800 text-xs text-gray-500`
- Jump link: `text-blue-400 hover:text-blue-300 cursor-pointer`

---

## State Management

**Parent component should manage:**

```typescript
interface AppState {
  // Data (from backend)
  context: SubmissionContext;
  episodes: Episode[];
  testResults: Map<string, TestResult[]>;  // episodeId -> tests at that point
  feedbackCache: Map<string, Feedback>;    // testId -> feedback
  
  // UI state
  playback: PlaybackState;
  selectedTestId: string | null;
  feedbackDrawerOpen: boolean;
  isLoadingFeedback: boolean;
}
```

**Key state transitions:**

1. **Episode changes** (via timeline or playback):
   - Update `playback.currentEpisodeId`
   - TestList receives new `tests` from `testResults.get(currentEpisodeId)`
   - Compare with previous episode to set `changedThisRun`

2. **Test selected**:
   - Set `selectedTestId`
   - If test is failing, open `feedbackDrawerOpen = true`
   - If feedback not in cache, fetch and set `isLoadingFeedback = true`

3. **Drawer closed**:
   - Set `feedbackDrawerOpen = false`
   - Optionally clear `selectedTestId`

---

## File Structure

```
src/
├── components/
│   ├── Header.tsx
│   ├── TimelineBar/
│   │   ├── TimelineBar.tsx
│   │   ├── PlayControls.tsx
│   │   ├── EpisodeSegments.tsx
│   │   └── Playhead.tsx
│   ├── TestList/
│   │   ├── TestList.tsx
│   │   └── TestItem.tsx
│   ├── ProgressChart.tsx
│   ├── FeedbackDrawer/
│   │   ├── FeedbackDrawer.tsx
│   │   ├── StackTraceViewer.tsx
│   │   └── FeedbackContent.tsx
│   └── PlaybackPage.tsx              # main page composing all components
├── types/
│   └── index.ts                      # all interfaces defined above
├── hooks/
│   └── usePlayback.ts                # playback state + controls logic
└── utils/
    ├── testSorting.ts                # sortTests function
    └── stackTraceParser.ts           # parseStackTrace function
```

---

## Integration Points

**Your existing CodeViewer needs these props/callbacks:**

```typescript
interface CodeViewerIntegration {
  // Props to pass in:
  currentEpisodeId: string;
  highlightLines?: { start: number; end: number; color: string };
  
  // Callbacks to receive:
  onFileChange?: (filename: string) => void;  // if you need to track active file
}
```

**Backend API calls needed:**

```typescript
// GET /api/submissions/:id
// Returns: SubmissionContext + Episode[]

// GET /api/submissions/:id/episodes/:episodeId/tests
// Returns: TestResult[]

// GET /api/submissions/:id/feedback/:testId
// Returns: Feedback (may be slow if generating via AI)
```

---

## Styling Notes

- Use Tailwind CSS classes as shown
- Dark theme: `gray-950` for deepest bg, `gray-900` for panels, `gray-800` for borders
- Accent: `blue-500/600` for interactive elements
- Status: `green-500` for pass, `red-500` for fail, `yellow-500` for changed/warning
- Font: system default for UI, `font-mono` for code/test names
- All interactive elements need `transition` for smooth hover/state changes
