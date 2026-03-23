import image_a8226d319ba83fa22a112087f3f97322273c9df8 from "../../assets/a8226d319ba83fa22a112087f3f97322273c9df8.png";
import { CheckCircle2, Send, Clock, Loader2 } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useLocation } from "react-router";
import { useState, useEffect } from "react";
import { getReport } from "../api";

export function InterviewCompletePage() {
  const location = useLocation();
  const state = location.state as any;
  const sessionId = state?.sessionId as number | undefined;
  const candidateName = state?.candidateName || "Candidate";

  const [analysisStatus, setAnalysisStatus] = useState<"processing" | "ready" | "failed">("processing");

  // Poll for analysis completion
  useEffect(() => {
    if (!sessionId) {
      setAnalysisStatus("ready");
      return;
    }

    let cancelled = false;
    const checkStatus = async () => {
      try {
        const report = await getReport(sessionId);
        if (cancelled) return;
        if ((report as any).status === "ready") {
          setAnalysisStatus("ready");
        } else if ((report as any).status === "failed") {
          setAnalysisStatus("failed");
        } else {
          // Still processing, check again in 3s
          setTimeout(checkStatus, 3000);
        }
      } catch {
        if (!cancelled) setTimeout(checkStatus, 3000);
      }
    };

    // Give the backend a moment to start processing
    const timeout = setTimeout(checkStatus, 2000);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [sessionId]);

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-lg w-full text-center space-y-6 relative z-10">
        {/* Success Icon */}
        <div className="flex justify-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 [filter:drop-shadow(0_0_10px_rgba(34,197,94,0.3))]" />
        </div>

        <h1 style={{ fontSize: "1.8rem", fontWeight: 700 }} className="text-foreground">
          Interview Complete!
        </h1>
        <p className="text-muted-foreground" style={{ fontSize: "0.9rem" }}>
          Thank you{candidateName !== "Candidate" ? `, ${candidateName}` : ""}, for participating in the AI-driven interview with NerveSenseAI
        </p>

        {/* Analysis Status */}
        <div className="card-gradient backdrop-blur-xl rounded-xl p-5 mx-auto max-w-sm relative overflow-hidden">
          {analysisStatus === "processing" && (
            <div className="flex items-center justify-center gap-3 text-primary">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Analyzing your interview...</span>
            </div>
          )}
          {analysisStatus === "ready" && (
            <div className="flex items-center justify-center gap-3 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Analysis complete</span>
            </div>
          )}
          {analysisStatus === "failed" && (
            <div className="flex items-center justify-center gap-3 text-amber-400">
              <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Analysis processing — results will be available shortly</span>
            </div>
          )}
        </div>

        {/* Illustration */}
        <div className="card-gradient backdrop-blur-xl rounded-xl overflow-hidden mx-auto max-w-md p-2">
          <ImageWithFallback
            src={image_a8226d319ba83fa22a112087f3f97322273c9df8}
            alt="Interview Complete"
            className="w-full h-48 object-cover rounded-lg"
          />
        </div>

        {/* What's Next Card */}
        <div className="card-gradient backdrop-blur-xl rounded-xl p-6 mx-auto max-w-sm relative overflow-hidden">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 icon-badge-squircle mx-auto">
              <Send className="w-5 h-5" />
            </div>
          </div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }} className="text-foreground mb-2">
            What's Next?
          </h3>
          <p className="text-muted-foreground mb-3" style={{ fontSize: "0.85rem" }}>
            The recruiter will review your interview responses and will contact you
            soon regarding the next steps.
          </p>
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground" style={{ fontSize: "0.8rem" }}>
            <Clock className="w-3.5 h-3.5" />
            Response within 2-3 business days
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 text-muted-foreground" style={{ fontSize: "0.8rem" }}>
        &copy; 2026 NerveSenseAI. All rights reserved.
      </div>
    </div>
  );
}
