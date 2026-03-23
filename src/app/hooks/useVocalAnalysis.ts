import { useRef, useState, useCallback, useEffect } from "react";

const FILLER_WORDS = [
  "um", "uh", "uhm", "uhh", "umm",
  "like", "so", "actually", "basically", "right",
  "you know", "i mean", "sort of", "kind of",
];

interface VocalAnalysisResult {
  transcript: string;
  wordCount: number;
  fillerCount: number;
  wpm: number;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
}

export function useVocalAnalysis(): VocalAnalysisResult {
  const [transcript, setTranscript] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [fillerCount, setFillerCount] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const wordCountRef = useRef(0);
  const fillerCountRef = useRef(0);
  const fullTranscriptRef = useRef("");
  const isListeningRef = useRef(false);

  // Check for browser support once
  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const countFillers = useCallback((text: string): number => {
    const lower = text.toLowerCase();
    let count = 0;
    // Count multi-word fillers first
    for (const filler of FILLER_WORDS) {
      if (filler.includes(" ")) {
        const regex = new RegExp(`\\b${filler}\\b`, "gi");
        const matches = lower.match(regex);
        if (matches) count += matches.length;
      }
    }
    // Count single-word fillers
    const words = lower.split(/\s+/);
    const singleFillers = FILLER_WORDS.filter((f) => !f.includes(" "));
    for (const word of words) {
      if (singleFillers.includes(word)) count++;
    }
    return count;
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let newText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newText += event.results[i][0].transcript + " ";
        }
      }

      if (newText.trim()) {
        fullTranscriptRef.current += newText;
        setTranscript(fullTranscriptRef.current);

        // Count words
        const newWords = newText.trim().split(/\s+/).length;
        wordCountRef.current += newWords;
        setWordCount(wordCountRef.current);

        // Count fillers in new text
        const newFillers = countFillers(newText);
        fillerCountRef.current += newFillers;
        setFillerCount(fillerCountRef.current);

        // Calculate WPM
        const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
        if (elapsedMinutes > 0.1) {
          setWpm(Math.round(wordCountRef.current / elapsedMinutes));
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening (use ref to avoid stale closure)
      if (isListeningRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // Already started
        }
      }
    };

    recognitionRef.current = recognition;
    startTimeRef.current = Date.now();
    wordCountRef.current = 0;
    fillerCountRef.current = 0;
    fullTranscriptRef.current = "";
    setTranscript("");
    setWordCount(0);
    setFillerCount(0);
    setWpm(0);

    try {
      isListeningRef.current = true;
      recognition.start();
      setIsListening(true);
    } catch (e) {
      isListeningRef.current = false;
      console.error("Failed to start speech recognition:", e);
    }
  }, [SpeechRecognition, countFillers]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  return { transcript, wordCount, fillerCount, wpm, isListening, startListening, stopListening };
}
