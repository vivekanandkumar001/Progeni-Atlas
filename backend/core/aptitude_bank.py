"""
Progeni Atlas — Standardized Cognitive & Aptitude Question Bank
==============================================================
Standardized question taxonomy calibrated across the 5 core pillars of 
campus recruitment and enterprise hiring (SHL, AMCAT, CoCubes, eLitmus):
1. Quantitative Reasoning (Arithmetic, Modern Math, Number Theory)
2. Logical & Analytical Reasoning (Syllogisms, Arrangements, Deduction)
3. Verbal Ability & Comprehension (Passages, Sentence Correction, Vocabulary)
4. Data Interpretation (Tabular, Charts, Dependent Caselets)
5. Abstract & Spatial Reasoning (Pattern Matrices, Series Logic)
"""

from typing import Any, Dict, List, Optional
import random

# Default Question Bank with high-yield, verified items
APTITUDE_QUESTIONS_CATALOG: List[Dict[str, Any]] = [
    # --------------------------------------------------------------------------
    # 1. QUANTITATIVE REASONING
    # --------------------------------------------------------------------------
    {
        "id": "quant-001",
        "section": "Quantitative",
        "topic": "Time & Work",
        "difficulty": "medium",
        "prompt": "Worker A can finish a project in 12 days, and Worker B can finish the same project in 18 days. If they work together for 4 days and then Worker A leaves, how many additional days will Worker B take to complete the remaining work?",
        "options": [
            "6 days",
            "8 days",
            "10 days",
            "12 days"
        ],
        "correctIndex": 1,
        "explanation": "Work done by A in 1 day = 1/12. Work done by B in 1 day = 1/18.\nTogether in 1 day = (1/12 + 1/18) = (3 + 2)/36 = 5/36.\nIn 4 days together, work completed = 4 * (5/36) = 20/36 = 5/9.\nRemaining work = 1 - 5/9 = 4/9.\nTime taken by B alone to finish 4/9 of work = (4/9) / (1/18) = (4/9) * 18 = 8 days.",
        "formula": "\\text{Rate}_{A+B} = \\frac{1}{12} + \\frac{1}{18} = \\frac{5}{36}",
        "timeRecommendedSeconds": 75
    },
    {
        "id": "quant-002",
        "section": "Quantitative",
        "topic": "Profit, Loss & Discount",
        "difficulty": "hard",
        "prompt": "A shopkeeper marks his goods 40% above the cost price and allows a discount of 25% on the marked price. If he additionally uses a faulty balance that weighs 900 grams instead of 1000 grams while selling, what is his overall net profit percentage?",
        "options": [
            "12.5%",
            "14.28%",
            "16.67%",
            "18.5%"
        ],
        "correctIndex": 2,
        "explanation": "Let Cost Price for 1000g be ₹1000 (CP = ₹1 per gram).\nMarked Price for 1000g = ₹1400 (40% above CP).\nSelling Price after 25% discount on MP = 1400 * 0.75 = ₹1050.\nCustomer receives 900g, but pays ₹1050.\nActual Cost Price of 900g to shopkeeper = 900 * ₹1 = ₹900.\nNet Profit = ₹1050 - ₹900 = ₹150.\nNet Profit Percentage = (150 / 900) * 100 = 16.67% (or 16 2/3%).",
        "formula": "\\text{Profit} \\% = \\frac{1050 - 900}{900} \\times 100 = 16.67\\%",
        "timeRecommendedSeconds": 90
    },
    {
        "id": "quant-003",
        "section": "Quantitative",
        "topic": "Permutations & Probability",
        "difficulty": "medium",
        "prompt": "From a group of 5 software engineers and 4 product managers, a project steering committee of 4 members is to be formed. What is the probability that the committee contains exactly 2 software engineers and 2 product managers?",
        "options": [
            "10/21",
            "5/14",
            "10/27",
            "20/63"
        ],
        "correctIndex": 0,
        "explanation": "Total people = 5 engineers + 4 PMs = 9.\nTotal ways to choose 4 members from 9 = 9C4 = (9 * 8 * 7 * 6) / (4 * 3 * 2 * 1) = 126.\nFavorable ways: choose 2 engineers from 5 AND 2 PMs from 4 = 5C2 * 4C2 = 10 * 6 = 60.\nProbability = 60 / 126 = 10 / 21.",
        "formula": "P = \\frac{^5C_2 \\times ^4C_2}{^9C_4} = \\frac{10 \\times 6}{126} = \\frac{10}{21}",
        "timeRecommendedSeconds": 60
    },
    {
        "id": "quant-004",
        "section": "Quantitative",
        "topic": "Speed, Time & Relative Motion",
        "difficulty": "medium",
        "prompt": "Two high-speed trains of lengths 180 meters and 220 meters are travelling towards each other on parallel tracks at 72 km/h and 108 km/h respectively. How many seconds will they take to completely cross each other from the moment they meet?",
        "options": [
            "6 seconds",
            "8 seconds",
            "10 seconds",
            "12 seconds"
        ],
        "correctIndex": 1,
        "explanation": "Total distance to cover = Sum of lengths = 180m + 220m = 400 meters.\nRelative speed (moving opposite directions) = 72 + 108 = 180 km/h.\nConvert to m/s: 180 * (5/18) = 50 m/s.\nTime taken = Total Distance / Relative Speed = 400 / 50 = 8 seconds.",
        "formula": "\\text{Time} = \\frac{180 + 220}{180 \\times \\frac{5}{18}} = \\frac{400}{50} = 8\\text{ s}",
        "timeRecommendedSeconds": 50
    },
    {
        "id": "quant-005",
        "section": "Quantitative",
        "topic": "Number Theory & Remainders",
        "difficulty": "hard",
        "prompt": "What is the remainder when 3^(2024) is divided by 7?",
        "options": [
            "1",
            "2",
            "4",
            "6"
        ],
        "correctIndex": 1,
        "explanation": "Using Euler's Totient or modular arithmetic cycles (Fermat's Little Theorem since 7 is prime):\n3^1 mod 7 = 3\n3^2 mod 7 = 2\n3^3 mod 7 = 6 = -1\n3^6 mod 7 = 1 (Cycle length = 6).\nDivide the exponent 2024 by 6: 2024 = 6 * 337 + 2.\nSo remainder is 2.\nTherefore, 3^(2024) mod 7 = 3^2 mod 7 = 9 mod 7 = 2.",
        "formula": "3^6 \\equiv 1 \\pmod 7 \\implies 3^{2024} = (3^6)^{337} \\cdot 3^2 \\equiv 1 \\cdot 9 \\equiv 2 \\pmod 7",
        "timeRecommendedSeconds": 60
    },

    # --------------------------------------------------------------------------
    # 2. LOGICAL REASONING
    # --------------------------------------------------------------------------
    {
        "id": "logic-001",
        "section": "Logical",
        "topic": "Syllogisms & Deduction",
        "difficulty": "medium",
        "prompt": "Statements:\n1. All microservices are scalable architectures.\n2. Some scalable architectures are distributed systems.\n3. No distributed system is single-point-of-failure.\n\nConclusions:\nI. Some microservices are distributed systems.\nII. Some scalable architectures are not single-point-of-failure.\n\nWhich of the conclusions logically follow?",
        "options": [
            "Only conclusion I follows",
            "Only conclusion II follows",
            "Both conclusion I and II follow",
            "Neither conclusion follows"
        ],
        "correctIndex": 1,
        "explanation": "Statement 2 says 'Some scalable architectures are distributed systems'. Statement 3 says 'No distributed system is single-point-of-failure'.\nTherefore, those specific scalable architectures that are distributed systems CANNOT be single-point-of-failure. Thus Conclusion II definitely follows.\nConclusion I does not necessarily follow because microservices are a subset of scalable architectures, but there is no guaranteed overlap between microservices and distributed systems.",
        "formula": "A \\subset B, B \\cap C \\neq \\emptyset, C \\cap D = \\emptyset \\implies (B \\cap C) \\cap D = \\emptyset",
        "timeRecommendedSeconds": 60
    },
    {
        "id": "logic-002",
        "section": "Logical",
        "topic": "Circular Seating Arrangement",
        "difficulty": "hard",
        "prompt": "Six engineers (A, B, C, D, E, F) sit around a circular table facing the center.\n- A sits second to the left of D.\n- C is an immediate neighbor of A.\n- F sits opposite to B.\n- E is not adjacent to D.\n\nWho sits to the immediate right of A?",
        "options": [
            "B",
            "C",
            "E",
            "F"
        ],
        "correctIndex": 2,
        "explanation": "Fix D at position 1.\nA sits second to the left of D -> position 5 (clockwise order: 1, 2, 3, 4, 5, 6).\nNeighbors of A are 4 and 6. C is an immediate neighbor of A.\nF is opposite to B -> pairs of opposite positions are (1,4), (2,5), (3,6). Since A is at 5, (2,5) is taken. D is at 1, so (1,4) is taken.\nThus F and B must occupy (3,6) or (6,3).\nSince position 6 is occupied by either F or B, C must be at position 4 (the other neighbor of A).\nNow positions left are 2 and either 3 or 6. E is not adjacent to D (positions 2 and 6 are adjacent to 1).\nThus E must be at position 3, making B/F at 2 and 6.\nClockwise neighbors around A(5) are 4(C, left) and 6(E/B, right). Checking constraints, E is to the immediate right of A.",
        "formula": "\\text{Clockwise Order: } D(1) \\to B(2) \\to E(3) \\to C(4) \\to A(5) \\to F(6)",
        "timeRecommendedSeconds": 100
    },
    {
        "id": "logic-003",
        "section": "Logical",
        "topic": "Coded Inequalities",
        "difficulty": "easy",
        "prompt": "Given the relationship:\nP > Q >= R = S < T <= U\nWhich of the following expressions is definitely TRUE?",
        "options": [
            "P > S",
            "Q < T",
            "R >= U",
            "P <= R"
        ],
        "correctIndex": 0,
        "explanation": "P > Q and Q >= R and R = S.\nTherefore, P > Q >= S, which guarantees P > S is strictly TRUE.\nBetween Q and T: Q >= S and S < T, which gives conflicting signs (no definite relation).\nBetween R and U: R = S and S < U, so R < U (not >=).\nBetween P and R: P > R (not <=).",
        "formula": "P > Q \\ge S \\implies P > S",
        "timeRecommendedSeconds": 40
    },
    {
        "id": "logic-004",
        "section": "Logical",
        "topic": "Blood Relations",
        "difficulty": "medium",
        "prompt": "Pointing to a photograph of a woman, Rahul said: 'Her only brother's daughter is the sister of my wife's only son.' How is the woman in the photograph related to Rahul?",
        "options": [
            "Mother-in-law",
            "Sister-in-law",
            "Paternal Aunt",
            "Sister of Father-in-law"
        ],
        "correctIndex": 3,
        "explanation": "'My wife's only son' = Rahul's son.\n'Sister of my wife's only son' = Rahul's daughter.\n'Her only brother's daughter is Rahul's daughter' => Rahul's daughter's father is Rahul, so Rahul is the brother's son or Rahul's father-in-law is the woman's only brother.\nTherefore, the woman's only brother is Rahul's wife's father (Rahul's father-in-law).\nHence, the woman is the sister of Rahul's father-in-law.",
        "formula": "\\text{Woman's Brother} = \\text{Rahul's Father-in-law} \\implies \\text{Woman} = \\text{Sister of Father-in-law}",
        "timeRecommendedSeconds": 65
    },

    # --------------------------------------------------------------------------
    # 3. VERBAL ABILITY & COMPREHENSION
    # --------------------------------------------------------------------------
    {
        "id": "verb-001",
        "section": "Verbal",
        "topic": "Critical Reading Comprehension",
        "difficulty": "hard",
        "prompt": "Passage:\n'In modern distributed software engineering, the Cap Theorem states that a networked data store can simultaneously guarantee at most two out of three properties: Consistency, Availability, and Partition Tolerance. Because network partitions (dropped packets, hardware splits) are an inevitable reality of physical networking, real-world systems are practically forced to choose between strong consistency (refusing stale responses) and high availability (returning whatever replica is reachable, risking divergence).'\n\nQuestion:\nBased on the passage, why are systems in practice rarely capable of choosing CA (Consistency and Availability together)?",
        "options": [
            "Because physical network partitions are unavoidable in networked hardware",
            "Because software consistency algorithms take too much CPU overhead",
            "Because database clients prefer availability over partition tolerance",
            "Because modern cloud platforms do not support data replication"
        ],
        "correctIndex": 0,
        "explanation": "The text explicitly states: 'Because network partitions (dropped packets, hardware splits) are an inevitable reality of physical networking, real-world systems are practically forced to choose between strong consistency and high availability.' Partition tolerance cannot simply be discarded in physical networks, rendering pure CA impractical in distributed environments.",
        "formula": "\\text{Distributed Law: } P = \\text{mandatory} \\implies \\text{Trade-off: } C \\lor A",
        "timeRecommendedSeconds": 50
    },
    {
        "id": "verb-002",
        "section": "Verbal",
        "topic": "Sentence Correction & Grammar",
        "difficulty": "medium",
        "prompt": "Identify the grammatically correct version of the underlined sentence:\n\n'Neither the engineering lead nor the frontend developers **was able to reproduce the concurrency glitch in production**.'",
        "options": [
            "was able to reproduce the concurrency glitch in production",
            "were able to reproduce the concurrency glitch in production",
            "is able to reproduce the concurrency glitch in production",
            "has been able to reproduce the concurrency glitch in production"
        ],
        "correctIndex": 1,
        "explanation": "Rule of Proximity: In 'Neither... nor...' structures with compound subjects of differing numbers, the verb agrees with the subject closest to it. Here, 'the frontend developers' is plural and closest to the verb. Therefore, the plural verb 'were able' is grammatically correct.",
        "formula": "\\text{Subject-Verb Agreement: Neither A nor B [plural] } \\implies \\text{Verb [plural]}",
        "timeRecommendedSeconds": 40
    },
    {
        "id": "verb-003",
        "section": "Verbal",
        "topic": "Contextual Vocabulary & Antonyms",
        "difficulty": "medium",
        "prompt": "Choose the word most nearly OPPOSITE in meaning to the capitalized word:\n\n'The architect presented a **METICULOUS** design blueprint that accounted for every possible failure scenario.'",
        "options": [
            "Cursory",
            "Rigorous",
            "Scrupulous",
            "Comprehensive"
        ],
        "correctIndex": 0,
        "explanation": "Meticulous means showing great attention to detail; very careful and precise. Rigorous, scrupulous, and comprehensive are synonyms. 'Cursory' means hasty and therefore not thorough or detailed, which is the exact antonym.",
        "formula": "\\text{Meticulous (Thorough)} \\iff \\text{Opposite of Cursory (Hasty/Superficial)}",
        "timeRecommendedSeconds": 30
    },

    # --------------------------------------------------------------------------
    # 4. DATA INTERPRETATION
    # --------------------------------------------------------------------------
    {
        "id": "di-001",
        "section": "Data Interpretation",
        "topic": "Tabular Revenue & Cloud Latency",
        "difficulty": "medium",
        "prompt": "Reference Data Table:\nCloud Microservices Cluster Telemetry:\n- Service Alpha: 400k req/min, 99.8% Success Rate, 24ms Average Latency\n- Service Beta:  250k req/min, 99.2% Success Rate, 45ms Average Latency\n- Service Gamma: 150k req/min, 98.0% Success Rate, 110ms Average Latency\n- Service Delta: 200k req/min, 99.5% Success Rate, 32ms Average Latency\n\nQuestion:\nWhat is the total number of FAILED requests per minute generated across all four services combined?",
        "options": [
            "5,800 requests/min",
            "6,800 requests/min",
            "7,200 requests/min",
            "8,400 requests/min"
        ],
        "correctIndex": 1,
        "explanation": "Service Alpha Failures: 400,000 * (100% - 99.8%) = 400,000 * 0.002 = 800 req/min.\nService Beta Failures: 250,000 * (100% - 99.2%) = 250,000 * 0.008 = 2,000 req/min.\nService Gamma Failures: 150,000 * (100% - 98.0%) = 150,000 * 0.020 = 3,000 req/min.\nService Delta Failures: 200,000 * (100% - 99.5%) = 200,000 * 0.005 = 1,000 req/min.\nTotal Failures = 800 + 2,000 + 3,000 + 1,000 = 6,800 req/min.",
        "formula": "\\sum \\text{Failures} = 800 + 2000 + 3000 + 1000 = 6800",
        "timeRecommendedSeconds": 75
    },
    {
        "id": "di-002",
        "section": "Data Interpretation",
        "topic": "Percentage Share & Ratios",
        "difficulty": "medium",
        "prompt": "Using the same telemetry table (Alpha: 400k, Beta: 250k, Gamma: 150k, Delta: 200k total req/min):\nWhat percentage of the TOTAL cluster request traffic is handled by Service Alpha alone?",
        "options": [
            "35.0%",
            "40.0%",
            "42.5%",
            "45.0%"
        ],
        "correctIndex": 1,
        "explanation": "Total requests/min = 400k + 250k + 150k + 200k = 1,000k (1,000,000 req/min).\nService Alpha traffic = 400k.\nPercentage = (400,000 / 1,000,000) * 100 = 40.0%.",
        "formula": "\\frac{400}{1000} \\times 100 = 40\\%",
        "timeRecommendedSeconds": 40
    },

    # --------------------------------------------------------------------------
    # 5. ABSTRACT & SPATIAL REASONING
    # --------------------------------------------------------------------------
    {
        "id": "abstract-001",
        "section": "Abstract",
        "topic": "Matrix Pattern Transformation",
        "difficulty": "hard",
        "prompt": "Pattern Rule:\nIn a 3x3 matrix, each row contains figures undergoing two simultaneous transformations from left to right:\n1. The outer polygon adds 1 edge (Triangle -> Square -> Pentagon).\n2. The internal shaded dot rotates 90 degrees clockwise.\n\nIf Row 3 begins with a Pentagon (dot at Top) and middle is Hexagon (dot at Right), what must be the final figure in Row 3?",
        "options": [
            "Heptagon with shaded dot at Bottom",
            "Heptagon with shaded dot at Left",
            "Hexagon with shaded dot at Bottom",
            "Octagon with shaded dot at Top"
        ],
        "correctIndex": 0,
        "explanation": "Rule 1: Number of edges increases by 1 (5 edges -> 6 edges -> 7 edges). The final figure must be a Heptagon (7-sided polygon).\nRule 2: Internal dot rotates 90 degrees clockwise (Top -> Right -> Bottom).\nCombining both rules gives: Heptagon with shaded dot at Bottom.",
        "formula": "N_{\\text{edges}} = 5 \\to 6 \\to 7; \\quad \\theta_{\\text{dot}} = 0^\\circ \\to 90^\\circ \\to 180^\\circ",
        "timeRecommendedSeconds": 50
    }
]


