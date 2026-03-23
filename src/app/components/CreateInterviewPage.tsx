import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { createInterview, type InterviewData } from "../api";
import {
  ArrowLeft,
  ArrowRight,
  Code,
  Users,
  Briefcase,
  Star,
  Crown,
  Loader2,
  CheckCircle2,
  Copy,
  Clock,
  ListChecks,
  CalendarDays,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  X,
  Send,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

const interviewTypes = [
  { id: "technical", label: "Technical", icon: Code },
  { id: "behavioral", label: "Behavioral", icon: Users },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "problem-solving", label: "Problem Solving", icon: Star },
  { id: "leadership", label: "Leadership", icon: Crown },
];
const durationOptions = ["15 minutes", "30 minutes", "45 minutes", "60 minutes"];

function generateId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

type ShareMethod = "email" | "whatsapp" | null;

export function CreateInterviewPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [jobPosition, setJobPosition] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [duration, setDuration] = useState("15 minutes");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["technical"]);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<{ question: string; type: string }[]>([]);
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [shareMethod, setShareMethod] = useState<ShareMethod>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePhone, setSharePhone] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [sending, setSending] = useState(false);
  const [isDurationOpen, setIsDurationOpen] = useState(false);
  const durationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (durationRef.current && !durationRef.current.contains(event.target as Node)) {
        setIsDurationOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const interviewLink = interviewData 
    ? `${window.location.protocol}//${window.location.host}/interview/start?token=${interviewData.access_token}`
    : "";

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const parseDuration = (d: string): number => {
    const match = d.match(/(\d+)/);
    return match ? parseInt(match[1]) : 30;
  };

  const handleGenerateQuestions = async () => {
    setGenerating(true);
    setStep(2);
    try {
      const data = await createInterview({
        job_position: jobPosition,
        job_description: jobDescription || undefined,
        duration_minutes: parseDuration(duration),
        interview_types: selectedTypes,
      });
      setInterviewData(data);
      setQuestions(
        data.questions.map((q) => ({
          question: q.question_text,
          type: q.question_type,
        }))
      );
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate questions");
      setStep(1);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateLink = () => {
    setStep(4);
  };

  const handleSendEmail = () => {
    if (!shareEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    setSending(true);
    const subject = encodeURIComponent(
      `You're Invited: ${jobPosition || "AI Interview"} — NerveSenseAI`
    );
    const body = encodeURIComponent(
      `Hi${candidateName ? ` ${candidateName}` : ""},\n\nYou've been invited to an AI-powered interview for the position of ${jobPosition || "a role at our company"}.\n\n📋 Interview Details:\n• Position: ${jobPosition || "N/A"}\n• Duration: ${duration}\n• Questions: ${questions.length}\n\n🔗 Join your interview here:\n${interviewLink}\n\nPlease click the link above when you're ready. Make sure you have a working camera and microphone.\n\nGood luck!\n\nBest regards,\nSarah Johnson\nNerveSenseAI`
    );

    // Open mailto immediately to avoid popup blockers
    window.open(`mailto:${shareEmail}?subject=${subject}&body=${body}`, "_blank");
    setSending(false);
    toast.success(`Email client opened for ${shareEmail}`);
    setShareMethod(null);
    setShareEmail("");
    setCandidateName("");
  };

  const handleSendWhatsApp = () => {
    if (!sharePhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }
    setSending(true);
    const cleanPhone = sharePhone.replace(/[^0-9+]/g, "");
    const message = encodeURIComponent(
      `Hi${candidateName ? ` ${candidateName}` : ""}! 👋\n\nYou've been invited to an AI-powered interview on NerveSenseAI.\n\n📋 *Interview Details:*\n• Position: ${jobPosition || "N/A"}\n• Duration: ${duration}\n• Questions: ${questions.length}\n\n🔗 *Join your interview here:*\n${interviewLink}\n\nMake sure you have a working camera and microphone. Good luck! 🍀`
    );

    // Open WhatsApp immediately to avoid popup blockers
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
    setSending(false);
    toast.success(`WhatsApp opened`);
    setShareMethod(null);
    setSharePhone("");
    setCandidateName("");
  };

  const progressPercent =
    step === 1 ? 33 : step === 2 ? 50 : step === 3 ? 75 : 100;

  return (
    <div className="max-w-[700px] mx-auto">
      {/* Header */}
      <button
        onClick={() => {
          if (step > 1) {
            setStep(step - 1);
          } else {
            navigate("/dashboard");
          }
        }}
        className="flex items-center gap-2 text-muted-foreground mb-2 hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <h2 style={{ fontSize: "1.3rem", fontWeight: 600 }} className="text-foreground">Create New Interview</h2>
      </button>

      {/* Progress Bar */}
      <div className="w-full bg-muted rounded-full h-1.5 mb-8 overflow-hidden">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(var(--primary),0.5)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step 1: Form */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-foreground mb-2" style={{ fontSize: "0.9rem", fontWeight: 500 }}>
              Job Position
            </label>
            <input
              type="text"
              value={jobPosition}
              onChange={(e) => setJobPosition(e.target.value)}
              placeholder="e.g. Senior Frontend Developer"
              className="w-full border border-border rounded-lg px-4 py-3 bg-background/50 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              style={{ fontSize: "0.9rem" }}
            />
          </div>

          <div>
            <label className="block text-foreground mb-2" style={{ fontSize: "0.9rem", fontWeight: 500 }}>
              Job Description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Enter detailed job description..."
              rows={5}
              className="w-full border border-border rounded-lg px-4 py-3 bg-background/50 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
              style={{ fontSize: "0.9rem" }}
            />
          </div>

          <div>
            <label className="block text-foreground mb-2" style={{ fontSize: "0.9rem", fontWeight: 500 }}>
              Interview Duration
            </label>
            <div className="relative" ref={durationRef}>
              <button
                type="button"
                onClick={() => setIsDurationOpen(!isDurationOpen)}
                className="w-full flex items-center justify-between border border-border rounded-lg px-4 py-3 bg-background/50 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all group"
                style={{ fontSize: "0.9rem" }}
              >
                <span className={isDurationOpen ? "text-white" : "text-foreground"}>{duration}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground group-hover:text-primary transition-all duration-300 ${isDurationOpen ? "rotate-180 text-primary" : ""}`} />
              </button>
              {isDurationOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-2xl border border-border rounded-xl shadow-2xl z-50 overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-200 origin-top">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setDuration(opt);
                        setIsDurationOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-white/5 transition-all ${duration === opt ? "text-primary bg-primary/10" : "text-foreground/80 hover:text-foreground"}`}
                      style={{ fontSize: "0.9rem", fontWeight: duration === opt ? 600 : 400 }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-foreground mb-3" style={{ fontSize: "0.9rem", fontWeight: 500 }}>
              Interview Types
            </label>
            <div className="flex flex-wrap gap-2">
              {interviewTypes.map((type) => {
                const isSelected = selectedTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    onClick={() => toggleType(type.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full border transition-all whitespace-nowrap shrink-0 ${isSelected
                        ? "border-primary bg-primary/10 text-white shadow-[0_0_10px_rgba(var(--primary),0.2)]"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:bg-white/5 hover:text-foreground"
                      }`}
                    style={{ fontSize: "0.85rem", fontWeight: 500 }}
                  >
                    <div className="icon-badge-squircle !p-1 !bg-transparent shrink-0">
                      <type.icon className="w-4 h-4" />
                    </div>
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-6 py-2.5 border border-border rounded-lg text-foreground hover:bg-white/5 transition-colors hover:border-sidebar-foreground/30 hover:text-white"
              style={{ fontSize: "0.9rem", fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={handleGenerateQuestions}
              disabled={!jobPosition.trim() || !jobDescription.trim()}
              className="btn-hero disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontSize: "0.9rem", fontWeight: 500 }}
            >
              Generate Questions
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Generating */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 flex items-start gap-3 backdrop-blur-md">
            <Loader2 className="w-5 h-5 text-primary animate-spin mt-0.5 shrink-0" />
            <div>
              <p style={{ fontSize: "0.95rem", fontWeight: 500 }} className="text-foreground">
                Generating Interview Questions
              </p>
              <p style={{ fontSize: "0.85rem" }} className="text-primary">
                Our AI is crafting personalized questions based on your job position
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              disabled
              className="btn-hero opacity-50 cursor-not-allowed"
              style={{ fontSize: "0.9rem", fontWeight: 500 }}
            >
              Create Interview Link & Finish
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Questions Generated */}
      {step === 3 && (
        <div className="space-y-6">
          <h3 style={{ fontSize: "1.05rem", fontWeight: 600 }} className="text-foreground">
            Generated Interview Questions:
          </h3>

          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div
                key={idx}
                className="card-gradient backdrop-blur-xl rounded-xl p-5 relative overflow-hidden"
              >
                <p className="text-foreground mb-2" style={{ fontSize: "0.9rem" }}>
                  {q.question}
                </p>
                <p className="text-primary" style={{ fontSize: "0.8rem", fontWeight: 500 }}>
                  Type: {q.type}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleCreateLink}
              className="btn-hero"
              style={{ fontSize: "0.9rem", fontWeight: 500 }}
            >
              Create Interview Link & Finish
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Interview Ready */}
      {step === 4 && (
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle2 className="w-14 h-14 text-green-500 [filter:drop-shadow(0_0_10px_rgba(34,197,94,0.3))]" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 600 }} className="text-foreground mb-2">
              Your AI Interview is Ready!
            </h2>
            <p className="text-muted-foreground" style={{ fontSize: "0.9rem" }}>
              Share this link with your candidates to start the interview process
            </p>
          </div>

          {/* Interview Link Box */}
          <div className="card-gradient backdrop-blur-xl rounded-xl p-6 text-left relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: "0.9rem", fontWeight: 600 }} className="text-foreground">
                Interview Link
              </span>
              <span className="text-green-500" style={{ fontSize: "0.8rem", fontWeight: 500 }}>
                Valid for 30 days
              </span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 bg-background/50 border border-border rounded-lg px-4 py-3 flex items-center gap-2 min-w-0">
                <span
                  className="text-primary underline cursor-pointer hover:text-white truncate text-shadow-sm"
                  style={{ fontSize: "0.85rem" }}
                  onClick={() => window.open(interviewLink, "_blank")}
                  title={interviewLink}
                >
                  {interviewLink}
                </span>
                <ExternalLink
                  className="w-3.5 h-3.5 text-muted-foreground shrink-0 cursor-pointer hover:text-white transition-colors"
                  onClick={() => window.open(interviewLink, "_blank")}
                />
              </div>
              <button
                onClick={() => {
                  const textArea = document.createElement("textarea");
                  textArea.value = interviewLink;
                  textArea.style.position = "fixed";
                  textArea.style.left = "-9999px";
                  document.body.appendChild(textArea);
                  textArea.select();
                  try {
                    document.execCommand("copy");
                    toast.success("Link copied to clipboard!");
                  } catch {
                    toast.error("Failed to copy link");
                  }
                  document.body.removeChild(textArea);
                }}
                className="btn-hero shrink-0"
                style={{ fontSize: "0.85rem", fontWeight: 500 }}
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground" style={{ fontSize: "0.8rem" }}>
              <span className="flex items-center gap-1.5">
                <div className="icon-badge-squircle w-6 h-6 p-1 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                {duration}
              </span>
              <span className="flex items-center gap-1.5">
                <div className="icon-badge-squircle w-6 h-6 p-1 shrink-0">
                  <ListChecks className="w-3.5 h-3.5" />
                </div>
                {questions.length} Questions
              </span>
              <span className="flex items-center gap-1.5">
                <div className="icon-badge-squircle w-6 h-6 p-1 shrink-0">
                  <CalendarDays className="w-3.5 h-3.5" />
                </div>
                Expires: Apr 11, 2026
              </span>
            </div>
          </div>

          {/* Share via */}
          <div className="card-gradient backdrop-blur-xl rounded-xl p-6 text-left relative overflow-hidden">
            <h4 style={{ fontSize: "0.95rem", fontWeight: 600 }} className="text-foreground mb-4">
              Send Interview Link
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShareMethod("email");
                  setSharePhone("");
                }}
                className={`btn-premium px-4 py-3 flex-1 ${shareMethod === "email"
                    ? "shadow-[0_0_10px_rgba(var(--primary),0.2)]"
                    : ""
                  }`}
                style={{ fontSize: "0.85rem", fontWeight: 500 }}
              >
                <div className="icon-badge-squircle w-6 h-6 p-1 shrink-0">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                Send via Email
              </button>
              <button
                onClick={() => {
                  setShareMethod("whatsapp");
                  setShareEmail("");
                }}
                className={`btn-premium px-4 py-3 flex-1 ${shareMethod === "whatsapp"
                    ? "shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                    : ""
                  }`}
                style={{ fontSize: "0.85rem", fontWeight: 500 }}
              >
                <div className="icon-badge-squircle w-6 h-6 p-1 bg-green-500/10 shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                </div>
                Send via WhatsApp
              </button>
            </div>

            {/* Email Share Form */}
            {shareMethod === "email" && (
              <div className="mt-4 space-y-3 bg-background/50 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-primary" />
                  <span style={{ fontSize: "0.85rem", fontWeight: 600 }} className="text-foreground">
                    Send via Email
                  </span>
                  <button
                    onClick={() => setShareMethod(null)}
                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label
                    className="block text-muted-foreground mb-1.5"
                    style={{ fontSize: "0.8rem", fontWeight: 500 }}
                  >
                    Candidate Name (optional)
                  </label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g., John Smith"
                    className="w-full border border-border rounded-lg px-3.5 py-2.5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors focus:ring-1 focus:ring-primary"
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>
                <div>
                  <label
                    className="block text-muted-foreground mb-1.5"
                    style={{ fontSize: "0.8rem", fontWeight: 500 }}
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="candidate@email.com"
                    className="w-full border border-border rounded-lg px-3.5 py-2.5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors focus:ring-1 focus:ring-primary"
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>
                <button
                  onClick={handleSendEmail}
                  disabled={sending || !shareEmail.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-blue-500 text-primary-foreground rounded-lg py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(var(--primary),0.3)] shadow-primary/20"
                  style={{ fontSize: "0.85rem", fontWeight: 500 }}
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Email Invitation
                    </>
                  )}
                </button>
              </div>
            )}

            {/* WhatsApp Share Form */}
            {shareMethod === "whatsapp" && (
              <div className="mt-4 space-y-3 bg-background/50 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-green-500" />
                  <span style={{ fontSize: "0.85rem", fontWeight: 600 }} className="text-foreground">
                    Send via WhatsApp
                  </span>
                  <button
                    onClick={() => setShareMethod(null)}
                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label
                    className="block text-muted-foreground mb-1.5"
                    style={{ fontSize: "0.8rem", fontWeight: 500 }}
                  >
                    Candidate Name (optional)
                  </label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g., John Smith"
                    className="w-full border border-border rounded-lg px-3.5 py-2.5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-green-500/50 transition-colors focus:ring-1 focus:ring-green-500/50"
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>
                <div>
                  <label
                    className="block text-muted-foreground mb-1.5"
                    style={{ fontSize: "0.8rem", fontWeight: 500 }}
                  >
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      value={sharePhone}
                      onChange={(e) => setSharePhone(e.target.value)}
                      placeholder="+1 234 567 8900"
                      className="w-full pl-9 pr-4 border border-border rounded-lg px-3.5 py-2.5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/50 transition-colors"
                      style={{ fontSize: "0.85rem" }}
                    />
                  </div>
                  <p className="text-muted-foreground mt-1" style={{ fontSize: "0.72rem" }}>
                    Include country code (e.g., +1 for US, +91 for India)
                  </p>
                </div>
                <button
                  onClick={handleSendWhatsApp}
                  disabled={sending || !sharePhone.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg py-2.5 hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                  style={{ fontSize: "0.85rem", fontWeight: 500 }}
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Opening WhatsApp...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send WhatsApp Message
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex-1 flex items-center justify-center gap-2 border border-border rounded-lg px-6 py-3 text-foreground hover:bg-white/5 transition-colors hover:border-sidebar-foreground/30 hover:text-white"
              style={{ fontSize: "0.9rem", fontWeight: 500 }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
            <button
              onClick={() => {
                setStep(1);
                setJobPosition("");
                setJobDescription("");
                setQuestions([]);
                setSelectedTypes(["technical"]);
                setShareMethod(null);
                setShareEmail("");
                setSharePhone("");
                setCandidateName("");
              }}
              className="btn-hero flex-1"
              style={{ fontSize: "0.9rem", fontWeight: 500 }}
            >
              <Plus className="w-4 h-4" />
              Create New Interview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}