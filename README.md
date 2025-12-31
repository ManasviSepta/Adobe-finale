# Adobe Finale - AI-Powered Research Companion

A comprehensive web application that transforms PDF research documents into interactive, AI-enhanced learning experiences. Adobe Finale combines document analysis, AI insights, and audio generation to create an intelligent research companion.

## 🎯 Project Overview

Adobe Finale is a full-stack web application that helps researchers, students, and professionals extract maximum value from their PDF documents through:

- **Intelligent Document Analysis**: AI-powered PDF processing and structure extraction
- **Interactive Insights**: Generate summaries, key points, and research questions
- **Audio Generation**: Convert text content to speech for accessibility
- **Adobe PDF Integration**: Seamless PDF viewing and annotation capabilities
- **User Management**: Secure authentication and document library management

## 🏗️ Architecture & Approach

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   ML Pipeline   │
│   (React/TS)    │◄──►│   (Flask/Python)│◄──►│   (AI Models)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌─────────┐            ┌─────────┐            ┌─────────┐
    │ Adobe   │            │ SQLite  │            │Sentence │
    │ Embed   │            │ Database│            │Transform│
    │ API     │            │         │            │ Model   │
    └─────────┘            └─────────┘            └─────────┘
```

### Workflow

1. **Document Upload & Processing**
   - User uploads PDF via drag-and-drop interface
   - Backend processes PDF using `pdfplumber` for text extraction
   - AI models analyze document structure and content
   - Document metadata stored in SQLite database

2. **AI Analysis Pipeline**
   - **Document Structure Analysis**: Identifies sections, subsections, and content hierarchy
   - **Content Embedding**: Uses SentenceTransformer (`all-MiniLM-L6-v2`) for semantic analysis
   - **Key Point Extraction**: Leverages KeyBERT for keyword and key phrase identification
   - **Insight Generation**: AI-powered summaries and research questions

3. **Interactive Features**
   - **Adobe PDF Viewer**: Integrated PDF viewing with annotation capabilities
   - **Insights Panel**: AI-generated summaries, key points, and questions
   - **Audio Generation**: Text-to-speech conversion using Azure TTS or Google Cloud TTS
   - **Library Management**: Organize and search through uploaded documents

4. **User Experience**
   - **Responsive Design**: Modern UI built with React, TypeScript, and Tailwind CSS
   - **Real-time Updates**: Live document processing status and progress indicators
   - **Authentication**: JWT-based user authentication and session management

## 🛠️ Technologies & Libraries

### Frontend Stack
- **React 18.3.1** - Modern UI framework with hooks and functional components
- **TypeScript 5.5.3** - Type-safe JavaScript development
- **Vite 5.4.2** - Fast build tool and development server
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **Lucide React 0.344.0** - Beautiful icon library
- **Adobe Embed API** - PDF viewing and annotation capabilities

### Backend Stack
- **Flask 2.3.2** - Lightweight Python web framework
- **Flask-CORS 3.0.10** - Cross-origin resource sharing
- **Flask-JWT-Extended 4.6.0** - JWT authentication
- **Flask-SQLAlchemy 3.1.1** - Database ORM
- **SQLite** - Lightweight database for data persistence

### AI & ML Libraries
- **SentenceTransformers 2.7.0** - Semantic text embeddings using `all-MiniLM-L6-v2`
- **KeyBERT 0.8.0** - Keyword extraction and key phrase identification
- **Scikit-learn 1.5.0** - Machine learning utilities
- **NLTK 3.8.1** - Natural language processing toolkit
- **PyTorch 2.2.0** - Deep learning framework (CPU optimized)

### Document Processing
- **PDFPlumber 0.9.0** - PDF text extraction and structure analysis
- **NumPy 1.26.4** - Numerical computing

### AI Integration
- **LangChain 0.3.27** - LLM orchestration framework
- **Google Generative AI 0.8.5** - Gemini model integration
- **OpenAI Integration** - GPT model support (configurable)

### Audio Generation
- **Google Cloud Text-to-Speech 2.27.0** - Cloud-based TTS
- **Azure Cognitive Services** - Alternative TTS provider
- **Pydub 0.25.0** - Audio processing and manipulation

### Development & Deployment
- **Docker & Docker Compose** - Containerization and orchestration
- **Python-dotenv 1.0.1** - Environment variable management
- **Passlib 1.7.4** - Password hashing and security

## 🚀 How to Build and Run

### Prerequisites
- **Docker & Docker Compose** (recommended)
- **Node.js 18+** (for frontend development)
- **Python 3.11+** (for backend development)
- **Adobe Embed API Key** (for PDF viewing features)

### Option 1: Docker Deployment (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "Adobe Finale"
   ```

2. **Build the Docker image**
   ```bash
   docker build --platform linux/amd64 -t adobe-pdf-companion .
   ```

