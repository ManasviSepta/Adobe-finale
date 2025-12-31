from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import shutil
from datetime import datetime
from models.pdf import PDF
from models.database import db
from python_model.main import process_pdfs_with_ml  # ✅ Using old model directly

# Change the URL prefix to match what the frontend is expecting
pdf_bp = Blueprint('pdfs', __name__, url_prefix='/api/pdfs')

@pdf_bp.route('/process/<int:pdf_id>', methods=['POST'])
@jwt_required()
def process_pdf(pdf_id):
    # Get user ID from JWT token
    user_id = get_jwt_identity()
    
    if not user_id:
        return jsonify({'error': 'User not authenticated'}), 401
    
    # Get PDF and verify ownership
    pdf = PDF.query.filter_by(id=pdf_id, user_id=user_id).first()
    
    if not pdf:
        return jsonify({'error': 'PDF not found or access denied'}), 404
        
    try:
        # Update processing status
        pdf.processing_status = 'processing'
        db.session.commit()
        
        # ✅ Process the PDF with the old model directly
        result = process_pdfs_with_ml(
            job_to_be_done="PDF processing",  # Default job for single PDF processing
            user_id=user_id,
            pdf_ids=[pdf.id]
        )
        
        # Update PDF with results
        pdf.content_json = result
        pdf.processing_status = 'completed'
        db.session.commit()
        
        return jsonify({
            'message': 'PDF processed successfully',
            'pdf_id': pdf_id,
            'status': 'completed'
        })
    except Exception as e:
        pdf.processing_status = 'failed'
        db.session.commit()
        return jsonify({'error': str(e)}), 500

@pdf_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_pdfs():
    files = request.files.getlist('pdfs')
    
    # Get user ID from JWT token
    user_id = get_jwt_identity()
    
    if not user_id:
        return jsonify({'error': 'User not authenticated'}), 401
    uploads = []
    for file in files:
        filename = secure_filename(file.filename)
        
        # Read file data into memory
        file_data = file.read()
        
        # Check if PDF with same name already exists for this user (in both uploads and library)
        existing_pdf = PDF.query.filter_by(
            user_id=user_id, 
            original_filename=filename
        ).first()
        
        if existing_pdf:
            # Replace existing PDF (smart replacement)
            
            # Update the existing PDF with new file data and current timestamp
            existing_pdf.set_file_data(file_data)
            existing_pdf.upload_date = datetime.utcnow()
            existing_pdf.processing_status = 'pending'
            existing_pdf.location = 'library'  # Always store in library permanently
            
            # Clear existing sections since we're replacing the content
            existing_pdf.clear_sections()
            existing_pdf.content_json = None
            
            db.session.commit()
            
            uploads.append({
                "id": existing_pdf.id,
                "name": existing_pdf.name,
                "originalFilename": filename,
                "fileSize": existing_pdf.file_size,
                "uploadDate": existing_pdf.upload_date,
                "processingStatus": existing_pdf.processing_status,
                "action": "replaced_in_library"  # Indicate this was a replacement in library
            })
        else:
            # Create new PDF record - automatically store in library permanently
            pdf = PDF.create_from_file(
                user_id=user_id,
                name=os.path.splitext(filename)[0],
                original_filename=filename,
                file_data=file_data
            )
            # Set location to 'library' for permanent storage
            pdf.location = 'library'
            db.session.add(pdf)
            db.session.commit()
            uploads.append({
                "id": pdf.id,
                "name": pdf.name,
                "originalFilename": filename,
                "fileSize": pdf.file_size,
                "uploadDate": pdf.upload_date,
                "processingStatus": pdf.processing_status,
                "action": "stored_in_library"  # Indicate this was stored in library
            })
    return jsonify({"pdfs": uploads}), 201

@pdf_bp.route('', methods=['GET'])
@pdf_bp.route('/', methods=['GET'])
@jwt_required()
def list_pdfs():
    # Get user ID from JWT token
    user_id = get_jwt_identity()
    
    # Show PDFs from both uploads and library for current session
    # This allows users to work with both newly uploaded and existing library PDFs
    pdfs = PDF.query.filter_by(user_id=user_id).order_by(PDF.upload_date.desc()).all()
    
    result = []
    for pdf in pdfs:
        # Check if PDF has file data or exists in filesystem
        has_file = bool(pdf.file_data) or (pdf.file_path and os.path.exists(pdf.file_path))
        
        result.append({
            "id": pdf.id,
            "name": pdf.name,
            "originalFilename": pdf.original_filename,
            "fileSize": pdf.file_size,
            "pageCount": pdf.page_count,
            "uploadDate": pdf.upload_date,
            "processingStatus": pdf.processing_status,
            "hasContent": bool(pdf.content_json),
            "hasFile": has_file,
            "location": pdf.location  # Show where the PDF is stored
        })
    return jsonify({"pdfs": result, "count": len(result)})

