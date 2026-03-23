import { useState, useEffect } from "react";
import { Search, FileText, Calendar, Clock, Loader2, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { listInterviews, getCandidates, CandidateSummary, InterviewListItem } from "../api";

interface CandidateRow {
  candidateId: number;
  candidateName: string;
  email: string | null;
  position: string;
  status: string;
  completedAt: string | null;
  overallScore: string | null;
  interviewId: number;
  sessionId: number | null;
  duration: string;
}

const initialsColors = [
  "bg-indigo-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-purple-500",
  "bg-cyan-500",
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AllInterviewsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      try {
        setLoading(true);
        setError(null);
        const interviews: InterviewListItem[] = await listInterviews();
        const allRows: CandidateRow[] = [];

        const results = await Promise.all(
          interviews.map((iv) =>
            getCandidates(iv.id).then((cands) => ({ iv, cands })).catch(() => ({ iv, cands: [] as CandidateSummary[] }))
          )
        );

        for (const { iv, cands } of results) {
          for (const c of cands) {
            allRows.push({
              candidateId: c.id,
              candidateName: c.name,
              email: c.email,
              position: iv.job_position,
              status: c.status,
              completedAt: c.completed_at,
              overallScore: c.overall_score,
              interviewId: iv.id,
              sessionId: c.session_id,
              duration: `${iv.duration_minutes} Min`,
            });
          }
        }

        if (!cancelled) setCandidates(allRows);
      } catch (err) {
        if (!cancelled) setError("Failed to load candidates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => { cancelled = true; };
  }, []);

  const filtered = candidates.filter((c) => {
    if (searchQuery === "") return true;
    const q = searchQuery.toLowerCase();
    return (
      c.candidateName.toLowerCase().includes(q) ||
      c.position.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Search Bar */}
      <div className="mb-5">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, position, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            style={{ fontSize: "0.85rem" }}
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-card/40 backdrop-blur-xl border border-border rounded-xl p-12 text-center shadow-lg">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground" style={{ fontSize: "0.85rem" }}>Loading candidates...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-card/40 backdrop-blur-xl border border-border rounded-xl p-12 text-center shadow-lg">
          <p className="text-red-400" style={{ fontSize: "0.9rem", fontWeight: 500 }}>{error}</p>
        </div>
      )}

      {/* Candidate Cards */}
      {!loading && !error && (
        <div className="flex flex-col gap-3">
          {filtered.map((candidate, idx) => (
            <div
              key={`${candidate.interviewId}-${candidate.candidateId}`}
              className="card-gradient backdrop-blur-xl rounded-3xl p-5 group relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                {/* Left: Avatar + Name & Position */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg ${initialsColors[idx % initialsColors.length]}`}
                    style={{ fontSize: "0.8rem", fontWeight: 600 }}
                  >
                    {getInitials(candidate.candidateName)}
                  </div>
                  <div className="min-w-0">
                    <p
                      style={{ fontSize: "0.9rem", fontWeight: 600 }}
                      className="text-foreground truncate group-hover:text-white transition-colors"
                    >
                      {candidate.candidateName}
                    </p>
                    <p className="text-muted-foreground mt-0.5" style={{ fontSize: "0.8rem" }}>
                      {candidate.position}
                    </p>
                  </div>
                </div>

                {/* Center: Date, Duration & Status */}
                <div className="flex items-center gap-6 px-6">
                  <span
                    className="flex items-center gap-1.5 text-muted-foreground"
                    style={{ fontSize: "0.8rem" }}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(candidate.completedAt)}
                  </span>
                  <span
                    className="flex items-center gap-1.5 text-muted-foreground"
                    style={{ fontSize: "0.8rem" }}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {candidate.duration}
                  </span>
                  {candidate.overallScore && (
                    <span
                      className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30"
                      style={{ fontSize: "0.75rem", fontWeight: 600 }}
                    >
                      {candidate.overallScore}
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full border ${
                      candidate.status === "completed"
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : candidate.status === "active"
                        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                    }`}
                    style={{ fontSize: "0.75rem", fontWeight: 500 }}
                  >
                    {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}
                  </span>
                </div>

                {/* Right: View Report */}
                {candidate.sessionId && candidate.status === "completed" ? (
                  <button
                    onClick={() => navigate(`/scheduled/${candidate.interviewId}/report/${candidate.candidateId}`)}
                    className="btn-hero px-4 py-2"
                    style={{ fontSize: "0.8rem", fontWeight: 500 }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Report
                  </button>
                ) : (
                  <span
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 text-muted-foreground rounded-lg border border-white/10"
                    style={{ fontSize: "0.8rem", fontWeight: 500 }}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {candidate.status === "active" ? "In Progress" : "Pending"}
                  </span>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="bg-card/40 backdrop-blur-xl border border-border rounded-xl p-12 text-center shadow-lg">
              <div className="w-12 h-12 rounded-full border border-white/10 bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                {candidates.length === 0 ? (
                  <Users className="w-5 h-5 text-primary" />
                ) : (
                  <Search className="w-5 h-5 text-primary" />
                )}
              </div>
              <p
                style={{ fontSize: "0.9rem", fontWeight: 500 }}
                className="text-foreground"
              >
                {candidates.length === 0 ? "No candidates yet" : "No candidates found"}
              </p>
              <p className="text-muted-foreground mt-1" style={{ fontSize: "0.8rem" }}>
                {candidates.length === 0
                  ? "Candidates will appear here once they join an interview"
                  : "Try adjusting your search criteria"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer count */}
      {!loading && !error && candidates.length > 0 && (
        <div className="mt-4 text-muted-foreground" style={{ fontSize: "0.8rem" }}>
          Showing {filtered.length} of {candidates.length} candidates
        </div>
      )}
    </div>
  );
}
