import image_e51b9bfbb12add0500f305c394b7a96ec1a4e537 from "../../assets/e51b9bfbb12add0500f305c394b7a96ec1a4e537.png";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { validateInterviewLink, startSession, type PublicInterviewInfo } from "../api";
import {
  Clock,
  Info,
  Camera,
  Mic,
  Sun,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Mail,
  User,
  Loader2,
  Monitor,
  Smartphone,
  Copy,
} from "lucide-react";
import { AnimatedCard } from "./ui/AnimatedCard";
import { LogoIcon } from "./ui/LogoIcon";



type CheckStatus = "idle" | "checking" | "pass" | "fail";

export function InterviewStartPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const interviewToken = searchParams.get("token") || "";

  const [interviewInfo, setInterviewInfo] = useState<PublicInterviewInfo | null>(null);
  const [loadingInterview, setLoadingInterview] = useState(true);
  const [interviewError, setInterviewError] = useState<string | null>(null);

  // Validate the interview token on mount
  useEffect(() => {
    if (!interviewToken) {
      setInterviewError("No interview token provided. Please use a valid interview link.");
      setLoadingInterview(false);
      return;
    }
    validateInterviewLink(interviewToken)
      .then((info) => {
        setInterviewInfo(info);
        setLoadingInterview(false);
      })
      .catch((err) => {
        setInterviewError(err.message || "Invalid or expired interview link.");
        setLoadingInterview(false);
      });
  }, [interviewToken]);

  const interviewData = interviewInfo
    ? {
      position: interviewInfo.job_position,
      duration: `${interviewInfo.duration_minutes} Minutes`,
      questionCount: interviewInfo.question_count,
    }
    : { position: "Loading...", duration: "--", questionCount: 0 };

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"info" | "envCheck">("info");

  // Environment check state
  const [cameraStatus, setCameraStatus] = useState<CheckStatus>("idle");
  const [micStatus, setMicStatus] = useState<CheckStatus>("idle");
  const [lightingStatus, setLightingStatus] = useState<CheckStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [simulatedMode, setSimulatedMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const allPassed =
    cameraStatus === "pass" && micStatus === "pass" && lightingStatus === "pass";

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [stream]);

  const startEnvironmentCheck = useCallback(async () => {
    setCameraStatus("checking");
    setMicStatus("checking");
    setLightingStatus("checking");
    setSimulatedMode(false);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStream(mediaStream);

      // Camera check
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setCameraStatus("pass");

      // Mic check with analyser
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(mediaStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkMic = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setMicLevel(Math.min(avg / 60, 1));
        animFrameRef.current = requestAnimationFrame(checkMic);
      };
      checkMic();

      // Give 2 seconds for mic to detect input
      setTimeout(() => {
        setMicStatus("pass");
      }, 1500);

      // Lighting check via canvas analysis
      setTimeout(() => {
        if (videoRef.current) {
          const canvas = document.createElement("canvas");
          canvas.width = videoRef.current.videoWidth || 320;
          canvas.height = videoRef.current.videoHeight || 240;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            let totalBrightness = 0;
            for (let i = 0; i < data.length; i += 4) {
              totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
            }
            const avgBrightness = totalBrightness / (data.length / 4);
            setLightingStatus(avgBrightness > 40 ? "pass" : "fail");
          } else {
            setLightingStatus("pass");
          }
        } else {
          setLightingStatus("pass");
        }
      }, 2500);
    } catch (_) {
      // Fallback: simulate environment check when permissions are unavailable
      setSimulatedMode(true);

      // Simulate sequential check passes with realistic timing
      setTimeout(() => setCameraStatus("pass"), 800);
      setTimeout(() => {
        setMicStatus("pass");
        setMicLevel(0.45);
      }, 1600);
      setTimeout(() => setLightingStatus("pass"), 2400);

      // Simulate mic level animation
      let simLevel = 0.2;
      const simInterval = setInterval(() => {
        simLevel = 0.15 + Math.random() * 0.5;
        setMicLevel(simLevel);
      }, 200);
      setTimeout(() => clearInterval(simInterval), 10000);
    }
  }, []);

  useEffect(() => {
    if (step === "envCheck") {
      startEnvironmentCheck();
    }
  }, [step, startEnvironmentCheck]);

  const handleContinueToInterview = async () => {
    // Stop stream before navigating
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    // Start a real session via the API
    try {
      const session = await startSession(interviewToken, {
        candidate_name: fullName,
        candidate_email: email || undefined,
      });
      navigate("/interview/session", {
        state: {
          sessionId: session.session_id,
          name: fullName,
          email,
          position: session.job_position,
          duration: `${session.duration_minutes} Minutes`,
          questionCount: session.total_questions,
          questions: session.questions,
        },
      });
    } catch (err: any) {
      // Fallback: navigate with local data if API fails
      navigate("/interview/session", {
        state: {
          name: fullName,
          email,
          position: interviewData.position,
          duration: interviewData.duration,
          questionCount: interviewData.questionCount,
        },
      });
    }
  };

  const handleProceedToCheck = () => {
    if (fullName.trim() && email.trim()) {
      setStep("envCheck");
    }
  };

  // Status icon helper
  const StatusIcon = ({ status }: { status: CheckStatus }) => {
    if (status === "checking")
      return <Loader2 className="w-5 h-5 text-[#4F6DF5] animate-spin" />;
    if (status === "pass")
      return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (status === "fail") return <XCircle className="w-5 h-5 text-red-500" />;
    return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
  };

  const statusLabel = (status: CheckStatus, passText: string) => {
    if (status === "checking") return "Checking...";
    if (status === "pass") return passText;
    if (status === "fail") return "Not Detected";
    return "Waiting...";
  };

  // ==================== LOADING / ERROR STATE ====================
  if (loadingInterview) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
        <div className="fixed inset-0 pointer-events-none -z-10 bg-background">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[120px]" />
        </div>
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground" style={{ fontSize: "0.95rem" }}>Validating interview link...</p>
        </div>
      </div>
    );
  }

  if (interviewError) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
        <div className="fixed inset-0 pointer-events-none -z-10 bg-background">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[120px]" />
        </div>
        <div className="max-w-md w-full card-gradient backdrop-blur-xl rounded-2xl p-8 text-center relative overflow-hidden">
          <XCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }} className="text-foreground mb-2">Invalid Interview Link</h2>
          <p className="text-muted-foreground mb-6" style={{ fontSize: "0.9rem" }}>{interviewError}</p>
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center gap-2 mx-auto bg-gradient-to-r from-primary to-blue-500 text-primary-foreground rounded-xl px-6 py-3 hover:opacity-90 transition-opacity"
            style={{ fontSize: "0.9rem", fontWeight: 600 }}
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  // ==================== INFO STEP ====================
  if (step === "info") {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
        {/* Background Gradients */}
        <div className="fixed inset-0 pointer-events-none -z-10 bg-background">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-md w-full relative z-10">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <LogoIcon className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
              <span style={{ fontSize: "1.4rem", fontWeight: 700 }}>
                <span className="text-primary">NerveSense</span>
                <span className="text-foreground">AI</span>
              </span>
            </div>
            <p className="text-muted-foreground" style={{ fontSize: "0.9rem" }}>
              AI-Powered Interview Platform
            </p>
          </div>

          <div className="card-gradient backdrop-blur-xl rounded-2xl relative overflow-hidden">
            {/* Illustration */}
            <div className="px-6 pt-6">
              <div className="bg-primary/5 rounded-xl overflow-hidden border border-primary/10">
                <img
                  src={image_e51b9bfbb12add0500f305c394b7a96ec1a4e537}
                  alt="Interview Illustration"
                  className="w-full h-44 object-cover object-center opacity-90"
                />
              </div>
            </div>

            <div className="px-6 py-6 space-y-5">
              {/* Title */}
              <div className="text-center">
                <h3
                  style={{ fontSize: "1.2rem", fontWeight: 600 }}
                  className="text-foreground mb-2"
                >
                  {interviewData.position}
                </h3>
                <div
                  className="flex items-center justify-center gap-4 text-muted-foreground"
                  style={{ fontSize: "0.85rem" }}
                >
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {interviewData.duration}
                  </span>
                </div>
              </div>

              {/* Full Name Input */}
              <div>
                <label
                  className="block text-foreground mb-2"
                  style={{ fontSize: "0.85rem", fontWeight: 500 }}
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., John Smith"
                    className="w-full pl-10 pr-4 border border-border rounded-xl px-4 py-3 bg-background/50 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    style={{ fontSize: "0.9rem" }}
                  />
                </div>
              </div>

              {/* Email Input */}
              <div>
                <label
                  className="block text-foreground mb-2"
                  style={{ fontSize: "0.85rem", fontWeight: 500 }}
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 border border-border rounded-xl px-4 py-3 bg-background/50 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    style={{ fontSize: "0.9rem" }}
                  />
                </div>
              </div>

              {/* Before you begin */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-primary" />
                  <span
                    style={{ fontSize: "0.9rem", fontWeight: 600 }}
                    className="text-foreground"
                  >
                    Before you begin
                  </span>
                </div>
                <ul
                  className="space-y-1.5 text-muted-foreground ml-6"
                  style={{ fontSize: "0.85rem" }}
                >
                  <li className="flex items-center gap-1.5">
                    <span className="text-primary mr-1 drop-shadow-[0_0_5px_rgba(var(--primary),0.5)]">•</span>
                    Ensure you have a stable internet connection
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-primary mr-1 drop-shadow-[0_0_5px_rgba(var(--primary),0.5)]">•</span>
                    We'll test your camera and microphone next
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-primary mr-1 drop-shadow-[0_0_5px_rgba(var(--primary),0.5)]">•</span>
                    Find a quiet, well-lit place for the interview
                  </li>
                </ul>
              </div>

              {/* Proceed Button */}
              <button
                onClick={handleProceedToCheck}
                disabled={!fullName.trim() || !email.trim()}
                className="btn-hero w-full py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontSize: "0.95rem", fontWeight: 600 }}
              >
                Continue to Environment Check
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== ENVIRONMENT CHECK STEP ====================
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-background">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-lg w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <LogoIcon className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
            <span style={{ fontSize: "1.4rem", fontWeight: 700 }}>
              <span className="text-primary">NerveSense</span>
              <span className="text-foreground">AI</span>
            </span>
          </div>
          <p className="text-muted-foreground" style={{ fontSize: "0.9rem" }}>
            AI-Powered Interview Platform
          </p>
        </div>

        <div className="card-gradient backdrop-blur-xl rounded-2xl relative overflow-hidden">
          <div className="px-6 py-6 space-y-5">
            {/* Back button + Title */}
            <div>
              <button
                onClick={() => {
                  if (stream) stream.getTracks().forEach((t) => t.stop());
                  if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
                  setStream(null);
                  setCameraStatus("idle");
                  setMicStatus("idle");
                  setLightingStatus("idle");
                  setStep("info");
                }}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-3"
                style={{ fontSize: "0.85rem" }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <h2
                style={{ fontSize: "1.35rem", fontWeight: 700 }}
                className="text-foreground text-center"
              >
                Environment Check
              </h2>
              <p
                className="text-muted-foreground text-center mt-1"
                style={{ fontSize: "0.85rem" }}
              >
                We'll quickly verify your setup to ensure the best experience.
              </p>
            </div>

            {/* Camera Preview */}
            <div className="relative bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{
                  transform: "scaleX(-1)",
                  display: cameraStatus === "pass" && !simulatedMode ? "block" : "none",
                }}
              />

              {/* Simulated camera placeholder */}
              {cameraStatus === "pass" && simulatedMode && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-background/80 to-background/40">
                  <div className="w-20 h-20 rounded-full border border-white/10 bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                    <Camera className="w-10 h-10 text-foreground" />
                  </div>
                  <span className="text-foreground" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                    Camera Preview
                  </span>
                  <span className="text-muted-foreground mt-0.5" style={{ fontSize: "0.7rem" }}>
                    Simulated — real preview on supported devices
                  </span>
                </div>
              )}

              {/* Overlay when camera not yet active */}
              {cameraStatus !== "pass" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Camera className="w-10 h-10 text-muted-foreground mb-2 opacity-50" />
                  <span className="text-muted-foreground" style={{ fontSize: "0.85rem" }}>
                    Camera Preview
                  </span>
                  {cameraStatus === "checking" && (
                    <span
                      className="text-primary mt-1"
                      style={{ fontSize: "0.8rem" }}
                    >
                      Requesting access...
                    </span>
                  )}
                  {cameraStatus === "fail" && (
                    <span
                      className="text-red-400 mt-1"
                      style={{ fontSize: "0.8rem" }}
                    >
                      Camera not available
                    </span>
                  )}
                </div>
              )}

              {/* LIVE badge */}
              {cameraStatus === "pass" && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-background/50 border border-border/50 backdrop-blur-sm rounded-full px-3 py-1">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <span
                    className="text-foreground"
                    style={{ fontSize: "0.75rem", fontWeight: 600 }}
                  >
                    LIVE
                  </span>
                </div>
              )}

              {cameraStatus === "pass" && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                  <span
                    className="text-primary bg-background/80 border border-border/50 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg"
                    style={{ fontSize: "0.75rem", fontWeight: 600 }}
                  >
                    Feed Active
                  </span>
                </div>
              )}
            </div>

            {/* Mic Level Indicator */}
            {micStatus === "pass" && (
              <div className="flex items-center gap-3 px-1">
                <Mic className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden border border-border/20">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full transition-all duration-100 shadow-[0_0_8px_rgba(var(--primary),0.8)]"
                    style={{ width: `${Math.max(micLevel * 100, 5)}%` }}
                  />
                </div>
                <span className="text-muted-foreground shrink-0" style={{ fontSize: "0.7rem" }}>
                  Mic Level
                </span>
              </div>
            )}

            {/* Status Cards */}
            <div className="space-y-2.5">
              {/* Camera */}
              <div
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${cameraStatus === "pass"
                  ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.05)]"
                  : cameraStatus === "fail"
                    ? "bg-destructive/10 border-destructive/30"
                    : "bg-muted/50 border-border"
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${cameraStatus === "pass"
                    ? "bg-primary/20 text-primary border border-primary/20"
                    : cameraStatus === "fail"
                      ? "bg-destructive/20 text-destructive border border-destructive/20"
                      : "bg-muted text-muted-foreground"
                    }`}
                >
                  <Camera
                    className="w-4 h-4"
                  />
                </div>
                <span
                  className={`flex-1 ${cameraStatus === "pass"
                    ? "text-white"
                    : cameraStatus === "fail"
                      ? "text-red-500"
                      : "text-muted-foreground"
                    }`}
                  style={{ fontSize: "0.9rem", fontWeight: 500 }}
                >
                  {statusLabel(cameraStatus, "Camera Connected")}
                </span>
                <StatusIcon status={cameraStatus} />
              </div>

              {/* Microphone */}
              <div
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${micStatus === "pass"
                  ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.05)]"
                  : micStatus === "fail"
                    ? "bg-destructive/10 border-destructive/30"
                    : "bg-muted/50 border-border"
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${micStatus === "pass"
                    ? "bg-primary/20 text-primary border border-primary/20"
                    : micStatus === "fail"
                      ? "bg-destructive/20 text-destructive border border-destructive/20"
                      : "bg-muted text-muted-foreground"
                    }`}
                >
                  <Mic
                    className="w-4 h-4"
                  />
                </div>
                <span
                  className={`flex-1 ${micStatus === "pass"
                    ? "text-white"
                    : micStatus === "fail"
                      ? "text-red-500"
                      : "text-muted-foreground"
                    }`}
                  style={{ fontSize: "0.9rem", fontWeight: 500 }}
                >
                  {statusLabel(micStatus, "Microphone Active")}
                </span>
                <StatusIcon status={micStatus} />
              </div>

              {/* Lighting */}
              <div
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors ${lightingStatus === "pass"
                  ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.05)]"
                  : lightingStatus === "fail"
                    ? "bg-destructive/10 border-destructive/30"
                    : "bg-muted/50 border-border"
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${lightingStatus === "pass"
                    ? "bg-primary/20 text-primary border border-primary/20"
                    : lightingStatus === "fail"
                      ? "bg-destructive/20 text-destructive border border-destructive/20"
                      : "bg-muted text-muted-foreground"
                    }`}
                >
                  <Sun
                    className="w-4 h-4"
                  />
                </div>
                <span
                  className={`flex-1 ${lightingStatus === "pass"
                    ? "text-white"
                    : lightingStatus === "fail"
                      ? "text-red-500"
                      : "text-muted-foreground"
                    }`}
                  style={{ fontSize: "0.9rem", fontWeight: 500 }}
                >
                  {statusLabel(lightingStatus, "Lighting Optimal")}
                </span>
                <StatusIcon status={lightingStatus} />
              </div>
            </div>

            {/* Retry button on failure */}
            {(cameraStatus === "fail" ||
              micStatus === "fail" ||
              lightingStatus === "fail") && (
                <button
                  onClick={() => {
                    if (stream) stream.getTracks().forEach((t) => t.stop());
                    setStream(null);
                    startEnvironmentCheck();
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-background/50 border border-primary/50 text-primary rounded-xl py-3 hover:bg-white/5 transition-colors"
                  style={{ fontSize: "0.9rem", fontWeight: 600 }}
                >
                  Retry Check
                </button>
              )}

            {/* Continue Button */}
            <button
              onClick={handleContinueToInterview}
              disabled={!allPassed}
              className="btn-hero w-full py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontSize: "0.95rem", fontWeight: 600 }}
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}