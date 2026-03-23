import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Video,
  Phone,
  Copy,
  Send,
  ExternalLink,
  Mail,
  MessageSquare,
  X,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatedCard } from "./ui/AnimatedCard";
import { SendPopover } from "./ui/SendPopover";
import { listInterviews, deleteInterview, type InterviewListItem } from "../api";

// Color palette for interview cards
const COMPANY_COLORS = ["#4285F4", "#1877F2", "#FF9900", "#00C853", "#FF5252", "#7C4DFF"];
const COMPANY_ICONS = ["◆", "●", "■", "▲", "★", "◎"];


export function DashboardPage() {
  const navigate = useNavigate();
  const [openSendId, setOpenSendId] = useState<number | null>(null);
  const [interviews, setInterviews] = useState<InterviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchInterviews = useCallback(async () => {
    try {
      const data = await listInterviews();
      setInterviews(data);
    } catch {
      // If backend is not running, show empty state
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteInterview(id);
      setInterviews((prev) => prev.filter((iv) => iv.id !== id));
      setConfirmDeleteId(null);
      toast.success("Interview deleted");
    } catch {
      toast.error("Failed to delete interview");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }} className="text-foreground mb-6">
        Dashboard
      </h1>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <AnimatedCard
          onClick={() => navigate("/scheduling")}
          className="p-6 transition-all"
        >
          <div className="w-16 h-16 icon-badge-squircle mb-5 group-hover:scale-105 transition-transform duration-300">
            <Video className="w-8 h-8" />
          </div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600 }} className="text-foreground mb-1">
            Create New Interview
          </h3>
          <p className="text-muted-foreground" style={{ fontSize: "0.85rem" }}>
            Create AI interviews and schedule them with candidates
          </p>
        </AnimatedCard>

        <AnimatedCard
          onClick={() => navigate("/scheduled")}
          className="p-6 transition-all"
        >
          <div className="w-16 h-16 icon-badge-squircle mb-5 group-hover:scale-105 transition-transform duration-300">
            <Phone className="w-8 h-8" />
          </div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600 }} className="text-foreground mb-1">
            Scheduled Interviews
          </h3>
          <p className="text-muted-foreground" style={{ fontSize: "0.85rem" }}>
            View and manage your scheduled interviews
          </p>
        </AnimatedCard>
      </div>

      {/* Previous Interviews */}
      <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }} className="text-foreground mb-4">
        Previously Created Interviews
      </h3>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground" style={{ fontSize: "0.9rem" }}>
          Loading interviews...
        </div>
      ) : interviews.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground" style={{ fontSize: "0.9rem" }}>
            No interviews created yet. Click "Create New Interview" to get started!
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {interviews.map((interview, idx) => {
          const color = COMPANY_COLORS[idx % COMPANY_COLORS.length];
          const icon = COMPANY_ICONS[idx % COMPANY_ICONS.length];
          const dateStr = new Date(interview.created_at).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
          return (
                <div
                key={interview.id}
                className="relative card-gradient backdrop-blur-xl rounded-3xl border-0 group p-5 transition-all text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-12 h-12 icon-badge-squircle transition-all group-hover:scale-110"
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 700,
                      background: `${color}15`,
                      color: color
                    }}
                  >
                    <span>
                      {icon}
                    </span>
                  </div>
                  <span className="text-muted-foreground" style={{ fontSize: "0.8rem" }}>
                    {dateStr}
                  </span>
                </div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: 600 }} className="text-foreground mb-1">
                  {interview.job_position}
                </h4>
                {confirmDeleteId === interview.id && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 mb-2">
                    <p className="text-red-400 mb-2" style={{ fontSize: "0.75rem" }}>
                      Delete this interview and all data?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                        style={{ fontSize: "0.72rem" }}
                        disabled={deletingId === interview.id}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(interview.id)}
                        className="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1"
                        style={{ fontSize: "0.72rem" }}
                        disabled={deletingId === interview.id}
                      >
                        {deletingId === interview.id && <Loader2 className="w-3 h-3 animate-spin" />}
                        Delete
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-muted-foreground mb-4" style={{ fontSize: "0.85rem" }}>
                  {interview.duration_minutes} Min · {interview.question_count} Questions
                </p>
                <div className="flex items-center gap-2 relative">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(interview.interview_link).then(
                        () => toast.success("Link copied!"),
                        () => toast.error("Failed to copy link")
                      );
                    }}
                    className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                    style={{ fontSize: "0.8rem", fontWeight: 500 }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link
                  </button>
                  <button
                    onClick={() =>
                      setOpenSendId(openSendId === interview.id ? null : interview.id)
                    }
                    className={`btn-premium px-4 py-2 ${
                      openSendId === interview.id ? "shadow-lg shadow-primary/20" : ""
                    }`}
                    style={{ fontSize: "0.8rem", fontWeight: 500 }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                  <button
                    onClick={() => window.open(interview.interview_link, "_blank")}
                    className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                    style={{ fontSize: "0.8rem", fontWeight: 500 }}
                    title="Preview interview as candidate"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(interview.id)}
                    className="flex items-center gap-1.5 border border-red-500/30 rounded-lg px-3 py-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    style={{ fontSize: "0.8rem", fontWeight: 500 }}
                    title="Delete interview"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Send Popover */}
                  {openSendId === interview.id && (
                    <SendPopover
                      interview={interview}
                      onClose={() => setOpenSendId(null)}
                    />
                  )}
                </div>
              </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
