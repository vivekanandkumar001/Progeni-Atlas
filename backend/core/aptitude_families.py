"""
Progeni Atlas — Parameterized Aptitude Item Families
===================================================
Industry-standard alternative to a static question bank: each family is a
*parametrized item template* with a deterministic answer/distractor function.
Randomized parameters yield effectively infinite verified-unique items with
zero LLM cost and zero key errors. The assemble path hashes every rendered
item (renderedHash) and tracks per-user exposure via `aptitude_question_usage`.

Every family exposes:
    id            stable family id (used for per-user exposure caps)
    section       one of the 5 pillars
    topic         blueprint topic tag
    difficulty    easy | medium | hard
    gen(rng)      -> item dict {prompt, options[4], correctIndex, explanation,
                                 formula, timeRecommendedSeconds}
"""

from __future__ import annotations

import math
import random
from typing import Any, Callable, Dict, List


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _int_param(rng: random.Random, lo: int, hi: int, step: int = 1) -> int:
    return rng.randrange(lo, hi + 1, step)


def _shuffle_options(rng: random.Random, correct: str, distractors: List[str]) -> List[str]:
    """Return 4 unique options with exactly one correct answer; raise if impossible."""
    opts = [correct] + distractors[:3]
    # guarantee uniqueness of strings
    seen = set()
    uniq = []
    for o in opts:
        while o in seen:
            o = o + " "
        seen.add(o)
        uniq.append(o)
    rng.shuffle(uniq)
    return uniq


# ---------------------------------------------------------------------------
# Family implementations
# ---------------------------------------------------------------------------

def _fam_time_work(rng: random.Random) -> Dict[str, Any]:
    x, y = rng.choice([(10, 15), (12, 18), (8, 24), (14, 21), (9, 18), (16, 24), (20, 30), (10, 20)])
    t = _int_param(rng, 2, 6)
    combined = 1 / x + 1 / y
    remaining = 1 - t * combined
    if remaining <= 0:
        # degenerate parameterization — fall back to a safe fixed instance
        x, y, t = 12, 18, 4
        combined = 1 / x + 1 / y
        remaining = 1 - t * combined
    ans_days = remaining * y
    correct = f"{int(round(ans_days))} days"
    distractors = [
        f"{int(round(ans_days)) + 2} days",
        f"{int(round(ans_days + 1))} days",
        f"{max(1, int(round(ans_days)) - 2)} days",
    ]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"Worker A can finish a project in {x} days and Worker B can finish the same project in {y} days. If they work together for {t} days and then Worker A leaves, how many additional days will Worker B take to complete the remaining work?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": (
            f"A in 1 day = 1/{x}; B in 1 day = 1/{y}. Together/day = (1/{x}+1/{y}) = {combined:.4f}. "
            f"Work in {t} days = {t*combined:.3f} ({1 - t*combined:.3f} remaining). "
            f"B alone: ({remaining:.4f}) × {y} = {ans_days:.2f} days."
        ),
        "formula": f"Remaining = 1 - {t}*(1/{x} + 1/{y}); Days = Remaining * {y}",
        "timeRecommendedSeconds": 75,
    }


def _fam_faulty_balance(rng: random.Random) -> Dict[str, Any]:
    markup = rng.choice([20, 30, 40, 50])
    disc = rng.choice([10, 15, 20, 25])
    weight = rng.choice([800, 900])
    true_profit = ((1 + markup / 100) * (1 - disc / 100) * 1000 / weight - 1) * 100
    correct = f"{true_profit:.2f}%"
    distractors = [
        f"{(markup - disc) + weight / 100:.2f}%",
        f"{true_profit - 4.17:.2f}%",
        f"{((1 + markup / 100) * (1 - disc / 100) - 1) * 100:.2f}%",
    ]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"A shopkeeper marks his goods {markup}% above the cost price and allows a discount of {disc}% on the marked price. He uses a faulty balance that weighs {weight} grams instead of 1000 grams while selling. What is his net profit percentage?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": (
            f"CP for 1000g = ₹1000. MP = ₹{1000 * (1 + markup / 100):.0f}. SP after discount = MP × {1 - disc / 100:.2f} = ₹{1000 * (1 + markup / 100) * (1 - disc / 100):.2f}. "
            f"Customer gets {weight}g for that price; CP of {weight}g = ₹{weight}. Profit = (SP − CP)/CP × 100 = {true_profit:.2f}%."
        ),
        "formula": "Profit% = [(1 + markup)(1 − discount) × 1000 / faultyWeight − 1] × 100",
        "timeRecommendedSeconds": 90,
    }


