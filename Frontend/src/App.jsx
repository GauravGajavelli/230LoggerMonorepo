import { useEffect } from 'react';
import { FeedbackApp } from './components/FeedbackApp';
import { PlaybackDataProvider } from './context/PlaybackDataContext';
import { eventTracker } from './utils/eventTracker';

function App() {
  const pathname = window.location.pathname;
  const token = new URLSearchParams(window.location.search).get('token');

  // ── Demo route (/demo) ──────────────────────────────────────────────────────
  // No auth required. Loads the static BST demo JSON directly.
  if (pathname === '/demo') {
    return (
      <PlaybackDataProvider useMock={false} jsonUrl="/data/frontend.json">
        <FeedbackApp />
      </PlaybackDataProvider>
    );
  }

  // ── Assignment feedback (/feedback?token=XXX) ───────────────────────────────
  // Token is per-student-per-assignment. Server validates before serving this page.
  if (pathname === '/feedback' && token) {
    return (
      <TokenApp token={token} />
    );
  }

  // ── Fallback: redirect to login ─────────────────────────────────────────────
  // Catches /feedback with no token, unknown paths, etc.
  window.location.replace('/login');
  return null;
}

function TokenApp({ token }) {
  useEffect(() => {
    eventTracker.init(token);
    eventTracker.track('page_view');
  }, [token]);

  return (
    <PlaybackDataProvider
      useMock={false}
      jsonUrl={`/api/data?token=${token}`}
      assessmentConfigUrl={`/api/assessment-config?token=${token}`}
    >
      <FeedbackApp token={token} />
    </PlaybackDataProvider>
  );
}

export default App;
