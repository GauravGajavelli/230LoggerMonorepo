import { useState, useEffect, useCallback } from 'react';
import { PlaybackDataProvider } from '../context/PlaybackDataContext';
import { FeedbackApp } from './FeedbackApp';
import { RatingPanel } from './RatingPanel';
import { AssessmentMappingTable } from './AssessmentMappingTable';

const GUIDE_ITEMS = [
  ['Test tabs (Failing / Improved / Passing)', 'Tests categorized by final status. Failing = still broken at last submission. Improved = was failing, now passes.'],
  ['Feedback accordion', 'Each item corresponds to one or more related test failures. Contains: pattern name (the system\'s classification), confidence level, root cause explanation (the core of what you\'re rating), suggested next steps, code diffs, and a practice drill.'],
  ['Code diffs', 'Before/after snippets showing what the student changed. The "note" explains what the system thinks happened.'],
  ['Drills', 'Practice problems sourced from past exams and course materials (never from the assignment itself). Includes test code, hints, and source attribution.'],
  ['Course appearances', 'How the system mapped this feedback to upcoming assessments.'],
  ['Timeline chart', 'Visual representation of the student\'s test runs over time. Click to see code at any point.'],
  ['Episode chips', 'Coding sessions identified by the system, with dominant intent (extending, debugging, etc.) and progress assessment.'],
  ['Assessment mapping table', '(Below feedback) Shows which future exams/HW the drills map to, what percentage of the assessment is covered, and point values.'],
];

