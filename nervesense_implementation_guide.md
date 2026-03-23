NerveSenseAI — Real-Time Multimodal Interview Analysis Implementation Plan
1. Product goal

Build an AI interview platform where:

recruiter creates an interview

candidate joins through a secure link

AI voice agent conducts the interview

candidate is analyzed during the live session

recruiter gets a live-updating nervousness/performance report

final report is ready immediately when the interview ends

system stores structured metrics, transcripts, and events, not the full interview video by default

This product is not a post-processing video analysis app.
It is a real-time interview analytics system.

2. Core product philosophy

Design the system around these rules:

Rule 1 — Live analysis is the main path

All major nervousness and communication metrics should be computed while the interview is happening.

Rule 2 — Backend is the source of truth

The voice agent can ask questions, but your backend controls:

question order

session state

timestamps

metric aggregation

report generation

Rule 3 — Store features, not full media

Do not depend on uploading a full interview recording after the session.
Instead store:

transcript

question timeline

frame-level or window-level facial features

audio features

behavioral event counts

per-question summaries

final report JSON

Rule 4 — Use streaming windows

Analyze audio and video in short windows like:

video: every 200–500 ms

audio: every 1–2 seconds

transcript updates: live or near live

Rule 5 — Make the report explainable

Only show metrics you can calculate consistently and explain clearly to the recruiter.

3. What the final product should do
Recruiter side

create interview

enter job position, job description, interview type, duration

generate tailored questions before the interview starts

create candidate link

watch interview status live

view live nervousness dashboard during the interview

view final report immediately after interview ends

export JSON / CSV / PDF

Candidate side

open secure interview link

join interview page only

allow camera + microphone

interact with AI interviewer by voice

answer questions in real time

get analyzed live without waiting for post-upload processing

4. Report design the system must support

Your report UI already suggests the exact analytics shape.

The system should produce these live and final sections:

Facial metrics

eye contact

gaze steadiness

head stability

smile / neutrality balance

brow relaxation / tension proxy

jaw relaxation / tension proxy

Vocal metrics

average WPM

speaking pace over time

filler word count

filler frequency over time

pause / hesitation patterns

Behavioral metrics

fidgets

posture shifts

self-touch incidents

incidents by question

nervousness timeline

Summary outputs

overall nervousness score

confidence score

per-question nervousness score

improvement tips

short recruiter-friendly summary

5. Correct architecture for your product

Build the backend as these modules:

Module A — Interview Management

Handles:

recruiter auth

interview creation

question generation

interview metadata

secure link generation

Module B — Live Interview Orchestrator

Handles:

candidate session start

question progression

current question index

timestamps

session state

Vapi coordination

Module C — Live Media Ingestion

Handles:

live audio chunks

live video frames or reduced-rate frame stream

websocket / WebRTC ingestion

routing streams to analyzers

Module D — Real-Time Analysis Engine

Handles:

live transcription

live vocal feature extraction

live facial feature extraction

live behavioral event detection

rolling feature windows

Module E — Fusion and Scoring Engine

Handles:

normalization

metric smoothing

per-question score calculation

overall nervousness / confidence scoring

timeline building

Module F — Live Report Engine

Handles:

dashboard state updates

chart data updates

final report JSON

tips generation

export generation

6. High-level live data flow
Recruiter flow

Recruiter creates interview

Backend generates questions

Backend stores questions

Backend creates secure interview link

Recruiter can monitor interview status

During interview, recruiter dashboard receives live analytics updates

At end, recruiter gets final report instantly

Candidate flow

Candidate opens secure interview link

Backend validates token

Candidate joins AI interview screen

Vapi asks question

Candidate answers

Frontend streams:

microphone audio chunks

camera frames at controlled rate

timing events

Backend analyzes live

Backend updates per-question and overall scores

Dashboard updates in real time

When interview ends, final report is already mostly ready

7. The most important design decision

Do not stream full raw video continuously for storage.

Instead use this model:

What the frontend sends

low-rate video frames for analysis only

compressed audio chunks

transcript events

session/question timing events

What backend stores

extracted features

aggregated metrics

event counts

transcript text

report-ready data

What backend may optionally store

short evidence clips only when needed

small snapshots for QA/debugging

