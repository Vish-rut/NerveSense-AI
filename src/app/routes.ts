import { createBrowserRouter } from "react-router";
import { useEffect } from "react";
import { LoginPage } from "./components/LoginPage";
import { SignUpPage } from "./components/SignUpPage";
import { DashboardLayout } from "./components/DashboardLayout";
import { DashboardPage } from "./components/DashboardPage";
import { CreateInterviewPage } from "./components/CreateInterviewPage";
import { ScheduledInterviewsPage } from "./components/ScheduledInterviewsPage";
import { InterviewDetailPage } from "./components/InterviewDetailPage";
import { CandidateReportPage } from "./components/CandidateReportPage";
import { AllInterviewsPage } from "./components/AllInterviewsPage";
import { SettingsPage } from "./components/SettingsPage";
import { InterviewStartPage } from "./components/InterviewStartPage";
import { InterviewSessionPage } from "./components/InterviewSessionPage";
import { InterviewCompletePage } from "./components/InterviewCompletePage";
import { LiveDashboardPage } from "./components/LiveDashboardPage";

function LandingRedirect() {
  useEffect(() => {
    window.location.replace("/landing/index.html");
  }, []);
  return null;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingRedirect,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/signup",
    Component: SignUpPage,
  },
  {
    path: "/dashboard",
    Component: DashboardLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "create", Component: CreateInterviewPage },
    ],
  },
  {
    path: "/create-interview",
    Component: DashboardLayout,
    children: [{ index: true, Component: CreateInterviewPage }],
  },
  {
    path: "/scheduling",
    Component: DashboardLayout,
    children: [{ index: true, Component: CreateInterviewPage }],
  },
  {
    path: "/scheduled",
    Component: DashboardLayout,
    children: [
      { index: true, Component: ScheduledInterviewsPage },
      { path: ":id", Component: InterviewDetailPage },
      { path: ":id/report/:candidateIdx", Component: CandidateReportPage },
      { path: ":id/live/:sessionId", Component: LiveDashboardPage },
    ],
  },
  {
    path: "/interviews",
    Component: DashboardLayout,
    children: [{ index: true, Component: AllInterviewsPage }],
  },
  {
    path: "/settings",
    Component: DashboardLayout,
    children: [{ index: true, Component: SettingsPage }],
  },
  {
    path: "/interview/start",
    Component: InterviewStartPage,
  },
  {
    path: "/interview/session",
    Component: InterviewSessionPage,
  },
  {
    path: "/interview/complete",
    Component: InterviewCompletePage,
  },
]);