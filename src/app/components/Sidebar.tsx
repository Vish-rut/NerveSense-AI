import { useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  Plus,
  CalendarPlus,
} from "lucide-react";
import { LogoIcon } from "./ui/LogoIcon";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Scheduling", icon: CalendarPlus, path: "/scheduling" },
  { label: "Scheduled Interview", icon: Calendar, path: "/scheduled" },
  { label: "Candidates", icon: Users, path: "/interviews" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="w-56 min-h-screen bg-sidebar backdrop-blur-md border-r border-sidebar-border flex flex-col py-6 px-4 shrink-0 sticky top-0 h-screen overflow-y-auto z-10">
      {/* Logo */}
      <div
        className="flex items-center gap-2 cursor-pointer px-2 ml-[6px] mr-[0px] mt-[0px] mb-[32px]"
        onClick={() => navigate("/dashboard")}
      >
        <LogoIcon className="w-8 h-8" />
        <span style={{ fontSize: "1.15rem", fontWeight: 700 }}>
          <span className="text-primary">NerveSense</span>
          <span className="text-sidebar-foreground">AI</span>
        </span>
      </div>

      <button
        onClick={() => navigate("/scheduling")}
        className="btn-hero mx-1 mb-8 w-[calc(100%-0.5rem)] whitespace-nowrap overflow-hidden"
        style={{ fontSize: "0.85rem", fontWeight: 700 }}
      >
        <Plus className="w-5 h-5 shrink-0" />
        Create New Interview
      </button>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 mx-[0px] mt-[20px] mb-[10px]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            location.pathname.startsWith(item.path + "/") ||
            (item.path === "/scheduling" && location.pathname.startsWith("/create-interview"));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-colors text-left ${isActive ? "text-primary-foreground bg-primary/20 border-l-2 border-primary" : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"} m-[0px] whitespace-nowrap overflow-hidden`}
              style={{ fontSize: "0.85rem", fontWeight: isActive ? 600 : 400 }}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}