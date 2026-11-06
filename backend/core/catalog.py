"""
Progeni Atlas — Drill and Skill Catalog System
===============================================
Catalog data, taxonomy seeding, and database normalization helpers.
"""

import re
import traceback
from datetime import datetime, timezone

from core.db import get_mongo_db
from core.constants import TECH_SKILLS_TAXONOMY

DRILL_CATALOG = [
    # ------------------ FRONTEND / REACT / NEXT.JS ------------------
    {
        "id": "drill-react-concurrent-rendering",
        "match_skills": ["react", "react.js", "frontend", "javascript", "typescript"],
        "title": "React 18 Concurrent Rendering & Fiber Linked-Lists",
        "category": "DATA_STRUCTURES",
        "difficulty": "INTERMEDIATE",
        "estimatedMinutes": 10,
        "coreSkillsTested": ["Fiber Node Architecture", "Concurrent Lane Priority", "Suspense & useTransition"],
        "description": "Examine how React Fiber breaks UI reconciliation into interruptible linked-list traversal units scheduled across microtasks.",
        "sampleStarterQuestion": "How does React Fiber maintain a workInProgress tree during concurrent rendering, and what happens when an urgent click event interrupts a low-priority transition?",
        "recommendedReason": "Generated from your React & Frontend resume background"
    },
    {
        "id": "drill-nextjs-streaming-ssr",
        "match_skills": ["next.js", "react", "frontend"],
        "title": "Next.js App Router, Streaming SSR & Hydration Optimization",
        "category": "SYSTEM_DESIGN",
        "difficulty": "ADVANCED",
        "estimatedMinutes": 12,
        "coreSkillsTested": ["Server Components", "Streaming HTML", "Selective Hydration"],
        "description": "Architect high-speed Next.js web applications leveraging React Server Components (RSC) and HTTP chunked transfer encoding.",
        "sampleStarterQuestion": "Explain the boundary between Server and Client Components in Next.js, and how the RSC wire format serializes without shipping server dependencies to client bundles.",
        "recommendedReason": "Tailored to your Next.js & modern full-stack skills"
    },
    # ------------------ PYTHON / FASTAPI / DJANGO / FLASK ------------------
    {
        "id": "drill-python-asyncio-concurrency",
        "match_skills": ["python", "fastapi", "django", "flask", "backend"],
        "title": "Python AsyncIO Event Loops, Coroutines & Non-Blocking I/O",
        "category": "SYSTEM_DESIGN",
        "difficulty": "INTERMEDIATE",
        "estimatedMinutes": 10,
        "coreSkillsTested": ["AsyncIO Event Loop", "GIL Bottlenecks", "Task Scheduling"],
        "description": "Analyze Python's cooperative multitasking model, CPU-bound vs I/O-bound throughput, and avoiding blocking calls in coroutine loops.",
        "sampleStarterQuestion": "How does the Python asyncio event loop manage task scheduling across sockets without thread preemption, and how do you prevent synchronous blocking operations from freezing the event loop?",
        "recommendedReason": "Targeted for your Python backend experience"
    },
    {
        "id": "drill-fastapi-microservices",
        "match_skills": ["fastapi", "python", "microservices"],
        "title": "High-Throughput ASGI Concurrency & FastAPI Worker Scaling",
        "category": "DISTRIBUTED_SYSTEMS",
        "difficulty": "ADVANCED",
        "estimatedMinutes": 15,
        "coreSkillsTested": ["ASGI Specification", "Uvicorn Worker Clustering", "Connection Pooling"],
        "description": "Design high-concurrency microservices processing 10,000+ RPS using Uvicorn worker clustering, async MongoDB pooling, and backpressure.",
        "sampleStarterQuestion": "In a FastAPI microservice running under Uvicorn worker processes, how should database connection pools be initialized to prevent fork-safety socket corruption?",
        "recommendedReason": "Customized for your FastAPI & microservices stack"
    },
    # ------------------ NODE.JS / EXPRESS / TYPESCRIPT ------------------
    {
        "id": "drill-nodejs-event-loop",
        "match_skills": ["node.js", "express", "typescript", "javascript"],
        "title": "Node.js Libuv Event Loop Phases & Microtask Priority",
        "category": "SYSTEM_DESIGN",
        "difficulty": "ADVANCED",
        "estimatedMinutes": 10,
        "coreSkillsTested": ["Libuv Event Loop", "process.nextTick vs Promise", "Threadpool Sizing"],
        "description": "Dissect the execution order across Timers, Pending Callbacks, Poll, Check, and Close phases in high-throughput Node.js microservices.",
        "sampleStarterQuestion": "What is the exact execution priority between process.nextTick microtasks, resolved Promise jobs, and setImmediate timers across event loop ticks?",
        "recommendedReason": "Matched to your Node.js & TypeScript stack"
    },
    # ------------------ DATABASE INTERNALS / MONGODB / NOSQL ------------------
    {
        "id": "drill-mongodb-aggregation-indexes",
        "match_skills": ["mongodb", "nosql", "database", "sql"],
        "title": "MongoDB Compound Indexing & Aggregation Pipeline Optimization",
        "category": "DATABASE_INTERNALS",
        "difficulty": "INTERMEDIATE",
        "estimatedMinutes": 10,
        "coreSkillsTested": ["Compound Indexes", "Equality-Sort-Range (ESR) Rule", "Covered Queries"],
        "description": "Analyze query planner decisions, execution explain plans, and multi-stage aggregation pipeline optimizations in MongoDB.",
        "sampleStarterQuestion": "How does the Equality, Sort, Range (ESR) rule govern index selection in MongoDB, and what stages in an aggregation pipeline allow MongoDB to utilize index scans instead of in-memory sorting?",
        "recommendedReason": "Directly tailored to your MongoDB document modeling skills"
    },
    {
        "id": "drill-mongodb-replica-failover",
        "match_skills": ["mongodb", "nosql", "distributed systems", "system design"],
        "title": "Distributed Document Stores: Replica Sets & Raft Election Consensus",
        "category": "DATABASE_INTERNALS",
        "difficulty": "ADVANCED",
        "estimatedMinutes": 12,
        "coreSkillsTested": ["Oplog Replication", "Raft Consensus", "Write Concern w:majority"],
        "description": "Architect resilient multi-node database clusters with automatic failover, read concern linearizability, and split-brain prevention.",
        "sampleStarterQuestion": "Walk me through how a MongoDB replica set conducts an election when the primary fails, and what ensures that an unacknowledged write with w:1 is rolled back if a network partition occurs.",
        "recommendedReason": "Matched to your distributed database architecture skills"
    },
    # ------------------ REDIS & CACHING ------------------
    {
        "id": "drill-redis-rate-limiting",
        "match_skills": ["redis", "system design", "distributed systems", "backend"],
        "title": "Distributed Rate Limiting with Redis & Sliding Window",
        "category": "SYSTEM_DESIGN",
        "difficulty": "INTERMEDIATE",
        "estimatedMinutes": 10,
        "coreSkillsTested": ["Sliding Window ZSET", "Token Bucket", "Atomic Lua Scripts"],
        "description": "Architect a low-latency rate limiter handling 100,000 requests/sec using atomic Redis Lua scripts and sorted sets.",
        "sampleStarterQuestion": "Why are Redis Lua scripts preferred over client-side multi-exec transactions when implementing sliding window rate limiting?",
        "recommendedReason": "Matched to your Redis & distributed caching background"
    },
    # ------------------ KAFKA & DISTRIBUTED SYSTEMS ------------------
    {
        "id": "drill-kafka-sticky-assignors",
        "match_skills": ["kafka", "apache kafka", "distributed systems", "microservices"],
        "title": "Kafka Sticky Partitioning & Rebalance Protocols",
        "category": "DISTRIBUTED_SYSTEMS",
        "difficulty": "ADVANCED",
        "estimatedMinutes": 10,
        "coreSkillsTested": ["Sticky Assignors", "Rebalance Protocol", "Batching Efficiency"],
        "description": "Evaluate network throughput and consumer rebalance latencies when configuring sticky partition assignors vs round-robin partitioners.",
        "sampleStarterQuestion": "How does the StickyAssignor algorithm in Apache Kafka minimize partition movement during a consumer group rebalance while maintaining balanced partition distribution?",
        "recommendedReason": "Generated for your Kafka & event-driven architecture background"
    },
    {
        "id": "drill-saga-pattern",
        "match_skills": ["microservices", "system design", "distributed systems", "backend"],
        "title": "Saga Orchestration vs Choreography & Outbox Pattern",
        "category": "DISTRIBUTED_SYSTEMS",
        "difficulty": "ADVANCED",
        "estimatedMinutes": 15,
        "coreSkillsTested": ["Compensating Transactions", "Eventual Consistency", "Transactional Outbox"],
        "description": "Formulate asynchronous compensating event workflows to resolve partial failures across microservices.",
        "sampleStarterQuestion": "How does the Saga pattern handle cascading rollbacks when payment succeeds but inventory reservation fails?",
        "recommendedReason": "Matched to your microservices & distributed system skills"
    },
    # ------------------ CLOUD & DEVOPS / DOCKER / K8S / AWS ------------------
    {
        "id": "drill-kubernetes-deployments",
        "match_skills": ["kubernetes", "docker", "aws", "cloud", "devops", "ci/cd"],
        "title": "Kubernetes Zero-Downtime Rolling Updates & Autoscaling (HPA)",
        "category": "DISTRIBUTED_SYSTEMS",
        "difficulty": "ADVANCED",
        "estimatedMinutes": 12,
        "coreSkillsTested": ["Pod Lifecycle", "Readiness Probes", "Horizontal Pod Autoscaler"],
        "description": "Design cloud-native deployment manifests ensuring zero dropped connections during traffic surges and automated pod rollouts.",
        "sampleStarterQuestion": "In Kubernetes, what is the precise difference between liveness and readiness probes during a rolling deployment, and what causes ingress traffic to hit unready pods?",
        "recommendedReason": "Generated for your Docker & Kubernetes cloud skills"
    },
    # ------------------ AI / ML / VECTOR DBS ------------------
    {
        "id": "drill-vector-embeddings-hnsw",
        "match_skills": ["machine learning", "pytorch", "tensorflow", "vector dbs", "qdrant", "ai", "llms"],
        "title": "Vector Databases, HNSW Indexing & Semantic Retrieval",
        "category": "DATA_STRUCTURES",
        "difficulty": "ADVANCED",
        "estimatedMinutes": 10,
        "coreSkillsTested": ["Cosine Similarity", "Hierarchical Navigable Small World", "Vector Quantization"],
        "description": "Analyze algorithmic trade-offs between exact nearest neighbors and approximate nearest neighbors in high-dimensional vector databases.",
        "sampleStarterQuestion": "How does the HNSW graph construction achieve logarithmic search complexity in high-dimensional vector spaces, and how does scalar quantization reduce RAM overhead?",
        "recommendedReason": "Matched to your AI, ML & Vector DB experience"
    },
    # ------------------ CORE ALGORITHMS & DATA STRUCTURES (UNIVERSAL) ------------------
    {
        "id": "drill-asymptotic-complexity",
        "match_skills": ["data structures", "algorithms", "python", "java", "c++", "javascript"],
        "title": "Asymptotic Complexity & Runtime Analysis",
        "category": "DATA_STRUCTURES",
        "difficulty": "INTERMEDIATE",
        "estimatedMinutes": 8,
        "coreSkillsTested": ["Big-O Bounds", "Amortized Analysis", "Space Tradeoffs"],
        "description": "Rapid-fire algorithm analysis drills focusing on explicit Big-O time and space complexity statement prior to logic execution.",
        "sampleStarterQuestion": "Explain the time and space complexity of inserting 1,000,000 elements into a dynamic array vs a balanced B-Tree, accounting for array reallocation overhead.",
        "recommendedReason": "Core algorithm evaluation matched to your profile"
    },
    {
        "id": "drill-lru-cache-implementation",
        "match_skills": ["data structures", "algorithms", "system design"],
        "title": "LRU Cache Architecture with Doubly-Linked List & Hash Map",
        "category": "DATA_STRUCTURES",
        "difficulty": "INTERMEDIATE",
        "estimatedMinutes": 10,
        "coreSkillsTested": ["O(1) Get & Put", "Doubly Linked List", "Node Eviction"],
        "description": "Implement and analyze thread-safe Least Recently Used cache eviction with strict O(1) time complexity bounds.",
        "sampleStarterQuestion": "Why is a doubly-linked list combined with a hash table required to achieve strict O(1) time complexity for both get and put operations in an LRU cache?",
        "recommendedReason": "Fundamental data structure competency drill"
    },
    # ------------------ BEHAVIORAL & LEADERSHIP (UNIVERSAL) ------------------
    {
        "id": "drill-behavioral-conflict",
        "match_skills": ["behavioral", "leadership"],
        "title": "Architectural Disagreement & Stakeholder Alignment",
        "category": "BEHAVIORAL",
        "difficulty": "BEGINNER",
        "estimatedMinutes": 5,
        "coreSkillsTested": ["STAR Method", "Data-Driven Consensus", "Technical Diplomacy"],
        "description": "Structure articulate responses demonstrating how you resolve technical conflicts using trade-off matrices and data-backed spikes.",
        "sampleStarterQuestion": "Tell me about a time you strongly disagreed with a senior architect on technology selection and how you built consensus.",
        "recommendedReason": "Behavioral dynamics matched to your career stage"
    },
    {
        "id": "drill-production-outage-triage",
        "match_skills": ["behavioral", "leadership", "devops"],
        "title": "High-Pressure Production Incident Triage & Blameless Post-Mortem",
        "category": "BEHAVIORAL",
        "difficulty": "INTERMEDIATE",
        "estimatedMinutes": 8,
        "coreSkillsTested": ["Incident Management", "Blameless Culture", "Root Cause Analysis (5 Whys)"],
        "description": "Demonstrate calm, methodical decision-making during severe production degradations and cross-functional incident mitigation.",
        "sampleStarterQuestion": "Describe a scenario where a critical system outage occurred under your watch. How did you stabilize the service and conduct a blameless post-mortem?",
        "recommendedReason": "Real-world systems leadership drill"
    }
]