STANDARD_TEST_TEMPLATES = [
    {
        "id": "template-campus-general",
        "title": "Standard Campus Employability Assessment",
        "subtitle": "AMCAT & CoCubes Benchmark Pattern",
        "description": "Comprehensive 5-pillar cognitive screening simulating top IT & product company hiring filters.",
        "durationMinutes": 30,
        "totalQuestions": 12,
        "sections": [
            {"name": "Quantitative", "questionCount": 4, "timeMinutes": 10},
            {"name": "Logical", "questionCount": 3, "timeMinutes": 8},
            {"name": "Verbal", "questionCount": 2, "timeMinutes": 5},
            {"name": "Data Interpretation", "questionCount": 2, "timeMinutes": 5},
            {"name": "Abstract", "questionCount": 1, "timeMinutes": 2}
        ],
        "negativeMarking": False,
        "proctoringStrictness": "STRICT"
    },
    {
        "id": "template-quant-speed-sprint",
        "title": "Quantitative Speed & Accuracy Sprint",
        "subtitle": "High-Velocity Math & Number Systems",
        "description": "Focus on arithmetic shortcuts, probability, percentages, and modular speed math.",
        "durationMinutes": 15,
        "totalQuestions": 5,
        "sections": [
            {"name": "Quantitative", "questionCount": 5, "timeMinutes": 15}
        ],
        "negativeMarking": True,
        "proctoringStrictness": "STANDARD"
    },
    {
        "id": "template-analytical-reasoning",
        "title": "Logical & Critical Deductions Test",
        "subtitle": "Puzzles, Arrangements & Syllogisms",
        "description": "Evaluate non-verbal fluid intelligence, critical reasoning, and algorithmic logic under pressure.",
        "durationMinutes": 15,
        "totalQuestions": 4,
        "sections": [
            {"name": "Logical", "questionCount": 4, "timeMinutes": 15}
        ],
        "negativeMarking": False,
        "proctoringStrictness": "STANDARD"
    }
]


