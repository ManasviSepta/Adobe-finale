import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'my-secret-key')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key')
    
    # Development flag - set to 'true' to disable JWT expiration
    DEVELOPMENT_MODE = os.getenv('DEVELOPMENT_MODE', 'true').lower() == 'true'
    
    # JWT Configuration - Disable expiration for development
    if DEVELOPMENT_MODE:
        JWT_ACCESS_TOKEN_EXPIRES = False  # Tokens never expire in development
        JWT_REFRESH_TOKEN_EXPIRES = False  # Refresh tokens also never expire
    else:
        JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)  # 1 hour in production
        JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)  # 30 days in production
    
    # Use absolute path for database
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    DB_PATH = os.path.join(BASE_DIR, os.getenv('DATABASE_PATH', 'database/research_companion.db'))
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_PATH}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(BASE_DIR, os.getenv('UPLOAD_FOLDER', 'uploads'))
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 50 * 1024 * 1024))
    CORS_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173')