SKILL_CATALOG_COLLECTION = "skill_catalog"
DRILL_CATALOG_COLLECTION = "practice_drill_catalog"
PRACTICE_DRILLS_DATA = DRILL_CATALOG  # legacy import compatibility; runtime reads MongoDB
PRACTICE_DRILLS_BY_ID = {}
_CATALOG_SEEDED_DATABASES = set()


def _catalog_collection(db, kind: str):
    if kind == "skills":
        return db[SKILL_CATALOG_COLLECTION]
    if kind == "drills":
        return db[DRILL_CATALOG_COLLECTION]
    raise ValueError("Catalog type must be 'skills' or 'drills'")


def _catalog_id(value: str) -> str:
    value = str(value or "").strip().lower()
    value = value.replace("++", " plus plus ").replace("#", " sharp ").replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:100]


def _ensure_catalog_seeded(db) -> None:
    """Seed initial defaults once; never overwrite administrator edits."""
    database_key = getattr(db, "name", None) or id(db)
    if database_key in _CATALOG_SEEDED_DATABASES:
        return

    skills = db[SKILL_CATALOG_COLLECTION]
    drills = db[DRILL_CATALOG_COLLECTION]
    skills.create_index("id", unique=True)
    drills.create_index("id", unique=True)

    now = datetime.now(timezone.utc)
    if skills.count_documents({}) == 0:
        for name in TECH_SKILLS_TAXONOMY:
            skill_id = _catalog_id(name)
            if skill_id:
                skills.update_one(
                    {"id": skill_id},
                    {"$setOnInsert": {
                        "id": skill_id,
                        "name": name,
                        "category": "General",
                        "aliases": [],
                        "active": True,
                        "created_at": now,
                        "updated_at": now,
                    }},
                    upsert=True,
                )

    if drills.count_documents({}) == 0:
        for seed in DRILL_CATALOG:
            drill = dict(seed)
            drill.update({"active": True, "created_at": now, "updated_at": now})
            drills.update_one({"id": drill["id"]}, {"$setOnInsert": drill}, upsert=True)
    _CATALOG_SEEDED_DATABASES.add(database_key)


