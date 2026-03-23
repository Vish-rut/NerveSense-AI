import { useState, useRef, useEffect } from "react";
import { Mail, MessageSquare, X, Send, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { type InterviewListItem } from "../api";

interface SendPopoverProps {
  interview: InterviewListItem | { job_position: string; duration_minutes: number; access_token: string };
  onClose: () => void;
  position?: "bottom" | "top";
}

export function SendPopover({
  interview,
  onClose,
  position = "bottom"
}: SendPopoverProps) {
  const [method, setMethod] = useState<"email" | "whatsapp" | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Construct the link dynamically based on the current origin
  const interviewLink = `${window.location.protocol}//${window.location.host}/interview/start?token=${interview.access_token}`;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleSendEmail = () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    const subject = encodeURIComponent(
      `You're Invited: ${interview.job_position} Interview — NerveSenseAI`
    );
    const body = encodeURIComponent(
      `Hi${name ? ` ${name}` : ""},\n\nYou've been invited to an AI-powered interview for the position of ${interview.job_position}.\n\n📋 Interview Details:\n• Position: ${interview.job_position}\n• Duration: ${interview.duration_minutes} Min\n\n🔗 Join your interview here:\n${interviewLink}\n\nPlease click the link above when you're ready. Make sure you have a working camera and microphone.\n\nGood luck!\n\nBest regards,\nNerveSenseAI`
    );

    // Open mailto immediately to avoid popup blockers
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
    toast.success(`Email client opened for ${email}`);
    onClose();
  };

  const handleSendWhatsApp = () => {
    if (!phone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    const cleanPhone = phone.replace(/[^0-9+]/g, "");
    const message = encodeURIComponent(
      `Hi${name ? ` ${name}` : ""}!👋\n\nYou've been invited to an AI-powered interview on NerveSenseAI.\n\n*Interview Details:*\n• Position: ${interview.job_position}\n• Duration: ${interview.duration_minutes} Min\n\n*Join your interview here:*\n${interviewLink}\n\nMake sure you have a working camera and microphone. Good luck!🍀`
    );

    // Open WhatsApp immediately to avoid popup blockers
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
    toast.success("WhatsApp opened");
    onClose();
  };

  const positionClass = position === "bottom" ? "bottom-full mb-2" : "top-full mt-2";

  return (
    <div
      ref={ref}
      className={`absolute ${positionClass} left-0 w-72 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 origin-bottom`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span style={{ fontSize: "0.85rem", fontWeight: 600 }} className="text-foreground">
          Send Interview Link
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!method && (
        <div className="p-3 space-y-2">
          <button
            onClick={() => setMethod("email")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
          >
            <div className="w-8 h-8 icon-badge-squircle group-hover:scale-110 transition-transform">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: 500 }} className="text-foreground">
                Send via Email
              </p>
              <p style={{ fontSize: "0.72rem" }} className="text-muted-foreground">
                Opens your email client with pre-filled message
              </p>
            </div>
          </button>
          <button
            onClick={() => setMethod("whatsapp")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
          >
            <div className="w-8 h-8 icon-badge-squircle bg-green-500/10 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: 500 }} className="text-foreground">
                Send via WhatsApp
              </p>
              <p style={{ fontSize: "0.72rem" }} className="text-muted-foreground">
                Opens WhatsApp with a formatted invitation
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Email form */}
      {method === "email" && (
        <div className="p-3 space-y-2.5">
          <button
            onClick={() => setMethod(null)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            style={{ fontSize: "0.75rem" }}
          >
            ← Back
          </button>
          <div>
            <label className="block text-muted-foreground mb-1" style={{ fontSize: "0.78rem", fontWeight: 500 }}>
              Candidate Name <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., John Smith"
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
              style={{ fontSize: "0.82rem" }}
            />
          </div>
          <div>
            <label className="block text-muted-foreground mb-1" style={{ fontSize: "0.78rem", fontWeight: 500 }}>
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="candidate@email.com"
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
              style={{ fontSize: "0.82rem" }}
            />
          </div>
          <button
            onClick={handleSendEmail}
            disabled={sending || !email.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-blue-500 text-primary-foreground rounded-lg py-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            style={{ fontSize: "0.82rem", fontWeight: 500 }}
          >
            <Send className="w-3.5 h-3.5" />
            Send Email
          </button>
        </div>
      )}

      {/* WhatsApp form */}
      {method === "whatsapp" && (
        <div className="p-3 space-y-2.5">
          <button
            onClick={() => setMethod(null)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            style={{ fontSize: "0.75rem" }}
          >
            ← Back
          </button>
          <div>
            <label className="block text-muted-foreground mb-1" style={{ fontSize: "0.78rem", fontWeight: 500 }}>
              Candidate Name <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., John Smith"
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
              style={{ fontSize: "0.82rem" }}
            />
          </div>
          <div>
            <label className="block text-muted-foreground mb-1" style={{ fontSize: "0.78rem", fontWeight: 500 }}>
              Phone Number <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                className="w-full pl-8 pr-3 border border-border rounded-lg py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 transition-colors"
                style={{ fontSize: "0.82rem" }}
              />
            </div>
            <p className="text-muted-foreground/70 mt-0.5" style={{ fontSize: "0.68rem" }}>
              Include country code (e.g., +1 for US, +91 for India)
            </p>
          </div>
          <button
            onClick={handleSendWhatsApp}
            disabled={sending || !phone.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg py-2 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
            style={{ fontSize: "0.82rem", fontWeight: 500 }}
          >
            <Send className="w-3.5 h-3.5" />
            Send WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}