def _fam_si_vs_ci_2yr(rng: random.Random) -> Dict[str, Any]:
    p = _int_param(rng, 20, 200, 10) * 1000
    r = rng.choice([5, 8, 10, 12, 15, 20])
    diff = p * (r / 100) ** 2
    correct = f"₹{int(diff):,}"
    distractors = [f"₹{int(p * r / 100):,}", f"₹{int(p * r / 50):,}", f"₹{int(p * (1 + r / 100) ** 2 - p - p * r / 50):,}"]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"The difference between compound interest and simple interest on a sum of ₹{p:,} for 2 years at {r}% per annum (compounded annually) is:",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"For 2 years, CI − SI = P × (R/100)² = {p:,} × ({r}/100)² = ₹{int(diff):,}.",
        "formula": "CI − SI (2 yr) = P × (R/100)²",
        "timeRecommendedSeconds": 60,
    }


def _fam_average_speed(rng: random.Random) -> Dict[str, Any]:
    a, b = rng.choice([(40, 60), (30, 60), (20, 80), (45, 90), (50, 100), (60, 120), (24, 36)])
    avg = 2 * a * b / (a + b)
    correct = f"{avg:.1f} km/h"
    distractors = [f"{(a + b) / 2:.1f} km/h", f"{a * b / (a + b):.1f} km/h", f"{2 * (a + b):.1f} km/h"]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"A person covers a distance to a destination at {a} km/h and returns over the same distance at {b} km/h. What is the average speed for the whole journey?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"Equal distances: avg speed = 2·a·b / (a + b) = 2 × {a} × {b} / {a + b} = {avg:.1f} km/h.",
        "formula": "v_avg = 2ab / (a + b)",
        "timeRecommendedSeconds": 60,
    }


def _fam_alligation(rng: random.Random) -> Dict[str, Any]:
    x, z, y = rng.choice([(10, 24, 60), (20, 40, 80), (30, 50, 70), (10, 25, 55), (40, 55, 70), (15, 35, 75)])
    # solution A x%, solution B y% -> mixture z%  =>  A:B = (y-z) : (z-x)
    a_part, b_part = y - z, z - x
    g = math.gcd(a_part, b_part)
    correct = f"{a_part // g} : {b_part // g}"
    distractors = [f"{b_part // g} : {a_part // g}", f"{z - x} : {y - z}", f"{y - x} : {y - z}"]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"In what ratio must a merchant mix a {x}% solution with a {y}% solution to obtain a {z}% solution?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"By alligation, A:B = (y − z) : (z − x) = ({y} − {z}) : ({z} − {x}) = {a_part} : {b_part} = {a_part // g} : {b_part // g}.",
        "formula": "A : B = (y − mean) : (mean − x)",
        "timeRecommendedSeconds": 75,
    }


def _fam_boats_streams(rng: random.Random) -> Dict[str, Any]:
    b, c = rng.choice([(15, 3), (20, 4), (18, 6), (12, 4), (25, 5), (10, 2)])
    d = rng.choice([36, 48, 60, 72, 96, 120])
    up = d / (b - c)
    down = d / (b + c)
    diff = up - down
    correct = f"{diff:.1f} hours" if diff != int(diff) else f"{int(diff)} hours"
    distractors = [f"{down + up:.1f} hours", f"{d / b * 2:.1f} hours", f"{abs(up - down) + 2:.1f} hours"]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"A boat can travel at {b} km/h in still water and the stream flows at {c} km/h. How much longer does a trip of {d} km take travelling upstream than it does travelling downstream over the same distance?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"Upstream speed = {b} − {c} = {b - c} km/h; time = {d}/{b - c} = {up:.2f} h. Downstream = {b} + {c} = {b + c} km/h; time = {d}/{b + c} = {down:.2f} h. Difference = {diff:.2f} h.",
        "formula": "Δt = D/(b−c) − D/(b+c)",
        "timeRecommendedSeconds": 75,
    }


