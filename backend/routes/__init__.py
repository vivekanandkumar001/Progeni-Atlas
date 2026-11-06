"""
Progeni Atlas — Routes Package
================================
Exports all modular Flask Blueprints for clean app registration.
"""

from routes.system_routes import system_bp
from routes.auth_routes import auth_bp
from routes.candidate_routes import candidate_bp
from routes.recruiter_routes import recruiter_bp
from routes.billing_routes import billing_bp
from routes.interview_routes import interview_bp
from routes.super_admin_routes import super_admin_bp

__all__ = [
    "system_bp",
    "auth_bp",
    "candidate_bp",
    "recruiter_bp",
    "billing_bp",
    "interview_bp",
    "super_admin_bp",
]
