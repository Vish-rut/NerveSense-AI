import { useNavigate } from "react-router";
import { ArrowRight, Loader2, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { listInterviews, deleteInterview, InterviewListItem } from "../api";

export function ScheduledInterviewsPage() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<InterviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    async function loadInterviews() {
      try {
        const data = await listInterviews();
        setInterviews(data);
      } catch (err: any) {
        setError(err.message || "Failed to load interviews.");
      } finally {
        setLoading(false);
      }
    }
    loadInterviews();
  }, []);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteInterview(id);
      setInterviews((prev) => prev.filter((iv) => iv.id !== id));
      setConfirmDeleteId(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete interview.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <h1
        style={{ fontSize: "1.5rem", fontWeight: 700 }}
        className="text-foreground mb-6"
      >
        Interview List with Candidate Feedback
      </h1>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm">
          {error}
        </div>
      ) : interviews.length === 0 ? (
        <div className="text-center p-12 text-muted-foreground bg-card/40 backdrop-blur-xl rounded-xl border border-border">
          <p>No scheduled interviews found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {interviews.map((interview) => (
            <div
              key={interview.id}
              className="card-gradient backdrop-blur-xl rounded-3xl p-5 group relative overflow-hidden"
            >
              {/* Top row: blue dot + date + actions */}
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-8 h-8 icon-badge-squircle"
                  style={{ background: "#4F6DF515", color: "#4F6DF5" }}
                >
                  <div className="w-2 h-2 bg-current rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground" style={{ fontSize: "0.8rem" }}>
                    {new Date(interview.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => setConfirmDeleteId(interview.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Delete confirmation */}
              {confirmDeleteId === interview.id && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
                  <p className="text-red-400 mb-2" style={{ fontSize: "0.8rem" }}>
                    Delete this interview and all its data?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontSize: "0.75rem" }}
                      disabled={deletingId === interview.id}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(interview.id)}
                      className="px-2.5 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1"
                      style={{ fontSize: "0.75rem" }}
                      disabled={deletingId === interview.id}
                    >
                      {deletingId === interview.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Position */}
              <h4
                style={{ fontSize: "0.95rem", fontWeight: 600 }}
                className="text-foreground mb-3 group-hover:text-white transition-colors"
              >
                {interview.job_position}
              </h4>

              {/* Duration + Questions */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-muted-foreground" style={{ fontSize: "0.85rem" }}>
                  {interview.duration_minutes} Min
                </span>
                <span
                  className="text-primary font-medium"
                  style={{ fontSize: "0.85rem", fontWeight: 500 }}
                >
                  {interview.question_count} Questions
                </span>
              </div>

              {/* View Detail Button */}
              <button
                onClick={() => navigate(`/scheduled/${interview.id}`)}
                className="btn-premium w-full px-4 py-2.5"
                style={{ fontSize: "0.85rem", fontWeight: 500 }}
              >
                View Detail
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