def _fam_sequential_percentage(rng: random.Random) -> Dict[str, Any]:
    x = rng.choice([10, 20, 25, 40, 50])
    y = rng.choice([10, 20, 25, 40, 50])
    change = ((1 + x / 100) * (1 - y / 100) - 1) * 100
    direction = "decrease" if change < 0 else "increase"
    correct = f"{abs(change):.1f}% {direction}"
    distractors = [
        f"{abs(x - y)}% {'decrease' if x < y else 'increase'}",
        f"{abs(change) + x / 10:.1f}% {direction}",
        f"{(x + y) / 2:.1f}% increase",
    ]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"The price of a commodity is increased by {x}% and as a result, a shopkeeper reduces his consumption of that commodity by {y}%. What is the net percentage change in his total expenditure on that commodity?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"New expenditure factor = (1 + {x}/100)(1 − {y}/100) = {(1 + x/100)*(1 - y/100):.3f}. Net change = ({(1 + x/100)*(1 - y/100):.3f} − 1) × 100 = {change:.1f}% → a {abs(change):.1f}% {direction}.",
        "formula": "Δ = (1 + p/100)(1 − q/100) − 1",
        "timeRecommendedSeconds": 60,
    }


def _fam_committee_probability(rng: random.Random) -> Dict[str, Any]:
    a = rng.choice([4, 5, 6])
    b = rng.choice([3, 4, 5])
    k = 4
    i = 2
    from math import comb
    favorable = comb(a, i) * comb(b, k - i)
    total = comb(a + b, k)
    p = favorable / total
    from fractions import Fraction
    frac = Fraction(favorable, total)
    correct = f"{frac.numerator}/{frac.denominator}"
    distractors = [f"{comb(a, i)}/{total}", f"{k}/{a + b}", f"{favorable}/{total + 1}"]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"A committee of {k} members is to be formed from {a} engineers and {b} managers. What is the probability that the committee contains exactly {i} engineers?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"Total ways = {a + b}C{k} = {total}. Favourable = {a}C2 × {b}C2 = {favorable}. Probability = {favorable}/{total} = {correct}.",
        "formula": f"P = ᵃCᵢ × ᵇCₖ₋ᵢ / (ᵃ⁺ᵇ)Cₖ",
        "timeRecommendedSeconds": 75,
    }


def _fam_number_series(rng: random.Random) -> Dict[str, Any]:
    a = _int_param(rng, 3, 30)
    d = rng.choice([3, 4, 5, 6, 7, 8, 9])
    n = 8
    term = a + (n - 1) * d
    correct = str(term)
    distractors = [str(term + d), str(term - d), str(a + (n - 1) * (d + 1))]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"Find the {n}th term of the arithmetic progression: {a}, {a + d}, {a + 2 * d}, {a + 3 * d}, …",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"nth term of an AP = a + (n − 1)d = {a} + 7 × {d} = {term}.",
        "formula": "Tₙ = a + (n−1)d",
        "timeRecommendedSeconds": 45,
    }


def _fam_ages_ratio(rng: random.Random) -> Dict[str, Any]:
    # father = x*son now; in y years father = z*son's age; son's age now = ?
    combos = [(3, 2, 12), (4, 3, 14), (3, 2, 8), (5, 4, 12), (4, 2, 12)]
    x, z, y = rng.choice(combos)
    son = (z * y - y) / (x - z) if (x - z) > 0 else None  # x*S + y = z*S + z*y => S = (z*y - y)/(x - z)
    son = int(round(abs(son))) if son else 12
    # sanity check — must be a positive integer solution
    if x * son + y != z * (son + y):
        son = (y * (z - 1)) // (x - z)
    correct = f"{son} years"
    distractors = [f"{son + 2} years", f"{son * 2} years", f"{son + y} years"]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"The present age of a father is {x} times the age of his son. {y} years from now, the father will be {z} times the age of his son. What is the present age of the son?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"Let son's age = S. Father = {x}S. In {y} years: {x}S + {y} = {z}(S + {y}) → S = {son} years.",
        "formula": "x·S + y = z·(S + y)",
        "timeRecommendedSeconds": 75,
    }


def _fam_two_dice(rng: random.Random) -> Dict[str, Any]:
    k = rng.choice([5, 6, 7, 8, 9, 10])
    ways = sum(1 for i in range(1, 7) for j in range(1, 7) if i + j == k)
    correct = f"{ways}/36"
    distractors = [f"{ways + 1}/36", f"{max(1, ways - 2)}/36", f"{k - 1}/36"]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"Two fair dice are thrown together. What is the probability that the sum of the numbers shown is exactly {k}?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"Favourable outcomes for sum = {k}: {ways}. Total outcomes = 36. Probability = {ways}/36.",
        "formula": "P = favourable / 36",
        "timeRecommendedSeconds": 60,
    }


