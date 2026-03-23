# 🧠 NerveSenseAI

**NerveSenseAI** is an AI-powered interview analysis platform designed to provide real-time behavioral and vocal insights. By combining multi-modal analysis (facial, postural, and vocal), it helps recruiters and candidates understand performance through objective, data-driven metrics.

---

## 🚀 Key Features

### 🎥 Multi-Modal Analysis
- **Facial Markers**: Real-time tracking of eye contact, gaze stability, smile ratio, and brow/jaw tension.
- **Behavioral Patterns**: Detection of posture shifts, self-touch gestures, and fidgeting.
- **Vocal Metrics**: Calculation of WPM (Words Per Minute), filler word frequency (um, ah, like), and pause detection.

### 📊 Comprehensive Reporting
- **Automated Scoring**: Instant generation of confidence and nervousness scores.
- **Interactive Dashboard**: Recruiter view for managing scheduled interviews and analyzing candidate results.
- **Export Options**: Export detailed analysis reports in PDF, CSV, or JSON formats.

### 🔐 Secure & Scalable
- **Supabase Integration**: Robust PostgreSQL backend with built-in Auth.
- **Vapi Support**: Seamless AI-driven voice interactions.
- **Modern UI**: Sleek, responsive design built with React and TailwindCSS.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React, Vite, TailwindCSS, Radix UI, Lucide Icons |
| **Backend** | FastAPI, Python 3.12, SQLAlchemy, AsyncPG |
| **Analysis** | MediaPipe (Vision), Faster-Whisper (Audio), NumPy |
| **Database** | Supabase (PostgreSQL) |
| **Deployment** | Vercel (Frontend), Render.com (Backend) |

---

## 📦 Deployment Guide

### Frontend (Vercel)
The frontend is a Vite-based SPA.
1. Connect repo to Vercel.
2. Set Environment Variable: `VITE_API_URL` to your production backend URL.
3. Deploy!

### Backend (Render.com)
The backend is a FastAPI server.
1. Connect repo to Render.com (Root: `backend`).
2. Set Environment Variables for DB credentials and Supabase keys (see `.env.example`).
3. Deploy!

---

## 🧑‍💻 Local Setup

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## 🖇️ Links
- **Figma Design**: [Original Mockups](https://www.figma.com/design/GOZ5ASDLk9GAMOVh9P3eYv/AI-Interview-Scheduler-Design-Implementation)
- **Repo**: [GitHub: Vish-rut/NerveSense-AI](https://github.com/Vish-rut/NerveSense-AI)

---

Developed with ❤️ for the future of AI-driven recruitment.