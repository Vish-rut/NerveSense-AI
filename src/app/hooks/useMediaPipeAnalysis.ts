import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

interface VocalMetrics {
  wpm: number;
  filler_count: number;
  word_count: number;
}

interface AnalysisHookResult {
  isLoaded: boolean;
  faceDetected: boolean;
  confidenceScore: number | null;
  nervousnessScore: number | null;
  startAnalysis: (videoElement: HTMLVideoElement, sessionId: string) => void;
  stopAnalysis: () => void;
  setCurrentQuestionId: (questionId: number | null) => void;
  setVocalMetrics: (metrics: VocalMetrics | null) => void;
  error: string | null;
}

export function useMediaPipeAnalysis(): AnalysisHookResult {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [nervousnessScore, setNervousnessScore] = useState<number | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef<boolean>(false);
  const lastSendTimeRef = useRef<number>(0);
  const currentQuestionIdRef = useRef<number | null>(null);
  const vocalMetricsRef = useRef<VocalMetrics | null>(null);
  const lastSentVocal = useRef({ filler_count: 0, word_count: 0, timestamp: Date.now() });

  // Accumulated metrics for the current window (5 seconds)
  const metricsAccumulator = useRef({
    frames: 0,
    smileCount: 0,
    eyeContactCount: 0,
    postureShifts: 0,
    selfTouches: 0,
    lastNoseY: 0, // For tracking posture shifts
    lastWristY: 0, // For tracking hand movements
    // Enhanced facial metrics per implementation guide
    blinkCount: 0,
    lastEyeBlinkL: 0,  // previous blink score for edge detection
    lastEyeBlinkR: 0,
    gazeShiftCount: 0,
    lastGazeX: 0,
    lastGazeY: 0,
    browTensionSum: 0,   // sum of brow tension scores across frames
    jawTensionSum: 0,    // sum of jaw tension scores across frames
    headStabilityDeltas: [] as number[], // nose Y deltas for computing variance
    // Enhanced behavioral metrics
    bodyMotionDeltas: [] as number[], // shoulder Y deltas for body movement variance
    lastShoulderY: 0,
    fidgetFrameCount: 0, // frames with significant wrist movement
    lastLeftWristPos: { x: 0, y: 0 },
    lastRightWristPos: { x: 0, y: 0 },
  });

  useEffect(() => {
    let isMounted = true;
    
    const initializeMediaPipe = async () => {
      try {
        console.log("Initializing MediaPipe models...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });

        if (isMounted) {
          faceLandmarkerRef.current = faceLandmarker;
          poseLandmarkerRef.current = poseLandmarker;
          setIsLoaded(true);
          console.log("MediaPipe initialized successfully.");
        }
      } catch (err: any) {
        console.error("Failed to initialize MediaPipe:", err);
        if (isMounted) {
          setError(err.message || "Failed to load AI models");
        }
      }
    };

    initializeMediaPipe();

    return () => {
      isMounted = false;
      if (faceLandmarkerRef.current) faceLandmarkerRef.current.close();
      if (poseLandmarkerRef.current) poseLandmarkerRef.current.close();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const resetAccumulator = () => {
    const prev = metricsAccumulator.current;
    metricsAccumulator.current = {
      frames: 0,
      smileCount: 0,
      eyeContactCount: 0,
      postureShifts: 0,
      selfTouches: 0,
      lastNoseY: prev.lastNoseY,
      lastWristY: prev.lastWristY,
      blinkCount: 0,
      lastEyeBlinkL: prev.lastEyeBlinkL,
      lastEyeBlinkR: prev.lastEyeBlinkR,
      gazeShiftCount: 0,
      lastGazeX: prev.lastGazeX,
      lastGazeY: prev.lastGazeY,
      browTensionSum: 0,
      jawTensionSum: 0,
      headStabilityDeltas: [],
      bodyMotionDeltas: [],
      lastShoulderY: prev.lastShoulderY,
      fidgetFrameCount: 0,
      lastLeftWristPos: prev.lastLeftWristPos,
      lastRightWristPos: prev.lastRightWristPos,
    };
  };

  const sendMetricsToBackend = async (sessionId: string) => {
    const acc = metricsAccumulator.current;
    if (acc.frames === 0) return;

    // Calculate averages over the 5-second window
    const smileRatio = acc.smileCount / acc.frames;
    const eyeContactRatio = acc.eyeContactCount / acc.frames;

    // Gaze stability: lower shift rate = more stable (0-1, 1 = perfectly stable)
    const gazeStability = Math.max(0, 1 - (acc.gazeShiftCount / Math.max(acc.frames, 1)));

    // Head stability from movement variance
    const headDeltas = acc.headStabilityDeltas;
    const headVariance = headDeltas.length > 0
      ? headDeltas.reduce((s, d) => s + d * d, 0) / headDeltas.length
      : 0;
    const headStabilityScore = Math.max(0, Math.min(100, 100 - headVariance * 50000));

    // Blink rate per minute (normal: 15-20/min, high anxiety: 30+/min)
    const windowSeconds = 5;
    const blinkRate = (acc.blinkCount / windowSeconds) * 60;

    // Brow & jaw tension (averaged 0-1 scores)
    const browTension = acc.frames > 0 ? acc.browTensionSum / acc.frames : 0;
    const jawTension = acc.frames > 0 ? acc.jawTensionSum / acc.frames : 0;

    // Body movement variance
    const bodyDeltas = acc.bodyMotionDeltas;
    const bodyMotionVariance = bodyDeltas.length > 0
      ? bodyDeltas.reduce((s, d) => s + d * d, 0) / bodyDeltas.length
      : 0;

    // Fidget score (0-100): proportion of frames with significant wrist movement
    const fidgetScore = Math.min(100, (acc.fidgetFrameCount / Math.max(acc.frames, 1)) * 100);

    const facialMetrics = {
      smile_ratio: smileRatio,
      eye_contact_ratio: eyeContactRatio,
      gaze_stability: gazeStability,
      blink_rate: blinkRate,
      head_stability_score: headStabilityScore,
      brow_tension: browTension,
      jaw_tension: jawTension,
    };

    const behavioralMetrics = {
      posture_shifts: acc.postureShifts,
      self_touches: acc.selfTouches,
      fidget_score: fidgetScore,
      body_motion_variance: bodyMotionVariance,
    };

    // Compute multimodal nervousness using guide weights: facial 35%, vocal 30%, behavioral 35%
    // Facial nervousness inputs
    const facialNervousness = Math.min(100, Math.max(0,
      (1 - eyeContactRatio) * 30 +          // low eye contact
      (1 - gazeStability) * 15 +             // unstable gaze
      Math.max(0, (blinkRate - 20) / 30) * 15 + // high blink rate above normal
      (1 - headStabilityScore / 100) * 20 +  // head instability
      browTension * 10 +                      // brow tension
      jawTension * 10                          // jaw tension
    ));

    // Compute vocal DELTAS since last send (not cumulative values)
    const vocal = vocalMetricsRef.current;
    let deltaFillers = 0, deltaWords = 0, windowWpm = 0;
    if (vocal) {
      deltaFillers = Math.max(0, vocal.filler_count - lastSentVocal.current.filler_count);
      deltaWords = Math.max(0, vocal.word_count - lastSentVocal.current.word_count);
      const elapsedMin = (Date.now() - lastSentVocal.current.timestamp) / 60000;
      windowWpm = elapsedMin > 0.05 ? Math.round(deltaWords / elapsedMin) : 0;
      lastSentVocal.current = { filler_count: vocal.filler_count, word_count: vocal.word_count, timestamp: Date.now() };
    }

    // Behavioral nervousness
    const behavioralNervousness = Math.min(100, Math.max(0,
      acc.postureShifts * 8 +
      acc.selfTouches * 12 +
      fidgetScore * 0.4 +
      bodyMotionVariance * 10000
    ));

    // Weighted fusion: facial 50%, behavioral 50% (vocal nervousness is computed server-side to avoid double-counting)
    const overallNervousness = facialNervousness * 0.50 + behavioralNervousness * 0.50;
    const localConfidence = Math.min(100, Math.max(0, 100 - overallNervousness));
    const localNervousness = Math.min(100, Math.max(0, overallNervousness));

    setConfidenceScore(localConfidence);
    setNervousnessScore(localNervousness);

    // Reset accumulator for next window
    resetAccumulator();

    try {
      const token = localStorage.getItem('nervesense_token');
      fetch(`/api/public/session/${sessionId}/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          confidence_score: localConfidence,
          nervousness_score: localNervousness,
          facial_metrics: facialMetrics,
          behavioral_metrics: behavioralMetrics,
          vocal_metrics: vocal ? { wpm: windowWpm, filler_count: deltaFillers, word_count: deltaWords } : {},
          question_id: currentQuestionIdRef.current
        })
      }).catch(err => console.error("Failed to send metrics:", err));
    } catch (e) {
      console.error(e);
    }
  };

  const analyzeVideoFrame = useCallback(async (videoElement: HTMLVideoElement, sessionId: string) => {
    if (!isAnalyzingRef.current || !faceLandmarkerRef.current || !poseLandmarkerRef.current) return;

    const startTimeMs = performance.now();
    
    try {
      if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        // Run inference
        const faceResult = faceLandmarkerRef.current.detectForVideo(videoElement, startTimeMs);
        const poseResult = poseLandmarkerRef.current.detectForVideo(videoElement, startTimeMs);
        
        const acc = metricsAccumulator.current;
        acc.frames += 1;

        // Track face detection
        const hasFace = !!(faceResult.faceBlendshapes && faceResult.faceBlendshapes.length > 0);
        setFaceDetected(hasFace);

        // Process Face (Blendshapes)
        if (faceResult.faceBlendshapes && faceResult.faceBlendshapes.length > 0) {
          const shapes = faceResult.faceBlendshapes[0].categories;
          const getShape = (name: string) => shapes.find(s => s.categoryName === name)?.score || 0;

          // Check for smile (mouthSmileLeft/Right)
          const smileLeft = getShape('mouthSmileLeft');
          const smileRight = getShape('mouthSmileRight');
          if (smileLeft > 0.4 || smileRight > 0.4) acc.smileCount += 1;

          // Eye contact: looking straight when gaze deviation is low
          const lookInL = getShape('eyeLookInLeft');
          const lookOutL = getShape('eyeLookOutLeft');
          const lookUpL = getShape('eyeLookUpLeft');
          const lookDownL = getShape('eyeLookDownLeft');
          const gazeDeviation = lookInL + lookOutL + lookUpL + lookDownL;
          if (gazeDeviation < 0.5) acc.eyeContactCount += 1;

          // Gaze stability: detect gaze shifts
          const gazeX = lookInL - lookOutL;
          const gazeY = lookUpL - lookDownL;
          if (acc.lastGazeX !== 0 || acc.lastGazeY !== 0) {
            const gazeDelta = Math.sqrt((gazeX - acc.lastGazeX) ** 2 + (gazeY - acc.lastGazeY) ** 2);
            if (gazeDelta > 0.15) acc.gazeShiftCount += 1;
          }
          acc.lastGazeX = gazeX;
          acc.lastGazeY = gazeY;

          // Blink detection (edge detection: score goes high when eye closes)
          const eyeBlinkL = getShape('eyeBlinkLeft');
          const eyeBlinkR = getShape('eyeBlinkRight');
          if (eyeBlinkL > 0.5 && acc.lastEyeBlinkL <= 0.5) acc.blinkCount += 1;
          acc.lastEyeBlinkL = eyeBlinkL;
          acc.lastEyeBlinkR = eyeBlinkR;

          // Brow tension proxy: browDownLeft + browDownRight (furrowed brows = tension)
          const browDown = (getShape('browDownLeft') + getShape('browDownRight')) / 2;
          const browInnerUp = getShape('browInnerUp');
          acc.browTensionSum += Math.max(browDown, browInnerUp * 0.7);

          // Jaw tension proxy: jawOpen deviation + mouthPucker + jawForward
          const jawClench = getShape('jawForward') + getShape('mouthPucker') * 0.5;
          acc.jawTensionSum += jawClench;
        }

        // Process Pose
        if (poseResult.landmarks && poseResult.landmarks.length > 0) {
          const landmarks = poseResult.landmarks[0];
          // Nose is index 0
          const currentNoseY = landmarks[0]?.y || 0;
          // Wrists are 15, 16
          const leftWrist = landmarks[15];
          const rightWrist = landmarks[16];
          // Shoulders are 11, 12
          const leftShoulder = landmarks[11];
          const rightShoulder = landmarks[12];

          // Detect posture shift (significant Y movement of nose)
          if (acc.lastNoseY > 0) {
            const noseYDelta = Math.abs(currentNoseY - acc.lastNoseY);
            acc.headStabilityDeltas.push(noseYDelta);
            if (noseYDelta > 0.05) {
              acc.postureShifts += 1;
            }
          }
          acc.lastNoseY = currentNoseY;

          // Body movement variance from shoulders
          const avgShoulderY = ((leftShoulder?.y || 0) + (rightShoulder?.y || 0)) / 2;
          if (acc.lastShoulderY > 0) {
            const shoulderDelta = Math.abs(avgShoulderY - acc.lastShoulderY);
            acc.bodyMotionDeltas.push(shoulderDelta);
          }
          acc.lastShoulderY = avgShoulderY;

          // Detect self-touch (wrist near face region — nose Y area)
          const faceY = currentNoseY;
          if (leftWrist && Math.abs(leftWrist.y - faceY) < 0.12 && leftWrist.x > 0.2 && leftWrist.x < 0.8) {
            acc.selfTouches += 1;
          }
          if (rightWrist && Math.abs(rightWrist.y - faceY) < 0.12 && rightWrist.x > 0.2 && rightWrist.x < 0.8) {
            acc.selfTouches += 1;
          }

          // Fidget detection: rapid wrist movement
          if (leftWrist) {
            const dx = Math.abs(leftWrist.x - acc.lastLeftWristPos.x);
            const dy = Math.abs(leftWrist.y - acc.lastLeftWristPos.y);
            if (dx + dy > 0.04 && acc.lastLeftWristPos.x > 0) acc.fidgetFrameCount += 1;
            acc.lastLeftWristPos = { x: leftWrist.x, y: leftWrist.y };
          }
          if (rightWrist) {
            const dx = Math.abs(rightWrist.x - acc.lastRightWristPos.x);
            const dy = Math.abs(rightWrist.y - acc.lastRightWristPos.y);
            if (dx + dy > 0.04 && acc.lastRightWristPos.x > 0) acc.fidgetFrameCount += 1;
            acc.lastRightWristPos = { x: rightWrist.x, y: rightWrist.y };
          }
        }

        // Send metrics every 5 seconds
        if (startTimeMs - lastSendTimeRef.current >= 5000) {
          await sendMetricsToBackend(sessionId);
          lastSendTimeRef.current = startTimeMs;
        }
      }
    } catch (e) {
      console.warn("Error in frame analysis:", e);
    }

    if (isAnalyzingRef.current) {
      requestRef.current = requestAnimationFrame(() => analyzeVideoFrame(videoElement, sessionId));
    }
  }, []);

  const startAnalysis = useCallback((videoElement: HTMLVideoElement, sessionId: string) => {
    if (!isLoaded || isAnalyzingRef.current) return;
    console.log("Starting analysis for session:", sessionId);
    isAnalyzingRef.current = true;
    lastSendTimeRef.current = performance.now();
    lastSentVocal.current = { filler_count: 0, word_count: 0, timestamp: Date.now() };
    resetAccumulator();
    
    // Slight delay to ensure video is fully ready and models are loaded
    setTimeout(() => {
      if (isAnalyzingRef.current) {
        requestRef.current = requestAnimationFrame(() => analyzeVideoFrame(videoElement, sessionId));
      }
    }, 1000);
  }, [isLoaded, analyzeVideoFrame]);

  const stopAnalysis = useCallback(() => {
    console.log("Stopping analysis");
    isAnalyzingRef.current = false;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  }, []);

  const setCurrentQuestionId = useCallback((questionId: number | null) => {
    currentQuestionIdRef.current = questionId;
  }, []);

  const setVocalMetrics = useCallback((metrics: VocalMetrics | null) => {
    vocalMetricsRef.current = metrics;
  }, []);

  return { isLoaded, faceDetected, confidenceScore, nervousnessScore, startAnalysis, stopAnalysis, setCurrentQuestionId, setVocalMetrics, error };
}
