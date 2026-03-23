import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Clock, Calendar, Settings, Loader2, Trash2, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { getInterview, getCandidates, deleteInterview, InterviewData, CandidateSummary } from "../api";
import { SendPopover } from "./ui/SendPopover";
import { toast } from "sonner";

export function InterviewDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSendPopover, setShowSendPopover] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;

      try {
        setLoading(true);
        const [interviewData, candidatesData] = await Promise.all([
          getInterview(parseInt(id, 10)),
          getCandidates(parseInt(id, 10))
        ]);

        setInterview(interviewData);
        setCandidates(candidatesData);
      } catch (err: any) {
        setError(err.message || "Failed to load interview details.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteInterview(parseInt(id, 10));
      navigate("/scheduled");
    } catch (err: any) {
      setError(err.message || "Failed to delete interview.");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="p-8">
        <p className="text-red-500 mb-2">{error || "Interview not found."}</p>
        <button
          onClick={() => navigate("/scheduled")}
          className="text-[#4F6DF5] mt-2 hover:underline"
          style={{ fontSize: "0.9rem" }}
        >
          Back to Scheduled Interviews
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate("/scheduled")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }} className="text-foreground">
            Interview Detail
          </h1>
        </button>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          style={{ fontSize: "0.8rem", fontWeight: 500 }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <p className="text-red-400" style={{ fontSize: "0.85rem" }}>
            Are you sure you want to delete this interview? This will remove all candidates, sessions, and reports. This action cannot be undone.
          </p>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontSize: "0.8rem" }}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1.5"
              style={{ fontSize: "0.8rem", fontWeight: 500 }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Detail Card */}
      <div className="bg-card/40 backdrop-blur-xl border border-border rounded-3xl p-6 mb-6 shadow-lg">
        {/* Position */}
        <h2
          style={{ fontSize: "1.1rem", fontWeight: 600 }}
          className="text-foreground mb-4"
        >
          {interview.job_position}
        </h2>

        {/* Meta Row */}
        <div className="flex items-center gap-8 mb-6">
          <div>
            <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
              Duration
            </p>
            <div className="flex items-center gap-2 text-foreground mt-1.5">
              <div className="icon-badge-squircle !p-1.5">
                <Clock className="w-4 h-4" />
              </div>
              <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                {interview.duration_minutes} Min
              </span>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
              Created On
            </p>
            <div className="flex items-center gap-2 text-foreground mt-1.5">
              <div className="icon-badge-squircle !p-1.5">
                <Calendar className="w-4 h-4" />
              </div>
              <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                {new Date(interview.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground" style={{ fontSize: "0.75rem" }}>
              Type
            </p>
            <div className="flex items-center gap-2 text-foreground mt-1.5">
              <div className="icon-badge-squircle !p-1.5">
                <Settings className="w-4 h-4" />
              </div>
              <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                {interview.interview_types.map(t => t.type_name).join(", ") || "Technical"}
              </span>
            </div>
          </div>
        </div>

        {/* Job Description */}
        <div className="mb-6">
          <h3
            style={{ fontSize: "1rem", fontWeight: 600 }}
            className="text-foreground mb-2"
          >
            Job Description
          </h3>
          <p className="text-muted-foreground" style={{ fontSize: "0.85rem", lineHeight: 1.7 }}>
            {interview.job_description || "No description provided."}
          </p>
        </div>

        {/* Interview Questions */}
        <div>
          <h3
            style={{ fontSize: "1rem", fontWeight: 600 }}
            className="text-foreground mb-4"
          >
            Interview Questions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {interview.questions.map((q, idx) => (
              <p
                key={q.id || idx}
                className="text-muted-foreground hover:text-foreground transition-colors p-3 rounded-lg bg-background/50 border border-border"
                style={{ fontSize: "0.85rem", lineHeight: 1.6 }}
              >
                <span style={{ fontWeight: 500 }} className="text-primary mr-2">
                  {idx + 1}.
                </span>
                {q.question_text}
              </p>
            ))}
          </div>
        </div>

        {/* Share Section (New) */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3
              style={{ fontSize: "1rem", fontWeight: 600 }}
              className="text-foreground"
            >
              Share Interview Link
            </h3>
            <div className="relative">
              <button
                onClick={() => setShowSendPopover(!showSendPopover)}
                className="btn-hero px-5 py-2 flex items-center gap-2"
                style={{ fontSize: "0.85rem", fontWeight: 500 }}
              >
                <Send className="w-4 h-4" />
                Send Link
              </button>
              {showSendPopover && (
                <SendPopover
                  interview={{
                    job_position: interview.job_position,
                    duration_minutes: interview.duration_minutes,
                    access_token: interview.access_token
                  }}
                  onClose={() => setShowSendPopover(false)}
                  position="bottom"
                />
              )}
            </div>
          </div>
          <div className="bg-background/40 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between group">
             <code className="text-primary text-sm truncate mr-4">{interview.interview_link}</code>
             <button 
                onClick={() => {
                  navigator.clipboard.writeText(interview.interview_link);
                  toast.success("Link copied!");
                }}
                className="text-muted-foreground hover:text-white transition-colors text-xs font-medium"
             >
                Copy Link
             </button>
          </div>
        </div>
      </div>

      {/* Candidates Section */}
      <div className="mb-6">
        <h3
          style={{ fontSize: "1.1rem", fontWeight: 600 }}
          className="text-foreground mb-4 flex items-center gap-2"
        >
          Candidates
          <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs">
            {candidates.length}
          </span>
        </h3>

        {candidates.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground bg-card/40 backdrop-blur-xl rounded-xl border border-border">
            <p>No candidates have completed this interview yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((candidate) => {
              const colors = ["#4F6DF5", "#7C3AED", "#10B981", "#F59E0B", "#EF4444"];
              const bgColor = colors[candidate.name.length % colors.length];
              const initial = candidate.name.charAt(0).toUpperCase();

              return (
                <div
                  key={candidate.id}
                  className="bg-card/40 backdrop-blur-xl border border-border rounded-3xl px-6 py-4 flex items-center justify-between shadow-lg hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg"
                      style={{
                        backgroundColor: bgColor,
                        boxShadow: `0 0 15px ${bgColor}40`,
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      {initial}
                    </div>
                    <div>
                      <p
                        style={{ fontSize: "0.9rem", fontWeight: 600 }}
                        className="text-foreground group-hover:text-white transition-colors"
                      >
                        {candidate.name}
                      </p>
                      <p className="text-muted-foreground" style={{ fontSize: "0.8rem" }}>
                        Status: {candidate.status}
                        {candidate.completed_at && ` • Completed: ${new Date(candidate.completed_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {candidate.overall_score && (
                      <span
                        className="text-primary"
                        style={{ fontSize: "1rem", fontWeight: 700 }}
                      >
                        {candidate.overall_score}
                      </span>
                    )}
                    {candidate.status === "active" && candidate.session_id && (
                      <button
                        onClick={() => navigate(`/scheduled/${id}/live/${candidate.session_id}`)}
                        className="border border-green-500/30 bg-green-500/10 rounded-lg px-4 py-2 text-green-400 hover:bg-green-500/20 transition-colors"
                        style={{ fontSize: "0.85rem", fontWeight: 500 }}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                          Watch Live
                        </span>
                      </button>
                    )}
                    {candidate.status === "completed" && candidate.report_url && (
                      <button
                        onClick={() => navigate(candidate.report_url!)}
                        className="btn-hero px-4 py-2"
                        style={{ fontSize: "0.85rem", fontWeight: 500 }}
                      >
                        View Report
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