temporary rolling buffer with auto-delete

This reduces storage cost and lets you finish the report immediately.

8. Real-time interview pipeline
Step 1 — Interview is created before session

Questions must still be generated before the live interview.
That is the right decision.

Store:

question id

question text

type

order

expected answer duration

follow-up allowed

Step 2 — Candidate joins live session

Frontend does:

camera permission

mic permission

websocket or WebRTC connection to backend

Vapi session start

Step 3 — Question starts

Backend marks:

question_id

asked_at

question_start_time

Step 4 — Candidate answer begins

Frontend and backend detect:

first speech timestamp

answer_started_at

Step 5 — Live streaming begins

Frontend streams:

audio chunks every 1–2 seconds

video frames every 200–500 ms or 3–5 fps

optional face landmarks client-side if you later optimize

Step 6 — Real-time analyzers process windows

Audio analyzer computes:

WPM

pause count

speech energy variation

pitch variability

filler words

hesitation signals

Video analyzer computes:

eye contact estimate

gaze shift frequency

blink rate

head movement

posture movement

self-touch candidate events

fidget score

Step 7 — Fusion engine updates live state

Backend aggregates features into:

current question metrics

current nervousness score

rolling interview-wide score

chart timelines

Step 8 — Recruiter dashboard updates

Recruiter sees live:

current question

score trend

pace trend

filler count

behavioral incidents

nervousness timeline

Step 9 — Question completes

Backend stores final per-question summary.

Step 10 — Interview ends

Backend finalizes:

final metric aggregation

summary

tips

report JSON

export availability

No heavy post-upload pipeline should be required for MVP.

9. Recommended streaming strategy

Use streaming windows, not full continuous uploads.

Video

Send:

3 to 5 fps for analysis

resolution around 360p or 480p

enough for face and upper-body posture

no need for full HD

This is enough for:

eye contact

head stability

posture shifts

self-touch approximation

fidget detection

Audio

Send:

1–2 second chunks

mono compressed stream

enough for transcript + voice features

Why this works

You do not need cinema-quality media.
You need enough signal to extract behavior features reliably.

10. Best technical architecture for real-time analysis
Frontend

Next.js or React

WebRTC or WebSocket stream handling

MediaDevices API for camera and mic

Vapi client integration

recruiter live dashboard with Recharts

Backend API

FastAPI

Real-time transport

Choose one of these:

Simpler first version

WebSocket for sending audio chunks, frame blobs, and events

Stronger long-term version

WebRTC for media streaming

WebSocket for control + metrics events

For your first serious build, a good practical direction is:

use WebSocket for events and analysis messages

send sampled frames and audio chunks through controlled upload stream

keep the system simpler before going deep into full media server architecture

Database

PostgreSQL

Cache / real-time state

Redis

Background jobs

Celery or RQ

but only for non-blocking tasks like exports and optional delayed summaries

not for the main live scoring loop

11. AI interviewer design

Vapi should be used for voice delivery, not full business control.

Vapi should do

ask the current question

listen to the candidate

return transcript events

optionally handle short clarifications

Your backend should do

choose the next question

decide when answer is complete

store timings

trigger scoring updates

trigger follow-up prompts

end the interview

This rule is critical.

12. Real-time analysis engine design

Build the live analysis engine as 3 sub-engines.

A. Live transcript and vocal analysis

Input:

audio chunk stream

transcript events

Output:

current transcript

WPM

filler count

pause ratio

hesitation score

pace timeline

confidence of transcription

B. Live facial analysis

Input:

sampled video frames

Output:

face detected

eye contact proxy

gaze direction stability

blink rate

head pose stability

smile/neutral ratio

brow tension proxy

jaw tension proxy

C. Live behavioral analysis

Input:

sampled frames

pose landmarks

Output:

posture shift count

shoulder movement instability

hand-to-face events

fidget score

body movement variance

13. How to implement the analyzers in a realistic MVP

Do not train large custom models first.

Use feature extraction + rules + weighted scoring.

Video tools

MediaPipe Face Mesh

MediaPipe Pose

OpenCV

Audio tools

faster-whisper or streaming ASR

librosa

webrtcvad or equivalent voice activity detection

Why this is right

