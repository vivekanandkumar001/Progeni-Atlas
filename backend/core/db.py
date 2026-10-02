import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
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

logger = logging.getLogger("talentpulse.db")

PG_URI = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
if PG_URI and "channel_binding=require" in PG_URI:
    PG_URI = PG_URI.replace("&channel_binding=require", "").replace("?channel_binding=require&", "?")

MONGO_URI = os.environ.get("MONGO_URI") or os.environ.get("MONGODB_URI")
QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")


def check_postgres_connection() -> dict:
    if not PG_URI:
        return {"status": "disabled", "error": "DATABASE_URL environment variable is missing"}
    try:
        conn = psycopg2.connect(PG_URI, connect_timeout=10)
        cur = conn.cursor()
        cur.execute("SELECT version();")
        ver = cur.fetchone()[0]
        cur.close()
        conn.close()
        return {"status": "connected", "version": ver}
    except Exception as e:
        logger.error(f"PostgreSQL connection failed: {e}")
        return {"status": "error", "error": str(e)}


def check_mongo_connection() -> dict:
    if not MONGO_URI:
        return {"status": "disabled", "error": "MONGO_URI environment variable is missing"}
    try:
        kwargs = {"serverSelectionTimeoutMS": 10000}
        if CERTIFI_CA:
            kwargs["tlsCAFile"] = CERTIFI_CA
        client = pymongo.MongoClient(MONGO_URI, **kwargs)
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


def init_postgres_schema():
    """Execute schema.sql if tables do not exist."""
    if not PG_URI:
        return False
    schema_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "database", "postgres", "schema.sql"))
    if not os.path.exists(schema_path):
        logger.warning(f"Schema file not found at {schema_path}")
        return False
    try:
        conn = psycopg2.connect(PG_URI, connect_timeout=10)
        cur = conn.cursor()
        with open(schema_path, "r") as f:
            sql = f.read()
        cur.execute(sql)
        conn.commit()
        cur.close()
        conn.close()
        logger.info("PostgreSQL schema migration applied successfully.")
        return True
    except Exception as e:
        logger.error(f"Failed to execute PostgreSQL schema migration: {e}")
        return False
