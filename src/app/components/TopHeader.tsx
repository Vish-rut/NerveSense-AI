import { useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";

import { User } from "lucide-react";

interface HeaderConfig {
  title: string;
  subtitle: string;
}

function getHeaderConfig(pathname: string, userName?: string): HeaderConfig {
  if (pathname.startsWith("/scheduling") || pathname.startsWith("/create-interview")) {
    return {
      title: "Create Interview",
      subtitle: "Set up a new AI-powered interview in minutes",
    };
  }
  if (pathname.match(/^\/scheduled\/\d+\/report/)) {
    return {
      title: "Candidate Report",
      subtitle: "AI-generated nervousness & confidence analysis",
    };
  }
  if (pathname.match(/^\/scheduled\/\d+/)) {
    return {
      title: "Interview Details",
      subtitle: "View job description, questions & candidate responses",
    };
  }
  if (pathname.startsWith("/scheduled")) {
    return {
      title: "Scheduled Interviews",
      subtitle: "Manage and track your upcoming interviews",
    };
  }
  if (pathname.startsWith("/interviews")) {
    return {
      title: "Candidates",
      subtitle: "Review completed interviews and candidate reports",
    };
  }
  if (pathname.startsWith("/settings")) {
    return {
      title: "Settings",
      subtitle: "Manage your account and preferences",
    };
  }
  // Default: Dashboard
  return {
    title: userName ? `Welcome, ${userName}!` : "Welcome!",
    subtitle: "AI-Driven Interviews, Hassle-Free Hiring",
  };
}

export function TopHeader() {
  const location = useLocation();
  const { user } = useAuth();
  const { title, subtitle } = getHeaderConfig(location.pathname, user?.name);

  return (
    <div className="bg-card/80 backdrop-blur-lg border border-border px-8 py-4 flex rounded-xl items-center justify-between mx-[35px] mt-[30px] mb-[0px] shadow-lg shadow-black/20">
      <div>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }} className="text-card-foreground">
          {title}
        </h3>
        <p className="text-muted-foreground" style={{ fontSize: "0.85rem" }}>
          {subtitle}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/50 p-0.5">
          <User className="w-6 h-6 text-primary/60" />
        </div>
      </div>
    </div>
  );
}
