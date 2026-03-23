import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { finishSession, nextQuestion as apiNextQuestion, type QuestionItem } from "../api";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Camera,
  SkipForward,
  FileText,
  ArrowRight,
  Cpu,
  Timer,
} from "lucide-react";
import { LogoIcon } from "./ui/LogoIcon";
import { useMediaPipeAnalysis } from "../hooks/useMediaPipeAnalysis";
import { useVocalAnalysis } from "../hooks/useVocalAnalysis";

const defaultQuestions = [
  "Tell me about a time you overcame a technical challenge.",
  "How do you handle tight deadlines and pressure situations?",
  "Describe your approach to debugging complex issues in production.",
  "How do you stay updated with the latest technologies and trends?",
  "Tell me about a project where you had to collaborate with a difficult team member.",
];

export function InterviewSessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as any;
  const candidateName = state?.name || "Candidate";
  const position = state?.position || "Interview";
  const durationStr = state?.duration || "30 Minutes";
  const totalQuestions = state?.questionCount || defaultQuestions.length;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionId = state?.sessionId as number | undefined;
  const apiQuestions = state?.questions as QuestionItem[] | undefined;

  // MediaPipe real-time analysis
  const { isLoaded, faceDetected, confidenceScore, nervousnessScore, startAnalysis, stopAnalysis, setCurrentQuestionId, setVocalMetrics } = useMediaPipeAnalysis();

  // Vocal analysis via Web Speech API
  const { wordCount, fillerCount, wpm, startListening, stopListening } = useVocalAnalysis();

  // Use API questions if available, otherwise fall back to defaults
  const questions = apiQuestions
    ? apiQuestions.map((q) => q.question_text)
    : totalQuestions <= defaultQuestions.length
      ? defaultQuestions.slice(0, totalQuestions)
      : defaultQuestions;

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get camera on mount
  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    (async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setStream(mediaStream);
        setCameraAvailable(true);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
      } catch {
        // Camera not available — run in simulated mode
        setCameraAvailable(false);
      }
    })();
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Trigger analysis when ready
  useEffect(() => {
    if (isLoaded && cameraAvailable && videoRef.current && videoOn && sessionId) {
      startAnalysis(videoRef.current, sessionId.toString());
    }
  }, [isLoaded, cameraAvailable, videoOn, sessionId, startAnalysis]);

  // Toggle video track
  useEffect(() => {
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = videoOn));
    }
  }, [videoOn, stream]);

  // Toggle audio track
  useEffect(() => {
    if (stream) {
      stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
    }
  }, [micOn, stream]);

  // Sync current question ID to analysis hook
  useEffect(() => {
    if (apiQuestions && apiQuestions[currentQuestion]) {
      setCurrentQuestionId(apiQuestions[currentQuestion].id);
    }
  }, [currentQuestion, apiQuestions, setCurrentQuestionId]);

  // Start vocal analysis when mic is on, session is active, and mic permission granted
  useEffect(() => {
    if (micOn && sessionId && cameraAvailable) {
      startListening();
    } else {
      stopListening();
    }
    return () => stopListening();
  }, [micOn, sessionId, cameraAvailable, startListening, stopListening]);

  // Feed vocal metrics to the MediaPipe hook for backend transmission
  useEffect(() => {
    setVocalMetrics({ wpm, filler_count: fillerCount, word_count: wordCount });
  }, [wpm, fillerCount, wordCount, setVocalMetrics]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleNextQuestion = async () => {
    if (currentQuestion < questions.length - 1) {
      // Notify backend of question progression
      if (sessionId) {
        try {
          await apiNextQuestion(sessionId);
        } catch {
          // Continue even if API fails
        }
      }
      setCurrentQuestion((q) => q + 1);
    }
  };

  const handleEndInterview = async () => {
    stopAnalysis();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    // Finish session via API
    if (sessionId) {
      try {
        await finishSession(sessionId);
      } catch {
        // Continue to complete page even if API fails
      }
    }
    navigate("/interview/complete", { state: { sessionId, candidateName } });
  };

  const progressPercent = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen relative flex flex-col overflow-hidden">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-background">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[120px]" />
      </div>

      {/* Top Bar */}
      <div className="card-gradient backdrop-blur-xl border-b border-border px-5 py-3 grid grid-cols-3 items-center relative z-10 w-full">

        {/* Left: REC only */}
        <div className="flex items-center gap-3 justify-start">
          {/* REC indicator */}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            <span
              className="text-red-500"
              style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em" }}
            >
              REC
            </span>
          </div>
        </div>

        {/* Center: Branding + AI Processing */}
        <div className="flex items-center gap-3 justify-center">
          <div className="flex items-center gap-1.5 hidden md:flex">
            <LogoIcon className="w-8 h-8 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
            <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>
              <span className="text-primary">NerveSense</span>
              <span className="text-foreground">AI</span>
            </span>
          </div>
          {/* AI Processing badge & live metrics */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 ${isLoaded ? 'bg-green-500/10 border-green-500/30' : 'bg-primary/10 border-primary/30'} text-foreground border rounded-full pl-1.5 pr-3 py-1 shadow-sm transition-colors`}>
              <div className="icon-badge-squircle w-6 h-6 p-0.5">
                <Cpu className={`w-3.5 h-3.5 ${isLoaded ? 'text-green-500' : 'text-primary'}`} />
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                {isLoaded ? "AI Processing" : "Loading AI..."}
              </span>
            </div>
            {confidenceScore !== null && (
              <div className="hidden sm:flex items-center gap-1.5 bg-background/80 border border-border backdrop-blur-md rounded-full px-3 py-1 text-foreground shadow-sm">
                <span className="text-muted-foreground" style={{ fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.05em" }}>CONFIDENCE</span>
                <span className={`font-mono ${confidenceScore > 75 ? 'text-green-500' : confidenceScore > 40 ? 'text-yellow-500' : 'text-red-500'}`} style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                  {Math.round(confidenceScore)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Timer & Question Counter */}
        <div className="flex items-center gap-4 justify-end">
          {/* Timer */}
          <div
            className="hidden sm:flex items-center gap-2 text-muted-foreground"
            style={{ fontSize: "0.85rem" }}
          >
            <div className="icon-badge-squircle w-7 h-7 p-1">
              <Timer className="w-4 h-4" />
            </div>
            {formatTime(seconds)}
          </div>

          {/* Question Counter */}
          <div
            className="text-muted-foreground"
            style={{ fontSize: "0.85rem", fontWeight: 500 }}
          >
            Question{" "}
            <span className="text-foreground" style={{ fontWeight: 700 }}>
              {currentQuestion + 1}
            </span>{" "}
            / {questions.length}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 w-full">
        <div className="w-full max-w-3xl space-y-5">
          {/* Camera Feed Area */}
          <div className="relative bg-background/60 backdrop-blur-xl border border-border rounded-2xl overflow-hidden aspect-video shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{
                transform: "scaleX(-1)",
                display: videoOn && cameraAvailable ? "block" : "none",
              }}
            />

            {/* Simulated camera placeholder when no real camera */}
            {videoOn && !cameraAvailable && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-md">
                <div className="w-24 h-24 rounded-full border border-white/10 bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                  <Camera className="w-10 h-10 text-foreground" />
                </div>
                <span className="text-foreground" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                  Camera Feed
                </span>
                <span className="text-muted-foreground mt-0.5" style={{ fontSize: "0.7rem" }}>
                  Simulated — real feed on supported devices
                </span>
              </div>
            )}

            {/* No video fallback */}
            {!videoOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md">
                <Camera className="w-12 h-12 text-muted-foreground mb-2 opacity-50" />
                <span className="text-muted-foreground" style={{ fontSize: "0.85rem" }}>
                  Camera is off
                </span>
              </div>
            )}

            {/* Face Detected Badge */}
            <div className="absolute top-3 left-3">
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur-md border ${faceDetected
                    ? "bg-green-500/10 border-green-500/20 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                    : "bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                  }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${faceDetected ? "bg-green-400" : "bg-red-400 animate-pulse"
                    }`}
                />
                <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  {faceDetected ? "Face Detected" : "No Face"}
                </span>
              </div>
            </div>

            {/* Pose Tracking Badge */}
            <div className="absolute top-3 right-3">
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-blue-300 rounded-full px-3 py-1.5 backdrop-blur-md shadow-[0_0_10px_rgba(var(--primary),0.1)]">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  Pose Tracking
                </span>
              </div>
            </div>

            {/* Candidate name overlay */}
            <div className="absolute bottom-3 left-3">
              <div className="bg-background/80 border border-border/50 backdrop-blur-md rounded-lg px-3 py-1.5">
                <span
                  className="text-foreground"
                  style={{ fontSize: "0.8rem", fontWeight: 500 }}
                >
                  {candidateName}
                </span>
              </div>
            </div>
          </div>

          {/* Interview Question Card */}
          <div className="card-gradient backdrop-blur-xl rounded-xl p-6 relative overflow-hidden">
            <div className="mb-2">
              <span
                className="text-primary font-semibold drop-shadow-[0_0_5px_rgba(var(--primary),0.3)]"
                style={{
                  fontSize: "0.75rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                }}
              >
                Interview Question
              </span>
            </div>
            <p
              className="text-foreground text-shadow-sm"
              style={{ fontSize: "1.05rem", fontWeight: 500, lineHeight: 1.6 }}
            >
              "{questions[currentQuestion]}"
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary to-blue-500 h-1.5 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(var(--primary),0.8)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            {/* Mic & Video Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMicOn(!micOn)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border ${micOn
                    ? "bg-background/50 border-border text-foreground hover:bg-white/10 hover:border-primary/50"
                    : "bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                  }`}
                title={micOn ? "Mute microphone" : "Unmute microphone"}
              >
                {micOn ? (
                  <Mic className="w-4.5 h-4.5" />
                ) : (
                  <MicOff className="w-4.5 h-4.5" />
                )}
              </button>

              <button
                onClick={() => setVideoOn(!videoOn)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border ${videoOn
                    ? "bg-background/50 border-border text-foreground hover:bg-white/10 hover:border-primary/50"
                    : "bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                  }`}
                title={videoOn ? "Turn off camera" : "Turn on camera"}
              >
                {videoOn ? (
                  <Video className="w-4.5 h-4.5" />
                ) : (
                  <VideoOff className="w-4.5 h-4.5" />
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {currentQuestion < questions.length - 1 && (
                <button
                  onClick={handleNextQuestion}
                  className="flex items-center justify-center gap-2 border border-border rounded-lg px-5 py-2.5 text-foreground hover:bg-white/5 transition-colors hover:border-sidebar-foreground/30 hover:text-white"
                  style={{ fontSize: "0.9rem", fontWeight: 500 }}
                >
                  <SkipForward className="w-4 h-4" />
                  Next Question
                </button>
              )}

              <button
                onClick={handleEndInterview}
                className="btn-hero px-5 py-2.5"
                style={{ fontSize: "0.85rem", fontWeight: 600 }}
              >
                <FileText className="w-4 h-4" />
                End Interview & View Results
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}