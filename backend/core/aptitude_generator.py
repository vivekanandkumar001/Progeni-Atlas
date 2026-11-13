"""
Progeni Atlas — Daily Aptitude Item Generator (LLM, verified)
=============================================================
Industry-standard flow, scaled down honestly:
  * drafts are generated section/difficulty-bucketed to fill the bank evenly,
  * each draft must pass an INDEPENDENT solver pass (generator model solves
    blind and the two answers must agree on the key),
  * near-duplicates are rejected by Jaccard token similarity,
  * verified items are banked; unverified drafts are discarded — never shown.

Daily cap 2000 banked items. When reached, generation pauses automatically
(and re-enables only when the bank drains below target after retirements).
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

BANK_TARGET = 2000
DAILY_BATCH = 50
SETTINGS_KEY = "aptitude_daily_gen"

# (section, difficulty, weight)
BUCKETS = [
    ("Quantitative", "easy", 0.08),
    ("Quantitative", "medium", 0.22),
    ("Quantitative", "hard", 0.12),
    ("Logical", "medium", 0.14),
    ("Logical", "hard", 0.10),
    ("Verbal", "medium", 0.13),
    ("Verbal", "easy", 0.05),
    ("Data Interpretation", "medium", 0.09),
    ("Data Interpretation", "hard", 0.04),
    ("Abstract", "medium", 0.03),
]

TOPICS = {
    "Quantitative": ["Time & Work", "Stocks & Partnerships", "Boats & Streams", "Percentage", "Ratio & Proportion", "Mixtures & Alligation", "Speed, Time & Distance", "Profit, Loss & Discount", "Simple & Compound Interest", "Number Systems", "Mensuration", "Time & Work — Wages", "Probability — Dice & Coins", "Ages & Ratios"],
    "Logical": ["Syllogism", "Seating Arrangement", "Blood Relations", "Coding-Decoding", "Direction Sense", "Number & Letter Series", "Statement — Assumptions", "Linear Puzzles", "Rank Order"],
    "Verbal": ["Reading Comprehension", "Sentence Correction", "Fill in the Blanks", "Synonyms & Antonyms", "Para Jumbles", "Error Spotting", "Vocabulary in Context"],
    "Data Interpretation": ["Tabular Data", "Bar Charts", "Line Graphs", "Pie Charts", "Caselets", "Mixed DI"],
    "Abstract": ["Figure Matrix", "Series of Figures", "Paper Folding & Punching", "Mirror Image", "Figure Counting"],
}


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", str(text).lower()))


def jaccard(a: str, b: str) -> float:
    ta, tb = _tokenize(a), _tokenize(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def bank_totals(db) -> dict[str, int]:
    static_seed = 15
    try:
        from core.aptitude_bank import APTITUDE_QUESTIONS_CATALOG
        static_seed = len(APTITUDE_QUESTIONS_CATALOG)
    except Exception:
        static_seed = 15
    generated = 0
    if db is not None:
        try:
            generated = db.aptitude_generated_bank.count_documents({})
        except Exception:
            generated = 0
    return {"staticSeed": static_seed, "generated": generated, "total": static_seed + generated, "target": BANK_TARGET}


def _gen_prompt(section: str, topic: str, difficulty: str) -> str:
    return f"""Write ONE original, AMCAT/CoCubes-grade {difficulty} multiple-choice question for the {section} section on the topic "{topic}".

Requirements:
- Self-contained, unambiguous stem (no missing information, no trick wording).
- Exactly 4 options, only ONE correct; the other three are plausible, standard distractors.
- Include a crisp expert explanation of why the key is correct.
- Real-world flavored numbers, clean integer or 1-2 decimal answers.

Return STRICT JSON only (no markdown fences), exactly this shape:
{{"section": "{section}", "topic": "{topic}", "difficulty": "{difficulty}",
  "prompt": "...", "options": ["A...", "B...", "C...", "D..."],
  "correctIndex": 0, "explanation": "...", "timeRecommendedSeconds": 75}}"""


def _solver_prompt(prompt: str, options: list[str]) -> str:
    letters = ["A", "B", "C", "D", "E", "F"]
    opts = "\n".join(f"{letters[i]}) {o}" for i, o in enumerate(options))
    return f"""Solve this multiple-choice problem. Think briefly, then commit to ONE option.

{prompt}

{opts}

