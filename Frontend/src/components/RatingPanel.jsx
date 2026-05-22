import { useState, useEffect, useRef, useCallback } from 'react';

const RUBRIC = {
  correctness: [
    [1, 'Major errors — misidentifies the problem, hallucinates methods'],
    [2, 'Significant inaccuracies — right area, wrong specifics'],
    [3, 'Mostly correct with minor errors'],
    [4, 'Accurate — correctly identifies issues and relevant tests'],
    [5, 'Fully correct — precise identification, accurate concept mapping'],
  ],
  actionability: [
    [1, 'Completely vague ("review your code")'],
    [2, 'Points in a direction but not enough to act'],
    [3, 'General approach given'],
    [4, 'Specific and actionable'],
    [5, 'Directly actionable with clear path and targeted drill'],
  ],
  specificity: [
    [1, 'Completely generic — could apply to anyone'],
    [2, 'Mentions right assignment but nothing student-specific'],
    [3, 'References specific tests but analysis is generic'],
    [4, 'Clearly based on this student\'s patterns'],
    [5, 'Deeply specific — references exact debugging progression'],
  ],
};

const FAILURE_MODES = [
  'hallucinated_reference',
  'wrong_root_cause',
  'vague_recommendation',
  'mismatched_concept',
  'redundant',
  'missing_obvious',
  'correct_but_unhelpful',
];

const EMPTY_RATING = { correctness: '', actionability: '', specificity: '', failureModes: [], otherText: '', notes: '' };

