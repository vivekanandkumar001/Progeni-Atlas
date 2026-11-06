"""
Progeni Atlas — Dynamic Interview Parameter Generator
======================================================
Infers role category, seniority level, and 4-6 evaluation parameters.
"""

def generate_dynamic_interview_parameters(job_description, resume_text="", interview_type="technical"):
    """
    Step-by-step reasoning engine to dynamically infer role category, seniority level,
    and 4-6 evaluation parameters with weightages summing to 100%, good/weak answer signals.
    """
    jd_lower = (job_description or "").lower()
    resume_lower = (resume_text or "").lower()
    itype = (interview_type or "technical").lower()

    # Step 1: Infer Role Category
    if any(k in jd_lower for k in ["lead", "staff", "principal", "architect", "engineering manager", "director"]):
        role_category = "technical/leadership"
    elif any(k in jd_lower for k in ["product manager", "scrum", "agile", "project manager"]):
        role_category = "business/management"
    elif any(k in jd_lower for k in ["sales", "account executive", "client", "consultant"]):
        role_category = "client-facing/sales"
    else:
        role_category = "technical/individual-contributor"

    # Step 2: Infer Seniority Level
    if any(k in jd_lower for k in ["principal", "distinguished", "10+ years", "director", "vp"]):
        seniority_level = "principal"
    elif any(k in jd_lower for k in ["lead", "staff", "architect", "8+ years", "7+ years"]):
        seniority_level = "lead"
    elif any(k in jd_lower for k in ["senior", "sr", "5+ years", "4+ years"]):
        seniority_level = "senior"
    elif any(k in jd_lower for k in ["junior", "intern", "associate", "entry", "fresher", "0-2 years"]):
        seniority_level = "associate"
    else:
        seniority_level = "mid"

    # Extract key skills mentioned in JD
    common_tech_skills = ["react", "python", "golang", "go", "java", "kubernetes", "aws", "postgresql", "fastapi", "typescript", "system design", "distributed systems", "pytorch", "microservices", "sql", "docker"]
    extracted_skills = [s.title() for s in common_tech_skills if s in jd_lower]
    if not extracted_skills:
        extracted_skills = ["Software Engineering", "Problem Solving", "System Architecture"]

    parameters = []

    if itype == "behavioral":
        parameters = [
            {
                "name": "Behavioral & Leadership",
                "weight_percent": 40,
                "reasoning": "Behavioral interview type prioritizes STAR method scenarios, team conflict resolution, and ownership.",
                "good_answer_signals": [
                    "Provides clear Situation-Task-Action-Result structure with quantifiable impact.",
                    "Demonstrates extreme ownership and constructive empathy during team conflicts."
                ],
                "weak_answer_signals": [
                    "Vague answers attributing success solely to team without individual contribution.",
                    "Defensive posture when discussing past project failures or friction."
                ]
            },
            {
                "name": "Communication & Clarity",
                "weight_percent": 30,
                "reasoning": "High communication weight for behavioral alignment and leadership articulation.",
                "good_answer_signals": [
                    "Structured, concise explanation with logical narrative flow.",
                    "Active listening and precise responses without rambling."
                ],
                "weak_answer_signals": [
                    "Disorganized, tangential responses lacking clear takeaways.",
                    "Monotone delivery with frequent hesitation."
                ]
            },
            {
                "name": "Adaptability & Curveballs",
                "weight_percent": 20,
                "reasoning": "Evaluates candidate resilience under high-pressure follow-up questions.",
                "good_answer_signals": [
                    "Remains calm under probing questions and acknowledges trade-offs.",
                    "Pivots strategy constructively when constraints change."
                ],
                "weak_answer_signals": [
                    "Flustered by pushback or refuses to revise assumptions.",
                    "Gives rigid answers ignoring scenario constraints."
                ]
            },
            {
                "name": "Domain Context Knowledge",
                "weight_percent": 10,
                "reasoning": "Baseline verification of industry context for behavioral interview type.",
                "good_answer_signals": [
                    "Understands domain terminology and business metrics.",
                    "Aligns technical decisions with business goals."
                ],
                "weak_answer_signals": [
                    "Lacks understanding of basic domain workflows.",
                    "Focuses purely on tech jargon without business value."
                ]
            }
        ]
    elif seniority_level in ["senior", "lead", "principal"] or role_category == "technical/leadership":
        parameters = [
            {
                "name": "System Design & Architecture",
                "weight_percent": 35,
                "reasoning": f"Crucial dimension for {seniority_level} role requiring distributed scalability, trade-off analysis, and fault tolerance.",
                "good_answer_signals": [
                    f"Proactively discusses scalability, caching, load balancing, and data partitioning for {', '.join(extracted_skills[:3])}.",
                    "Explicitly articulates CAP theorem trade-offs and single-point-of-failure mitigation."
                ],
                "weak_answer_signals": [
                    "Proposes monolithic solutions without considering throughput or latency constraints.",
                    "Ignores database indexing, bottleneck detection, or failover strategies."
                ]
            },
            {
                "name": "Technical Depth & Code Quality",
                "weight_percent": 30,
                "reasoning": f"Evaluates mastery of core technologies ({', '.join(extracted_skills[:3])}) and clean coding practices.",
                "good_answer_signals": [
                    "Writes clean, idiomatic code with optimal time/space complexity (O(N) vs O(N^2)).",
                    "Handles edge cases, concurrency locks, and memory leaks proactively."
                ],
                "weak_answer_signals": [
                    "Struggles with fundamental data structures or language idioms.",
                    "Produces brittle code missing basic boundary validation."
                ]
            },
            {
                "name": "Problem Solving & Trade-offs",
                "weight_percent": 20,
                "reasoning": "Assesses analytical decomposition when faced with ambiguous technical constraints.",
                "good_answer_signals": [
                    "Breaks complex requirements into manageable micro-components.",
                    "Evaluates alternative approaches before committing to an architecture."
                ],
                "weak_answer_signals": [
                    "Jumps directly to coding without clarifying requirements or edge cases.",
                    "Stuck on first approach without considering alternative data structures."
                ]
            },
            {
                "name": "Communication & Articulation",
                "weight_percent": 15,
                "reasoning": "Senior candidates must clearly communicate complex technical decisions to stakeholders.",
                "good_answer_signals": [
                    "Uses clear architectural diagrams and precise technical terminology.",
                    "Explains complex technical trade-offs in an intuitive manner."
                ],
                "weak_answer_signals": [
                    "Incoherent explanations with heavy hand-waving.",
                    "Unable to defend architectural choices when questioned."
                ]
            }
        ]
    else:
        # Mid / Associate Technical Role
        parameters = [
            {
                "name": "Domain Technical Knowledge",
                "weight_percent": 40,
                "reasoning": f"Primary parameter for {seniority_level} developer role focused on hands-on proficiency in {', '.join(extracted_skills[:3])}.",
                "good_answer_signals": [
                    f"Demonstrates fluent syntax, standard libraries, and framework idioms in {extracted_skills[0] if extracted_skills else 'core stack'}.",
                    "Accurately explains asynchronous execution, SQL indexing, and REST/gRPC protocols."
                ],
                "weak_answer_signals": [
                    "Fails basic language syntax or core API usage.",
                    "Confuses fundamental concepts like synchronous vs asynchronous execution."
                ]
            },
            {
                "name": "Problem Solving & Analytical Approach",
                "weight_percent": 30,
                "reasoning": "Evaluates algorithmic reasoning, debugging, and step-by-step logic.",
                "good_answer_signals": [
                    "Traces code execution systematically and identifies bug root causes.",
                    "Derives correct time and space complexity analysis."
                ],
                "weak_answer_signals": [
                    "Relies on trial-and-error guessing without systematic debugging.",
                    "Unable to optimize brute-force solution."
                ]
            },
            {
                "name": "Communication & Clarity",
                "weight_percent": 15,
                "reasoning": "Assesses ability to explain code logic and collaborate effectively.",
                "good_answer_signals": [
                    "Verbalizes thought process clearly while writing code.",
                    "Asks clarifying questions about constraints before writing code."
                ],
                "weak_answer_signals": [
                    "Silent coding without explaining logic to interviewer.",
                    "Does not seek clarification when requirements are ambiguous."
                ]
            },
            {
                "name": "Adaptability & Follow-ups",
                "weight_percent": 15,
                "reasoning": "Evaluates responsiveness when new constraints or follow-up questions are introduced.",
                "good_answer_signals": [
                    "Quickly adapts solution when interviewer adds new scale or memory constraints.",
                    "Accepts feedback constructively and fixes edge case bugs."
                ],
                "weak_answer_signals": [
                    "Resistant to changing initial implementation.",
                    "Struggles to handle simple follow-up modifications."
                ]
            }
        ]

    # Verify total weight check
    total_weight = sum(p["weight_percent"] for p in parameters)
    if total_weight != 100:
        diff = 100 - total_weight
        parameters[0]["weight_percent"] += diff
        total_weight = 100

    return {
        "role_category": role_category,
        "seniority_level": seniority_level,
        "parameters": parameters,
        "total_weight_check": total_weight
    }