@pdf_bp.route('/<int:pdf_id>', methods=['DELETE'])
@jwt_required()
def delete_pdf(pdf_id):
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        pdf = PDF.query.get(pdf_id)
        if not pdf:
            return jsonify({'error': 'PDF not found'}), 404
            
        if pdf.user_id != user_id:
            return jsonify({'error': 'Unauthorized access to PDF'}), 403
        
        # Move PDF to library instead of deleting
        pdf.location = 'library'
        db.session.commit()
        
        return jsonify({"message": "PDF moved to library"})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete PDF: {str(e)}'}), 500

@pdf_bp.route('/<int:pdf_id>/download', methods=['GET'])
@jwt_required()
def download_pdf(pdf_id):
    # Get user ID from JWT token
    user_id = get_jwt_identity()
    pdf = PDF.query.get(pdf_id)
    
    if not pdf or pdf.user_id != user_id:
        return jsonify({'error': 'PDF not found'}), 404
    
    # Get file data from database
    file_data = pdf.get_file_data()
    if not file_data:
        # Try to get file from filesystem (for backward compatibility)
        if pdf.file_path and os.path.exists(pdf.file_path):
            return send_file(pdf.file_path, 
                           mimetype='application/pdf',
                           as_attachment=True,
                           download_name=pdf.original_filename)
        else:
            return jsonify({'error': 'PDF file not found in database or filesystem'}), 404
        
        # Create a temporary file-like object from the binary data
    from io import BytesIO
    file_stream = BytesIO(file_data)
    file_stream.seek(0)
    
    return send_file(file_stream, 
                      mimetype='application/pdf',
                      as_attachment=True,
                      download_name=pdf.original_filename)

@pdf_bp.route('/clear-uploads', methods=['POST'])
@jwt_required()
def clear_uploads():
    """Clear all PDFs from uploads panel (move them to library)"""
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get all PDFs in uploads for this user
        uploads = PDF.query.filter_by(user_id=user_id, location='uploads').all()
        
        if not uploads:
            return jsonify({
                'message': 'No PDFs in uploads to clear',
                'movedCount': 0
            })
        
        # Move them to library
        moved_count = 0
        for pdf in uploads:
            pdf.location = 'library'
            moved_count += 1
        
        # Commit changes
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully moved {moved_count} PDF(s) from uploads to library',
            'movedCount': moved_count
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to clear uploads: {str(e)}'}), 500

@pdf_bp.route('/move-to-library', methods=['POST'])
@jwt_required()
def move_pdfs_to_library():
    """Move PDFs from uploads to library with smart replacement"""
    try:
        data = request.get_json()
        pdf_ids = data.get('pdfIds', [])
        
        if not pdf_ids:
            return jsonify({'error': 'No PDF IDs provided'}), 400
        
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get the PDFs from uploads
        pdfs = PDF.query.filter_by(user_id=user_id, location='uploads').filter(PDF.id.in_(pdf_ids)).all()
        
        if not pdfs:
            return jsonify({'error': 'No PDFs found in uploads'}), 404
        
        moved_pdfs = []
        replaced_pdfs = []
        
        for pdf in pdfs:
            # Check if a PDF with the same filename already exists in library
            existing_library_pdf = PDF.query.filter_by(
                user_id=user_id,
                original_filename=pdf.original_filename,
                location='library'
            ).first()
            
            if existing_library_pdf:
                # Replace the existing library PDF with the new one
                
                # Copy the new PDF data to the existing library PDF
                existing_library_pdf.set_file_data(pdf.file_data)
                existing_library_pdf.upload_date = pdf.upload_date
                existing_library_pdf.processing_status = pdf.processing_status
                existing_library_pdf.content_json = pdf.content_json
                
                # Clear and copy sections if they exist
                existing_library_pdf.clear_sections()
                for section in pdf.sections:
                    existing_library_pdf.add_section(
                        section.section_title,
                        section.content,
                        section.page_number,
                        section.section_index,
                        section.get_embedding()
                    )
                
                # Delete the upload PDF since we've replaced the library one
                db.session.delete(pdf)
                replaced_pdfs.append(pdf.original_filename)
                
            else:
                # Move the PDF to library
                pdf.location = 'library'
                moved_pdfs.append(pdf.original_filename)
        
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully processed {len(pdfs)} PDF(s)',
            'movedToLibrary': moved_pdfs,
            'replacedInLibrary': replaced_pdfs,
            'totalProcessed': len(pdfs)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': f'Failed to move PDFs to library: {str(e)}'
        }), 500