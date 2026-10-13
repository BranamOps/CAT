#!/usr/bin/env python3
"""Build CAT's data files from the hand-authored level modules.

Each question is authored as (code, difficulty, stem, correct, [3 distractors],
explanation, manual_page, pdf_page). The builder places the correct answer at a
balanced index so the answer key is not predictable, then re-validates the whole
bank so no unsourced or malformed question can ship.
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


def source_label(manual_page, pdf_page):
    multi = any(ch in manual_page for ch in ",-") or any(ch in pdf_page for ch in ",-")
    mark = "pp." if multi else "p."
    return "Manual %s %s (PDF %s %s)." % (mark, manual_page, mark, pdf_page)


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
                code, diff, stem, correct, wrongs, expl, mp, pp = q
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
                    "source": source_label(mp, pp),
                    "difficulty": difficulty_values[difficulty_index],
                })
                difficulty_index += 1
                qids.append(qid)
            lessons_out.append({
                "id": lesson_id,
                "levelId": level["n"],
                "title": lesson["title"],
                "subtitle": lesson["subtitle"],
                "pages": lesson["pages"],
                "questionIds": qids,
                "intro": lesson["intro"],
                "teaching": [{"heading": h, "text": t} for h, t in lesson["teaching"]],
                "scenario": {"title": lesson["scenario"][0], "text": lesson["scenario"][1]},
                "sourceNote": lesson["sourceNote"],
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
        "manual": "Property & Casualty Training Manual, Book #2 (Norris Training System, Rev. 2024)",
        "sourcePagination": "References use the printed section.page labels; PDF page numbers are shown alongside them.",
        "masteryThreshold": MASTERY_THRESHOLD,
        "questionsPerLesson": QUESTIONS_PER_LESSON,
        "lessonTimerSeconds": LESSON_TIMER_SECONDS,
        "questionTimerSeconds": QUESTION_TIMER_SECONDS,
        "attackTime": {
            "minSeconds": ATTACK_MIN_SECONDS,
            "maxSeconds": ATTACK_MAX_SECONDS,
            "baseChancePercent": ATTACK_BASE_CHANCE,
            "chancePerLevelPercent": ATTACK_PER_LEVEL,
            "note": "After a question times out the opponent may call ATTACK TIME, taking 0-60 seconds from the lesson clock. The chance rises from 10% at level 1 to 90% at level 9. The final exam has no artificial attacks.",
        },
        "story": [
            "CAT was a stray before she was anything else. She found the cardboard Box Tower on the greenway, guarded it, and learned the rules well enough to test a small black cat named BAT. BAT passed, the tower opened to every cat, and CAT walked back out through the door she had held shut.",
            "A tower you found first is not the same as a home you can keep. So CAT takes the long way: nine levels, from the cold alley to the long shadow at the edge of town.",
            "At every stop an opponent waits, and the battles are intellectual and harmless. No claws, no bites: just Property & Casualty rules for Kansas, a ten minute clock, and ten questions. Answer well and the path continues. Let the clock run out and the opponent may call ATTACK TIME and steal seconds from the lesson.",
            "Past the ninth level waits the last opponent of all: CAT's own shadow, the part of her that never had a door to close. It asks one hundred fifty-six questions in one hundred fifty minutes and uses no tricks.",
            "Answer well, and CAT finds what every stray is looking for.",
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
            "intro": "Nine levels are behind CAT. At the edge of town the last opponent is her own shadow - everything the alley taught, turned around and looking back.",
            "dialogue": "You learned the rules to leave the alley. Now show me you can use them when nothing is chasing you and no clock is playing tricks.",
            "win": "The shadow steps aside. It was never an enemy, only the part of CAT that had nowhere to go. And down the road, a door stands open and a light is on.",
            "lose": "The shadow holds its ground. Not a defeat, only another round: the rules are still there to be learned, and the door will still be open next time.",
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
        check("PDF p" in lesson["sourceNote"],
              "lesson %d sourceNote needs a PDF reference" % lesson["id"])

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
        check(q["source"].startswith("Manual p"), "%s needs a manual reference" % q["id"])
        check("PDF p" in q["source"], "%s needs a PDF page reference" % q["id"])
        check(isinstance(q["difficulty"], int) and 1 <= q["difficulty"] <= 5,
              "%s has an invalid difficulty" % q["id"])
        check(q["answer"] in range(4), "%s answer out of range" % q["id"])
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
