import { useNavigate, useParams } from "react-router";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, TrendingUp, Eye, Mic, Activity, Lightbulb, Download, FileSpreadsheet, FileJson, Printer, ChevronDown, Loader2 } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { getReportByCandidate, getReportExportUrl, type ReportData } from "../api";

// --- Helper: build chart data from API response ---
function buildFacialRadar(report: ReportData) {
  const details = report.scores.component_details || {};
  return [
    { metric: "Eye Contact", value: Math.round(details.eye_contact_score ?? report.scores.facial * 0.8) },
    { metric: "Gaze Stability", value: Math.round(details.gaze_stability_score ?? 50) },
    { metric: "Head Stability", value: Math.round(details.head_stability_score ?? 50) },
    { metric: "Smile", value: Math.round(details.smile_score ?? report.scores.facial * 0.6) },
    { metric: "Brow Relax", value: Math.round(100 - (details.brow_tension ?? 0)) },
    { metric: "Jaw Relax", value: Math.round(100 - (details.jaw_tension ?? 0)) },
  ];
}

function buildNervousnessBreakdown(report: ReportData) {
  const details = report.scores.component_details || {};
  return [
    { name: "Facial", value: Math.round(details.facial_nervousness ?? (100 - (report.scores.facial || 50))), color: "#8B5CF6" },
    { name: "Vocal", value: Math.round(details.vocal_nervousness ?? (100 - (report.scores.vocal || 50))), color: "#A855F7" },
    { name: "Behavioral", value: Math.round(details.behavioral_nervousness ?? (100 - (report.scores.behavioral || 50))), color: "#10B981" },
  ];
}

function buildEmotions(report: ReportData) {
  const dist = report.emotion_distribution;
  let all: { name: string; value: number; color: string }[];
  if (dist) {
    all = [
      { name: "Neutral", value: dist.neutral, color: "#94A3B8" },
      { name: "Focus", value: dist.focus, color: "#22D3EE" },
      { name: "Stress", value: dist.stress, color: "#F59E0B" },
      { name: "Confidence", value: dist.confidence, color: "#8B5CF6" },
    ];
  } else {
    // Fallback if no emotion_distribution
    const confidence = report.scores.overall_confidence || 0;
    const nervousness = report.scores.overall_nervousness || 0;
    all = [
      { name: "Neutral", value: Math.round(Math.max(100 - confidence - nervousness, 10)), color: "#94A3B8" },
      { name: "Focus", value: Math.round(Math.max(confidence * 0.3, 5)), color: "#22D3EE" },
      { name: "Stress", value: Math.round(nervousness), color: "#F59E0B" },
      { name: "Confidence", value: Math.round(confidence), color: "#8B5CF6" },
    ];
  }
  return { chartData: all.filter(d => d.value > 0), legendData: all };
}

function buildSpeakingPace(report: ReportData) {
  // Use real time-series data from session metrics
  if (report.timeline && report.timeline.length > 0) {
    const paceData = report.timeline.map(t => ({
      time: t.time,
      wpm: Math.round(t.wpm),
    }));
    // Return empty if all WPM values are 0 (no vocal data captured)
    if (paceData.some(p => p.wpm > 0)) return paceData;
    return [];
  }
  // Fallback to per-question data
  const questions = (report.questions || []).filter(q => q.analysis != null);
  const data = questions.map((q, i) => ({
    time: `Q${q.order != null ? q.order + 1 : i + 1}`,
    wpm: Math.round(q.analysis?.speaking_rate || 0),
  }));
  if (data.some(d => d.wpm > 0)) return data;
  return [];
}

function buildFillerFrequency(report: ReportData) {
  // Use real time-series data from session metrics
  if (report.timeline && report.timeline.length > 0) {
    return report.timeline.map(t => ({
      time: t.time,
      count: t.filler_count,
    }));
  }
  // Fallback to per-question data
  const questions = (report.questions || []).filter(q => q.analysis != null);
  return questions.map((q, i) => ({
    time: `Q${q.order != null ? q.order + 1 : i + 1}`,
    count: q.analysis?.filler_word_count || 0,
  }));
}