export function RaterApp({ raterToken }) {
  const [pairs, setPairs] = useState([]);
  const [raterId, setRaterId] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratedSet, setRatedSet] = useState(new Set());
  const [showInfoModal, setShowInfoModal] = useState(() => !localStorage.getItem('rater-info-seen'));
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pairLoading, setPairLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/rater/pairs?token=${raterToken}`)
      .then(r => r.json())
      .then(data => {
        setPairs(data.pairs || []);
        setRaterId(data.rater_id || '');
        setRatedSet(new Set((data.pairs || []).filter(p => p.rated).map(p => p.pair_id)));
        if (data.current_pair) {
          const idx = (data.pairs || []).findIndex(p => p.pair_id === data.current_pair);
          if (idx >= 0) setCurrentIndex(idx);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [raterToken]);

  const currentPair = pairs[currentIndex];
  const ratedCount = ratedSet.size;

  const dataUrl = currentPair ? `/api/rater/data?token=${raterToken}&pair=${currentPair.pair_id}` : null;
  const configUrl = currentPair ? `/api/rater/assessment-config?token=${raterToken}&pair=${currentPair.pair_id}` : null;
  const reportUrl = currentPair ? `/api/rater/report?token=${raterToken}&pair=${currentPair.pair_id}` : null;

  useEffect(() => {
    if (!dataUrl || currentPair?.pair_type === 'generic') {
      setFeedbackItems([]);
      setPairLoading(false);
      return;
    }
    setPairLoading(true);
    fetch(dataUrl)
      .then(r => r.json())
      .then(data => {
        const feedbackIds = new Set((data.feedback || []).map(f => f.testId));
        const hasFb = t => feedbackIds.has(t.testId);
        const statusOrder = { failing: 0, improved: 1, passing: 2 };
        const tests = (data.testHistories || [])
          .map(h => ({
            testId: h.testId,
            name: h.testName || h.testId,
            status: h.isLingeringFailure ? 'failing'
              : (h.failureIntervals?.length > 0) ? 'improved'
              : 'passing',
            hasFeedback: hasFb(h),
          }))
          .filter(t => t.hasFeedback)
          .sort((a, b) => (statusOrder[a.status] - statusOrder[b.status]) || (b.hasFeedback - a.hasFeedback));
        const items = tests.map(t => ({ testId: t.testId, label: t.name }));
        setFeedbackItems(items);
        setPairLoading(false);
      })
      .catch(() => { setFeedbackItems([]); setPairLoading(false); });
  }, [dataUrl, currentPair?.pair_type]);

  const navigate = useCallback((delta) => {
    setCurrentIndex(prev => {
      const next = prev + delta;
      if (next < 0 || next >= pairs.length) return prev;
      return next;
    });
  }, [pairs.length]);

  useEffect(() => {
    const handler = (e) => {
      if (pairLoading) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const handleRated = useCallback((pairId, autoCopied = []) => {
    setRatedSet(prev => new Set([...prev, pairId, ...autoCopied]));
  }, []);

  const handleCloseModal = () => {
    setShowInfoModal(false);
    localStorage.setItem('rater-info-seen', '1');
  };

  const providerKey = currentPair?.pair_id || 'none';

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
        color: '#64748B', fontSize: 14,
      }}>
        Loading rating data...
      </div>
    );
  }

  if (!pairs.length) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
        color: '#64748B', fontSize: 14,
      }}>
        No pairs assigned. Check your rater token.
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F1F5F9',
      fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
    }}>
      {/* Rater header */}
      <header style={{
        background: '#1E293B', color: '#FFFFFF',
        padding: '12px 28px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
        borderBottom: '1px solid rgba(0,0,0,0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '.13em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
              marginBottom: 5,
            }}>
              CSSE 230 · IRB-Approved Research Study
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.02em' }}>
                Expert Feedback Rating
              </span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>·</span>
              <span style={{
                fontSize: 13, color: 'rgba(255,255,255,0.65)',
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
                {raterId}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowInfoModal(true)}
            title="How to use this tool"
            style={{
              all: 'unset', width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              color: '#FFFFFF', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ?
          </button>
        </div>
      </header>

      {/* Pair navigator */}
      <div style={{
        background: '#FFFFFF', borderBottom: '1px solid #E2E8F0',
        padding: '10px 28px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
            {currentPair?.pair_id}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4,
            fontFamily: "'IBM Plex Mono', monospace",
            background: currentPair?.pair_type === 'generic' ? '#F0F9FF' : '#F0FDF4',
            color: currentPair?.pair_type === 'generic' ? '#0369A1' : '#166534',
            border: `1px solid ${currentPair?.pair_type === 'generic' ? '#BAE6FD' : '#BBF7D0'}`,
          }}>
            {currentPair?.pair_type === 'generic' ? 'GENERIC' : 'PERSONALIZED'}
          </span>
          <span style={{ color: '#CBD5E1' }}>·</span>
          <span style={{ fontSize: 13, color: '#64748B' }}>
            {currentPair?.assignment}
          </span>
          <span style={{ color: '#CBD5E1' }}>·</span>
          <span style={{
            fontSize: 12, color: '#64748B',
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            {ratedCount} of {pairs.length} rated
          </span>
        </div>

        <button onClick={() => navigate(-1)} disabled={currentIndex === 0 || pairLoading} style={navBtnStyle}>
          &#8592; Prev
        </button>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap', opacity: pairLoading ? 0.5 : 1, pointerEvents: pairLoading ? 'none' : 'auto' }}>
          {pairs.map((p, i) => {
            const isGeneric = p.pair_type === 'generic';
            const rated = ratedSet.has(p.pair_id);
            return (
              <button
                key={p.pair_id}
                onClick={() => setCurrentIndex(i)}
                title={`${p.pair_id} — ${p.assignment} (${p.pair_type})`}
                style={{
                  all: 'unset', width: 10, height: 10, cursor: 'pointer',
                  borderRadius: isGeneric ? 2 : '50%',
                  background: rated ? '#22C55E' : isGeneric ? '#BAE6FD' : '#E2E8F0',
                  border: i === currentIndex ? '2px solid #0F172A' : '2px solid transparent',
                  boxSizing: 'border-box',
                }}
              />
            );
          })}
        </div>

        <button onClick={() => navigate(1)} disabled={currentIndex === pairs.length - 1 || pairLoading} style={navBtnStyle}>
          Next &#8594;
        </button>
      </div>

      {/* Main content: feedback (left) + rating panel (right) */}
      <div style={{
        display: 'flex', gap: 20, padding: '0 20px 40px',
        maxWidth: 1400, margin: '0 auto',
        alignItems: 'flex-start',
        opacity: pairLoading ? 0.4 : 1,
        transition: 'opacity 0.15s',
        pointerEvents: pairLoading ? 'none' : 'auto',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {currentPair && currentPair.pair_type === 'personalized' && dataUrl && (
            <>
              <AssessmentMappingTable reportUrl={reportUrl} />
              <PlaybackDataProvider
                key={providerKey}
                useMock={false}
                jsonUrl={dataUrl}
                assessmentConfigUrl={configUrl}
              >
                <FeedbackApp
                  raterMode
                  pairId={currentPair.pair_id}
                  onBack={() => navigate(-1)}
                />
              </PlaybackDataProvider>
            </>
          )}
          {currentPair && currentPair.pair_type === 'generic' && (
            <GenericPairView
              key={providerKey}
              pairId={currentPair.pair_id}
              assignment={currentPair.assignment}
              pdfUrl={`/api/rater/pdf?token=${raterToken}&pair=${currentPair.pair_id}`}
            />
          )}
        </div>

        <RatingPanel
          pairId={currentPair?.pair_id}
          raterToken={raterToken}
          onRated={handleRated}
          feedbackItems={feedbackItems}
        />
      </div>

      <InfoModal open={showInfoModal} onClose={handleCloseModal} />
    </div>
  );
}

const navBtnStyle = {
  all: 'unset', padding: '5px 12px', fontSize: 12, fontWeight: 600,
  borderRadius: 6, border: '1px solid #CBD5E1', cursor: 'pointer',
  color: '#334155', background: '#FFFFFF',
};

function GenericPairView({ pairId, assignment, pdfUrl }) {
  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{
        background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12,
        padding: '16px 20px', marginBottom: 16,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.08em', color: '#0369A1', marginBottom: 6,
        }}>
          Generic Feedback — Class-Wide Review Guide
        </div>
        <p style={{ fontSize: 13, color: '#0C4A6E', margin: 0, lineHeight: 1.6 }}>
          This student did not receive personalized debugging feedback for {assignment}.
          Instead, they received the generic class-wide review guide shown below.
          Rate whether this guide is still useful as general study material — it was not
          tailored to this student's specific submission.
        </p>
      </div>

      <div style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12,
        overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      }}>
        <iframe
          src={pdfUrl}
          title={`${pairId} report PDF`}
          style={{ width: '100%', height: 'calc(100vh - 300px)', border: 'none', minHeight: 600 }}
        />
      </div>
    </div>
  );
}

function InfoModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 16,
          maxWidth: 720, width: '90vw', maxHeight: '80vh', overflowY: 'auto',
          padding: '28px 32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: 20,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
            How to Use This Tool
          </h2>
          <button
            onClick={onClose}
            style={{
              all: 'unset', fontSize: 18, color: '#64748B', cursor: 'pointer',
              lineHeight: 1, padding: '0 2px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Purpose */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{
            margin: '0 0 10px', fontSize: 13, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748B',
          }}>
            What is this?
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: '#334155', margin: '0 0 10px' }}>
            This tool analyzed each student's test run history (their code changes, test failures,
            debugging patterns, and error progressions) then generated personalized feedback identifying
            root causes, recommending practice drills sourced from course materials, and mapping weak
            areas to upcoming assessments.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: '#334155', margin: '0 0 10px' }}>
            You are seeing the same interactive view the students received. The timeline, code replay,
            test results, and feedback accordions below are exactly what each student saw for their
            submission.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: '#334155', margin: 0, fontWeight: 600 }}>
            Your task: Rate whether this generated feedback is <em>correct</em> (factually accurate),{' '}
            <em>actionable</em> (a student could use it to improve), and <em>specific</em> (tailored
            to this student's patterns, not generic advice). Use the timeline and code replay to verify
            the system's claims about what the student did.
          </p>
        </div>

        {/* Anatomy guide */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{
            margin: '0 0 12px', fontSize: 13, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748B',
          }}>
            Feedback Anatomy
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>
            {GUIDE_ITEMS.map(([title, desc]) => (
              <div key={title} style={{ fontSize: 12, lineHeight: 1.5, color: '#334155' }}>
                <strong style={{ color: '#0F172A' }}>{title}:</strong> {desc}
              </div>
            ))}
          </div>
        </div>

        {/* Got it button */}
        <div style={{ textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 24px', fontSize: 13, fontWeight: 600,
              background: '#1E293B', color: '#FFFFFF', border: 'none',
              borderRadius: 8, cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
