import { useState, useEffect } from "react";
import { Save, User, Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AnimatedCard } from "./ui/AnimatedCard";
import { getMe } from "../api";


export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [emailNotif, setEmailNotif] = useState(true);
  const [interviewNotif, setInterviewNotif] = useState(true);

  useEffect(() => {
    getMe()
      .then((user) => {
        setName(user.name);
        setEmail(user.email);
      })
      .catch(() => {
        setName("Sarah Johnson");
        setEmail("sarah@company.com");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }} className="text-foreground mb-1">
            Settings
          </h1>
          <p className="text-muted-foreground" style={{ fontSize: "0.9rem" }}>
            Manage your profile and notification preferences
          </p>
        </div>
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span style={{ fontSize: "0.9rem" }}>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Page Title */}
      <div className="mb-8">
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }} className="text-foreground mb-1">
          Settings
        </h1>
        <p className="text-muted-foreground" style={{ fontSize: "0.9rem" }}>
          Manage your profile and notification preferences
        </p>
      </div>

      {/* Profile Section */}
      <AnimatedCard className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 icon-badge-squircle">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 600 }} className="text-foreground">
              Profile
            </h3>
            <p className="text-muted-foreground" style={{ fontSize: "0.8rem" }}>
              Your personal information
            </p>
          </div>
        </div>

        {/* Avatar Row */}
        <div className="flex items-center gap-5 mb-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/30 shadow-[0_0_20px_rgba(139,92,246,0.15)] overflow-hidden">
            <User className="w-10 h-10 text-primary/40" />
          </div>
          <div>
            <p style={{ fontSize: "1.05rem", fontWeight: 600 }} className="text-foreground">
              {name || "Your Name"}
            </p>
            <p className="text-muted-foreground mb-2" style={{ fontSize: "0.85rem" }}>
              {email || "your@email.com"}
            </p>
            <button
              className="btn-hero px-4 py-1.5"
              style={{ fontSize: "0.8rem", fontWeight: 500 }}
            >
              Change Photo
            </button>
          </div>
        </div>

        {/* Input Fields — 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-muted-foreground mb-2" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-3 bg-background/50 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              style={{ fontSize: "0.9rem" }}
            />
          </div>
          <div>
            <label className="block text-muted-foreground mb-2" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-3 bg-background/50 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              style={{ fontSize: "0.9rem" }}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-muted-foreground mb-2" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-3 bg-background/50 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              style={{ fontSize: "0.9rem" }}
            />
          </div>
        </div>
      </AnimatedCard>

      {/* Notifications Section */}
      <AnimatedCard className="p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 icon-badge-squircle">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 600 }} className="text-foreground">
              Notifications
            </h3>
            <p className="text-muted-foreground" style={{ fontSize: "0.8rem" }}>
              Choose what updates you receive
            </p>
          </div>
        </div>

        <div>
          {/* Email Notifications */}
          <div className="flex items-center justify-between py-4">
            <div>
              <p style={{ fontSize: "0.9rem", fontWeight: 500 }} className="text-foreground">
                Email Notifications
              </p>
              <p className="text-muted-foreground" style={{ fontSize: "0.8rem" }}>
                Receive updates about your interviews via email
              </p>
            </div>
            <button
              onClick={() => setEmailNotif(!emailNotif)}
              className={`w-12 h-7 rounded-full transition-all duration-200 relative shrink-0 ${emailNotif
                  ? "bg-primary shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                  : "bg-muted"
                }`}
            >
              <div
                className="w-5 h-5 bg-white rounded-full absolute top-1 transition-all duration-200"
                style={{ left: emailNotif ? "calc(100% - 24px)" : "4px" }}
              />
            </button>
          </div>

          <div className="border-t border-border/50" />

          {/* Interview Reminders */}
          <div className="flex items-center justify-between py-4">
            <div>
              <p style={{ fontSize: "0.9rem", fontWeight: 500 }} className="text-foreground">
                Interview Reminders
              </p>
              <p className="text-muted-foreground" style={{ fontSize: "0.8rem" }}>
                Get notified when candidates complete interviews
              </p>
            </div>
            <button
              onClick={() => setInterviewNotif(!interviewNotif)}
              className={`w-12 h-7 rounded-full transition-all duration-200 relative shrink-0 ${interviewNotif
                  ? "bg-primary shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                  : "bg-muted"
                }`}
            >
              <div
                className="w-5 h-5 bg-white rounded-full absolute top-1 transition-all duration-200"
                style={{ left: interviewNotif ? "calc(100% - 24px)" : "4px" }}
              />
            </button>
          </div>
        </div>
      </AnimatedCard>

      {/* Save Button — right-aligned */}
      <div className="flex justify-end">
        <button
          onClick={() => toast.success("Settings saved successfully!")}
          className="btn-hero gap-2"
          style={{ fontSize: "0.9rem", fontWeight: 600 }}
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
}