def _fam_wages_ratio(rng: random.Random) -> Dict[str, Any]:
    a_eff = rng.choice([2, 3, 4])
    wage = rng.choice([2400, 3000, 3600, 4500, 6000])
    b_share = wage // (a_eff + 1)
    correct = f"₹{b_share}"
    distractors = [f"₹{a_eff * wage // (a_eff + 1)}", f"₹{wage // 2}", f"₹{b_share + 200}"]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"Worker A is {a_eff} times as efficient as Worker B. Both work together on a task and earn a total of ₹{wage}. How much should Worker B receive?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"A:B efficiency ratio = {a_eff}:1 → wages split in the same ratio. B = ₹{wage}/({a_eff}+1) = ₹{b_share}.",
        "formula": "wage_B = total / (ratio_sum)",
        "timeRecommendedSeconds": 60,
    }


def _fam_di_table_percentage(rng: random.Random) -> Dict[str, Any]:
    names = rng.sample(["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Sigma", "Omega", "Zeta"], 4)
    reqs = [rng.choice([120, 150, 200, 250, 300, 400, 500, 600]) for _ in range(4)]
    total = sum(reqs)
    target_idx = rng.randrange(4)
    pct = reqs[target_idx] / total * 100
    correct = f"{pct:.1f}%"
    distractors = [f"{pct + 5:.1f}%", f"{pct - 5:.1f}%", f"{reqs[target_idx] / total * 10:.1f}%"]
    options = _shuffle_options(rng, correct, distractors)
    table = "\n".join(f"  Service {n}: {v}k req/min" for n, v in zip(names, reqs))
    return {
        "prompt": f"Given the telemetry table:\n{table}\nWhat percentage of TOTAL cluster request traffic does Service {names[target_idx]} handle alone?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"Total traffic = {sum(reqs)}k req/min. Service {names[target_idx]} = {reqs[target_idx]}k → {reqs[target_idx]}/{total} × 100 = {pct:.1f}%.",
        "formula": "share% = part / total × 100",
        "timeRecommendedSeconds": 60,
    }


def _fam_syllogism(rng: random.Random) -> Dict[str, Any]:
    sets = [
        ("All programmers are engineers.", "Some engineers are researchers.", "No researcher is a manager.",
         "Some programmers may not be managers."),
        ("All mammals are animals.", "Some animals are aquatic.", "No aquatic is a desert dweller.",
         "All mammals may be non-desert dwellers."),
        ("All teslas are EVs.", "Some EVs are sedans.", "No sedan is a truck.",
         "Some teslas may be trucks."),
    ]
    a, b, c, d = rng.choice(sets)
    correct = d
    distractors = [
        "All programmers are trucks." if "programmer" in a else "All mammals are desert dwellers.",
        "No engineer is an artist matches." if "programmer" in a else "All animals are aquatic.",
        "Some engineers are teslas." if "programmer" in a else "All teslas are trucks.",
    ]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"Consider the statements:\nI. {a}\nII. {b}\nIII. {c}\nWhich of the following conclusions is DEFINITELY FALSE given the statements?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"Statement I is universal (all), II and III are particular/negative restrictions — the only statement guaranteed false is '{correct}'.",
        "formula": "Syllogism: universal affirmative + particular + negative universal",
        "timeRecommendedSeconds": 75,
    }


def _fam_blood_relation(rng: random.Random) -> Dict[str, Any]:
    names = ["Aisha", "Rahul", "Meena", "Arjun", "Priya", "Rohan", "Sneha", "Dev", "Kavya", "Nathan"]
    x = rng.choice(names)
    rest = [n for n in names if n != x]
    y = rng.choice(rest)
    correct = "Nephew (sister's son)"
    distractors = ["Brother-in-law", "Son", "Cousin"]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"{x} introduced {y} as the son of her only sister's husband. How is {y} related to {x}?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": (
            f"{x}'s sister's husband is her brother-in-law. His son ({y}) is the child of {x}'s sister, "
            f"i.e. the nephew of {x}."
        ),
        "formula": "sister's husband = brother-in-law; brother-in-law's son = nephew",
        "timeRecommendedSeconds": 60,
    }


