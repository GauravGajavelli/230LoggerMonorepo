import { useState, useRef, useEffect } from "react";

/* ═══════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════ */

const ASSIGNMENTS = [
  {
    id: "bst-remove",
    title: "Binary Search Tree — remove()",
    dueDate: "Apr 14, 2026",
    submittedAt: "Apr 14, 2026 · 11:42 PM",
    status: "new",
    passing: 5,
    failing: 3,
    improved: 2,
    total: 8,
  },
  {
    id: "avl-rotations",
    title: "AVL Tree — Rotations",
    dueDate: "Apr 7, 2026",
    submittedAt: "Apr 7, 2026 · 10:15 PM",
    status: "reviewed",
    passing: 7,
    failing: 1,
    improved: 1,
    total: 8,
  },
  {
    id: "hashtable",
    title: "Hash Table — Collision Handling",
    dueDate: "Mar 31, 2026",
    submittedAt: "Mar 31, 2026 · 9:58 PM",
    status: "reviewed",
    passing: 10,
    failing: 0,
    improved: 3,
    total: 10,
  },
];

const DETAIL_DATA = {
  assignment: "Binary Search Tree — remove()",
  submitted: "Apr 14, 2026 · 11:42 PM",
  summary: { passing: 5, failing: 3, improved: 2 },
  tests: [
    {
      id: 1, name: "testRemoveSingleChild", status: "failing", changedAt: "10:18 PM",
      explanation: "After your edit at 10:18 PM, you changed the child-pointer reassignment in remove(). The left child is now linked where the right child should be, causing the tree to lose the right subtree.",
      suggestion: "Check the direction of the pointer assignment on line 147. Compare it to how you handle the mirror case on line 153 — the pattern should match but for the opposite child.",
      diff: {
        before: ["  if (node.left != null && node.right == null) {", "      return node.left;", "  } else if (node.right != null && node.left == null) {", "-     return node.right;", "  }"],
        after: ["  if (node.left != null && node.right == null) {", "      return node.left;", "  } else if (node.right != null && node.left == null) {", "+     return node.left;  // ← bug: should be node.right", "  }"],
      },
    },
    {
      id: 2, name: "testRemoveRoot", status: "failing", changedAt: "10:31 PM",
      explanation: "The root removal fails because the in-order successor lookup doesn't account for the case where the right child has no left subtree. Your loop exits immediately and the successor value is never copied.",
      suggestion: "Add a base case: if node.right.left is null, the successor is simply node.right. Handle this before entering the while loop.",
      diff: {
        before: ["  Node successor = node.right;", "  while (successor.left != null) {", "      successor = successor.left;", "  }"],
        after: ["  Node successor = node.right;", "  // missing: if successor.left == null, use successor directly", "  while (successor.left != null) {", "      successor = successor.left;", "  }"],
      },
    },
    {
      id: 3, name: "testRemoveLeaf", status: "failing", changedAt: "9:52 PM",
      explanation: "This test began failing after your 9:52 PM change where you modified the null-return logic. The parent still holds a reference to the deleted node instead of being set to null.",
      suggestion: "Trace through the recursive call: when remove() returns null for a leaf, make sure the parent assigns that return value back to its child pointer.",
      diff: {
        before: ["  if (node.left == null && node.right == null) {", "-     return null;", "  }"],
        after: ["  if (node.left == null && node.right == null) {", "+     node = null;  // ← doesn't propagate to parent", "  }"],
      },
    },
    { id: 4, name: "testRemoveTwoChildren", status: "passing", changedAt: null, explanation: "", suggestion: "" },
    { id: 5, name: "testRemoveNotFound", status: "passing", changedAt: null, explanation: "", suggestion: "" },
    { id: 6, name: "testTreeStructureAfterRemove", status: "improved", changedAt: "10:31 PM", explanation: "", suggestion: "" },
    { id: 7, name: "testRemoveFromEmptyTree", status: "passing", changedAt: null, explanation: "", suggestion: "" },
    { id: 8, name: "testSizeAfterRemove", status: "improved", changedAt: "10:18 PM", explanation: "", suggestion: "" },
  ],
  timeline: [
    { time: "9:30 PM", passing: 6, failing: 2, event: null },
    { time: "9:45 PM", passing: 6, failing: 2, event: null },
    { time: "9:52 PM", passing: 5, failing: 3, event: "testRemoveLeaf broke" },
    { time: "10:00 PM", passing: 5, failing: 3, event: null },
    { time: "10:10 PM", passing: 5, failing: 3, event: null },
    { time: "10:18 PM", passing: 4, failing: 4, event: "testRemoveSingleChild broke" },
    { time: "10:25 PM", passing: 4, failing: 4, event: null },
    { time: "10:31 PM", passing: 5, failing: 3, event: "testTreeStructure fixed" },
    { time: "10:40 PM", passing: 5, failing: 3, event: null },
    { time: "11:42 PM", passing: 5, failing: 3, event: "Submitted" },
  ],
  episodes: [
    {
      id: "ep1",
      timeRange: "9:30 – 9:52 PM",
      edits: 6,
      area: "remove(), leaf-node branch",
      outcome: "testRemoveLeaf went from passing to failing",
      outcomeType: "regression",
      linkedTestId: 3,
    },
    {
      id: "ep2",
      timeRange: "9:55 – 10:18 PM",
      edits: 4,
      area: "remove(), single-child branch",
      outcome: "testRemoveSingleChild went from passing to failing",
      outcomeType: "regression",
      linkedTestId: 1,
    },
    {
      id: "ep3",
      timeRange: "10:20 – 10:31 PM",
      edits: 3,
      area: "remove(), two-children branch",
      outcome: "testTreeStructure went from failing to passing",
      outcomeType: "fix",
      linkedTestId: 6,
    },
    {
      id: "ep4",
      timeRange: "10:35 – 11:42 PM",
      edits: 5,
      area: "remove(), cleanup and retest",
      outcome: "testSizeAfterRemove went from failing to passing. No other changes.",
      outcomeType: "fix",
      linkedTestId: 8,
    },
  ],
};