function buildBehavioralIncidents(report: ReportData) {
  const questions = report.questions || [];
  return questions
    .filter(q => q.analysis != null)
    .map((q, i) => ({
      question: `Q${q.order != null ? q.order + 1 : i + 1}`,
      fidgets: q.analysis?.fidget_count || 0,
      posture: q.analysis?.posture_shift_count || 0,
      touch: q.analysis?.self_touch_count || 0,
    }));
}

function buildNervousnessTimeline(report: ReportData) {
  const questions = report.questions || [];
  return questions
    .filter(q => q.analysis != null)
    .map((q, i) => {
      const nervScore = q.analysis?.nervousness_score || 0;
      let level: string;
      let color: string;
      if (nervScore > 60) {
        level = "elevated";
        color = "#EF4444";
      } else if (nervScore > 35) {
        level = "moderate";
        color = "#F59E0B";
      } else {
        level = "low";
        color = "#22D3EE";
      }
      return { question: `Q${q.order != null ? q.order + 1 : i + 1}`, level, color, score: Math.round(nervScore) };
    });
}

// --- StatBox Component ---
function StatBox({
  value,
  label,
  color = "#8b5cf6",
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-lg px-5 py-3 text-center">
      <p style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value}</p>
      <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.75rem" }}>
        {label}
      </p>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    fontSize: "0.75rem",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    color: "hsl(var(--foreground))"
  },
  itemStyle: { color: "hsl(var(--foreground))" }
};