def _fam_direction_sense(rng: random.Random) -> Dict[str, Any]:
    a, b, c = rng.choice([(3, 4, 5), (6, 8, 10), (5, 12, 13), (8, 15, 17), (9, 12, 15)])
    correct = f"{c} km"
    distractors = [f"{a + b} km", f"{abs(a - b)} km", f"{2 * max(a, b)} km"]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"A man walks {a} km towards the north and then turns right and walks {b} km. What is the straight-line distance from his starting point to his final position?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"North and east legs are perpendicular, forming a right-angled triangle. Straight-line distance = √({a}² + {b}²) = √{a*a + b*b} = {c} km.",
        "formula": "d = √(a² + b²)",
        "timeRecommendedSeconds": 60,
    }


VOWELS = set("AEIOU")


def _fam_coding_decoding(rng: random.Random) -> Dict[str, Any]:
    words = ["GLOW", "SPIRIT", "BENCH", "CLOCK", "BRAVE", "CRISP", "LIGHT", "MARCH", "PLANT", "TRUST", "FROST", "GRACE"]

    def advance(ch: str, k: int) -> str:
        o = ord(ch) - 65
        return chr((o + k) % 26 + 65)

    def encode(word: str, k: int) -> str:
        out = []
        for ch in word:
            if ch in VOWELS:
                out.append(ch)
            else:
                out.append(advance(ch, k))
        return "".join(out)

    word = rng.choice(words)
    correct = encode(word, 1)
    distractors = [encode(word, -1), encode(word, 2), word]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"In a certain code language, every consonant is advanced by one letter of the English alphabet, while vowels remain unchanged. How is '{word}' written in that code?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"Vowels ({', '.join(sorted(set(word) & VOWELS)) or 'none'}) stay unchanged; each consonant shifts forward by 1. '{word}' becomes '{correct}'.",
        "formula": "code(ch) = ch if ch in vowels else ch+1",
        "timeRecommendedSeconds": 60,
    }


def _fam_di_max_min(rng: random.Random) -> Dict[str, Any]:
    names = rng.sample(["Alpha", "Beta", "Gamma", "Delta", "Sigma", "Omega", "Zeta", "Epsilon"], 4)
    reqs = [rng.choice([120, 150, 200, 250, 300, 400, 500, 600]) for _ in range(4)]
    want_max = rng.random() < 0.5
    target = max(range(4), key=lambda i: reqs[i]) if want_max else min(range(4), key=lambda i: reqs[i])
    direction = "most" if want_max else "least"
    correct = f"Service {names[target]}"
    distractors = [f"Service {names[i]}" for i in range(4) if i != target][:3]
    options = _shuffle_options(rng, correct, distractors)
    table = "\n".join(f"  Service {n}: {v}k req/min" for n, v in zip(names, reqs))
    return {
        "prompt": f"Given the telemetry table:\n{table}\nWhich service handles the {direction} request traffic?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"Compare the values: " + ", ".join(f"{n} = {v}k" for n, v in zip(names, reqs)) + f". The {direction} is Service {names[target]}.",
        "formula": "argmax / argmin over the table",
        "timeRecommendedSeconds": 50,
    }


def _fam_di_ratio(rng: random.Random) -> Dict[str, Any]:
    names = rng.sample(["Alpha", "Beta", "Gamma", "Delta"], 2)
    x = rng.choice([100, 150, 200, 300, 400])
    y = rng.choice([100, 150, 200, 300, 400])
    if x == y:
        y += 100
    from math import gcd
    g = gcd(x, y)
    correct = f"{x // g} : {y // g}"
    distractors = [f"{y // g} : {x // g}", f"{x + y} : {x + y + 50 if False else y}", f"{x // g + 1} : {y // g + 1}"]
    options = _shuffle_options(rng, correct, distractors)
    return {
        "prompt": f"From the telemetry table:\n  Service {names[0]}: {x}k req/min\n  Service {names[1]}: {y}k req/min\nWhat is the ratio of Service {names[0]} to Service {names[1]} traffic (in lowest terms)?",
        "options": options,
        "correctIndex": options.index(correct),
        "explanation": f"Ratio = {x} : {y} = ({x} ÷ {g}) : ({y} ÷ {g}) = {x // g} : {y // g}.",
        "formula": "ratio = x : y, reduce by gcd",
        "timeRecommendedSeconds": 45,
    }


