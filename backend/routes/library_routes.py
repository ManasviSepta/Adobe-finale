from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.pdf import PDF
from models.database import db
import os

library_bp = Blueprint('library', __name__, url_prefix='/api/library')

@library_bp.route('', methods=['GET'])
@library_bp.route('/', methods=['GET'])
@jwt_required()
def get_library_pdfs():
    """Get all PDFs in the user's library (location='library')"""
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get only PDFs that are in the library (location='library')
        pdfs = PDF.query.filter_by(user_id=user_id, location='library').all()
        
        pdf_list = []
        for pdf in pdfs:
            pdf_data = {
                'id': pdf.id,
                'name': pdf.name or pdf.original_filename or 'Unknown',
                'uploadDate': pdf.upload_date.isoformat() if pdf.upload_date else None,
                'pageCount': pdf.page_count,
                'processing_status': pdf.processing_status,
                'file_path': pdf.file_path,
                'content_json': pdf.content_json is not None,
                'location': pdf.location
            }
            pdf_list.append(pdf_data)
        
        return jsonify({
            'pdfs': pdf_list,
            'count': len(pdf_list)
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to get library PDFs: {str(e)}'
        }), 500

@library_bp.route('/move-to-uploads', methods=['POST'])
@library_bp.route('/move-to-uploads/', methods=['POST'])
@jwt_required()
def move_pdfs_to_uploads():
    """Move PDFs from library to uploads (this is more of a copy operation)"""
    try:
        data = request.get_json()
        pdf_ids = data.get('pdfIds', [])
        
        if not pdf_ids:
            return jsonify({'error': 'No PDF IDs provided'}), 400
        
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get the PDFs
        pdfs = PDF.query.filter_by(user_id=user_id).filter(PDF.id.in_(pdf_ids)).all()
        
        if not pdfs:
            return jsonify({'error': 'No PDFs found'}), 404
        
        # Move PDFs to uploads by updating their location
        for pdf in pdfs:
            pdf.location = 'uploads'
        
        db.session.commit()
        
        moved_pdfs = [pdf.name or pdf.original_filename for pdf in pdfs]
        
        return jsonify({
            'message': f'Successfully moved {len(pdfs)} PDF(s) to uploads',
            'movedPdfs': moved_pdfs
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to move PDFs to uploads: {str(e)}'
        }), 500

@library_bp.route('/delete', methods=['DELETE'])
@library_bp.route('/delete/', methods=['DELETE'])
@jwt_required()
def delete_library_pdfs():
    """Delete PDFs from the library"""
    try:
        data = request.get_json()
        pdf_ids = data.get('pdfIds', [])
        
        if not pdf_ids:
            return jsonify({'error': 'No PDF IDs provided'}), 400
        
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get the PDFs
        pdfs = PDF.query.filter_by(user_id=user_id).filter(PDF.id.in_(pdf_ids)).all()
        
        if not pdfs:
            return jsonify({'error': 'No PDFs found'}), 404
        
        deleted_pdfs = []
        
        for pdf in pdfs:
            try:
                # Delete the physical file if it exists
                if pdf.file_path and os.path.exists(pdf.file_path):
                    os.remove(pdf.file_path)
                
                # Delete from database
                db.session.delete(pdf)
                deleted_pdfs.append(pdf.name or pdf.original_filename)
                
            except Exception as e:
                continue
        
        # Commit the changes
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully deleted {len(deleted_pdfs)} PDF(s)',
            'deletedPdfs': deleted_pdfs
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': f'Failed to delete library PDFs: {str(e)}'
        }), 500

@library_bp.route('/duplicate-check', methods=['POST'])
@library_bp.route('/duplicate-check/', methods=['POST'])
@jwt_required()
def check_duplicate_pdf():
    """Check if a PDF with the same name already exists"""
    try:
        data = request.get_json()
        filename = data.get('filename')
        
        if not filename:
            return jsonify({'error': 'No filename provided'}), 400
        
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Check if PDF with same name exists for this user only
        existing_pdf = PDF.query.filter_by(
            user_id=user_id, 
            original_filename=filename
        ).first()
        
        if existing_pdf:
            return jsonify({
                'isDuplicate': True,
                'existingPdf': {
                    'id': existing_pdf.id,
                    'name': existing_pdf.name or existing_pdf.original_filename,
                    'uploadDate': existing_pdf.upload_date.isoformat() if existing_pdf.upload_date else None,
                    'processing_status': existing_pdf.processing_status
                }
            })
        else:
            return jsonify({
                'isDuplicate': False
            })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to check duplicate PDF: {str(e)}'
        }), 500

@library_bp.route('/all-pdfs', methods=['GET'])
@library_bp.route('/all-pdfs/', methods=['GET'])
@jwt_required()
def get_all_user_pdfs():
    """Get all PDFs for the user (both uploads and library) for insights generation"""
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get all PDFs for the user (both uploads and library)
        pdfs = PDF.query.filter_by(user_id=user_id).all()
        
        pdf_list = []
        for pdf in pdfs:
            pdf_data = {
                'id': pdf.id,
                'name': pdf.name or pdf.original_filename or 'Unknown',
                'uploadDate': pdf.upload_date.isoformat() if pdf.upload_date else None,
                'pageCount': pdf.page_count,
                'processing_status': pdf.processing_status,
                'file_path': pdf.file_path,
                'content_json': pdf.content_json is not None,
                'location': pdf.location
            }
            pdf_list.append(pdf_data)
        
        return jsonify({
            'pdfs': pdf_list,
            'count': len(pdf_list)
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to get all user PDFs: {str(e)}'
        }), 500
