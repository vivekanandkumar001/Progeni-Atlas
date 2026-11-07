"""
Progeni Atlas — Shared Constants & Taxonomies
==============================================
Common directory paths and engineering skill taxonomies.
"""

import os
import tempfile

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
DEFAULT_RECORDING_DIR = os.path.join(BASE_DIR, "recordings")

def _resolve_writable_dir(preferred_path: str, fallback_name: str) -> str:
    try:
        os.makedirs(preferred_path, exist_ok=True)
        test_file = os.path.join(preferred_path, ".write_test")
        with open(test_file, "w") as f:
            f.write("ok")
        if os.path.exists(test_file):
            os.remove(test_file)
        return preferred_path
    except (OSError, PermissionError):
        fallback_path = os.path.join(tempfile.gettempdir(), "progeni_atlas", fallback_name)
        try:
            os.makedirs(fallback_path, exist_ok=True)
        except Exception:
            pass
        return fallback_path

UPLOAD_DIR = _resolve_writable_dir(DEFAULT_UPLOAD_DIR, "uploads")
RECORDING_DIR = _resolve_writable_dir(DEFAULT_RECORDING_DIR, "recordings")

TECH_SKILLS_TAXONOMY = [
    # Languages
    "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Golang", "Rust", "Ruby", "PHP", "SQL",
    # Frontend
    "React", "React.js", "Next.js", "Vue", "Vue.js", "Angular", "HTML5", "CSS3", "Tailwind CSS", "Redux", "Zustand",
    # Backend & APIs
    "Node.js", "Express", "FastAPI", "Django", "Flask", "Spring Boot", "GraphQL", "REST APIs", "WebSockets", "WebRTC",
    # Databases & Caches
    "MongoDB", "Redis", "MySQL", "SQLite", "Cassandra", "DynamoDB", "Elasticsearch",
    # Cloud & DevOps
    "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Terraform", "CI/CD", "Linux", "Git",
    # Architecture & Messaging
    "System Design", "Microservices", "Kafka", "Apache Kafka", "RabbitMQ", "Saga Pattern",
    # Core CS
    "Data Structures", "Algorithms", "Concurrency", "Multithreading", "Distributed Systems",
    # AI & ML
    "Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "Pandas", "NumPy", "Scikit-Learn", "NLP", "LLMs", "Vector DBs", "Qdrant"
]
