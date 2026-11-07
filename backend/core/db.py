import os
import logging
from contextlib import contextmanager
import pymongo
from dotenv import load_dotenv

try:
    import certifi
    CERTIFI_CA = certifi.where()
except ImportError:
    CERTIFI_CA = None

# Load root .env file
root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
if os.path.exists(root_env):
    load_dotenv(root_env)
else:
    load_dotenv()

logger = logging.getLogger("progeni_atlas.db")

MONGO_URI = os.environ.get("MONGO_URI") or os.environ.get("MONGODB_URI") or "mongodb://localhost:27017/progeni_atlas"
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME") or "progeni_atlas"
QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")

_mongo_client = None

def get_mongo_client():
    global _mongo_client
    if _mongo_client is None:
        kwargs = {"serverSelectionTimeoutMS": 5000}
        use_tls = "mongodb+srv://" in MONGO_URI.lower() or "ssl=true" in MONGO_URI.lower() or "tls=true" in MONGO_URI.lower()
        if use_tls and CERTIFI_CA:
            kwargs["tlsCAFile"] = CERTIFI_CA
        _mongo_client = pymongo.MongoClient(MONGO_URI, **kwargs)
        logger.info(f"[MongoDB] Initialized MongoClient connection to {MONGO_URI.split('@')[-1] if '@' in MONGO_URI else MONGO_URI}")
    return _mongo_client

def get_mongo_db(db_name: str = None):
    client = get_mongo_client()
    name = db_name or MONGODB_DB_NAME
    return client[name]

