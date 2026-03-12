import { usePlaybackDataContext } from '../context/PlaybackDataContext';

/* ── Icons ── */
const NewDot = () => <span className="feedback-unseen-tab" />;
const ReviewedIcon = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6" stroke="#CBD5E1" strokeWidth="1.2" fill="none" />
    <path d="M5.5 8l1.8 1.8 3.2-3.6" stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronIcon = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M6 4l4 4-4 4" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PLACEHOLDER_REVIEWED = {
  id: 'linked-lists',
  title: 'Linked Lists',
  dueDate: 'Mar 3, 2026',
  submittedAt: 'Mar 3, 2026 · 10:02 PM',
  status: 'reviewed',
  passing: 9, failing: 0, improved: 2, total: 9,
};

/* ── Status pill ── */
function StatusPill({ status, failing }) {
  if (status === 'new' && failing > 0) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px 3px 7px', borderRadius: 20,
        background: '#FEF3C7', border: '1px solid #FDE68A',
        fontSize: 11, fontWeight: 600, color: '#92400E',
        fontFamily: "'IBM Plex Mono', monospace",
      }}>
        <NewDot />{failing} to review
      </span>
    );
  }
  if (status === 'new' && failing === 0) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        background: '#D1FAE5', border: '1px solid #A7F3D0',
        fontSize: 11, fontWeight: 600, color: '#065F46',
        fontFamily: "'IBM Plex Mono', monospace",
      }}>
        All passing
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px 3px 7px', borderRadius: 20,
      background: '#F1F5F9', border: '1px solid #E2E8F0',
      fontSize: 11, fontWeight: 500, color: '#64748B',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <ReviewedIcon />Reviewed
    </span>
  );
}

/* ── Mini-bar ── */
function MiniBar({ passing, failing, improved, total }) {
  const segments = [
    { count: failing,  color: '#FCA5A5' },
    { count: improved, color: '#93C5FD' },
    { count: passing,  color: '#6EE7B7' },
  ];
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {segments.map((seg, si) =>
        Array.from({ length: seg.count }).map((_, i) => (
          <span key={`${si}-${i}`} style={{ width: 6, height: 18, borderRadius: 2, background: seg.color }} />
        ))
      )}
    </div>
  );
}

/* ── Assignment card ── */
function AssignmentCard({ assignment, onClick }) {
  const isNew = assignment.status === 'new';
  const { title, dueDate, submittedAt, passing, failing, improved, total } = assignment;

  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box',
        background: '#FFFFFF',
        border: isNew ? '1px solid #FDE68A' : '1px solid #E2E8F0',
        borderRadius: 12, padding: '18px 20px', marginBottom: 10,
        cursor: 'pointer', transition: 'box-shadow .15s, border-color .15s',
        boxShadow: isNew ? '0 1px 4px rgba(245,158,11,.08)' : '0 1px 3px rgba(0,0,0,.04)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,.08)';
        e.currentTarget.style.borderColor = '#CBD5E1';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = isNew ? '0 1px 4px rgba(245,158,11,.08)' : '0 1px 3px rgba(0,0,0,.04)';
        e.currentTarget.style.borderColor = isNew ? '#FDE68A' : '#E2E8F0';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{
              fontSize: 15, fontWeight: 600, color: '#0F172A', margin: 0,
              letterSpacing: '-.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {title}
            </h2>
            <StatusPill status={assignment.status} failing={failing} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {dueDate && (
              <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: "'IBM Plex Mono', monospace" }}>
                Due {dueDate}
              </span>
            )}
            {dueDate && <span style={{ fontSize: 12, color: '#94A3B8' }}>·</span>}
            <span style={{ fontSize: 12, color: '#64748B' }}>
              {(passing + improved)}/{total} passing
              {improved > 0 && (
                <span style={{ color: '#2563EB', marginLeft: 4 }}>(+{improved} improved)</span>
              )}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MiniBar passing={passing} failing={failing} improved={improved} total={total} />
          <ChevronIcon />
        </div>
      </div>
    </button>
  );
}

/**
 * Assignment list landing page — wireframe style.
 */
export function AssignmentList({ onSelectAssignment, reviewed }) {
  const { context, detailSummary } = usePlaybackDataContext();

  const submittedAt = context?.submittedAt
    ? new Date(context.submittedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
    : '—';

  const bstCard = {
    id: 'bst',
    title: context?.assignmentName || 'Binary Search Tree',
    dueDate: null,
    submittedAt,
    status: reviewed ? 'reviewed' : 'new',
    passing: detailSummary.passing,
    failing: detailSummary.failing,
    improved: detailSummary.improved,
    total: detailSummary.total,
  };

  const newAssignments     = reviewed ? [] : [bstCard];
  const reviewedAssignments = reviewed ? [bstCard, PLACEHOLDER_REVIEWED] : [PLACEHOLDER_REVIEWED];

  return (
    <div style={{
      maxWidth: 680, margin: '0 auto', padding: '32px 16px 100px',
      fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
    }}>
      {/* Welcome header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: '0 0 6px', letterSpacing: '-.03em' }}>
          Your debugging feedback
        </h1>
        <p style={{ fontSize: 14, color: '#64748B', margin: 0, lineHeight: 1.5 }}>
          Personalized feedback on your recent assignments. Click one to see what changed and why.
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: '6px 0 0', lineHeight: 1.5 }}>
          Only you can see this feedback — it is not shared with course staff.
        </p>
      </div>

      {/* New feedback section */}
      {newAssignments.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
            color: '#B45309', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <NewDot />New feedback
          </div>
          {newAssignments.map((a) => (
            <AssignmentCard key={a.id} assignment={a} onClick={onSelectAssignment} />
          ))}
        </div>
      )}

      {/* Previously reviewed */}
      {reviewedAssignments.length > 0 && (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.08em', color: '#94A3B8', marginBottom: 10,
          }}>
            Previously reviewed
          </div>
          {reviewedAssignments.map((a) => (
            <AssignmentCard
              key={a.id} assignment={a}
              onClick={a.id === 'bst' ? onSelectAssignment : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