You need a system that is:

buildable

fast enough for live use

explainable

easy to debug

14. Real-time scoring model

Create 3 rolling category scores.

facial_nervousness

Based on:

low eye contact

unstable gaze

high blink rate

high head instability

elevated tension proxies

vocal_nervousness

Based on:

filler words

abnormal speaking pace

long pauses

hesitation patterns

frequent restarts

behavioral_nervousness

Based on:

posture shifts

self-touch events

fidget level

body instability

final score

Use weighted fusion.

Example:

facial: 35%

vocal: 30%

behavioral: 35%

Then:

overall_nervousness = weighted total

confidence_score = inverse or derived score

Do not make the score jump wildly.
Use smoothing over rolling windows.

15. How to make scores stable during a live interview

Live systems often look noisy unless you smooth them.

Use:

rolling window aggregation

exponential smoothing

per-question baselines

threshold-based incident counting

Example:

compute raw metrics every second

smooth them over last 5–10 seconds

update recruiter dashboard every 2–3 seconds

This makes the UI feel intelligent instead of jittery.

16. Question-wise analysis design

This is required by your report structure.

For each question store:

question_id

asked_at

answer_started_at

answer_ended_at

transcript_text

answer_duration

avg_wpm

filler_count

pause_ratio

eye_contact_score

gaze_stability

head_stability

posture_shift_count

self_touch_count

fidget_score

nervousness_score

short feedback note

This will power:

incidents by question

nervousness timeline

improvement tips

final recruiter summary

17. How the recruiter live dashboard should work

The recruiter dashboard should show live values, but not update too aggressively.

Update every 2–3 seconds.

Show:

current question

candidate speaking or silent

avg WPM

filler words

eye contact trend

posture/self-touch incidents

overall nervousness trend

per-question status

At interview end:

freeze the live values

finalize report JSON

show complete charts immediately

18. Storage strategy to reduce cost

Since you do not want full interview upload and storage, use this storage plan.

Store permanently

interview metadata

questions

transcript

per-question metrics

timeline points

aggregated scores

behavioral event logs

final report JSON

exports

Store temporarily

rolling frame/audio buffers for short fault recovery

optional last 30–60 seconds of media in temp storage

Optional feature flag

Allow interview recording only when recruiter enables it.

This gives you:

lower storage cost

faster final report

more privacy-friendly system

19. Data model you should build
users

id

name

email

role

created_at

interviews

id

recruiter_id

job_position

job_description

duration_minutes

status

access_token

expires_at

created_at

interview_types

id

interview_id

type_name

interview_questions

id

interview_id

question_text

question_type

order_index

expected_time_seconds

follow_up_allowed

created_at

candidates

id

interview_id

name

email

status

joined_at

completed_at

interview_sessions

id

interview_id

candidate_id

started_at

ended_at

session_status

current_question_index

live_report_status

final_report_ready

question_responses

id

session_id

question_id

question_start_time

answer_start_time

answer_end_time

transcript_text

transcript_confidence

live_audio_metrics

id

session_id

question_id

window_started_at

window_ended_at

wpm

filler_count

pause_ratio

hesitation_score

energy_variation

pitch_variation

live_video_metrics

id

session_id

question_id

window_started_at

window_ended_at

eye_contact_score

gaze_shift_rate

blink_rate

head_stability_score

smile_ratio

brow_tension_score

jaw_tension_score

live_behavior_metrics

id

session_id

question_id

window_started_at

window_ended_at

posture_shift_count

self_touch_count

fidget_score

body_motion_variance

question_analysis

id

session_id

question_id

confidence_score

nervousness_score

eye_contact_score

speaking_rate

filler_word_count

posture_shift_count

self_touch_count

notes_json

analysis_results

id

session_id

overall_confidence_score

overall_nervousness_score

facial_score

vocal_score

behavioral_score

summary_text

generated_at

report_exports

id

session_id

export_type

file_url

created_at

20. API design
Recruiter APIs
create interview

POST /api/interviews

get interview details

GET /api/interviews/{interview_id}

list recruiter interviews

GET /api/interviews

get questions

GET /api/interviews/{interview_id}/questions

create link

POST /api/interviews/{interview_id}/link

get live session state

