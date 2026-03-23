"""
Video analysis using MediaPipe for facial landmarks and pose detection.
Extracts eye contact, head stability, facial expression metrics, and posture data.
"""
import logging
import math
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-load MediaPipe modules
_face_mesh = None
_pose = None
_mp = None


def _init_mediapipe():
    global _face_mesh, _pose, _mp
    if _face_mesh is not None:
        return True

    try:
        import mediapipe as mp

        _face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        _pose = mp.solutions.pose.Pose(
            static_image_mode=False,
            model_complexity=0,  # 0=lite, 1=full, 2=heavy
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        _mp = mp
        logger.info("MediaPipe face_mesh and pose initialized")
        return True
    except Exception as e:
        logger.warning(f"MediaPipe initialization failed ({type(e).__name__}: {e}). Using fallback.")
        return False



def analyze_video(video_path: str, sample_fps: int = 2) -> dict:
    """
    Analyze a video file for facial and behavioral features.
    Samples frames at `sample_fps` rate (default: 2 frames/sec for speed).

    Returns:
        {
            "eye_contact_score": float (0-100),
            "head_stability_score": float (0-100),
            "smile_ratio": float (0-1),
            "posture_shift_count": int,
            "self_touch_count": int,
            "facial_timeline": [...],
            "behavioral_timeline": [...],
            "total_frames_analyzed": int,
            "duration_seconds": float
        }
    """
    try:
        import cv2
    except ImportError:
        logger.warning("opencv-python not installed. Using fallback video analysis.")
        return _fallback_result()

    if not _init_mediapipe():
        return _fallback_result()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error(f"Cannot open video: {video_path}")
        return _fallback_result()

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    frame_interval = max(1, int(fps / sample_fps))

    # Accumulators
    eye_contact_frames = 0
    total_analyzed = 0
    smile_frames = 0
    head_positions = []      # (yaw, pitch) per frame for stability
    shoulder_positions = []  # shoulder y-positions for posture shifts
    hand_face_distances = [] # for self-touch detection

    frame_idx = 0
    facial_timeline = []
    behavioral_timeline = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval != 0:
            frame_idx += 1
            continue

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h, w = frame.shape[:2]
        timestamp = round(frame_idx / fps, 2)

        # --- Face Mesh Analysis ---
        face_result = _face_mesh.process(frame_rgb)
        eye_contact = False
        is_smiling = False
        yaw, pitch = 0.0, 0.0

        if face_result.multi_face_landmarks:
            landmarks = face_result.multi_face_landmarks[0].landmark

            # Eye contact: check if iris is roughly centered
            eye_contact = _check_eye_contact(landmarks, w, h)
            if eye_contact:
                eye_contact_frames += 1

            # Head pose estimation (simplified: nose tip vs face center)
            yaw, pitch = _estimate_head_pose(landmarks, w, h)
            head_positions.append((yaw, pitch))

            # Smile detection (mouth aspect ratio)
            is_smiling = _check_smile(landmarks)
            if is_smiling:
                smile_frames += 1

        # --- Pose Analysis ---
        pose_result = _pose.process(frame_rgb)
        shoulder_y = None
        hand_near_face = False

        if pose_result.pose_landmarks:
            plm = pose_result.pose_landmarks.landmark

            # Shoulder position for posture tracking
            left_shoulder = plm[11]
            right_shoulder = plm[12]
            shoulder_y = (left_shoulder.y + right_shoulder.y) / 2
            shoulder_positions.append(shoulder_y)

            # Self-touch detection: hand near face
            nose = plm[0]
            left_wrist = plm[15]
            right_wrist = plm[16]
            dist_left = math.sqrt((nose.x - left_wrist.x)**2 + (nose.y - left_wrist.y)**2)
            dist_right = math.sqrt((nose.x - right_wrist.x)**2 + (nose.y - right_wrist.y)**2)
            hand_near_face = dist_left < 0.15 or dist_right < 0.15
            hand_face_distances.append(min(dist_left, dist_right))

        total_analyzed += 1

        # Build timeline entries (every ~5 seconds)
        if total_analyzed % (sample_fps * 5) == 0:
            facial_timeline.append({
                "timestamp": timestamp,
                "eye_contact": eye_contact,
                "smiling": is_smiling,
                "head_yaw": round(yaw, 2),
                "head_pitch": round(pitch, 2)
            })
            behavioral_timeline.append({
                "timestamp": timestamp,
                "shoulder_shift": shoulder_y is not None,
                "hand_near_face": hand_near_face
            })

        frame_idx += 1

    cap.release()

    # --- Compute aggregate metrics ---
    eye_contact_score = round((eye_contact_frames / total_analyzed) * 100, 1) if total_analyzed > 0 else 0.0
    smile_ratio = round(smile_frames / total_analyzed, 3) if total_analyzed > 0 else 0.0

    # Head stability: lower standard deviation = more stable
    head_stability_score = _compute_head_stability(head_positions)

    # Posture shifts: count significant shoulder position changes
    posture_shift_count = _count_posture_shifts(shoulder_positions)

    # Self-touch: count frames where hand was near face (threshold)
    self_touch_count = sum(1 for d in hand_face_distances if d < 0.15)

    return {
        "eye_contact_score": eye_contact_score,
        "head_stability_score": head_stability_score,
        "smile_ratio": smile_ratio,
        "posture_shift_count": posture_shift_count,
        "self_touch_count": self_touch_count,
        "facial_timeline": facial_timeline,
        "behavioral_timeline": behavioral_timeline,
        "total_frames_analyzed": total_analyzed,
        "duration_seconds": round(duration, 2)
    }


def _check_eye_contact(landmarks, w, h) -> bool:
    """Simplified eye contact: check if the nose tip is roughly centered horizontally."""
    nose_tip = landmarks[1]  # nose tip landmark
    x_ratio = nose_tip.x  # 0.0 (left) to 1.0 (right)
    y_ratio = nose_tip.y  # 0.0 (top) to 1.0 (bottom)
    # Consider "looking at camera" if face is roughly centered
    return 0.3 < x_ratio < 0.7 and 0.2 < y_ratio < 0.8


def _estimate_head_pose(landmarks, w, h) -> tuple[float, float]:
    """Estimate yaw and pitch from face landmarks (simplified)."""
    nose = landmarks[1]
    left_ear = landmarks[234]
    right_ear = landmarks[454]

    # Yaw: difference in x between nose and ear midpoint
    ear_mid_x = (left_ear.x + right_ear.x) / 2
    yaw = (nose.x - ear_mid_x) * 100  # crude degrees estimate

    # Pitch: nose y relative to forehead
    forehead = landmarks[10]
    pitch = (nose.y - forehead.y) * 100

    return yaw, pitch


def _check_smile(landmarks) -> bool:
    """Check smile using mouth width / height ratio."""
    # Mouth corners
    left_corner = landmarks[61]
    right_corner = landmarks[291]
    # Mouth top and bottom
    top_lip = landmarks[13]
    bottom_lip = landmarks[14]

    mouth_width = math.sqrt(
        (right_corner.x - left_corner.x)**2 +
        (right_corner.y - left_corner.y)**2
    )
    mouth_height = math.sqrt(
        (bottom_lip.x - top_lip.x)**2 +
        (bottom_lip.y - top_lip.y)**2
    )

    if mouth_height == 0:
        return False

    ratio = mouth_width / mouth_height
    return ratio > 3.5  # smile threshold


def _compute_head_stability(positions: list) -> float:
    """Score 0-100 based on head position variance. Higher = more stable."""
    if len(positions) < 2:
        return 100.0

    yaws = [p[0] for p in positions]
    pitches = [p[1] for p in positions]

    yaw_std = _std(yaws)
    pitch_std = _std(pitches)
    combined_std = (yaw_std + pitch_std) / 2

    # Map: std 0 → score 100, std 10+ → score 0
    score = max(0.0, 100.0 - combined_std * 10)
    return round(score, 1)


def _count_posture_shifts(positions: list, threshold: float = 0.02) -> int:
    """Count significant shoulder position changes."""
    if len(positions) < 2:
        return 0

    shifts = 0
    for i in range(1, len(positions)):
        if abs(positions[i] - positions[i-1]) > threshold:
            shifts += 1
    return shifts


def _std(values: list) -> float:
    """Standard deviation."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return math.sqrt(variance)


def _fallback_result() -> dict:
    """Return placeholder results when MediaPipe is not available."""
    return {
        "eye_contact_score": 0.0,
        "head_stability_score": 0.0,
        "smile_ratio": 0.0,
        "posture_shift_count": 0,
        "self_touch_count": 0,
        "facial_timeline": [],
        "behavioral_timeline": [],
        "total_frames_analyzed": 0,
        "duration_seconds": 0.0
    }
