import { useEffect } from 'react';
import { FeedbackApp } from './components/FeedbackApp';
import { RaterApp } from './components/RaterApp';
import { PlaybackDataProvider } from './context/PlaybackDataContext';
import { eventTracker } from './utils/eventTracker';

function App() {
  const pathname = window.location.pathname;
  const token = new URLSearchParams(window.location.search).get('token');

  // ── Demo route (/demo) ──────────────────────────────────────────────────────
  if (pathname === '/demo') {
    return (
      <PlaybackDataProvider useMock={false} jsonUrl="/data/frontend.json">
        <FeedbackApp />
      </PlaybackDataProvider>
    );
  }

  // ── Expert rating mode (/rate?token=RATER_TOKEN) ────────────────────────────
  if (pathname === '/rate' && token) {
    return <RaterApp raterToken={token} />;
  }

  // ── Assignment feedback (/feedback?token=XXX) ───────────────────────────────
  if (pathname === '/feedback' && token) {
    return <TokenApp token={token} />;
  }

  // ── Fallback: redirect to login ─────────────────────────────────────────────
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
