import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Activity, Eye, Cpu, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getLiveMetrics, type LiveMetricsData } from "../api";

function GaugeCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card-gradient backdrop-blur-xl rounded-xl p-5 text-center relative overflow-hidden">
      <p className="text-muted-foreground mb-2" style={{ fontSize: "0.75rem", fontWeight: 500 }}>
        {label}
      </p>
      <p style={{ fontSize: "2.5rem", fontWeight: 800, color, lineHeight: 1 }}>
        {Math.round(value)}%
      </p>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-lg px-4 py-3 text-center">
      <p style={{ fontSize: "1.3rem", fontWeight: 700, color }}>{value}</p>
      <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.7rem" }}>{label}</p>
    </div>
  );
}

export function LiveDashboardPage() {
  const navigate = useNavigate();
  const { id, sessionId } = useParams();
  const [data, setData] = useState<LiveMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const fetchMetrics = async () => {
      try {
        const result = await getLiveMetrics(parseInt(sessionId, 10));
        setData(result);
        setError(null);
        setLoading(false);

        // Stop polling if session is no longer active
        if (result.session_status === "analyzed" || result.session_status === "analysis_failed") {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchMetrics();
    intervalRef.current = setInterval(fetchMetrics, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Connecting to live session...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">{error || "Unable to load live metrics."}</p>
        <button
          onClick={() => navigate(`/scheduled/${id}`)}
          className="text-primary hover:underline"
          style={{ fontSize: "0.9rem" }}
        >
          Back to Interview Details
        </button>
      </div>
    );
  }

  const isLive = data.session_status === "active";
  const timeline = data.timeline.map((t, i) => ({
    idx: i + 1,
    confidence: Math.round(t.confidence || 0),
    nervousness: Math.round(t.nervousness || 0),
  }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(`/scheduled/${id}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }} className="text-foreground">
            Live Dashboard
          </h1>
        </button>

        <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 border ${
          isLive
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-muted/20 border-border text-muted-foreground"
        }`}>
          {isLive && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
          <Cpu className="w-3.5 h-3.5" />
          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
            {isLive ? "Live" : data.session_status}
          </span>
        </div>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <GaugeCard
          label="Confidence"
          value={data.averages.confidence}
          color={data.averages.confidence > 60 ? "#22c55e" : data.averages.confidence > 40 ? "#eab308" : "#ef4444"}
        />
        <GaugeCard
          label="Nervousness"
          value={data.averages.nervousness}
          color={data.averages.nervousness < 40 ? "#22c55e" : data.averages.nervousness < 60 ? "#eab308" : "#ef4444"}
        />
      </div>

      {/* Current Question */}
      <div className="card-gradient backdrop-blur-xl rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground" style={{ fontSize: "0.75rem", fontWeight: 500 }}>
            Current Progress
          </span>
        </div>
        <p className="text-foreground" style={{ fontSize: "1rem", fontWeight: 600 }}>
          Question {(data.current_question_index || 0) + 1}
        </p>
        <p className="text-muted-foreground mt-1" style={{ fontSize: "0.8rem" }}>
          {data.total_snapshots} metric snapshots collected
        </p>
      </div>

      {/* Trend Chart */}
      {timeline.length > 1 && (
        <div className="card-gradient backdrop-blur-xl rounded-xl p-5 mb-6">
          <p className="text-muted-foreground mb-3" style={{ fontSize: "0.8rem", fontWeight: 500 }}>
            Confidence & Nervousness Trend
          </p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="idx"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    fontSize: "0.75rem",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "hsl(var(--foreground))",
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line
                  key="live-confidence-line"
                  type="monotone"
                  dataKey="confidence"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  name="Confidence"
                />
                <Line
                  key="live-nervousness-line"
                  type="monotone"
                  dataKey="nervousness"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  name="Nervousness"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Facial & Behavioral Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card-gradient backdrop-blur-xl rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-foreground" style={{ fontSize: "0.9rem", fontWeight: 600 }}>Facial</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Eye Contact" value={`${Math.round(data.averages.eye_contact_ratio * 100)}%`} color="#8b5cf6" />
            <StatCard label="Smile" value={`${Math.round(data.averages.smile_ratio * 100)}%`} color="#22d3ee" />
          </div>
        </div>

        <div className="card-gradient backdrop-blur-xl rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-foreground" style={{ fontSize: "0.9rem", fontWeight: 600 }}>Behavioral</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Posture Shifts" value={data.averages.posture_shifts} color="#10b981" />
            <StatCard label="Self-Touch" value={data.averages.self_touches} color="#fbbf24" />
          </div>
        </div>
      </div>
    </div>
  );
}