export function RatingPanel({ pairId, raterToken, onRated, feedbackItems = [] }) {
  const [selectedItem, setSelectedItem] = useState('_pair_');
  const [cache, setCache] = useState({});
  const [saveStatus, setSaveStatus] = useState('');
  const [showRubric, setShowRubric] = useState(false);
  const debounceRef = useRef(null);
  const loadingRef = useRef(true);
  const pairIdRef = useRef(pairId);
  const cacheRef = useRef(cache);

  cacheRef.current = cache;
  const current = cache[selectedItem] || EMPTY_RATING;

  useEffect(() => {
    if (!pairId || !raterToken) return;
    loadingRef.current = true;
    pairIdRef.current = pairId;
    setSelectedItem(feedbackItems.length > 0 ? feedbackItems[0].testId : '_pair_');

    fetch(`/api/rater/ratings?token=${raterToken}`)
      .then(r => r.json())
      .then(ratings => {
        const pairRatings = ratings.filter(r => r.pair_id === pairId);
        const newCache = {};
        for (const r of pairRatings) {
          const key = r.test_id || '_pair_';
          const modes = JSON.parse(r.failure_modes || '[]');
          const otherMode = modes.find(m => m.startsWith('other:'));
          newCache[key] = {
            correctness: r.correctness || '',
            actionability: r.actionability || '',
            specificity: r.specificity || '',
            failureModes: modes.filter(m => !m.startsWith('other:')),
            otherText: otherMode ? otherMode.slice(6) : '',
            notes: r.notes || '',
          };
        }
        setCache(newCache);
        loadingRef.current = false;
      })
      .catch(() => { loadingRef.current = false; });
  }, [pairId, raterToken, feedbackItems]);

  const save = useCallback((itemId, data) => {
    if (!pairId || !raterToken) return;
    const modes = [...(data.failureModes || [])];
    if (data.otherText?.trim()) modes.push(`other:${data.otherText.trim()}`);

    setSaveStatus('saving');
    fetch(`/api/rater/ratings?token=${raterToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pair_id: pairId,
        test_id: itemId,
        correctness: data.correctness || null,
        actionability: data.actionability || null,
        specificity: data.specificity || null,
        failure_modes: modes,
        notes: data.notes || '',
      }),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(body => {
        setSaveStatus('saved');
        const items = feedbackItems.length > 0 ? feedbackItems : [{ testId: '_pair_' }];
        const latest = cacheRef.current;
        const allRated = items.every(it => {
          const c = latest[it.testId];
          return c && c.correctness;
        });
        if (allRated && onRated) onRated(pairId, body.auto_copied || []);
      })
      .catch(() => setSaveStatus('error'));
  }, [pairId, raterToken, feedbackItems, onRated]);

  const updateField = useCallback((field, value) => {
    if (loadingRef.current) return;
    setCache(prev => {
      const entry = { ...(prev[selectedItem] || EMPTY_RATING), [field]: value };
      const next = { ...prev, [selectedItem]: entry };

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => save(selectedItem, entry), 600);

      return next;
    });
  }, [selectedItem, save]);

  const toggleFailureMode = (mode) => {
    const modes = current.failureModes || [];
    const next = modes.includes(mode) ? modes.filter(m => m !== mode) : [...modes, mode];
    updateField('failureModes', next);
  };

  const ratedCount = feedbackItems.length > 0
    ? feedbackItems.filter(it => cache[it.testId]?.correctness).length
    : (cache['_pair_']?.correctness ? 1 : 0);
  const totalCount = feedbackItems.length > 0 ? feedbackItems.length : 1;

  const selectStyle = {
    width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6,
    border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155',
    fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase',
    letterSpacing: '.06em', marginBottom: 4, display: 'block',
  };

  return (
    <div style={{
      width: 300, flexShrink: 0, position: 'sticky', top: 0,
      maxHeight: '100vh', overflowY: 'auto',
      padding: '16px', background: '#FFFFFF',
      border: '1px solid #E2E8F0', borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 14,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Rating</span>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 4,
          background: saveStatus === 'saved' ? '#F0FDF4' : saveStatus === 'saving' ? '#FEF9C3' : saveStatus === 'error' ? '#FEF2F2' : '#F8FAFC',
          color: saveStatus === 'saved' ? '#166534' : saveStatus === 'saving' ? '#854D0E' : saveStatus === 'error' ? '#991B1B' : '#94A3B8',
          fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500,
        }}>
          {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Error' : ''}
        </span>
      </div>

      {/* Feedback item selector */}
      {feedbackItems.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Feedback Item</label>
          <select
            value={selectedItem}
            onChange={e => setSelectedItem(e.target.value)}
            style={{ ...selectStyle, fontSize: 11 }}
          >
            {feedbackItems.map(item => (
              <option key={item.testId} value={item.testId}>
                {cache[item.testId]?.correctness ? '\u2713 ' : ''}{item.label}
              </option>
            ))}
            <option value="_pair_">{cache['_pair_']?.notes ? '\u2713 ' : ''}Optional notes</option>
          </select>
          <div style={{
            fontSize: 10, color: '#64748B', marginTop: 4,
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            {ratedCount} of {totalCount} items rated
          </div>
        </div>
      )}

      {/* Dimensions */}
      {[
        ['Correctness', current.correctness, v => updateField('correctness', v), RUBRIC.correctness,
          'Is the root cause explanation factually accurate? Check "What went wrong" against the timeline and code diffs.'],
        ['Actionability', current.actionability, v => updateField('actionability', v), RUBRIC.actionability,
          'Could a student act on the suggested next steps and drill? Are they concrete enough to follow?'],
        ['Specificity', current.specificity, v => updateField('specificity', v), RUBRIC.specificity,
          'Is this tailored to this student? Expand "What went wrong" and "Code changes" to check.'],
      ].map(([label, value, setter, options, tip]) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <label style={labelStyle}>
            {label}
            <Tip text={tip} />
          </label>
          <select value={value} onChange={e => setter(e.target.value ? parseInt(e.target.value) : '')} style={selectStyle}>
            <option value="">—</option>
            {options.map(([val, desc]) => (
              <option key={val} value={val}>{val}: {desc}</option>
            ))}
          </select>
        </div>
      ))}

      {/* Failure modes */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Failure Modes</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {FAILURE_MODES.map(mode => (
            <label key={mode} style={{
              fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={(current.failureModes || []).includes(mode)}
                onChange={() => toggleFailureMode(mode)}
                style={{ margin: 0 }}
              />
              {mode.replace(/_/g, ' ')}
            </label>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(current.otherText || '').trim().length > 0}
                readOnly
                style={{ margin: 0 }}
              />
              other:
            </label>
            <input
              type="text"
              value={current.otherText || ''}
              onChange={e => updateField('otherText', e.target.value)}
              placeholder="describe"
              style={{
                flex: 1, fontSize: 11, padding: '2px 6px', borderRadius: 4,
                border: '1px solid #CBD5E1', color: '#334155',
              }}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          value={current.notes || ''}
          onChange={e => updateField('notes', e.target.value)}
          placeholder="Optional notes..."
          rows={3}
          style={{
            width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6,
            border: '1px solid #CBD5E1', resize: 'vertical', color: '#334155',
            fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif",
          }}
        />
      </div>

      {/* Rubric reference */}
      <button
        onClick={() => setShowRubric(!showRubric)}
        style={{
          all: 'unset', fontSize: 11, color: '#64748B', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8,
        }}
      >
        <span style={{ transform: showRubric ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .15s' }}>&#9654;</span>
        Rubric Reference
      </button>
      {showRubric && (
        <div style={{
          fontSize: 10, color: '#64748B', background: '#F8FAFC',
          border: '1px solid #E2E8F0', borderRadius: 6, padding: '8px 10px', marginBottom: 12,
          lineHeight: 1.5,
        }}>
          {Object.entries(RUBRIC).map(([dim, levels]) => (
            <div key={dim} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, textTransform: 'capitalize', marginBottom: 2 }}>{dim}</div>
              {levels.map(([val, desc]) => (
                <div key={val}>{val}: {desc}</div>
              ))}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

function Tip({ text }) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const handleEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.top - 4, right: window.innerWidth - r.right });
    }
    setShow(true);
  };

  return (
    <span
      ref={ref}
      style={{ marginLeft: 4, cursor: 'help', display: 'inline-block' }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: 10 }}>?</span>
      {show && (
        <span style={{
          position: 'fixed', right: pos.right, top: pos.top,
          transform: 'translateY(-100%)',
          padding: '6px 10px', borderRadius: 6,
          background: '#1E293B', color: '#F1F5F9', fontSize: 11, lineHeight: 1.4,
          fontWeight: 400, textTransform: 'none', letterSpacing: 'normal',
          whiteSpace: 'normal', width: 220,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {text}
        </span>
      )}
    </span>
  );
}