Return STRICT JSON only (no markdown fences): {{"answer": "A" | "B" | "C" | "D"}}"""


def _valid_schema(item: dict[str, Any]) -> bool:
    if not isinstance(item, dict):
        return False
    prompt = str(item.get("prompt") or "").strip()
    if len(prompt) < 40:
        return False
    options = item.get("options")
    if not isinstance(options, list) or len(options) != 4:
        return False
    if len({str(o).strip() for o in options}) != 4:  # duplicate options
        return False
    ci = item.get("correctIndex")
    if not isinstance(ci, int) or ci < 0 or ci > 3:
        return False
    if str(item.get("difficulty") or "").lower() not in ("easy", "medium", "hard"):
        return False
    if str(item.get("section") or "").lower() not in ("quantitative", "logical", "verbal", "data interpretation", "abstract"):
        return False
    explanation = str(item.get("explanation") or "").strip()
    if len(explanation) < 20:
        return False
    return True


def generate_items(db, count: int = DAILY_BATCH, dry_run: bool = False) -> dict[str, Any]:
    """Generate up to `count` verified items. Auto-pauses when the bank is full.

    Safety guards (learned from a live Gemini outage):
      * wall-clock ceiling MAX_SECONDS for the whole batch,
      * aborts after MAX_CONSECUTIVE_LLM_FAILURES in a row (provider outage —
        stop instead of burning quota on calls that can only fail).
    """
    import time as _time

    MAX_SECONDS = 600
    MAX_CONSECUTIVE_LLM_FAILURES = 12
    batch_started = _time.time()
    consecutive_llm_failures = 0

    from app.services import llm_service

    totals = bank_totals(db)
    if totals["total"] >= BANK_TARGET:
        return {"status": "paused", "reason": f"bank target reached ({BANK_TARGET})", **totals}

    budget_remaining = max(1, count)
    generated: list[dict[str, Any]] = []
    stats = {"accepted": 0, "rejected": 0, "deduped": 0, "invalid": 0, "solver_disagree": 0}

    # gather existing prompt corpus for dedup (static + generated + this run)
    existing_prompts: list[str] = []
    try:
        from core.aptitude_bank import APTITUDE_QUESTIONS_CATALOG
        existing_prompts.extend(str(q.get("prompt", "")) for q in APTITUDE_QUESTIONS_CATALOG)
    except Exception:
        pass
    if db is not None:
        try:
            for row in db.aptitude_generated_bank.find({}, {"_id": 0, "prompt": 1}):
                existing_prompts.append(str(row.get("prompt", "")))
        except Exception:
            pass

    def bucket_pick(idx: int):
        total_w = sum(w for _, _, w in BUCKETS)
        r = (idx * 0.61803398875) % 1.0 * total_w  # deterministic spread if random unavailable
        import random
        r = random.random() * total_w
        acc = 0.0
        for section, difficulty, w in BUCKETS:
            acc += w
            if r <= acc:
                return section, difficulty
        return BUCKETS[0][:2]

    attempts = 0
    max_attempts = count * 4
    while (
        len(generated) < budget_remaining
        and attempts < max_attempts
        and (_time.time() - batch_started) < MAX_SECONDS
        and consecutive_llm_failures < MAX_CONSECUTIVE_LLM_FAILURES
    ):
        attempts += 1
        section, difficulty = bucket_pick(attempts)
        topic = TOPICS.get(section, ["General"])[attempts % len(TOPICS.get(section, ["General"]))]

        try:
            raw = llm_service.call_llm(_gen_prompt(section, topic, difficulty), system="You are a senior psychometric item writer. Output STRICT JSON only.", temperature=0.7)
            draft = llm_service._json_from(raw)
            consecutive_llm_failures = 0
        except Exception:
            consecutive_llm_failures += 1
            stats["rejected"] += 1
            continue

        draft = dict(draft) if isinstance(draft, dict) else {}
        draft.setdefault("section", section)
        draft.setdefault("topic", topic)
        draft.setdefault("difficulty", difficulty)

        if not _valid_schema(draft):
            stats["invalid"] += 1
            continue

        # near-duplicate rejection (Jaccard on token sets)
        is_dup = any(jaccard(draft["prompt"], p) >= 0.55 for p in existing_prompts + [g["prompt"] for g in generated])
        if is_dup:
            stats["deduped"] += 1
            continue

        # independent solver must agree on the key
        try:
            solver_raw = llm_service.call_llm(_solver_prompt(draft["prompt"], [str(o) for o in draft["options"]]), system="You are an expert problem solver. Output STRICT JSON only.", temperature=0.0)
            solver = llm_service._json_from(solver_raw)
            answer_letter = str((solver or {}).get("answer", "")).strip().upper()[:1]
            letter_idx = {"A": 0, "B": 1, "C": 2, "D": 3}.get(answer_letter, -1)
            consecutive_llm_failures = 0
        except Exception:
            letter_idx = -1
            consecutive_llm_failures += 1
        if letter_idx != int(draft.get("correctIndex", -99)):
            stats["solver_disagree"] += 1
            stats["rejected"] += 1
            continue

        generated.append({
            "id": f"gen-{abs(hash(draft['prompt'])) % 10**10}",
            "section": str(draft["section"]).strip().title().replace("Di", "Data Interpretation") if False else str(draft["section"]).strip(),
            "topic": str(draft["topic"]).strip(),
            "difficulty": str(draft["difficulty"]).strip().lower(),
            "prompt": str(draft["prompt"]).strip(),
            "options": [str(o).strip() for o in draft["options"]],
            "correctIndex": int(draft["correctIndex"]),
            "explanation": str(draft["explanation"]).strip(),
            "timeRecommendedSeconds": int(draft.get("timeRecommendedSeconds") or 75),
            "source": "llm_daily_gen",
            "verifiedBy": "solver_agreement",
            "tags": [],
            "createdAt": datetime.now(timezone.utc),
        })
        existing_prompts.append(draft["prompt"])

    if not dry_run and generated and db is not None:
        db.aptitude_generated_bank.insert_many(generated)

    totals = bank_totals(db) if not dry_run else {**totals, "total": totals["total"] + len(generated), "generated": totals["generated"] + len(generated)}

    result = {
        "status": "ok",
        "requested": count,
        "accepted": len(generated),
        "rejected": stats["rejected"],
        "invalid": stats["invalid"],
        "solverDisagree": stats["solver_disagree"],
        "deduped": stats["deduped"],
        "attempts": attempts,
        "elapsedSeconds": round(_time.time() - batch_started, 1),
        "abortedEarly": consecutive_llm_failures >= MAX_CONSECUTIVE_LLM_FAILURES or (_time.time() - batch_started) >= MAX_SECONDS,
        "bankTotal": totals["total"],
        "dryRun": dry_run,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    return result


def run_daily_if_needed(db, force: bool = False) -> dict[str, Any]:
    """5:00 AM IST daily behaviour: generate unless the admin already did today
    or the bank is at target. Uses an atomic Mongo claim so the two gunicorn
    workers cannot double-run."""
    from datetime import timedelta

    now_utc = datetime.now(timezone.utc)
    ist = now_utc + timedelta(hours=5, minutes=30)
    if ist.hour < 5 and not force:
        return {"status": "skipped", "reason": "before 05:00 IST"}

    today = ist.date().isoformat()

    totals = bank_totals(db)
    if totals["total"] >= BANK_TARGET:
        return {"status": "paused", "reason": f"bank target reached ({BANK_TARGET})", **totals}

    try:
        db.platform_settings.update_one({"key": SETTINGS_KEY}, {"$setOnInsert": {"key": SETTINGS_KEY, "lastRunDate": None, "lastClaimDate": None, "dailyBatch": DAILY_BATCH, "target": BANK_TARGET, "createdAt": now_utc}}, upsert=True)
        claim = db.platform_settings.find_one_and_update(
            {
                "key": SETTINGS_KEY,
                "$and": [
                    {"$or": [{"lastRunDate": {"$ne": today}}, {"lastRunDate": {"$exists": False}}, {"lastRunDate": None}]},
                    {"$or": [{"lastClaimDate": {"$ne": today}}, {"lastClaimDate": {"$exists": False}}, {"lastClaimDate": None}]},
                ],
            },
            {"$set": {"lastClaimDate": today, "claimedAt": now_utc}},
            return_document=True,
        )
    except Exception as e:
        return {"status": "error", "reason": f"claim failed: {e}"}

    if claim is None:
        return {"status": "skipped", "reason": "already generated or claimed today", "today": today}

    result = generate_items(db, DAILY_BATCH)

    try:
        if result.get("accepted", 0) > 0:
            db.platform_settings.update_one({"key": SETTINGS_KEY}, {"$set": {"lastRunDate": today, "lastResult": {**result, "at": result["at"]}, "lastFailureDate": None}})
        else:
            db.platform_settings.update_one({"key": SETTINGS_KEY}, {"$set": {"lastFailureDate": today, "lastResult": {**result, "at": result["at"]}}})
    except Exception:
        pass
    return {**result, "today": today}


def bank_stats(db) -> dict[str, Any]:
    totals = bank_totals(db)
    settings = None
    usage = {}
    try:
        settings = db.platform_settings.find_one({"key": SETTINGS_KEY}, {"_id": 0})
    except Exception:
        settings = None
    try:
        usage = {
            "totalUsageEvents": db.aptitude_question_usage.count_documents({}),
            "uniqueItemsServed": len(db.aptitude_question_usage.distinct("itemId")),
            "uniqueUsersPracticed": len(db.aptitude_question_usage.distinct("userId")),
        }
    except Exception:
        usage = {}
    try:
        by_section = list(db.aptitude_generated_bank.aggregate([{"$group": {"_id": "$section", "n": {"$sum": 1}}}]))
        by_difficulty = list(db.aptitude_generated_bank.aggregate([{"$group": {"_id": "$difficulty", "n": {"$sum": 1}}}]))
        by_section = [{"section": str(b.get("_id")), "n": int(b.get("n", 0))} for b in by_section]
        by_difficulty = [{"difficulty": str(b.get("_id")), "n": int(b.get("n", 0))} for b in by_difficulty]
    except Exception:
        by_section, by_difficulty = [], []
    from core.aptitude_families import FAMILIES
    return {
        **totals,
        "parameterizedFamilies": len(FAMILIES),
        "usage": usage,
        "generatedBySection": by_section,
        "generatedByDifficulty": by_difficulty,
        "settings": settings,
    }
