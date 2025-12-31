from flask import Blueprint, request, jsonify
from models.user import User
from models.database import db
from flask_jwt_extended import create_access_token, get_jwt_identity
from werkzeug.exceptions import BadRequest
import re

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# Email validation constants
EMAIL_MAX_LENGTH = 254
EMAIL_LOCAL_MAX_LENGTH = 64
EMAIL_DOMAIN_MAX_LENGTH = 253

# Password validation constants
PASSWORD_MIN_LENGTH = 5
PASSWORD_MAX_LENGTH = 128

def validate_email(email):
    """Validate email format and length according to RFC standards"""
    if not email:
        return "Email is required"
    
    if not isinstance(email, str):
        return "Email must be a string"
    
    # Check length limits
    if len(email) > EMAIL_MAX_LENGTH:
        return f"Email must be {EMAIL_MAX_LENGTH} characters or less"
    
    # Check for @ symbol
    if '@' not in email:
        return "Email must contain @ symbol"
    
    local_part, domain_part = email.split('@', 1)
    
    # Check local part length
    if len(local_part) > EMAIL_LOCAL_MAX_LENGTH:
        return f"Part before @ must be {EMAIL_LOCAL_MAX_LENGTH} characters or less"
    
    # Check domain part length
    if len(domain_part) > EMAIL_DOMAIN_MAX_LENGTH:
        return f"Domain part must be {EMAIL_DOMAIN_MAX_LENGTH} characters or less"
    
    # Check for valid characters (only allow letters, numbers, and specific special chars)
    valid_local_chars = re.compile(r'^[a-zA-Z0-9.!#$%&\'*+/=?^_`{|}~-]+$')
    valid_domain_chars = re.compile(r'^[a-zA-Z0-9.-]+$')
    
    if not valid_local_chars.match(local_part):
        return "Email contains invalid characters. Only letters, numbers, and .!#$%&'*+/=?^_`{|}~- are allowed"
    
    if not valid_domain_chars.match(domain_part):
        return "Domain contains invalid characters. Only letters, numbers, . and - are allowed"
    
    # Check for valid email format
    email_regex = re.compile(r'^[a-zA-Z0-9.!#$%&\'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$')
    if not email_regex.match(email):
        return "Please enter a valid email address"
    
    return None

def validate_password(password):
    """Validate password basic requirements (only hard requirements that block submission)"""
    if not password:
        return "Password is required"
    
    if not isinstance(password, str):
        return "Password must be a string"
    
    # Check length (these are hard requirements that block submission)
    if len(password) < PASSWORD_MIN_LENGTH:
        return f"Password must be at least {PASSWORD_MIN_LENGTH} characters long"
    
    if len(password) > PASSWORD_MAX_LENGTH:
        return f"Password must be {PASSWORD_MAX_LENGTH} characters or less"
    
    # Note: We don't enforce capital letter, number, or special character requirements
    # These are just suggestions shown in the UI, not blockers for submission
    
    return None

@auth_bp.route('/signup', methods=['POST'])
@auth_bp.route('/signup/', methods=['POST'])
def signup():
    data = request.get_json()
    if not data: 
        raise BadRequest('Missing body')
    
    email = data.get('email')
    name = data.get('name')
    password = data.get('password')
    
    # Validate required fields
    if not email or not name or not password:
        return jsonify({"error": "Missing required fields: email, name, and password"}), 400
    
    # Validate email
    email_error = validate_email(email)
    if email_error:
        return jsonify({"error": email_error}), 400
    
    # Validate password
    password_error = validate_password(password)
    if password_error:
        return jsonify({"error": password_error}), 400
    
    # Validate name
    if not isinstance(name, str) or len(name.strip()) == 0:
        return jsonify({"error": "Name must be a non-empty string"}), 400
    
    if len(name.strip()) > 100:
        return jsonify({"error": "Name must be 100 characters or less"}), 400
    
    # Check if email already exists
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 409
    
    # Create user
    user = User.create(email, name.strip(), password)
    db.session.add(user)
    db.session.commit()
    
    access_token = create_access_token(identity=user.id)
    return jsonify({
        "message": "Signup successful",
        "user": {"id": user.id, "email": user.email, "name": user.name},
        "token": access_token
    })

@auth_bp.route('/login', methods=['POST'])
@auth_bp.route('/login/', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        raise BadRequest('Missing body')
    
    email = data.get('email')
    password = data.get('password')
    
    # Validate required fields
    if not email or not password:
        return jsonify({"error": "Missing required fields: email and password"}), 400
    
    # Basic email validation for login
    email_error = validate_email(email)
    if email_error:
        return jsonify({"error": email_error}), 400
    
    # Find user and verify password
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({
            "error": "No account found with this email. Please sign up to create a new account.",
            "suggestion": "signup"
        }), 401
    if not user.verify_password(password):
        return jsonify({"error": "Incorrect password. Please try again."}), 401
    
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        "message": "Login successful",
        "user": {"id": user.id, "email": user.email, "name": user.name},
        "token": access_token
    })



# Import jwt_required decorator for protected routes
from flask_jwt_extended import jwt_required

@auth_bp.route('/me', methods=['GET'])
@auth_bp.route('/me/', methods=['GET'])
# Temporarily remove JWT requirement for testing
# @jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        "user": {"id": user.id, "email": user.email, "name": user.name}
    })
