#!/usr/bin/env python3
"""Build CAT's data files from the hand-authored level modules.

Each question is authored as (code, difficulty, stem, correct, [3 distractors],
explanation, topic). The builder places the correct answer at a balanced index so
the answer key is not predictable, then re-validates the whole bank so no
malformed or under-specified question can ship.

CAT teaches Kansas property and casualty insurance concepts. Questions are
written in CAT's own words; they name the idea being tested (the "topic") rather
than citing any source document.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import level1, level2, level3, level4, level5, level6, level7, level8, level9  # noqa: E402

LEVELS = [m.LEVEL for m in (level1, level2, level3, level4, level5,
                            level6, level7, level8, level9)]

# Balanced answer-key rotation: each index appears three times per 12 questions.
ANSWER_PATTERN = [1, 3, 0, 2, 0, 2, 3, 1, 2, 0, 3, 1]

MASTERY_THRESHOLD = 80
QUESTIONS_PER_LESSON = 10
LESSON_TIMER_SECONDS = 600
QUESTION_TIMER_SECONDS = 60
ATTACK_MIN_SECONDS = 0
ATTACK_MAX_SECONDS = 60
ATTACK_BASE_CHANCE = 10
ATTACK_PER_LEVEL = 10
EXAM_QUESTIONS = 156
EXAM_MINUTES = 150

# CAT starts the journey young and grows up once enough lessons are mastered.
ADULT_AT_LESSON = 14

SUBJECT = "Kansas Property & Casualty Insurance"

# Text that would betray a source document. The bank must never name one.
FORBIDDEN = ("manual p", "pdf p", "training manual", "pre-study guide")


# Difficulty must rise level by level. Each level is given a target average, and the authored
# relative difficulty inside that level decides which questions carry the higher value. That keeps
# the curve strictly increasing while each lesson still mixes easier and harder questions.
TARGET_MEANS = [1.4, 1.8, 2.2, 2.5, 2.8, 3.1, 3.5, 3.9, 4.3]


def level_difficulty_values(level):
    slots = [(q[1], li, qi)
             for li, lesson in enumerate(level["lessons"])
             for qi, q in enumerate(lesson["qs"])]
    n = len(slots)
    target = TARGET_MEANS[level["n"] - 1]
    total = int(round(target * n))
    base = max(1, total // n)
    extra = total - base * n
    order = sorted(range(n), key=lambda i: (slots[i][0], slots[i][1], slots[i][2]))
    values = [base] * n
    for i in order[n - extra:]:
        values[i] = base + 1
    return values


def build():
    levels_out = []
    questions = []
    q_counter = 0
    lesson_counter = 0

    for level in LEVELS:
        difficulty_values = level_difficulty_values(level)
        difficulty_index = 0
        lessons_out = []
        for lesson in level["lessons"]:
            lesson_counter += 1
            lesson_id = lesson_counter
            qids = []
            for q in lesson["qs"]:
                code, diff, stem, correct, wrongs, expl, topic = q
                slot = ANSWER_PATTERN[q_counter % len(ANSWER_PATTERN)]
                q_counter += 1
                qid = "q%03d" % q_counter
                opts = []
                wi = 0
                for i in range(4):
                    if i == slot:
                        opts.append(correct)
                    else:
                        opts.append(wrongs[wi])
                        wi += 1
                questions.append({
                    "id": qid,
                    "lessonId": lesson_id,
                    "code": code,
                    "stem": stem,
                    "options": opts,
                    "answer": slot,
                    "explanation": expl,
                    "topic": topic,
                    "difficulty": difficulty_values[difficulty_index],
                })
                difficulty_index += 1
                qids.append(qid)
            lessons_out.append({
                "id": lesson_id,
                "levelId": level["n"],
                "title": lesson["title"],
                "subtitle": lesson["subtitle"],
                "questionIds": qids,
                "intro": lesson["intro"],
                "teaching": [{"heading": h, "text": t} for h, t in lesson["teaching"]],
                "scenario": {"title": lesson["scenario"][0], "text": lesson["scenario"][1]},
            })
        levels_out.append({
            "id": level["n"],
            "title": level["title"],
            "tagline": level["tagline"],
            "color": level["color"],
            "lessons": lessons_out,
        })

    # Exam blueprint: every lesson contributes 5 or 6 questions, totalling 156.
    counts = []
    remaining = EXAM_QUESTIONS
    for i in range(lesson_counter):
        left = lesson_counter - i
        take = remaining // left
        counts.append(take)
        remaining -= take

    curriculum = {
        "title": "CAT's Insurance Journey",
        "subject": SUBJECT,
        "masteryThreshold": MASTERY_THRESHOLD,
        "questionsPerLesson": QUESTIONS_PER_LESSON,
        "lessonTimerSeconds": LESSON_TIMER_SECONDS,
        "questionTimerSeconds": QUESTION_TIMER_SECONDS,
        "adultAtLesson": ADULT_AT_LESSON,
        "attackTime": {
            "minSeconds": ATTACK_MIN_SECONDS,
            "maxSeconds": ATTACK_MAX_SECONDS,
            "baseChancePercent": ATTACK_BASE_CHANCE,
            "chancePerLevelPercent": ATTACK_PER_LEVEL,
            "note": "A rival may challenge CAT during a lesson. The chance rises from 10% at level 1 to 90% at level 9, and a challenge can cost up to a minute of the lesson clock. The final exam has no challenges.",
        },
        "story": [
            "CAT was a backyard alley cat in the country, and she survived on human scraps. Every winter tested her - cold nights, empty bowls, and whatever the households left behind - and she lived through each one on scraps and stubbornness.",
            "Other cats found her along the way, and they tested her. Not with claws: with insurance knowledge. Property and casualty rules, Kansas style - which promise answers for which loss, and what happens when the clock runs out. Losing an argument stung worse than losing a fight, so she learned the rules cold.",
            "For a long time her only goal was survival. Then one day she saw the red car, and the goal changed. She would leave with that car. Everything after that night was practice for the road out.",
            "Nine levels stand between the backyard and the road: twenty-seven lessons, ten questions each, a ten minute clock and sixty seconds to a question. At every stop a rival cat waits to argue with her, and when the clock runs out they may strike and steal seconds from the lesson.",
            "At the very end waits the only challenger left: SHADOW CAT, her own shadow - everything survival taught her, turned around and looking back. One hundred fifty-six questions in one hundred fifty minutes, and no tricks at all.",
            "Win, and the mother who drives the red car brings her home. That is how CAT becomes the cardboard box tower queen - and only after that does a small black cat named BAT come into the story at all.",
        ],
        "levels": levels_out,
        "exam": {
            "questionCount": EXAM_QUESTIONS,
            "minutes": EXAM_MINUTES,
            "passPercent": MASTERY_THRESHOLD,
            "noAttacks": True,
            "lessonCounts": counts,
        },
        "boss": {
            "title": "The Shadow at the End of Level Nine",
            "intro": "Nine levels are behind CAT, and the red car is idling at the edge of town. Between them stands the last challenger: SHADOW CAT, her own shadow - everything survival taught her, turned around and looking back.",
            "dialogue": "You learned the rules to survive the alley. Now show me you can use them when nothing is chasing you and no clock is playing tricks.",
            "win": "SHADOW CAT steps aside. It was never an enemy, only the part of CAT that had nowhere to go. And down the road the red car is waiting, with the mother who will bring her home.",
            "lose": "SHADOW CAT holds its ground. Not a defeat, only another round: the rules are still there to be learned, and the red car will still be waiting next time.",
        },
    }

    return curriculum, questions


def validate(curriculum, questions):
    errors = []

    def check(cond, msg):
        if not cond:
            errors.append(msg)

    levels = curriculum["levels"]
    lessons = [l for lv in levels for l in lv["lessons"]]

    check(len(levels) == 9, "expected 9 levels, found %d" % len(levels))
    check(all(len(lv["lessons"]) == 3 for lv in levels), "each level must have 3 lessons")
    check(len(lessons) == 27, "expected 27 lessons, found %d" % len(lessons))
    check(len(questions) == 270, "expected 270 questions, found %d" % len(questions))
    check(sum(curriculum["exam"]["lessonCounts"]) == curriculum["exam"]["questionCount"],
          "exam blueprint must total the exam question count")

    ids = [q["id"] for q in questions]
    check(len(set(ids)) == len(ids), "duplicate question ids")

    for lesson in lessons:
        check(len(lesson["questionIds"]) == 10,
              "lesson %d must have exactly 10 questions" % lesson["id"])
        check(len(lesson["teaching"]) == 3, "lesson %d must have 3 teaching sections" % lesson["id"])
        check(len(lesson["scenario"]["text"]) >= 200,
              "lesson %d scenario is too short" % lesson["id"])

    by_id = {q["id"]: q for q in questions}
    for lesson in lessons:
        for qid in lesson["questionIds"]:
            check(qid in by_id, "lesson %d references missing question %s" % (lesson["id"], qid))
            if qid in by_id:
                check(by_id[qid]["lessonId"] == lesson["id"],
                      "question %s is attached to the wrong lesson" % qid)

    dist = [0, 0, 0, 0]
    for q in questions:
        check(len(q["options"]) == 4, "%s needs 4 options" % q["id"])
        check(len(set(q["options"])) == 4, "%s has duplicate options" % q["id"])
        check(isinstance(q["answer"], int) and 0 <= q["answer"] <= 3,
              "%s has an invalid answer index" % q["id"])
        check(bool(q["explanation"]), "%s needs an explanation" % q["id"])
        check(bool(q["topic"]), "%s needs a topic label" % q["id"])
        check(isinstance(q["difficulty"], int) and 1 <= q["difficulty"] <= 5,
              "%s has an invalid difficulty" % q["id"])
        if 0 <= q["answer"] <= 3:
            dist[q["answer"]] += 1

    for i, n in enumerate(dist):
        share = n / float(len(questions))
        check(0.15 <= share <= 0.35,
              "answer key position %s is unbalanced (%.1f%%)" % ("ABCD"[i], share * 100))

    # Difficulty must increase from level to level, with the early levels kept accessible.
    means = []
    for lv in levels:
        ds = [by_id[qid]["difficulty"] for l in lv["lessons"] for qid in l["questionIds"]]
        means.append(sum(ds) / float(len(ds)))
    for i in range(len(means) - 1):
        check(means[i] < means[i + 1],
              "difficulty must increase from level %d to %d (%.2f vs %.2f)"
              % (i + 1, i + 2, means[i], means[i + 1]))
    check(max(by_id[qid]["difficulty"] for l in levels[0]["lessons"] for qid in l["questionIds"]) <= 3,
          "level 1 must stay within the accessible difficulties")
    check(any(by_id[qid]["difficulty"] >= 4 for l in levels[-1]["lessons"] for qid in l["questionIds"]),
          "level 9 must contain applied, higher-difficulty questions")

    # Nothing may betray a source document: no manual names, page citations, or PDF references.
    blob_parts = []
    for q in questions:
        blob_parts.extend([q["stem"], q["explanation"], q["topic"]] + q["options"])
    for lesson in lessons:
        blob_parts.extend([lesson["title"], lesson["subtitle"], lesson["intro"],
                           lesson["scenario"]["title"], lesson["scenario"]["text"]])
        for t in lesson["teaching"]:
            blob_parts.extend([t["heading"], t["text"]])
    blob = " ".join(blob_parts).lower()
    for bad in FORBIDDEN:
        check(bad not in blob, "content references a source document ('%s')" % bad)

    return errors, dist, means


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    curriculum, questions = build()
    errors, dist, means = validate(curriculum, questions)
    if errors:
        for e in errors:
            print("VALIDATION ERROR:", e)
        return 1
    with open(os.path.join(root, "data", "curriculum.json"), "w") as fh:
        json.dump(curriculum, fh, indent=1)
        fh.write("\n")
    with open(os.path.join(root, "data", "questions.json"), "w") as fh:
        json.dump(questions, fh, indent=1)
        fh.write("\n")
    print("Built %d levels, %d lessons, %d questions." % (
        len(curriculum["levels"]),
        sum(len(lv["lessons"]) for lv in curriculum["levels"]),
        len(questions)))
    print("Answer key distribution (A/B/C/D): %s" % dist)
    print("Difficulty by level: %s" % " ".join("%.2f" % m for m in means))
    print("Exam blueprint: %d questions across %d lessons." % (
        sum(curriculum["exam"]["lessonCounts"]), len(curriculum["exam"]["lessonCounts"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