GET /api/interviews/{interview_id}/live-status

get live report

GET /api/reports/{session_id}/live

get final report

GET /api/reports/{session_id}

export report

GET /api/reports/{session_id}/export?type=pdf
GET /api/reports/{session_id}/export?type=csv
GET /api/reports/{session_id}/export?type=json

Candidate APIs
validate link

GET /api/public/interview/{token}

start session

POST /api/public/interview/{token}/start

send live event

POST /api/public/session/{session_id}/event

start question

POST /api/public/session/{session_id}/question/{question_id}/start

complete question

POST /api/public/session/{session_id}/question/{question_id}/complete

finish interview

POST /api/public/session/{session_id}/finish

get current state

GET /api/public/session/{session_id}/state

Real-time channels
candidate websocket

/ws/session/{session_id}/stream
Used for:

audio chunks

video frame packets

speech state events

face-detected events

recruiter websocket

/ws/recruiter/session/{session_id}/live-report
Used for:

score updates

timeline updates

incident updates

question progression

21. Backend services structure
interview_service

create interview

save interview data

create secure link

question_generation_service

generate tailored questions

save them before interview starts

session_service

start session

maintain question state

finish session

vapi_service

configure AI interviewer

send current question

process transcript / response events

stream_ingestion_service

receive audio/video/event stream

validate packet structure

push windows into analysis pipeline

audio_analysis_service

transcription

WPM

filler detection

pause metrics

hesitation metrics

video_analysis_service

face mesh

eye contact

head pose

gaze shifts

smile/tension proxies

behavior_analysis_service

posture shifts

hand-to-face detection

fidget scoring

scoring_service

normalize features

compute per-window scores

compute per-question scores

compute overall scores

live_report_service

update dashboard state

build chart points

store final report JSON

export_service

PDF

CSV

JSON

22. Recommended folder structure
backend/
  app/
    main.py
    api/
      routes/
        interviews.py
        public_interview.py
        reports.py
        exports.py
        live_ws.py
    core/
      config.py
      security.py
      realtime.py
    db/
      session.py
      models.py
      migrations/
    schemas/
      interview.py
      session.py
      stream.py
      report.py
    services/
      interview_service.py
      question_generation_service.py
      session_service.py
      vapi_service.py
      stream_ingestion_service.py
      audio_analysis_service.py
      video_analysis_service.py
      behavior_analysis_service.py
      scoring_service.py
      live_report_service.py
      export_service.py
    realtime/
      websocket_manager.py
      event_bus.py
      redis_pubsub.py
    ml/
      audio/
        transcription.py
        vocal_features.py
      video/
        facial_features.py
        pose_features.py
        behavioral_features.py
      fusion/
        score_calculator.py
        smoothing.py
        tips_generator.py
    templates/
      report.html
    static/
      report.css

23. Best implementation path for the live analysis model

Build in layers.

Version 1 — real-time usable core

Include:

interview creation

question generation

secure candidate link

Vapi interview flow

live transcript

live WPM

filler count

pause ratio

simple eye contact

simple posture shift

live report updates

final report JSON

This is your first strong real-time MVP.

Version 2 — stronger multimodal analysis

Add:

gaze stability

head stability

blink rate

self-touch detection

fidget score

per-question tips

nervousness timeline smoothing

Version 3 — advanced system

Add:

better tension proxies

more reliable hand-to-face classification

stronger follow-up logic

calibration by interview type

confidence intervals for metrics

benchmark comparisons across sessions

24. How to implement nervousness timeline

Your UI includes a nervousness timeline.
This should come from per-question or per-time-window scores.

Recommended method:

compute a nervousness score every 5 seconds

smooth it

assign color/status bands:

low

moderate

elevated

Also keep question-level tags:

Q1 moderate

Q2 elevated

Q3 stable

Q4 elevated

Q5 stable

That will directly power the timeline blocks in your UI.

25. How to implement behavioral incidents by question

For each question, count:

posture shifts

self-touch incidents

fidgets

Then store them as grouped values per question.

This directly powers the bar chart:

Q1 counts

Q2 counts

Q3 counts

Q4 counts

Q5 counts

26. How to generate improvement tips

Use rule-based evidence first.

Example rules