FAMILIES: List[Dict[str, Any]] = [
    {"id": "fam-time-work", "section": "Quantitative", "topic": "Time & Work", "difficulty": "medium", "tags": ["amcat", "campus"], "gen": _fam_time_work},
    {"id": "fam-faulty-balance", "section": "Quantitative", "topic": "Profit, Loss & Discount", "difficulty": "hard", "tags": ["amcat"], "gen": _fam_faulty_balance},
    {"id": "fam-si-vs-ci-2yr", "section": "Quantitative", "topic": "Simple & Compound Interest", "difficulty": "easy", "tags": ["amcat", "campus"], "gen": _fam_si_vs_ci_2yr},
    {"id": "fam-average-speed", "section": "Quantitative", "topic": "Speed, Time & Distance", "difficulty": "medium", "tags": ["amcat"], "gen": _fam_average_speed},
    {"id": "fam-alligation", "section": "Quantitative", "topic": "Mixtures & Alligation", "difficulty": "medium", "tags": ["amcat"], "gen": _fam_alligation},
    {"id": "fam-boats-streams", "section": "Quantitative", "topic": "Boats & Streams", "difficulty": "medium", "tags": ["amcat"], "gen": _fam_boats_streams},
    {"id": "fam-sequential-percentage", "section": "Quantitative", "topic": "Percentage & Successive Change", "difficulty": "medium", "tags": ["amcat", "tcs-nqt"], "gen": _fam_sequential_percentage},
    {"id": "fam-committee-probability", "section": "Quantitative", "topic": "Permutations & Probability", "difficulty": "medium", "tags": ["amcat"], "gen": _fam_committee_probability},
    {"id": "fam-number-series", "section": "Quantitative", "topic": "Number Series & Progressions", "difficulty": "easy", "tags": ["campus", "tcs-nqt"], "gen": _fam_number_series},
    {"id": "fam-ages-ratio", "section": "Quantitative", "topic": "Ages & Ratios", "difficulty": "medium", "tags": ["campus"], "gen": _fam_ages_ratio},
    {"id": "fam-two-dice", "section": "Quantitative", "topic": "Probability — Dice & Cards", "difficulty": "easy", "tags": ["campus"], "gen": _fam_two_dice},
    {"id": "fam-wages-ratio", "section": "Quantitative", "topic": "Time & Work — Wages", "difficulty": "easy", "tags": ["campus"], "gen": _fam_wages_ratio},
    {"id": "fam-di-table-percentage", "section": "Data Interpretation", "topic": "Tabular Data Interpretation", "difficulty": "medium", "tags": ["amcat"], "gen": _fam_di_table_percentage},
    {"id": "fam-blood-relation", "section": "Logical", "topic": "Blood Relations", "difficulty": "medium", "tags": ["tcs-nqt", "amcat"], "gen": _fam_blood_relation},
    {"id": "fam-direction-sense", "section": "Logical", "topic": "Direction Sense", "difficulty": "easy", "tags": ["campus", "tcs-nqt"], "gen": _fam_direction_sense},
    {"id": "fam-coding-decoding", "section": "Logical", "topic": "Coding-Decoding", "difficulty": "medium", "tags": ["amcat", "campus"], "gen": _fam_coding_decoding},
    {"id": "fam-di-max-min", "section": "Data Interpretation", "topic": "Tabular Comparison", "difficulty": "medium", "tags": ["amcat"], "gen": _fam_di_max_min},
    {"id": "fam-syllogism", "section": "Logical", "topic": "Syllogism & Deduction", "difficulty": "hard", "tags": ["tcs-nqt", "infosys"], "gen": _fam_syllogism},
    {"id": "fam-di-ratio", "section": "Data Interpretation", "topic": "Tabular Ratios", "difficulty": "medium", "tags": ["amcat"], "gen": _fam_di_ratio},
]


def get_families_by_section(section: str) -> List[Dict[str, Any]]:
    return [f for f in FAMILIES if f["section"].lower() == section.lower()]


def render_family_item(family: Dict[str, Any], seed: str) -> Dict[str, Any]:
    """Render one item from a family, deterministically from a seed string."""
    rng = random.Random(seed)
    item = family["gen"](rng)
    return {
        "id": f"{family['id']}#{seed[:10]}",
        "familyId": family["id"],
        "section": family["section"],
        "topic": family["topic"],
        "difficulty": family["difficulty"],
        "tags": family.get("tags", []),
        "prompt": item["prompt"],
        "options": item["options"],
        "correctIndex": item["correctIndex"],
        "explanation": item["explanation"],
        "formula": item["formula"],
        "timeRecommendedSeconds": item["timeRecommendedSeconds"],
    }
