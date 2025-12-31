from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.user import User
from models.pdf import PDF

user_bp = Blueprint('user', __name__, url_prefix='/api/user')

@user_bp.route('/profile', methods=['GET'])
@user_bp.route('/profile/', methods=['GET'])
# Temporarily remove JWT requirement for testing
# @jwt_required()
def user_profile():
    uid = get_jwt_identity()
    user = User.query.get(uid)
    pdf_count = PDF.query.filter_by(user_id=uid).count()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        "user": {"id": user.id, "email": user.email, "name": user.name, "createdAt": user.created_at},
        "stats": {"totalPDFs": pdf_count}
    })
