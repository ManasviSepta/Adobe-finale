from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from functools import wraps
from models.user import User
from models.pdf import PDF
from flask import jsonify, request

def jwt_required_user(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            if not user_id:
                return jsonify({'error': 'Authentication required'}), 401
            return fn(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': f'Authentication error: {str(e)}'}), 401
    return wrapper

def verify_pdf_access(pdf_id):
    """
    Verify that the current user has access to the specified PDF
    
    Args:
        pdf_id: The ID of the PDF to verify access for
        
    Returns:
        tuple: (has_access, pdf_object, error_response)
        - has_access: Boolean indicating if user has access
        - pdf_object: PDF object if accessible, None otherwise
        - error_response: JSON response if error, None otherwise
    """
    try:
        user_id = get_jwt_identity()
        
        if not user_id:
            return False, None, jsonify({'error': 'Authentication required'}), 401
        
        # Get PDF and verify ownership
        pdf = PDF.query.filter_by(id=pdf_id, user_id=user_id).first()
        
        if not pdf:
            return False, None, jsonify({'error': 'PDF not found or access denied'}), 404
        
        return True, pdf, None
        
    except Exception as e:
        return False, None, jsonify({'error': f'Error verifying PDF access: {str(e)}'}), 500

def require_pdf_access(f):
    """
    Decorator to require PDF access for a route
    
    Usage:
    @app.route('/pdf/<int:pdf_id>')
    @require_pdf_access
    def pdf_route(pdf_id, pdf):
        # pdf parameter will contain the verified PDF object
        pass
    """
    @wraps(f)
    def decorated_function(pdf_id, *args, **kwargs):
        has_access, pdf, error_response = verify_pdf_access(pdf_id)
        
        if not has_access:
            return error_response
        
        # Add the PDF object to kwargs so the route function can access it
        kwargs['pdf'] = pdf
        return f(pdf_id, *args, **kwargs)
    
    return decorated_function
