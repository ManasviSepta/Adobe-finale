from .database import db
from datetime import datetime
import json
from typing import List, Dict, Any, Optional

class PDFSection(db.Model):
    """Model for storing PDF sections with embeddings"""
    __tablename__ = 'pdf_sections'
    
    id = db.Column(db.Integer, primary_key=True)
    pdf_id = db.Column(db.Integer, db.ForeignKey('pdfs.id'), nullable=False)
    section_title = db.Column(db.String, nullable=False)
    content = db.Column(db.Text, nullable=False)
    page_number = db.Column(db.Integer, nullable=False)
    section_index = db.Column(db.Integer, nullable=False)
    embedding_json = db.Column(db.Text)  # JSON array of embedding values
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    pdf = db.relationship('PDF', back_populates='sections')
    
    def get_embedding(self) -> List[float]:
        """Get embedding as a list of floats"""
        if self.embedding_json:
            return json.loads(self.embedding_json)
        return []
    
    def set_embedding(self, embedding: List[float]):
        """Set embedding from a list of floats"""
        self.embedding_json = json.dumps(embedding)

class PDF(db.Model):
    __tablename__ = 'pdfs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String, nullable=False)
    original_filename = db.Column(db.String, nullable=False)
    file_data = db.Column(db.LargeBinary, nullable=True)  # Store PDF as binary data (nullable during migration)
    file_size = db.Column(db.Integer)
    page_count = db.Column(db.Integer)
    content_json = db.Column(db.Text)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    processing_status = db.Column(db.String, default='pending')
    
    # Keep file_path for backward compatibility during migration
    file_path = db.Column(db.String, nullable=True)
    filename = db.Column(db.String, nullable=True)
    
    # Location field to distinguish between uploads and library
    location = db.Column(db.String, default='uploads')  # 'uploads' or 'library'
    
    # Relationship
    sections = db.relationship('PDFSection', back_populates='pdf', cascade='all, delete-orphan')
    
    def get_sections(self) -> List[PDFSection]:
        """Get all sections for this PDF"""
        return self.sections
    
    def add_section(self, section_title: str, content: str, page_number: int, 
                   section_index: int, embedding: Optional[List[float]] = None) -> PDFSection:
        """Add a new section to this PDF"""
        section = PDFSection(
            pdf_id=self.id,
            section_title=section_title,
            content=content,
            page_number=page_number,
            section_index=section_index
        )
        if embedding:
            section.set_embedding(embedding)
        
        self.sections.append(section)
        return section
    
    def clear_sections(self):
        """Remove all sections for this PDF"""
        for section in self.sections:
            db.session.delete(section)
        self.sections.clear()
    
    def get_sections_with_embeddings(self) -> List[Dict[str, Any]]:
        """Get sections with their embeddings as dictionaries"""
        return [
            {
                'id': section.id,
                'section_title': section.section_title,
                'content': section.content,
                'page_number': section.page_number,
                'section_index': section.section_index,
                'embedding': section.get_embedding()
            }
            for section in self.sections
        ]
    
    def set_file_data(self, file_data: bytes):
        """Set the PDF file data"""
        self.file_data = file_data
        self.file_size = len(file_data)
    
    def get_file_data(self) -> bytes:
        """Get the PDF file data"""
        return self.file_data
    
    @classmethod
    def create_from_file(cls, user_id: int, name: str, original_filename: str, file_data: bytes):
        """Create a new PDF record from file data"""
        pdf = cls(
            user_id=user_id,
            name=name,
            original_filename=original_filename,
            file_data=file_data,
            file_size=len(file_data)
        )
        return pdf
