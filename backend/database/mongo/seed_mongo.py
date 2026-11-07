import os
import pymongo
import certifi
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))
mongo_uri = os.environ.get("MONGO_URI") or os.environ.get("MONGODB_URI")


def seed_mongo():
    if not mongo_uri:
        print("No MONGO_URI provided.")
        return
    client = pymongo.MongoClient(mongo_uri, tlsCAFile=certifi.where())
    db = client.get_database("progeni_atlas_docs")

    # 1. Seed Interview Transcript
    transcript_coll = db["interview_transcripts"]
    transcript_coll.delete_many({})
    transcript_doc = {
        "sessionId": "e1111111-1111-1111-1111-111111111111",
        "candidateId": "c3333333-3333-3333-3333-333333333333",
        "turns": [
            {
                "turnIndex": 0,
                "stage": "intro",
                "speaker": "ai_interviewer",
                "text": "Hello Vivekanand! Welcome to your technical screening for Senior Full-Stack & Systems Architecture Engineer at CloudScale Systems. Could you start with a brief overview of your background?",
                "audioClipUrl": "https://storage.progeni.live/audio/e1111111-1111-1111-1111-111111111111/turn_0.webm",
                "latencyMs": 320,
            },
            {
                "turnIndex": 1,
                "stage": "intro",
                "speaker": "candidate",
                "text": "Thank you! I have over 4 years of experience specializing in Next.js frontend applications, Node.js microservices, PostgreSQL relational modeling, and real-time streaming architectures.",
                "audioClipUrl": "https://storage.progeni.live/audio/e1111111-1111-1111-1111-111111111111/turn_1.webm",
                "latencyMs": 410,
            }
        ]
    }
    transcript_coll.insert_one(transcript_doc)
    print("Inserted transcript into MongoDB Atlas.")

    # 2. Seed Turn Evaluation
    eval_coll = db["turn_evaluations"]
    eval_coll.delete_many({})
    eval_doc = {
        "sessionId": "e1111111-1111-1111-1111-111111111111",
        "turnIndex": 1,
        "questionAsked": "Could you start with a brief overview of your background?",
        "candidateAnswer": "Thank you! I have over 4 years of experience specializing in Next.js frontend applications, Node.js microservices, PostgreSQL relational modeling, and real-time streaming architectures.",
        "expectedConcepts": ["Next.js", "Node.js", "PostgreSQL", "System Design"],
        "metrics": {
            "relevanceScore": 9.2,
            "depthScore": 8.8,
            "correctnessScore": 9.5
        },
        "proctoring": {
            "gazeConfidence": 0.98,
            "audioVoiceCount": 1,
            "tabFocusLost": False
        },
        "missingConcepts": [],
        "redFlagsDetected": [],
        "actionDecision": "PASS",
        "recommendedFollowUp": "Ask about database sharding tradeoffs in high-throughput messaging."
    }
    eval_coll.insert_one(eval_doc)
    print("Inserted turn evaluation into MongoDB Atlas.")


if __name__ == "__main__":
    seed_mongo()
