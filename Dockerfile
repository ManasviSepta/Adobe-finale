# Multi-stage Dockerfile for React + Python backend
# Stage 1: Build React app
FROM node:18 AS frontend-builder

# Set working directory
WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy frontend source code
COPY frontend/ ./

# Build the React app
RUN npm run build

# Stage 2: Python backend with React frontend
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy Python requirements first
COPY backend/requirements.txt ./

# Install system dependencies and Python dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ffmpeg \
    sqlite3 \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend source code
COPY backend/ ./backend/

# Copy the built React app from Stage 1 into Flask static dir
COPY --from=frontend-builder /app/frontend/dist ./backend/static

# Create necessary directories
RUN mkdir -p uploads database audio

# Set up database: apply schema and seed demo data
RUN sqlite3 backend/database/research_companion.db ".read backend/database/schema.sql" && \
    python - <<'PY'
import sqlite3
from passlib.hash import bcrypt

db_path = 'backend/database/research_companion.db'
conn = sqlite3.connect(db_path)
try:
    password_hash = bcrypt.hash('demo1234')
    conn.execute("INSERT OR IGNORE INTO users (email, name, password_hash) VALUES (?, ?, ?)",
                 ('demo@example.com', 'Demo User', password_hash))
    conn.commit()
    print('Database schema applied and demo user seeded: demo@example.com / demo1234')
finally:
    conn.close()
PY

# Set environment variables
ENV FLASK_APP=backend/app.py
ENV FLASK_ENV=production
ENV PYTHONPATH=/app/backend

# Environment variables for the web app - these will be overridden by docker run
ENV ADOBE_EMBED_API_KEY=""
ENV LLM_PROVIDER="gemini"
ENV GEMINI_MODEL="gemini-2.5-flash"
ENV GOOGLE_API_KEY=""
ENV GOOGLE_APPLICATION_CREDENTIALS=""
ENV TTS_PROVIDER="azure"
ENV AZURE_TTS_KEY=""
ENV AZURE_TTS_ENDPOINT=""

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Run the Flask app
CMD ["python", "backend/app.py"]
