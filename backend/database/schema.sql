-- Adobe Hackathon PDF Research Companion Database Schema

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- PDFs table (stores uploaded PDF information)
CREATE TABLE IF NOT EXISTS pdfs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    -- Optional legacy filesystem fields
    file_path TEXT,
    filename TEXT,
    -- New binary storage
    file_data BLOB,
    file_size INTEGER,
    page_count INTEGER,
    content_json TEXT, -- Stores extracted sections as JSON
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, error
    -- Location: 'uploads' or 'library'
    location TEXT DEFAULT 'uploads',
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- PDF Sections table (stores individual sections with embeddings)
CREATE TABLE IF NOT EXISTS pdf_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pdf_id INTEGER NOT NULL,
    section_title TEXT NOT NULL,
    content TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    section_index INTEGER NOT NULL, -- Order within the PDF
    embedding_json TEXT, -- Stores the embedding vector as JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pdf_id) REFERENCES pdfs (id) ON DELETE CASCADE
);

-- Insights table (stores generated insights)
CREATE TABLE IF NOT EXISTS insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pdf_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    persona TEXT NOT NULL,
    job_to_be_done TEXT NOT NULL,
    section_title TEXT,
    content TEXT,
    page_number INTEGER,
    relevance_score REAL,
    importance_rank INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pdf_id) REFERENCES pdfs (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Related sections table (for connecting the dots feature)
CREATE TABLE IF NOT EXISTS related_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_pdf_id INTEGER NOT NULL,
    target_pdf_id INTEGER NOT NULL,
    source_section_title TEXT,
    target_section_title TEXT,
    similarity_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_pdf_id) REFERENCES pdfs (id) ON DELETE CASCADE,
    FOREIGN KEY (target_pdf_id) REFERENCES pdfs (id) ON DELETE CASCADE
);

-- User sessions table (for managing authentication)
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Processing jobs table (for background tasks)
CREATE TABLE IF NOT EXISTS processing_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    pdf_id INTEGER,
    job_type TEXT NOT NULL, -- 'pdf_processing', 'insight_generation', 'related_sections'
    status TEXT DEFAULT 'queued', -- queued, running, completed, failed
    input_data TEXT, -- JSON input for the job
    output_data TEXT, -- JSON output from the job
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (pdf_id) REFERENCES pdfs (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pdfs_user_id ON pdfs (user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_sections_pdf_id ON pdf_sections (pdf_id);
CREATE INDEX IF NOT EXISTS idx_pdf_sections_page_number ON pdf_sections (page_number);
CREATE INDEX IF NOT EXISTS idx_insights_pdf_id ON insights (pdf_id);
CREATE INDEX IF NOT EXISTS idx_insights_user_id ON insights (user_id);
CREATE INDEX IF NOT EXISTS idx_related_sections_source ON related_sections (source_pdf_id);
CREATE INDEX IF NOT EXISTS idx_related_sections_target ON related_sections (target_pdf_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs (status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user ON processing_jobs (user_id);