def _catalog_rows(kind: str, *, active_only: bool = False, strict: bool = False) -> list[dict]:
    """Read the live catalog; admin edits are visible without a process restart."""
    try:
        db = get_mongo_db()
        _ensure_catalog_seeded(db)
        query = {"active": {"$ne": False}} if active_only else {}
        sort_field = "name" if kind == "skills" else "title"
        rows = list(_catalog_collection(db, kind).find(query).sort(sort_field, 1))
        for row in rows:
            row.pop("_id", None)
            for key in ("created_at", "updated_at"):
                if isinstance(row.get(key), datetime):
                    row[key] = row[key].isoformat()
        return rows
    except Exception:
        if strict:
            raise
        traceback.print_exc()
        return []


def get_active_skill_names() -> list[str]:
    return [row["name"] for row in _catalog_rows("skills", active_only=True) if row.get("name")]


def get_active_drills() -> list[dict]:
    return _catalog_rows("drills", active_only=True)


def get_active_drill_by_id(drill_id: str) -> dict | None:
    try:
        db = get_mongo_db()
        _ensure_catalog_seeded(db)
        drill = db[DRILL_CATALOG_COLLECTION].find_one({"id": str(drill_id), "active": {"$ne": False}})
        if drill:
            drill.pop("_id", None)
        return drill
    except Exception:
        traceback.print_exc()
        return None


