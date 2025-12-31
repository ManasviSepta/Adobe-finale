from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from config import Config
from models.database import db
from routes.auth_routes import auth_bp
from routes.pdf_routes import pdf_bp
from routes.insights_routes import insights_bp
from routes.user_routes import user_bp
from routes.library_routes import library_bp
from middleware.rate_limiter import create_rate_limiter
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static', static_url_path='')
app.config.from_object(Config)
db.init_app(app)

limiter = create_rate_limiter()
limiter.init_app(app)

# JWT Configuration - Tokens never expire in development (see config.py)
# To enable token expiration in production, set DEVELOPMENT_MODE=false in .env file
jwt = JWTManager(app)

# Log JWT configuration for development
import logging
logger = logging.getLogger(__name__)
logger.info(f"JWT Configuration - Access Token Expires: {app.config.get('JWT_ACCESS_TOKEN_EXPIRES', 'Not set')}")
logger.info(f"JWT Secret Key: {'Set' if app.config.get('JWT_SECRET_KEY') else 'Not set'}")

# Update CORS configuration to allow all origins for testing
CORS(app, 
     supports_credentials=True, 
     origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.3000", "http://localhost:8080", "http://127.0.0.1:8080"],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
     expose_headers=['Content-Type', 'Authorization'],
     max_age=3600)
app.config['PYTHON_MODEL_PATH'] = 'python_model'

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(pdf_bp)
app.register_blueprint(insights_bp)
app.register_blueprint(user_bp)
app.register_blueprint(library_bp)

# Load ML model at startup
def load_ml_model():
    """Load the ML model at application startup"""
    try:
        logger.info("Loading ML model at Flask startup...")
        from python_model.ml_model import get_model, get_model_status
        
        # This will trigger model loading
        model = get_model()
        status = get_model_status()
        
        if status['available']:
            logger.info(f"ML model loaded successfully: {status['message']}")
        else:
            logger.warning(f"ML model not ready: {status['message']}")
            
        return status
    except Exception as e:
        logger.error(f"Failed to load ML model at startup: {e}")
        return {
            'status': 'error',
            'message': f'Failed to load model: {str(e)}',
            'available': False
        }

# Debug route to check if the app is running
@app.route('/debug')
def debug():
    return jsonify({'status': 'ok', 'routes': [str(rule) for rule in app.url_map.iter_rules()]})

@app.route('/uploads/<path:filename>')
def uploads(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/health')
def health():
    return {"status": "OK", "message": "Flask backend running!"}

# Expose Adobe Embed API key from environment at runtime
@app.route('/api/config/adobe-embed-key', methods=['GET'])
def get_adobe_embed_key():
    client_id = os.getenv('ADOBE_EMBED_API_KEY', '')
    return jsonify({"clientId": client_id})

@app.route('/api/cors-test', methods=['GET'])
def cors_test():
    """Test endpoint for CORS configuration"""
    return jsonify({
        "status": "OK", 
        "message": "CORS test successful!",
        "origin": request.headers.get('Origin', 'No origin header'),
        "method": request.method
    })

@app.route('/api/ml-health')
def ml_health():
    try:
        from python_model.main import get_model_status
        ml_status = get_model_status()
        return {
            "status": "OK", 
            "message": "Flask backend running!",
            "ml_model": ml_status
        }
    except Exception as e:
        return {
            "status": "OK",
            "message": "Flask backend running!",
            "ml_model": {
                "status": "error",
                "message": f"Failed to check ML model: {str(e)}",
                "available": False
            }
        }

# Serve React app for all non-API routes (supports React Router)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    # Don't serve React app for API routes
    if path.startswith('api/'):
        return jsonify({'error': 'API route not found'}), 404
    
    # Check if React static files exist
    if not os.path.exists(app.static_folder) or not os.path.exists(os.path.join(app.static_folder, 'index.html')):
        # In development, redirect to Vite dev server
        return jsonify({
            'message': 'React app not built. Please run:',
            'instructions': [
                '1. cd frontend && npm run build',
                '2. Or use Vite dev server: cd frontend && npm run dev',
                '3. Access at http://localhost:5173'
            ],
            'vite_dev_server': 'http://localhost:5173'
        }), 404
    
    # Serve index.html for all other routes (React Router will handle routing)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    # Create database tables if not exist
    with app.app_context():
        db.create_all()
        
        # Load ML model at startup
        ml_status = load_ml_model()
        if ml_status['available']:
            logger.info("Application ready with ML model loaded!")
        else:
            logger.warning("Application started but ML model failed to load")
    
    app.run(host='0.0.0.0', port=8080, debug=True)
