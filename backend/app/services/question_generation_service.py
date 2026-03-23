"""
Question generation service — hybrid approach (templates only for now).

Uses template banks for each interview type, with question distribution
based on interview duration and selected types (guide Section 7-8).
"""

import random
from dataclasses import dataclass


@dataclass
class GeneratedQuestion:
    question_text: str
    question_type: str
    order_index: int
    expected_time_seconds: int


# ─── Question Template Banks ──────────────────────────────────────────────────
# Each type has a pool of templates. {position} is replaced with the job title.

QUESTION_TEMPLATES: dict[str, list[str]] = {
    "technical": [
        "Describe your experience with the core technologies relevant to {position}. What complex projects have you worked on?",
        "Explain a challenging technical problem you solved in a previous role. What was your approach and the outcome?",
        "How do you ensure code quality and maintainability in your projects? Describe your testing and review practices.",
        "Walk me through how you would design a scalable system for a high-traffic application relevant to this role.",
        "What is your experience with version control, CI/CD pipelines, and deployment strategies?",
        "How do you approach debugging complex issues in production? Can you give a specific example?",
        "Describe your experience with APIs — both building and consuming them. What best practices do you follow?",
        "What tools and frameworks are you most proficient in for this {position} role? How do you stay current?",
        "How do you handle database design and optimization? Describe a schema you designed.",
        "Explain a time when you had to learn a new technology quickly to deliver a project. How did you approach it?",
    ],
    "behavioral": [
        "Tell me about a time you had a conflict with a team member. How did you resolve it?",
        "Describe a situation where you had to meet a very tight deadline. How did you manage your time?",
        "Give an example of when you took initiative on a project without being asked.",
        "Tell me about a time you received critical feedback. How did you respond?",
        "Describe a situation where you had to adapt to a significant change at work.",
        "How do you handle multiple competing priorities? Give a specific example.",
        "Tell me about a time you made a mistake at work. What did you learn from it?",
        "Describe a situation where you had to persuade others to adopt your approach.",
    ],
    "problem-solving": [
        "Describe a complex problem you faced in your last role. Walk me through your problem-solving process.",
        "How would you approach optimizing a slow-performing feature in an application relevant to {position}?",
        "Given a scenario where a critical system goes down, what steps would you take to diagnose and fix the issue?",
        "Describe a time when you had to find a creative solution with limited resources.",
        "How do you break down a large, ambiguous problem into manageable pieces?",
        "Walk me through how you would approach building a feature from scratch with unclear requirements.",
    ],
    "leadership": [
        "Describe your experience leading a team or project. What was your leadership style?",
        "How do you motivate team members who are struggling or disengaged?",
        "Tell me about a decision you made that was unpopular. How did you handle the pushback?",
        "How do you handle delegation? Describe a time you had to trust someone else with a critical task.",
        "What's your approach to mentoring junior developers or team members?",
    ],
    "experience": [
        "Walk me through your career journey and what led you to apply for {position}.",
        "What's the most impactful project you've worked on? What was your specific contribution?",
        "Describe your experience working in a team environment. What role do you typically take?",
        "What industry domains have you worked in, and how does that experience relate to this role?",
        "Tell me about a project you're most proud of and why.",
    ],
}


def _get_question_distribution(
    interview_types: list[str],
    total_questions: int,
) -> dict[str, int]:
    """
    Distribute questions across interview types based on guide Section 7 logic.
    Prioritizes Technical, then spreads evenly.
    """
    if not interview_types:
        interview_types = ["technical"]

    distribution: dict[str, int] = {}
    remaining = total_questions

    # Give Technical a slight weight advantage if present
    if "technical" in interview_types and len(interview_types) > 1:
        tech_count = max(1, total_questions * 40 // 100)
        distribution["technical"] = tech_count
        remaining -= tech_count
        other_types = [t for t in interview_types if t != "technical"]
    else:
        other_types = list(interview_types)

    # Distribute remaining evenly
    if other_types:
        per_type = max(1, remaining // len(other_types))
        for i, t in enumerate(other_types):
            count = per_type if i < len(other_types) - 1 else remaining
            distribution[t] = count
            remaining -= count
    elif remaining > 0:
        distribution["technical"] = distribution.get("technical", 0) + remaining

    return distribution


def _get_question_count_from_duration(duration_minutes: int) -> int:
    """Estimate question count from interview duration."""
    if duration_minutes <= 15:
        return 5
    elif duration_minutes <= 30:
        return 8
    elif duration_minutes <= 45:
        return 10
    else:
        return 12


def generate_questions(
    job_position: str,
    job_description: str | None,
    interview_types: list[str],
    duration_minutes: int,
    number_of_questions: int | None = None,
) -> list[GeneratedQuestion]:
    """
    Generate interview questions using template-based approach.

    Returns a list of GeneratedQuestion objects ready to be stored.
    """
    # Determine total question count
    total = number_of_questions or _get_question_count_from_duration(duration_minutes)

    # Normalize type names
    normalized_types = [t.lower().replace(" ", "-") for t in interview_types]
    valid_types = [t for t in normalized_types if t in QUESTION_TEMPLATES]
    if not valid_types:
        valid_types = ["technical"]

    # Get distribution
    distribution = _get_question_distribution(valid_types, total)

    # Pick questions
    questions: list[GeneratedQuestion] = []
    order = 0
    time_per_question = max(60, (duration_minutes * 60) // total)

    for q_type, count in distribution.items():
        templates = QUESTION_TEMPLATES.get(q_type, QUESTION_TEMPLATES["technical"])
        selected = random.sample(templates, min(count, len(templates)))

        for template in selected:
            text = template.replace("{position}", job_position)
            questions.append(
                GeneratedQuestion(
                    question_text=text,
                    question_type=q_type.replace("-", " ").title(),
                    order_index=order,
                    expected_time_seconds=time_per_question,
                )
            )
            order += 1

    # Shuffle to mix types for a natural interview feel
    random.shuffle(questions)
    for i, q in enumerate(questions):
        q.order_index = i

    return questions