/* ═══════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════ */

const Icon = ({ type, size = 16 }) => {
  const s = { width: size, height: size, display: "inline-block", flexShrink: 0 };
  if (type === "fail") return (
    <svg style={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#FECACA" stroke="#DC2626" strokeWidth="1.2" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
  if (type === "pass") return (
    <svg style={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#D1FAE5" stroke="#059669" strokeWidth="1.2" />
      <path d="M5 8.2l2 2 4-4.4" stroke="#059669" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (type === "improved") return (
    <svg style={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#DBEAFE" stroke="#2563EB" strokeWidth="1.2" />
      <path d="M8 11V5.5M5.5 7.5L8 5l2.5 2.5" stroke="#2563EB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (type === "chevron") return (
    <svg style={{ ...s, transition: "transform .2s" }} viewBox="0 0 16 16" fill="none">
      <path d="M6 4l4 4-4 4" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (type === "clock") return (
    <svg style={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="#94A3B8" strokeWidth="1.2" />
      <path d="M8 4.5V8l2.5 1.5" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
  if (type === "back") return (
    <svg style={s} viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (type === "new") return (
    <svg style={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="4" fill="#F59E0B" />
    </svg>
  );
  if (type === "reviewed") return (
    <svg style={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="#CBD5E1" strokeWidth="1.2" fill="none" />
      <path d="M5.5 8l1.8 1.8 3.2-3.6" stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return null;
};

/* ═══════════════════════════════════════════
   TIMELINE CHART
   ═══════════════════════════════════════════ */

const TimelineChart = ({ data }) => {
  const h = 100, w = 520, padY = 16, padX = 30;
  const maxVal = 8;
  const stepX = (w - padX * 2) / (data.length - 1);
  const y = (v) => padY + ((maxVal - v) / maxVal) * (h - padY * 2);
  const passingPts = data.map((d, i) => `${padX + i * stepX},${y(d.passing)}`).join(" ");
  const failingPts = data.map((d, i) => `${padX + i * stepX},${y(d.failing)}`).join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={w} height={h + 32} style={{ display: "block" }}>
        {[0, 2, 4, 6, 8].map((v) => (
          <g key={v}>
            <line x1={padX} x2={w - padX} y1={y(v)} y2={y(v)} stroke="#E2E8F0" strokeWidth="1" />
            <text x={padX - 6} y={y(v) + 4} textAnchor="end" fill="#94A3B8" fontSize="10" fontFamily="'IBM Plex Mono', monospace">{v}</text>
          </g>
        ))}
        <polyline points={passingPts} fill="none" stroke="#059669" strokeWidth="2" />
        <polyline points={failingPts} fill="none" stroke="#DC2626" strokeWidth="2" strokeDasharray="4 3" />
        {data.map((d, i) => d.event ? (
          <g key={i} style={{ cursor: "pointer" }}>
            <circle cx={padX + i * stepX} cy={y(d.failing)} r="6" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
          </g>
        ) : null)}
        {data.map((d, i) => i % 2 === 0 || d.event ? (
          <text key={i} x={padX + i * stepX} y={h + 20} textAnchor="middle" fill="#64748B" fontSize="9" fontFamily="'IBM Plex Mono', monospace">{d.time}</text>
        ) : null)}
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 4, paddingLeft: padX }}>
        <span style={{ fontSize: 11, color: "#059669", fontFamily: "'IBM Plex Mono', monospace" }}>● Passing</span>
        <span style={{ fontSize: 11, color: "#DC2626", fontFamily: "'IBM Plex Mono', monospace" }}>╌ Failing</span>
        <span style={{ fontSize: 11, color: "#F59E0B", fontFamily: "'IBM Plex Mono', monospace" }}>● Event</span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   DIFF VIEWER
   ═══════════════════════════════════════════ */

const DiffView = ({ diff }) => {
  if (!diff) return null;
  const lines = [...diff.before, "───", ...diff.after];
  return (
    <pre style={{
      fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: "1.7",
      background: "#0F172A", color: "#CBD5E1", borderRadius: 8,
      padding: "12px 16px", margin: "8px 0 0", overflowX: "auto", border: "1px solid #1E293B",
    }}>
      {lines.map((l, i) => {
        let color = "#CBD5E1", bg = "transparent";
        if (l.startsWith("-")) { color = "#FCA5A5"; bg = "rgba(220,38,38,.12)"; }
        if (l.startsWith("+")) { color = "#86EFAC"; bg = "rgba(5,150,105,.12)"; }
        if (l === "───") return <div key={i} style={{ borderTop: "1px dashed #334155", margin: "6px 0" }} />;
        return <div key={i} style={{ color, background: bg, padding: "0 4px", borderRadius: 3 }}>{l}</div>;
      })}
    </pre>
  );
};

/* ═══════════════════════════════════════════
   EPISODE CHIPS (inline timeline annotation)
   ═══════════════════════════════════════════ */

const EpisodeChips = ({ episodes, onJump }) => {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
      {episodes.map((ep) => {
        const isRegression = ep.outcomeType === "regression";
        return (
          <button
            key={ep.id}
            onClick={() => onJump(ep)}
            style={{
              all: "unset", display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px 4px 7px", borderRadius: 6, cursor: "pointer",
              fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
              background: isRegression ? "#FEF2F2" : "#EFF6FF",
              border: `1px solid ${isRegression ? "#FECACA" : "#BFDBFE"}`,
              color: isRegression ? "#991B1B" : "#1E40AF",
              transition: "box-shadow .12s, border-color .12s",
              lineHeight: 1.3,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.08)";
              e.currentTarget.style.borderColor = isRegression ? "#FCA5A5" : "#93C5FD";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = isRegression ? "#FECACA" : "#BFDBFE";
            }}
          >
            <Icon type={isRegression ? "fail" : "improved"} size={11} />
            <span>{ep.timeRange.split(" – ")[0]}</span>
            <span style={{ color: isRegression ? "#DC2626" : "#2563EB", fontWeight: 500 }}>·</span>
            <span style={{ fontWeight: 500 }}>{ep.area.split(", ")[1] || ep.area}</span>
          </button>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════
   TEST CARD
   ═══════════════════════════════════════════ */

const TestCard = ({ test, forceOpen, onViewed }) => {
  const [manualOpen, setManualOpen] = useState(false);
  const cardRef = useRef(null);
  const isFailing = test.status === "failing";
  const open = isFailing && (manualOpen || forceOpen);
  const highlighted = forceOpen;

  useEffect(() => {
    if (forceOpen && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [forceOpen]);

  const borderColor = isFailing ? "#FECACA" : test.status === "improved" ? "#BFDBFE" : "#D1FAE5";
  const bgColor = isFailing ? "#FFFBFB" : test.status === "improved" ? "#F8FAFF" : "#F7FDF9";

  return (
    <div ref={cardRef} style={{
      border: `1px solid ${highlighted ? "#F59E0B" : borderColor}`, borderRadius: 10, background: bgColor,
      marginBottom: 8, transition: "box-shadow .15s, border-color .3s",
      boxShadow: highlighted ? "0 2px 12px rgba(245,158,11,.12)" : open && isFailing ? "0 2px 12px rgba(220,38,38,.08)" : "none",
    }}>
      <button
        onClick={() => isFailing && setManualOpen(!manualOpen)}
        style={{
          all: "unset", display: "flex", alignItems: "center", gap: 10,
          width: "100%", padding: "12px 16px", cursor: isFailing ? "pointer" : "default", boxSizing: "border-box",
        }}
      >
        <Icon type={test.status === "improved" ? "improved" : test.status === "failing" ? "fail" : "pass"} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 500, color: "#1E293B", flex: 1, textAlign: "left" }}>
          {test.name}
        </span>
        {test.changedAt && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748B", fontFamily: "'IBM Plex Mono', monospace" }}>
            <Icon type="clock" size={13} />{test.changedAt}
          </span>
        )}
        {isFailing && (
          <span style={{ transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform .2s", marginLeft: 4 }}>
            <Icon type="chevron" />
          </span>
        )}
      </button>
      {open && isFailing && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #FEE2E2" }}>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#94A3B8", marginBottom: 6 }}>What happened</div>
            <p style={{ fontSize: 13, lineHeight: "1.6", color: "#334155", margin: 0 }}>{test.explanation}</p>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#94A3B8", marginBottom: 6 }}>Code change</div>
            <DiffView diff={test.diff} />
          </div>
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#B45309", marginBottom: 4 }}>Suggested next step</div>
            <p style={{ fontSize: 13, lineHeight: "1.55", color: "#78350F", margin: 0 }}>{test.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   DETAIL VIEW
   ═══════════════════════════════════════════ */

const DetailView = ({ onBack }) => {
  const [tab, setTab] = useState("issues");
  const [highlightedTestId, setHighlightedTestId] = useState(null);
  const d = DETAIL_DATA;
  const failingTests = d.tests.filter((t) => t.status === "failing");
  const improvedTests = d.tests.filter((t) => t.status === "improved");
  const passingTests = d.tests.filter((t) => t.status === "passing");

  const handleEpisodeJump = (episode) => {
    const test = d.tests.find((t) => t.id === episode.linkedTestId);
    if (!test) return;

    // switch to the right tab
    if (test.status === "failing") setTab("issues");
    else if (test.status === "improved") setTab("improved");
    else setTab("passing");

    // highlight and auto-open the linked test
    setHighlightedTestId(episode.linkedTestId);

    // clear highlight after a few seconds
    setTimeout(() => setHighlightedTestId(null), 3000);
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px 80px" }}>
      {/* back nav */}
      <button
        onClick={onBack}
        style={{
          all: "unset", display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "#64748B", cursor: "pointer", marginBottom: 20,
          padding: "4px 0",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#1E293B")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
      >
        <Icon type="back" size={14} />
        All assignments
      </button>

      {/* assignment header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: "0 0 4px", letterSpacing: "-.03em" }}>{d.assignment}</h1>
        <p style={{ fontSize: 12, color: "#64748B", margin: 0, fontFamily: "'IBM Plex Mono', monospace" }}>Submitted {d.submitted}</p>
      </div>

      {/* summary banner */}
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12,
        padding: "18px 20px", display: "flex", gap: 24, alignItems: "center",
        marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.04)",
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#0F172A", margin: "0 0 4px" }}>
            {d.summary.failing} of {d.summary.passing + d.summary.failing + d.summary.improved} tests need attention
          </p>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
            {d.summary.improved} test{d.summary.improved !== 1 ? "s" : ""} improved since your earlier runs — nice progress.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {d.tests.map((t) => (
            <span key={t.id} title={t.name} style={{
              width: 10, height: 28, borderRadius: 3,
              background: t.status === "failing" ? "#FCA5A5" : t.status === "improved" ? "#93C5FD" : "#6EE7B7",
            }} />
          ))}
        </div>
      </div>

      {/* timeline */}
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12,
        padding: "16px 20px", marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,.04)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#94A3B8", marginBottom: 10 }}>
          Session timeline
        </div>
        <TimelineChart data={d.timeline} />
        <p style={{ fontSize: 11, color: "#94A3B8", margin: "10px 0 0", lineHeight: 1.5 }}>
          Based on test runs recorded during your work session. Yellow dots mark moments when a test's status changed.
        </p>
        <EpisodeChips episodes={d.episodes} onJump={handleEpisodeJump} />
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: "2px solid #E2E8F0" }}>
        {[
          { key: "issues", label: `Needs attention (${failingTests.length})` },
          { key: "improved", label: `Improved (${improvedTests.length})` },
          { key: "passing", label: `Passing (${passingTests.length})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            all: "unset", padding: "8px 16px", fontSize: 13,
            fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? "#0F172A" : "#64748B",
            borderBottom: tab === t.key ? "2px solid #1E293B" : "2px solid transparent",
            marginBottom: -2, cursor: "pointer", transition: "color .15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "issues" && failingTests.map((t) => <TestCard key={t.id} test={t} forceOpen={highlightedTestId === t.id} />)}
      {tab === "improved" && improvedTests.map((t) => <TestCard key={t.id} test={t} forceOpen={highlightedTestId === t.id} />)}
      {tab === "passing" && passingTests.map((t) => <TestCard key={t.id} test={t} forceOpen={highlightedTestId === t.id} />)}

      {/* closure */}
      <div style={{
        marginTop: 24, padding: "16px 20px", background: "#FFFFFF",
        border: "1px solid #E2E8F0", borderRadius: 12, textAlign: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,.04)",
      }}>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 10px" }}>
          Done reviewing? You can come back anytime before the next assignment.
        </p>
        <button style={{
          all: "unset", padding: "8px 20px", fontSize: 13, fontWeight: 600,
          color: "#FFF", background: "#1E293B", borderRadius: 8, cursor: "pointer",
        }}>
          Mark as reviewed ✓
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ASSIGNMENT LIST (LANDING PAGE)
   ═══════════════════════════════════════════ */

const StatusPill = ({ status, failing }) => {
  if (status === "new" && failing > 0) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 10px 3px 7px", borderRadius: 20,
        background: "#FEF3C7", border: "1px solid #FDE68A",
        fontSize: 11, fontWeight: 600, color: "#92400E",
        fontFamily: "'IBM Plex Mono', monospace",
      }}>
        <Icon type="new" size={8} />
        {failing} to review
      </span>
    );
  }
  if (status === "new" && failing === 0) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 10px 3px 7px", borderRadius: 20,
        background: "#D1FAE5", border: "1px solid #A7F3D0",
        fontSize: 11, fontWeight: 600, color: "#065F46",
        fontFamily: "'IBM Plex Mono', monospace",
      }}>
        All passing
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px 3px 7px", borderRadius: 20,
      background: "#F1F5F9", border: "1px solid #E2E8F0",
      fontSize: 11, fontWeight: 500, color: "#64748B",
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <Icon type="reviewed" size={14} />
      Reviewed
    </span>
  );
};

const MiniBar = ({ tests }) => {
  const { passing, failing, improved, total } = tests;
  const segments = [
    { count: failing, color: "#FCA5A5" },
    { count: improved, color: "#93C5FD" },
    { count: passing, color: "#6EE7B7" },
  ];
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {segments.map((seg, si) =>
        Array.from({ length: seg.count }).map((_, i) => (
          <span key={`${si}-${i}`} style={{
            width: 6, height: 18, borderRadius: 2, background: seg.color,
          }} />
        ))
      )}
    </div>
  );
};

const AssignmentCard = ({ assignment, onClick }) => {
  const isNew = assignment.status === "new";
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset", display: "block", width: "100%", boxSizing: "border-box",
        background: "#FFFFFF",
        border: isNew ? "1px solid #FDE68A" : "1px solid #E2E8F0",
        borderRadius: 12, padding: "18px 20px", marginBottom: 10,
        cursor: "pointer", transition: "box-shadow .15s, border-color .15s",
        boxShadow: isNew ? "0 1px 4px rgba(245,158,11,.08)" : "0 1px 3px rgba(0,0,0,.04)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 3px 12px rgba(0,0,0,.08)";
        e.currentTarget.style.borderColor = "#CBD5E1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = isNew ? "0 1px 4px rgba(245,158,11,.08)" : "0 1px 3px rgba(0,0,0,.04)";
        e.currentTarget.style.borderColor = isNew ? "#FDE68A" : "#E2E8F0";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h2 style={{
              fontSize: 15, fontWeight: 600, color: "#0F172A", margin: 0,
              letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {assignment.title}
            </h2>
            <StatusPill status={assignment.status} failing={assignment.failing} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'IBM Plex Mono', monospace" }}>
              Due {assignment.dueDate}
            </span>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>·</span>
            <span style={{ fontSize: 12, color: "#64748B" }}>
              {assignment.passing + assignment.improved}/{assignment.total} passing
              {assignment.improved > 0 && (
                <span style={{ color: "#2563EB", marginLeft: 4 }}>
                  (+{assignment.improved} improved)
                </span>
              )}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MiniBar tests={assignment} />
          <Icon type="chevron" size={14} />
        </div>
      </div>
    </button>
  );
};

const AssignmentList = ({ onSelect }) => {
  const newAssignments = ASSIGNMENTS.filter((a) => a.status === "new");
  const reviewedAssignments = ASSIGNMENTS.filter((a) => a.status === "reviewed");

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 16px 80px" }}>
      {/* welcome header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0F172A", margin: "0 0 6px", letterSpacing: "-.03em" }}>
          Your debugging feedback
        </h1>
        <p style={{ fontSize: 14, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
          Personalized feedback on your recent assignments. Click one to see what changed and why.
        </p>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: "6px 0 0", lineHeight: 1.5 }}>
          Only you can see this feedback — it is not shared with course staff.
        </p>
      </div>

      {/* new feedback section */}
      {newAssignments.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em",
            color: "#B45309", marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
          }}>
            <Icon type="new" size={8} />
            New feedback
          </div>
          {newAssignments.map((a) => (
            <AssignmentCard key={a.id} assignment={a} onClick={() => onSelect(a.id)} />
          ))}
        </div>
      )}

      {/* reviewed section */}
      {reviewedAssignments.length > 0 && (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em",
            color: "#94A3B8", marginBottom: 10,
          }}>
            Previously reviewed
          </div>
          {reviewedAssignments.map((a) => (
            <AssignmentCard key={a.id} assignment={a} onClick={() => onSelect(a.id)} />
          ))}
        </div>
      )}

    </div>
  );
};

/* ═══════════════════════════════════════════
   APP SHELL
   ═══════════════════════════════════════════ */

export default function FeedbackApp() {
  const [view, setView] = useState("list"); // "list" | "detail"

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif" }}>
      {/* top bar */}
      <header style={{
        background: "#1E293B", color: "#F8FAFC", padding: "10px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-.02em", cursor: "pointer" }}
            onClick={() => setView("list")}
          >
            CSSE 230
          </span>
          <span style={{ color: "#64748B" }}>·</span>
          <span style={{ color: "#94A3B8" }}>Debugging Feedback</span>
        </div>
        <span style={{
          color: "#E2E8F0", fontSize: 13, fontWeight: 500,
          fontFamily: "'IBM Plex Mono', monospace",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="#E2E8F0" strokeWidth="1.3" fill="none" />
            <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="#E2E8F0" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Private to you
        </span>
      </header>

      {view === "list" && <AssignmentList onSelect={() => setView("detail")} />}
      {view === "detail" && <DetailView onBack={() => setView("list")} />}

      {/* research study footer */}
      <footer style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#F8FAFC", borderTop: "1px solid #E2E8F0",
        padding: "8px 24px", display: "flex", alignItems: "center",
        justifyContent: "center", gap: 6,
      }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="6.5" stroke="#94A3B8" strokeWidth="1.2" />
          <path d="M8 7v4M8 5.2v.1" stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 12, color: "#64748B" }}>
          Part of an IRB-approved research study.
        </span>
        <span
          style={{ fontSize: 12, color: "#2563EB", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          Learn more
        </span>
      </footer>
    </div>
  );
}