high filler words → “Use silent pauses instead of filler words.”

high WPM spikes → “Slow down during complex answers.”

repeated posture shifts → “Try to keep your upper body centered.”

increased self-touch → “Keep your hands resting naturally between gestures.”

low eye contact → “Practice answering while focusing near camera level.”

Best approach:

detect issue patterns

map them to readable tips

attach severity

link to question ids

This is much better than vague AI advice.

27. PDF generation strategy

Your report should still be generated from HTML, not screenshots.

Use:

Jinja2 template

report JSON

dedicated print CSS

WeasyPrint

Even though analysis is live, PDF generation should still happen from structured report data.

That gives:

clean layout

fast export

no browser distortion

charts and sections that match your UI structure

28. Security and privacy design

Since you want less storage, that helps privacy too.

Must-have rules:

HTTPS only

signed interview tokens

candidate access limited to interview page

recruiter-only report access

raw stream packets not stored permanently by default

temp buffers auto-expire

retention policy for transcripts and metrics

audit logs without sensitive raw media leakage

Also be careful with product wording:
describe outputs as:

communication confidence insights

nervousness indicators

behavior analytics

Do not present them as final truth or hiring decision certainty.

29. Practical performance rules

To keep the system fast enough:

analyze video at sampled rate, not every frame

analyze audio in chunks, not as full continuous waveform processing

smooth scores before UI updates

send dashboard updates every 2–3 seconds, not every event

keep feature extraction lightweight for MVP

use Redis for live state and pub/sub

store aggregated metrics in batches

30. Recommended deployment setup
Frontend

Vercel

Backend

FastAPI service on Render / Railway / ECS / EC2

Database

managed PostgreSQL

Cache / pubsub

Redis

Object storage

S3 or MinIO

mostly for exports and optional evidence snippets

not for mandatory full interview videos

Workers

background workers only for:

PDF generation

CSV generation

optional delayed summary jobs

optional QA clip storage

31. Realistic MVP definition for your actual vision

A real-time MVP should include:

recruiter creates interview

backend generates tailored questions

candidate joins with secure link

Vapi conducts interview

frontend streams audio + sampled video frames live

backend computes live vocal, facial, and behavioral metrics

recruiter sees live nervousness dashboard

backend stores structured metrics instead of full interview video

final report is ready immediately when session ends

JSON / CSV / PDF export works

That is the right MVP for your ambition.

32. Common mistakes to avoid
Mistake 1

Building the system around full video upload and post-processing.

Mistake 2

Streaming too much raw media and creating huge storage cost.

Mistake 3

Letting Vapi control the entire interview flow.

Mistake 4

Trying to train custom deep models before feature-based live analysis works.

Mistake 5

Updating the dashboard too frequently and making it noisy.

Mistake 6

Showing metrics that are not actually reliable.

Mistake 7

Skipping precise question timestamps.
Without them your charts and per-question analysis will become messy.

33. Final build direction

If this product were being built from scratch for your exact goal, the direction would be:

build interview creation and question generation

build secure candidate interview flow

integrate Vapi with backend-controlled question progression

build live audio/video streaming pipeline

build real-time vocal analyzer

build real-time facial analyzer

build real-time behavioral analyzer

build rolling scoring and smoothing engine

build recruiter live dashboard

finalize report JSON at interview end without full video upload

generate PDF/CSV/JSON from structured report data

add optional evidence storage only when needed

34. Very short workflow summary for your AI IDE

You can give this to your AI IDE as the system workflow:

NerveSenseAI is a real-time AI interview platform.
Questions are generated before the interview.
The candidate joins using a secure public link.
Vapi conducts the interview, but the backend controls question order and session state.
During the interview, the frontend streams audio chunks and sampled video frames to the backend.
The backend performs live transcription, vocal analysis, facial analysis, and behavioral analysis in rolling windows.
It stores structured features, incidents, transcripts, and per-question metrics instead of storing the full interview video by default.
A fusion engine computes facial, vocal, behavioral, and overall nervousness scores in real time.
The recruiter dashboard receives live score and chart updates during the interview.
When the interview ends, the system finalizes the report immediately from the already collected metrics and generates JSON, CSV, and PDF exports from structured report data.