3. **Run the application (Choose one of the following options)**

   **Option A: Using Google Cloud credentials file**
   ```bash
   docker run -v /path/to/credentials:/credentials \
     -e ADOBE_EMBED_API_KEY=<ADOBE_EMBED_API_KEY> \
     -e LLM_PROVIDER=gemini \
     -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json \
     -e GEMINI_MODEL=gemini-2.5-flash \
     -e TTS_PROVIDER=azure \
     -e AZURE_TTS_KEY=<AZURE_TTS_KEY> \
     -e AZURE_TTS_ENDPOINT=<AZURE_TTS_ENDPOINT> \
     -p 8080:8080 \
     adobe-pdf-companion
   ```

   **Option B: Using direct API keys**
   ```bash
   docker run \
     -e ADOBE_EMBED_API_KEY=<my_adobe_key> \
     -e LLM_PROVIDER=gemini \
     -e GEMINI_MODEL=gemini-2.5-flash \
     -e GOOGLE_API_KEY=<my_gemini_key> \
     -e TTS_PROVIDER=azure \
     -e AZURE_TTS_KEY=<azure_tts_key> \
     -e AZURE_TTS_ENDPOINT=<endpoint>/ \
     -p 8080:8080 \
     adobe-pdf-companion
   ```

4. **Access the application**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:8080/api
   - Health Check: http://localhost:8080/api/health

### Option 2: Local Development

#### Backend Setup
1. **Navigate to backend directory**
```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   # Create .env file in backend directory
   FLASK_ENV=development
   ADOBE_EMBED_API_KEY=your_adobe_embed_api_key
   LLM_PROVIDER=gemini
   GOOGLE_API_KEY=your_google_api_key
   TTS_PROVIDER=azure
   AZURE_TTS_KEY=your_azure_tts_key
   AZURE_TTS_ENDPOINT=your_azure_tts_endpoint
   ```

5. **Initialize database**
```bash
   sqlite3 database/research_companion.db ".read database/schema.sql"
   ```

6. **Run the backend**
   ```bash
   python app.py
   ```

#### Frontend Setup
1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8080/api

### Default Login Credentials
- **Email**: demo@example.com
- **Password**: demo1234

## 📁 Project Structure

```
Adobe Finale/
├── backend/                    # Python Flask backend
│   ├── app.py                 # Main Flask application
│   ├── config.py              # Configuration settings
│   ├── requirements.txt       # Python dependencies
│   ├── database/              # Database schema and files
│   ├── models/                # Data models
│   ├── routes/                # API route handlers
│   ├── middleware/            # Custom middleware
│   ├── python_model/          # AI/ML processing pipeline
│   │   ├── ml_model.py        # SentenceTransformer model
│   │   └── src/
│   │       ├── document_analyzer/  # PDF processing
│   │       └── io_handlers/        # Input/output handlers
│   └── static/                # Built frontend assets
├── frontend/                  # React TypeScript frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── contexts/          # React contexts
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API services
│   │   └── types/             # TypeScript type definitions
│   ├── package.json           # Node.js dependencies
│   └── vite.config.ts         # Vite configuration
├── docker-compose.yml         # Docker orchestration
├── Dockerfile                 # Multi-stage Docker build
└── README.md                  # This file
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADOBE_EMBED_API_KEY` | Adobe Embed API client ID | Required |
| `LLM_PROVIDER` | AI model provider (gemini, ollama, openai) | gemini |
| `GEMINI_MODEL` | Google Gemini model name | gemini-2.5-flash |
| `GOOGLE_API_KEY` | Google AI API key | Required for Gemini |
| `TTS_PROVIDER` | Text-to-speech provider (azure, google) | azure |
| `AZURE_TTS_KEY` | Azure Cognitive Services key | Required for Azure TTS |
| `AZURE_TTS_ENDPOINT` | Azure TTS endpoint URL | Required for Azure TTS |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth/login` | POST | User authentication |
| `/api/auth/register` | POST | User registration |
| `/api/pdf/upload` | POST | PDF upload and processing |
| `/api/pdf/list` | GET | List user's PDFs |
| `/api/insights/generate` | POST | Generate AI insights |
| `/api/audio/generate` | POST | Generate audio from text |

## 🎨 Features

### Core Features
- **PDF Upload & Processing**: Drag-and-drop PDF upload with AI-powered analysis
- **Document Structure Analysis**: Automatic section and subsection identification
- **AI Insights Generation**: Summaries, key points, and research questions
- **Audio Generation**: Text-to-speech conversion for accessibility
- **Adobe PDF Integration**: Professional PDF viewing and annotation
- **User Authentication**: Secure login and registration system
- **Document Library**: Organize and search through uploaded documents

### AI Capabilities
- **Semantic Analysis**: Using SentenceTransformer for content understanding
- **Keyword Extraction**: KeyBERT-powered key phrase identification
- **Content Summarization**: AI-generated document summaries
- **Question Generation**: Automatic research question creation
- **Multi-Model Support**: Configurable AI providers (Gemini, OpenAI, Ollama)

### User Experience
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Real-time Processing**: Live status updates during document analysis
- **Modern UI**: Clean, intuitive interface built with Tailwind CSS
- **Accessibility**: Audio generation and keyboard navigation support

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt password encryption
- **Rate Limiting**: API request rate limiting
- **CORS Protection**: Cross-origin resource sharing configuration
- **Input Validation**: Server-side input sanitization

## 🚀 Performance Optimizations

- **Model Caching**: SentenceTransformer model loaded once at startup
- **Database Indexing**: Optimized SQLite queries
- **Static Asset Serving**: Efficient frontend asset delivery
- **Docker Multi-stage Build**: Optimized container image size
- **Lazy Loading**: Components loaded on demand

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Adobe Finale** - Transforming research documents into intelligent learning experiences. 🚀