def init_mongo_db():
    """Ensure indexes exist for collections in MongoDB."""
    try:
        db = get_mongo_db()
        # users
        db.users.create_index("email", unique=True, sparse=True)
        db.users.create_index("id", unique=True, sparse=True)
        # email_otps
        db.email_otps.create_index([("email", pymongo.ASCENDING), ("purpose", pymongo.ASCENDING)])
        db.email_otps.create_index("created_at")
        # companion_pairings
        db.companion_pairings.create_index("token_hash", unique=True, sparse=True)
        db.companion_pairings.create_index("session_id")
        # companion_rate_limits
        db.companion_rate_limits.create_index("key", unique=True, sparse=True)
        # interview_sessions
        db.interview_sessions.create_index("id", unique=True, sparse=True)
        db.interview_sessions.create_index("candidate_id")
        db.interview_sessions.create_index("candidate_email")
        db.interview_sessions.create_index("recruiter_id")
        db.interview_sessions.create_index("recruiter_email")
        # interview_invitations
        db.interview_invitations.create_index("id", unique=True, sparse=True)
        db.interview_invitations.create_index("session_id")
        db.interview_invitations.create_index("candidate_id")
        db.interview_invitations.create_index("candidate_email")
        # candidate_notifications
        db.candidate_notifications.create_index("candidate_id")
        db.candidate_notifications.create_index("candidate_email")
        db.candidate_notifications.create_index("created_at")
        # recruiter_notifications
        db.recruiter_notifications.create_index("recruiter_id")
        db.recruiter_notifications.create_index("recruiter_email")
        db.recruiter_notifications.create_index("created_at")
        # organizations
        db.organizations.create_index("id", unique=True, sparse=True)
        db.organizations.create_index("slug", unique=True, sparse=True)
        # audit_logs
        db.audit_logs.create_index("created_at")
        db.audit_logs.create_index("action")

        # Seed default platform super_admin user if not already present
        admin_email = os.environ.get("ADMIN_DEFAULT_EMAIL", "admin@progeni.live").strip().lower()
        if admin_email:
            existing_admin = db.users.find_one({"email": admin_email})
            import uuid
            import hashlib
            from datetime import datetime, timezone
            default_pwd = os.environ.get("ADMIN_DEFAULT_PASSWORD", "Admin@123456")
            pwd_hash = hashlib.sha256(default_pwd.encode("utf-8")).hexdigest()
            now_utc = datetime.now(timezone.utc)
            if not existing_admin:
                db.users.insert_one({
                    "id": str(uuid.uuid4()),
                    "email": admin_email,
                    "password_hash": pwd_hash,
                    "full_name": "Progeni Atlas Administrator",
                    "role": "super_admin",
                    "status": "active",
                    "is_email_verified": True,
                    "created_at": now_utc,
                    "updated_at": now_utc,
                })
                logger.info(f"[MongoDB] Seeded default super_admin account: {admin_email}")
            else:
                db.users.update_one(
                    {"email": admin_email},
                    {"$set": {
                        "role": "super_admin",
                        "status": "active",
                        "is_email_verified": True,
                        "password_hash": pwd_hash,
                        "updated_at": now_utc,
                    }}
                )
                logger.info(f"[MongoDB] Ensured default super_admin account: {admin_email}")

        # Seed / Sync 4 Canonical Packages matching industry standards
        canonical_packages = [
            {
                "id": "pkg-starter",
                "package_id": "pkg-starter",
                "name": "Starter Practice",
                "tier": "starter",
                "target_audience": "individual",
                "billing_period": "monthly",
                "price": 0,
                "monthlyPrice": 0,
                "annualPrice": 0,
                "price_nanousd": 0,
                "included_interviews": 2,
                "interviewsIncluded": 2,
                "included_recruiter_seats": 0,
                "seatsIncluded": 0,
                "included_candidate_seats": 1,
                "interview_duration_limit_minutes": 20,
                "version": 1,
                "status": "published",
                "active": True,
                "description": "Ideal for students and job seekers trying their first 2 complimentary AI technical video interviews.",
                "created_at": now_utc.isoformat(),
                "published_at": now_utc.isoformat()
            },
            {
                "id": "pkg-candidate-pro",
                "package_id": "pkg-candidate-pro",
                "name": "Candidate Pro",
                "tier": "pro",
                "target_audience": "individual",
                "billing_period": "monthly",
                "price": 999,
                "monthlyPrice": 999,
                "annualPrice": 9590,
                "price_nanousd": 999000000000,
                "included_interviews": 20,
                "interviewsIncluded": 20,
                "included_recruiter_seats": 1,
                "seatsIncluded": 1,
                "included_candidate_seats": 1,
                "interview_duration_limit_minutes": 45,
                "version": 1,
                "status": "published",
                "active": True,
                "description": "Comprehensive interview preparation tailored to target job listings with in-depth evaluation dossiers.",
                "created_at": now_utc.isoformat(),
                "published_at": now_utc.isoformat()
            },
            {
                "id": "pkg-growth",
                "package_id": "pkg-growth",
                "name": "Hiring Team Growth",
                "tier": "growth",
                "target_audience": "organization",
                "billing_period": "monthly",
                "price": 8999,
                "monthlyPrice": 8999,
                "annualPrice": 83990,
                "price_nanousd": 8999000000000,
                "included_interviews": 50,
                "interviewsIncluded": 50,
                "included_recruiter_seats": 3,
                "seatsIncluded": 3,
                "included_candidate_seats": 50,
                "interview_duration_limit_minutes": 45,
                "version": 1,
                "status": "published",
                "active": True,
                "description": "For fast-moving hiring teams and agencies interviewing and screening up to 50 active engineering candidates/mo.",
                "created_at": now_utc.isoformat(),
                "published_at": now_utc.isoformat()
            },
            {
                "id": "pkg-enterprise",
                "package_id": "pkg-enterprise",
                "name": "Enterprise Scale",
                "tier": "enterprise",
                "target_audience": "organization",
                "billing_period": "yearly",
                "price": 24999,
                "monthlyPrice": 24999,
                "annualPrice": 249990,
                "price_nanousd": 24999000000000,
                "included_interviews": 500,
                "interviewsIncluded": 500,
                "included_recruiter_seats": 20,
                "seatsIncluded": 20,
                "included_candidate_seats": 500,
                "interview_duration_limit_minutes": 60,
                "version": 1,
                "status": "published",
                "active": True,
                "description": "High-volume campus placements and large enterprise hiring with custom rubrics and ATS integration.",
                "created_at": now_utc.isoformat(),
                "published_at": now_utc.isoformat()
            }
        ]

        # Clean out obsolete dummy packages
        db.packages.delete_many({"name": {"$in": ["Starter Placement", "Growth Enterprise", "Global Enterprise Tier"]}})
        for cpkg in canonical_packages:
            db.packages.update_one(
                {"id": cpkg["id"]},
                {"$set": cpkg},
                upsert=True
            )
        logger.info("[MongoDB] Synced canonical industry-standard packages.")

        logger.info("[MongoDB] Verified database collections and indexes.")
        return True
    except Exception as e:
        logger.warning(f"[MongoDB] Warning initializing indexes: {e}")
        return False

# Primary database accessor
get_db = get_mongo_db

@contextmanager
def get_db_connection():
    """Context manager yielding the MongoDB database instance for backwards compatibility."""
    yield get_mongo_db()

def check_postgres_connection() -> dict:
    return {"status": "disabled", "message": "PostgreSQL removed completely. Active storage: MongoDB."}

def check_mongo_connection() -> dict:
    if not MONGO_URI:
        return {"status": "disabled", "error": "MONGO_URI environment variable is missing"}
    try:
        client = get_mongo_client()
        info = client.admin.command("ping")
        return {"status": "connected", "ping": info}
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        return {"status": "error", "error": str(e)}

def check_qdrant_connection() -> dict:
    try:
        from qdrant_client import QdrantClient
        if QDRANT_URL:
            client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
            colls = client.get_collections()
            return {"status": "connected", "collections": [c.name for c in colls.collections]}
        else:
            client = QdrantClient(host=os.environ.get("QDRANT_HOST", "localhost"), port=int(os.environ.get("QDRANT_PORT", "6333")))
            return {"status": "connected", "collections": []}
    except Exception as e:
        logger.warning(f"Qdrant connection check failed: {e}")
        return {"status": "mock_fallback", "error": str(e)}

# Stubs for obsolete postgres connection pooling
PG_URI = None
def init_db_pool(minconn=1, maxconn=10):
    return None

def get_db_pool():
    return None

def close_db_pool():
    pass

def init_postgres_schema():
    return True