def get_template_by_id(template_id: str) -> Optional[Dict[str, Any]]:
    for t in STANDARD_TEST_TEMPLATES:
        if t["id"] == template_id:
            return t
    return STANDARD_TEST_TEMPLATES[0]


def assemble_session_questions(template_id: str) -> List[Dict[str, Any]]:
    """Assemble balanced questions matching the requested template."""
    tmpl = get_template_by_id(template_id)
    selected_questions: List[Dict[str, Any]] = []

    for sec in tmpl.get("sections", []):
        sec_name = sec["name"]
        needed = sec["questionCount"]
        pool = [q for q in APTITUDE_QUESTIONS_CATALOG if q["section"].lower() == sec_name.lower()]
        if not pool:
            pool = [q for q in APTITUDE_QUESTIONS_CATALOG]
        
        # Sample without replacement
        sample_size = min(needed, len(pool))
        chosen = random.sample(pool, sample_size)
        selected_questions.extend(chosen)

    # Fallback if too few
    if len(selected_questions) < tmpl.get("totalQuestions", 5):
        remaining = [q for q in APTITUDE_QUESTIONS_CATALOG if q not in selected_questions]
        selected_questions.extend(remaining[: tmpl.get("totalQuestions", 5) - len(selected_questions)])

    return selected_questions