def _catalog_string_list(value, field_name: str, *, max_items: int = 30) -> list[str]:
    if not isinstance(value, list):
        raise ValueError(f"{field_name} must be a list of strings")
    cleaned = []
    for item in value[:max_items]:
        if isinstance(item, str) and item.strip():
            text = item.strip()[:160]
            if text not in cleaned:
                cleaned.append(text)
    return cleaned


def _normalize_catalog_payload(kind: str, payload: dict, item_id: str | None = None) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("A JSON object is required")
    active = payload.get("active", True)
    if not isinstance(active, bool):
        raise ValueError("active must be true or false")

    if kind == "skills":
        name = str(payload.get("name", "")).strip()
        if not name or len(name) > 100:
            raise ValueError("Skill name is required and must be at most 100 characters")
        skill_id = item_id or _catalog_id(payload.get("id") or name)
        if not skill_id:
            raise ValueError("Skill id is invalid")
        return {
            "id": skill_id,
            "name": name,
            "category": str(payload.get("category") or "General").strip()[:80],
            "aliases": _catalog_string_list(payload.get("aliases", []), "aliases"),
            "active": active,
        }

    drill_id = item_id or str(payload.get("id", "")).strip()
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{1,99}", drill_id):
        raise ValueError("Drill id must be 2–100 letters, numbers, hyphens, or underscores")
    title = str(payload.get("title", "")).strip()
    description = str(payload.get("description", "")).strip()
    starter_question = str(payload.get("sampleStarterQuestion", "")).strip()
    category = str(payload.get("category", "")).strip().upper()
    difficulty = str(payload.get("difficulty", "")).strip().upper()
    allowed_categories = {str(d.get("category", "")).upper() for d in DRILL_CATALOG}
    if not title or len(title) > 180:
        raise ValueError("Drill title is required and must be at most 180 characters")
    if category not in allowed_categories:
        raise ValueError(f"category must be one of: {', '.join(sorted(allowed_categories))}")
    if difficulty not in {"BEGINNER", "INTERMEDIATE", "ADVANCED"}:
        raise ValueError("difficulty must be BEGINNER, INTERMEDIATE, or ADVANCED")
    try:
        minutes = int(payload.get("estimatedMinutes"))
    except (TypeError, ValueError):
        raise ValueError("estimatedMinutes must be an integer")
    if not 1 <= minutes <= 240:
        raise ValueError("estimatedMinutes must be between 1 and 240")
    if not description or len(description) > 5000:
        raise ValueError("description is required and must be at most 5000 characters")
    if not starter_question or len(starter_question) > 3000:
        raise ValueError("sampleStarterQuestion is required and must be at most 3000 characters")
    return {
        "id": drill_id,
        "title": title,
        "category": category,
        "difficulty": difficulty,
        "estimatedMinutes": minutes,
        "coreSkillsTested": _catalog_string_list(payload.get("coreSkillsTested", []), "coreSkillsTested"),
        "match_skills": [s.lower() for s in _catalog_string_list(payload.get("match_skills", []), "match_skills")],
        "description": description,
        "sampleStarterQuestion": starter_question,
        "recommendedReason": str(payload.get("recommendedReason", "")).strip()[:500],
        "active": active,
    }