export function CandidateReportPage() {
  const navigate = useNavigate();
  const { id, candidateIdx } = useParams();
  const [exportOpen, setExportOpen] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch report data
  useEffect(() => {
    async function loadReport() {
      if (!id || !candidateIdx) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getReportByCandidate(parseInt(id, 10), parseInt(candidateIdx, 10));
        if ((data as any).status && (data as any).status !== "ready") {
          setError((data as any).message || `Report status: ${(data as any).status}`);
          return;
        }
        setReport(data);
      } catch (err: any) {
        setError(err.message || "Failed to load report.");
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [id, candidateIdx]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Export helpers ---
  function exportJSON() {
    if (!report) return;
    const url = getReportExportUrl(report.session_id, "json");
    window.open(url, "_blank");
    setExportOpen(false);
  }

  function exportCSV() {
    if (!report) return;
    const url = getReportExportUrl(report.session_id, "csv");
    window.open(url, "_blank");
    setExportOpen(false);
  }

  function exportPDF() {
    if (!report) return;
    const url = getReportExportUrl(report.session_id, "pdf");
    window.open(url, "_blank");
    setExportOpen(false);
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading report...</span>
      </div>
    );
  }

  // Error state
  if (error || !report) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">{error || "Report not available yet."}</p>
        <button
          onClick={() => navigate(`/scheduled/${id || "1"}`)}
          className="text-primary hover:underline"
          style={{ fontSize: "0.9rem" }}
        >
          Back to Interview Details
        </button>
      </div>
    );
  }

  // Build chart data from real report
  const facialRadar = buildFacialRadar(report);
  const { chartData: emotionsChartData, legendData: emotionsLegendData } = buildEmotions(report);
  const nervousnessBreakdown = buildNervousnessBreakdown(report);
  const speakingPace = buildSpeakingPace(report);
  const fillerFrequency = buildFillerFrequency(report);
  const behavioralIncidents = buildBehavioralIncidents(report);
  const nervousnessTimeline = buildNervousnessTimeline(report);

  const answeredQuestions = report.questions.filter(q => q.analysis != null);
  const totalPostureShifts = answeredQuestions.reduce((sum, q) => sum + (q.analysis?.posture_shift_count || 0), 0);
  const totalSelfTouch = answeredQuestions.reduce((sum, q) => sum + (q.analysis?.self_touch_count || 0), 0);
  const totalFidgets = answeredQuestions.reduce((sum, q) => sum + (q.analysis?.fidget_count || 0), 0);
  const totalFillerWords = answeredQuestions.reduce((sum, q) => sum + (q.analysis?.filler_word_count || 0), 0);
  const answeredWithWPM = answeredQuestions.filter(q => (q.analysis?.speaking_rate || 0) > 0);
  const avgWPM = answeredWithWPM.length > 0
    ? Math.round(answeredWithWPM.reduce((sum, q) => sum + (q.analysis?.speaking_rate || 0), 0) / answeredWithWPM.length)
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(`/scheduled/${id || "1"}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <h1
            style={{ fontSize: "1.5rem", fontWeight: 700 }}
            className="text-foreground"
          >
            Candidate Report
          </h1>
        </button>

        {/* Export Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="btn-hero px-5 py-2.5"
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
          >
            <Download className="w-4 h-4" />
            Export
            <ChevronDown className={`w-4 h-4 transition-transform ${exportOpen ? "rotate-180" : ""}`} />
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-card/90 backdrop-blur-xl border border-border rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={exportPDF}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-foreground hover:bg-white/5 transition-colors text-left"
                style={{ fontSize: "0.85rem" }}
              >
                <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center shrink-0 border border-red-500/20">
                  <Printer className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p style={{ fontWeight: 600 }}>Print / PDF</p>
                  <p className="text-muted-foreground" style={{ fontSize: "0.7rem" }}>
                    Via browser print dialog
                  </p>
                </div>
              </button>

              <button
                onClick={exportCSV}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-foreground hover:bg-white/5 transition-colors text-left"
                style={{ fontSize: "0.85rem" }}
              >
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p style={{ fontWeight: 600 }}>Export as CSV</p>
                  <p className="text-muted-foreground" style={{ fontSize: "0.7rem" }}>
                    Spreadsheet compatible
                  </p>
                </div>
              </button>

              <button
                onClick={exportJSON}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-foreground hover:bg-white/5 transition-colors text-left"
                style={{ fontSize: "0.85rem" }}
              >
                <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0 border border-amber-500/20">
                  <FileJson className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p style={{ fontWeight: 600 }}>Export as JSON</p>
                  <p className="text-muted-foreground" style={{ fontSize: "0.7rem" }}>
                    Raw structured data
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overall Confidence Score Card */}
      <div className="card-gradient backdrop-blur-xl rounded-xl p-8 mb-6 text-center relative overflow-hidden">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-full px-4 py-1.5 mb-4">
          <div className="icon-badge-squircle w-6 h-6 p-0.5">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
            Session Complete
          </span>
        </div>

        <h2
          style={{ fontSize: "1.35rem", fontWeight: 700 }}
          className="text-foreground mb-2"
        >
          Overall Confidence Score
        </h2>

        <p
          className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400 mb-2"
          style={{ fontSize: "4rem", fontWeight: 800, lineHeight: 1.1 }}
        >
          {Math.round(report.scores.overall_confidence)}%
        </p>

        <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-4">
          <TrendingUp className="w-4 h-4" />
          <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
            {report.candidate.name} — {report.interview.job_position}
          </span>
        </div>

        <p
          className="text-muted-foreground max-w-xl mx-auto"
          style={{ fontSize: "0.9rem", lineHeight: 1.7 }}
        >
          {report.summary}
        </p>
      </div>

      {/* Multimodal Score Breakdown — Weighted Fusion (35/30/35) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card-gradient backdrop-blur-xl rounded-xl p-5 text-center">
          <p className="text-muted-foreground mb-1" style={{ fontSize: "0.75rem", fontWeight: 500 }}>Facial Score (35%)</p>
          <p style={{ fontSize: "2rem", fontWeight: 700, color: report.scores.facial >= 60 ? "#8B5CF6" : "#F59E0B" }}>
            {Math.round(report.scores.facial)}
          </p>
          <p className="text-muted-foreground mt-1" style={{ fontSize: "0.7rem" }}>
            Nervousness: {Math.round(nervousnessBreakdown[0].value)}%
          </p>
        </div>
        <div className="card-gradient backdrop-blur-xl rounded-xl p-5 text-center">
          <p className="text-muted-foreground mb-1" style={{ fontSize: "0.75rem", fontWeight: 500 }}>Vocal Score (30%)</p>
          <p style={{ fontSize: "2rem", fontWeight: 700, color: report.scores.vocal >= 60 ? "#A855F7" : "#F59E0B" }}>
            {Math.round(report.scores.vocal)}
          </p>
          <p className="text-muted-foreground mt-1" style={{ fontSize: "0.7rem" }}>
            Nervousness: {Math.round(nervousnessBreakdown[1].value)}%
          </p>
        </div>
        <div className="card-gradient backdrop-blur-xl rounded-xl p-5 text-center">
          <p className="text-muted-foreground mb-1" style={{ fontSize: "0.75rem", fontWeight: 500 }}>Behavioral Score (35%)</p>
          <p style={{ fontSize: "2rem", fontWeight: 700, color: report.scores.behavioral >= 60 ? "#10B981" : "#F59E0B" }}>
            {Math.round(report.scores.behavioral)}
          </p>
          <p className="text-muted-foreground mt-1" style={{ fontSize: "0.7rem" }}>
            Nervousness: {Math.round(nervousnessBreakdown[2].value)}%
          </p>
        </div>
        <div className="card-gradient backdrop-blur-xl rounded-xl p-5 text-center">
          <p className="text-muted-foreground mb-1" style={{ fontSize: "0.75rem", fontWeight: 500 }}>Overall Nervousness</p>
          <p style={{ fontSize: "2rem", fontWeight: 700, color: report.scores.overall_nervousness <= 35 ? "#22D3EE" : report.scores.overall_nervousness <= 60 ? "#F59E0B" : "#EF4444" }}>
            {Math.round(report.scores.overall_nervousness)}
          </p>
          <p className="text-muted-foreground mt-1" style={{ fontSize: "0.7rem" }}>
            {report.scores.overall_nervousness <= 35 ? "Low" : report.scores.overall_nervousness <= 60 ? "Moderate" : "Elevated"}
          </p>
        </div>
      </div>

      {/* Three Metric Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Facial Metrics */}
        <div className="card-gradient backdrop-blur-xl rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 icon-badge-squircle">
              <Eye className="w-5 h-5" />
            </div>
            <h3
              style={{ fontSize: "1rem", fontWeight: 600 }}
              className="text-foreground"
            >
              Facial Metrics
            </h3>
          </div>

          {/* Radar Chart */}
          <div className="h-52 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={facialRadar}
                cx="50%"
                cy="50%"
                outerRadius="70%"
              >
                <PolarGrid stroke="rgba(255,255,255,0.2)" id="facial-radar-grid" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fontSize: 10, fill: "#cbd5e1" }}
                />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  key="facial-radar-data"
                  dataKey="value"
                  stroke="#22D3EE"
                  fill="#22D3EE"
                  fillOpacity={0.4}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Donut Chart */}
          <div className="h-44 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={emotionsChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {emotionsChartData.map((entry) => (
                    <Cell key={`emotion-cell-${entry.name}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2">
            {emotionsLegendData.map((e) => (
              <div key={e.name} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: e.color }}
                />
                <span className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
                  {e.name}: {e.value}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Vocal Metrics */}
        <div className="card-gradient backdrop-blur-xl rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 icon-badge-squircle">
              <Mic className="w-5 h-5" />
            </div>
            <h3
              style={{ fontSize: "1rem", fontWeight: 600 }}
              className="text-foreground"
            >
              Vocal Metrics
            </h3>
          </div>

          {avgWPM === 0 && totalFillerWords === 0 && speakingPace.length === 0 ? (
            <div className="text-center py-10">
              <Mic className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-muted-foreground" style={{ fontSize: "0.85rem" }}>
                No vocal data was captured for this session.
              </p>
              <p className="text-muted-foreground mt-1" style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                Ensure microphone access is enabled in a Chromium-based browser.
              </p>
            </div>
          ) : (
          <>
          {/* Stat Boxes */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatBox value={avgWPM} label="Avg WPM" color="#a855f7" />
            <StatBox
              value={totalFillerWords}
              label="Filler Words"
              color="#fbbf24"
            />
          </div>

          {/* Speaking Pace Line Chart */}
          <p
            className="text-muted-foreground mb-2"
            style={{ fontSize: "0.75rem", fontWeight: 500 }}
          >
            Speaking Pace (WPM) over Time
          </p>
          <div className="h-36 mb-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={speakingPace}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  width={30}
                />
                <Tooltip {...tooltipStyle} />
                <Line
                  key="speaking-pace-line"
                  type="monotone"
                  dataKey="wpm"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#a855f7" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Filler Word Frequency Bar Chart */}
          <p
            className="text-muted-foreground mb-2"
            style={{ fontSize: "0.75rem", fontWeight: 500 }}
          >
            Filler Word Frequency over Time
          </p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fillerFrequency}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  width={20}
                />
                <Tooltip {...tooltipStyle} />
                <Bar key="filler-count-bar" dataKey="count" fill="#fbbf24" radius={[3, 3, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          </>
          )}
        </div>

        {/* Behavioral Metrics */}
        <div className="card-gradient backdrop-blur-xl rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 icon-badge-squircle">
              <Activity className="w-5 h-5" />
            </div>
            <h3
              style={{ fontSize: "1rem", fontWeight: 600 }}
              className="text-foreground"
            >
              Behavioral Metrics
            </h3>
          </div>

          {/* Stat Boxes */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatBox
              value={totalFidgets}
              label="Fidgets"
              color="#f97316"
            />
            <StatBox
              value={totalPostureShifts}
              label="Posture Shifts"
              color="#10b981"
            />
            <StatBox
              value={totalSelfTouch}
              label="Self-Touch"
              color="#fbbf24"
            />
          </div>

          {/* Behavioral Incidents Bar Chart */}
          <p
            className="text-muted-foreground mb-2"
            style={{ fontSize: "0.75rem", fontWeight: 500 }}
          >
            Behavioral Incidents by Question
          </p>
          <div className="h-36 mb-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={behavioralIncidents}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="question"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  width={20}
                />
                <Tooltip {...tooltipStyle} />
                <Bar
                  key="behavioral-fidgets-bar"
                  dataKey="fidgets"
                  fill="#f97316"
                  radius={[3, 3, 0, 0]}
                  barSize={10}
                />
                <Bar
                  key="behavioral-posture-bar"
                  dataKey="posture"
                  fill="#10b981"
                  radius={[3, 3, 0, 0]}
                  barSize={10}
                />
                <Bar
                  key="behavioral-touch-bar"
                  dataKey="touch"
                  fill="#fbbf24"
                  radius={[3, 3, 0, 0]}
                  barSize={10}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Nervousness Timeline */}
          <p
            className="text-muted-foreground mb-3"
            style={{ fontSize: "0.75rem", fontWeight: 500 }}
          >
            Nervousness Timeline
          </p>
          <div className="flex items-center gap-1.5">
            {nervousnessTimeline.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full h-7 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: item.color }}
                >
                  <span style={{ fontSize: "0.6rem", fontWeight: 600, color: "#fff" }}>{item.score}</span>
                </div>
                <span className="text-muted-foreground/70" style={{ fontSize: "0.6rem" }}>
                  {item.question}
                </span>
                <span className="text-muted-foreground/50" style={{ fontSize: "0.55rem" }}>
                  {item.level}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI-Generated Improvement Tips */}
      <div className="card-gradient backdrop-blur-xl rounded-xl p-6 mb-6 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-10 h-10 icon-badge-squircle">
            <Lightbulb className="w-5 h-5 text-amber-400" />
          </div>
          <h3
            style={{ fontSize: "1.1rem", fontWeight: 600 }}
            className="text-foreground"
          >
            AI-Generated Improvement Tips
          </h3>
        </div>

        <div className="space-y-3">
          {report.tips.length === 0 ? (
            <p className="text-muted-foreground text-center py-4" style={{ fontSize: "0.85rem" }}>
              No specific improvement tips — great performance!
            </p>
          ) : (
            report.tips.map((tip, idx) => (
              <div
                key={idx}
                className="bg-black/20 border border-white/5 rounded-xl px-5 py-4 flex items-start gap-4 transition-colors hover:bg-black/40"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground shrink-0 mt-0.5 bg-gradient-to-br from-primary to-purple-600 shadow-sm"
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                  }}
                >
                  {idx + 1}
                </div>
                <div>
                  <p
                    style={{ fontSize: "0.9rem", fontWeight: 600 }}
                    className="text-foreground mb-1"
                  >
                    {tip.title}
                  </p>
                  <p
                    className="text-muted-foreground"
                    style={{ fontSize: "0.85rem", lineHeight: 1.6 }}
                  >
                    {tip.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
