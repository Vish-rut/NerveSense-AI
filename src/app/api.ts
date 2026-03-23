/**
 * API client for NerveSenseAI backend.
 * 
 * All requests go through the Vite proxy (/api → localhost:8000).
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// ─── Auth token management ───────────────────────────────────────────────────

export function getAuthToken(): string | null {
  return localStorage.getItem("nervesense_token");
}

export function setAuthToken(token: string): void {
  localStorage.setItem("nervesense_token", token);
}

export function clearAuthToken(): void {
  localStorage.removeItem("nervesense_token");
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    let message = error.detail || `API error: ${res.status}`;
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }
    throw new Error(message);
  }

  return res.json();
}

// ─── Auth types & functions ──────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  user: AuthUser;
  access_token: string;
  token_type: string;
}

export async function signup(name: string, email: string, password: string): Promise<AuthResponse> {
  const result = await request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  setAuthToken(result.access_token);
  return result;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const result = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(result.access_token);
  return result;
}

export async function getMe(): Promise<AuthUser> {
  return request<AuthUser>("/auth/me");
}

export function logout(): void {
  clearAuthToken();
}

// ─── Interview types ─────────────────────────────────────────────────────────

export interface QuestionItem {
  id: number;
  question_text: string;
  question_type: string;
  order_index: number;
  expected_time_seconds: number;
}

export interface InterviewData {
  id: number;
  job_position: string;
  job_description: string | null;
  duration_minutes: number;
  status: string;
  access_token: string;
  interview_link: string;
  expires_at: string;
  created_at: string;
  interview_types: { id: number; type_name: string }[];
  questions: QuestionItem[];
}

export interface InterviewListItem {
  id: number;
  job_position: string;
  duration_minutes: number;
  status: string;
  access_token: string;
  interview_link: string;
  question_count: number;
  expires_at: string;
  created_at: string;
  interview_types: string[];
}

export interface PublicInterviewInfo {
  job_position: string;
  duration_minutes: number;
  question_count: number;
  interview_types: string[];
}

export interface SessionData {
  session_id: number;
  interview_id: number;
  candidate_name: string;
  job_position: string;
  duration_minutes: number;
  current_question_index: number;
  total_questions: number;
  session_status: string;
  questions: QuestionItem[];
}

export interface SessionQuestionState {
  session_id: number;
  current_question_index: number;
  total_questions: number;
  current_question: QuestionItem | null;
  session_status: string;
}

// ─── Recruiter APIs ──────────────────────────────────────────────────────────

export function createInterview(data: {
  job_position: string;
  job_description?: string;
  duration_minutes: number;
  interview_types: string[];
  number_of_questions?: number;
}): Promise<InterviewData> {
  return request<InterviewData>("/interviews", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listInterviews(): Promise<InterviewListItem[]> {
  return request<InterviewListItem[]>("/interviews");
}

export function getInterview(id: number): Promise<InterviewData> {
  return request<InterviewData>(`/interviews/${id}`);
}

export function getInterviewQuestions(id: number): Promise<QuestionItem[]> {
  return request<QuestionItem[]>(`/interviews/${id}/questions`);
}

export function deleteInterview(id: number): Promise<{ status: string }> {
  return request<{ status: string }>(`/interviews/${id}`, {
    method: "DELETE",
  });
}

export interface CandidateSummary {
  id: number;
  name: string;
  email: string | null;
  status: string;
  completed_at: string | null;
  overall_score: string | null;
  report_url: string | null;
  session_id: number | null;
}

export function getCandidates(id: number): Promise<CandidateSummary[]> {
  return request<CandidateSummary[]>(`/interviews/${id}/candidates`);
}

// ─── Candidate (Public) APIs ─────────────────────────────────────────────────

export function validateInterviewLink(token: string): Promise<PublicInterviewInfo> {
  return request<PublicInterviewInfo>(`/public/interview/${token}`);
}

export function startSession(
  token: string,
  data: { candidate_name: string; candidate_email?: string }
): Promise<SessionData> {
  return request<SessionData>(`/public/interview/${token}/start`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getSessionState(sessionId: number): Promise<SessionQuestionState> {
  return request<SessionQuestionState>(`/public/session/${sessionId}/state`);
}

export function nextQuestion(sessionId: number): Promise<SessionQuestionState> {
  return request<SessionQuestionState>(`/public/session/${sessionId}/next`, {
    method: "POST",
  });
}

export function finishSession(
  sessionId: number
): Promise<{ status: string; session_id: number; message: string }> {
  return request(`/public/session/${sessionId}/finish`, {
    method: "POST",
  });
}

// ─── Media Upload ────────────────────────────────────────────────────────────

export async function uploadMedia(
  sessionId: number,
  videoBlob?: Blob,
  audioBlob?: Blob
): Promise<{ status: string; session_id: number; message: string }> {
  const formData = new FormData();
  if (videoBlob) {
    formData.append("video", videoBlob, `session_${sessionId}_video.webm`);
  }
  if (audioBlob) {
    formData.append("audio", audioBlob, `session_${sessionId}_audio.wav`);
  }

  const res = await fetch(`${API_BASE}/public/session/${sessionId}/media`, {
    method: "POST",
    body: formData,
    // Note: do NOT set Content-Type header — browser sets it with boundary for FormData
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

// ─── Report APIs ─────────────────────────────────────────────────────────────

export interface ReportScores {
  overall_confidence: number;
  overall_nervousness: number;
  facial: number;
  vocal: number;
  behavioral: number;
  component_details?: {
    eye_contact_score?: number;
    gaze_stability_score?: number;
    head_stability_score?: number;
    smile_score?: number;
    blink_rate?: number;
    brow_tension?: number;
    jaw_tension?: number;
    facial_nervousness?: number;
    wpm_score?: number;
    filler_score?: number;
    pause_score?: number;
    vocal_nervousness?: number;
    posture_score?: number;
    touch_score?: number;
    fidget_score?: number;
    behavioral_nervousness?: number;
  };
}

export interface ReportTip {
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  category: string;
}

export interface TimelinePoint {
  time: string;
  time_seconds: number;
  wpm: number;
  filler_count: number;
  confidence: number;
  nervousness: number;
}

export interface EmotionDistribution {
  neutral: number;
  focus: number;
  stress: number;
  confidence: number;
}

export interface ReportData {
  status: string;
  session_id: number;
  interview: {
    id: number;
    job_position: string;
    duration_minutes: number;
  };
  candidate: {
    name: string;
    email: string | null;
    completed_at: string | null;
  };
  scores: ReportScores;
  summary: string;
  generated_at: string;
  timeline: TimelinePoint[];
  emotion_distribution: EmotionDistribution;
  questions: {
    id: number;
    text: string;
    type: string;
    order: number;
    analysis: {
      confidence_score: number;
      nervousness_score: number;
      eye_contact_score: number;
      speaking_rate: number;
      filler_word_count: number;
      posture_shift_count: number;
      self_touch_count: number;
      fidget_count: number;
    } | null;
    response: {
      transcript: string | null;
      confidence: number | null;
    } | null;
  }[];
  tips: ReportTip[];
}

export function getReport(sessionId: number): Promise<ReportData> {
  return request<ReportData>(`/reports/${sessionId}`);
}

export function getReportByCandidate(interviewId: number, candidateId: number): Promise<ReportData> {
  return request<ReportData>(`/reports/by-candidate/${interviewId}/${candidateId}`);
}

export function getReportExportUrl(sessionId: number, type: "json" | "csv" | "pdf"): string {
  return `${API_BASE}/reports/${sessionId}/export?type=${type}`;
}

// ─── Live Dashboard APIs ────────────────────────────────────────────────────

export interface LiveMetricsData {
  session_id: number;
  session_status: string;
  current_question_index: number;
  total_snapshots: number;
  averages: {
    confidence: number;
    nervousness: number;
    smile_ratio: number;
    eye_contact_ratio: number;
    posture_shifts: number;
    self_touches: number;
  };
  timeline: {
    timestamp: string | null;
    confidence: number | null;
    nervousness: number | null;
  }[];
}

export function getLiveMetrics(sessionId: number): Promise<LiveMetricsData> {
  return request<LiveMetricsData>(`/reports/${sessionId}/live`);
}
