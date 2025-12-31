"""
Refactored PDF Processing with ML Model
- Model loaded once at startup via ml_model.py
- All PDF data and embeddings stored in database
- Processing happens only when "Generate Insights" is triggered
- Returns insight data matching frontend expectations
"""

import sys
import os
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
import json

# Add python_model folder to sys.path for src imports
sys.path.append(os.path.dirname(__file__))
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from src.document_analyzer.pdf_processor import PDFProcessor
from src.document_analyzer.requirement_modeling import RequirementModeler
from src.document_analyzer.section_extractor import SectionExtractor
from src.document_analyzer.subsection_analyzer import SubsectionAnalyzer
from ml_model import get_model, encode_text, is_model_ready

# Import database models (will be imported when needed)
try:
    from models.pdf import PDF, PDFSection
    from models.database import db
    DB_AVAILABLE = True
except ImportError:
    print("⚠️  Database models not available - running in standalone mode")
    DB_AVAILABLE = False

def get_pdfs_from_db(user_id: int, pdf_ids: List[int]) -> List[PDF]:
    """
    Retrieve PDFs from database for a given user and PDF IDs.
    
    Args:
        user_id (int): User ID
        pdf_ids (List[int]): List of PDF IDs to retrieve
        
    Returns:
        List[PDF]: List of PDF objects with their sections
    """
    if not DB_AVAILABLE:
        raise Exception("Database not available")
    
    pdfs = PDF.query.filter(
        PDF.id.in_(pdf_ids), 
        PDF.user_id == user_id
    ).all()
    
    if not pdfs:
        raise Exception(f"No PDFs found for user {user_id} with IDs {pdf_ids}")
    
    return pdfs

def save_embeddings_to_db(pdf: PDF, sections_data: List[Dict[str, Any]]):
    """
    Save PDF sections with embeddings to database.
    
    Args:
        pdf (PDF): PDF object to save sections for
        sections_data (List[Dict]): List of section data with embeddings
    """
    if not DB_AVAILABLE:
        raise Exception("Database not available")
    
    # Clear existing sections
    pdf.clear_sections()
    
    # Add new sections with embeddings
    for idx, section_data in enumerate(sections_data):
        pdf.add_section(
            section_title=section_data['section_title'],
            content=section_data['content'],
            page_number=section_data['page_number'],
            section_index=idx,
            embedding=section_data.get('embedding')
        )
    
    # Update PDF processing status
    pdf.processing_status = 'completed'
    
    # Commit to database
    db.session.commit()

def extract_sections_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Extract sections from a PDF file.
    
    Args:
        pdf_path (str): Path to the PDF file
        
    Returns:
        List[Dict]: List of extracted sections with metadata
    """
    print(f"📄 Extracting sections from: {Path(pdf_path).name}")
    
    # Extract PDF content
    processor = PDFProcessor()
    document = processor.extract_text_with_structure(pdf_path)
    
    sections = document.get("sections", [])
    extracted_sections = []
    
    for idx, section in enumerate(sections):
        section_text = f"{section['section_title']}. {section['content'][:500]}"
        
        # Only process sections with sufficient content
        if len(section_text.split()) >= 10:
            extracted_sections.append({
                "section_title": section["section_title"],
                "content": section["content"],
                "page_number": section["page_number"],
                "section_index": idx,
                "section_text": section_text
            })
    
    print(f"✅ Extracted {len(extracted_sections)} sections from {Path(pdf_path).name}")
    return extracted_sections

def generate_embeddings_for_sections(sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generate embeddings for extracted sections using the loaded model.
    
    Args:
        sections (List[Dict]): List of sections to generate embeddings for
        
    Returns:
        List[Dict]: Sections with embeddings added
    """
    if not is_model_ready():
        raise Exception("ML model not ready")
    
    print(f"🧠 Generating embeddings for {len(sections)} sections...")
    
    for section in sections:
        try:
            # Generate embedding for the section text
            embedding = encode_text(section['section_text'])
            section['embedding'] = embedding
        except Exception as e:
            print(f"⚠️  Failed to generate embedding for section '{section['section_title']}': {e}")
            section['embedding'] = []
    
    print(f"✅ Generated embeddings for {len(sections)} sections")
    return sections

def process_pdfs_with_ml(job_to_be_done: str, user_id: int, pdf_ids: List[int], k: int = 5) -> Dict[str, Any]:
    """
    Main function to process PDFs with ML model and generate insights.
    This is triggered when the "Generate Insights" button is clicked.
    
    Args:
        job_to_be_done (str): Job to be done
        user_id (int): User ID
        pdf_ids (List[int]): List of PDF IDs to process
        k (int): Number of top insights to return
        
    Returns:
        Dict[str, Any]: Insight data matching frontend expectations
    """
    start_time = time.time()
    print(f"🚀 Processing {len(pdf_ids)} PDFs")
    print(f"📋 Job to be done: '{job_to_be_done}'")
    
    # Check if model is ready
    if not is_model_ready():
        return {"error": "ML model not ready"}
    
    try:
        # Get PDFs from database
        pdfs = get_pdfs_from_db(user_id, pdf_ids)
        print(f"📚 Retrieved {len(pdfs)} PDFs from database")
        
        # Process each PDF to extract sections and generate embeddings
        all_sections = []
        
        for pdf in pdfs:
            # Check if PDF has sections with embeddings already
            existing_sections = pdf.get_sections_with_embeddings()
            
            if existing_sections and all(section.get('embedding') for section in existing_sections):
                print(f"♻️  Using existing sections for {pdf.original_filename}")
                for section in existing_sections:
                    section['source_pdf'] = pdf.original_filename
                    section['pdf_id'] = pdf.id
                all_sections.extend(existing_sections)
            else:
                # Extract sections and generate embeddings
                print(f"🔄 Processing PDF: {pdf.original_filename}")
                
                # Get PDF data from database
                pdf_data = pdf.get_file_data()
                if not pdf_data:
                    print(f"⚠️  PDF data not found in database for: {pdf.original_filename}")
                    continue
                
                # Create temporary file for processing
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
                    temp_file.write(pdf_data)
                    temp_path = temp_file.name
                
                try:
                    # Extract sections
                    sections = extract_sections_from_pdf(temp_path)
                finally:
                    # Clean up temporary file
                    os.unlink(temp_path)
                
                # Generate embeddings
                sections_with_embeddings = generate_embeddings_for_sections(sections)
                
                # Save to database
                save_embeddings_to_db(pdf, sections_with_embeddings)
                
                # Add to all sections for processing
                for section in sections_with_embeddings:
                    section['source_pdf'] = pdf.original_filename
                    section['pdf_id'] = pdf.id
                all_sections.extend(sections_with_embeddings)
        
        if not all_sections:
            return {"error": "No sections found in the provided PDFs"}
        
        # Generate requirement model for job to be done only
        modeler = RequirementModeler(get_model())
        req_model = modeler.parse_job_to_be_done(job_to_be_done)
        query_embedding = req_model['embedding']
        
        # Calculate similarity scores
        from sklearn.metrics.pairwise import cosine_similarity
        import numpy as np
        
        for section in all_sections:
            if section.get('embedding'):
                section_embedding = np.array(section["embedding"]).reshape(1, -1)
                query_embedding_reshaped = np.array(query_embedding).reshape(1, -1)
                similarity_score = cosine_similarity(section_embedding, query_embedding_reshaped)[0][0]
                section["relevance_score"] = float(similarity_score)
            else:
                section["relevance_score"] = 0.0
        
        # Sort by relevance and take top k
        top_sections = sorted(all_sections, key=lambda x: x["relevance_score"], reverse=True)[:k]
        
        # Format output for frontend
        insight_cards = []
        
        for rank, section in enumerate(top_sections):
            # Create insight card matching frontend expectations
            insight_card = {
                "id": f"insight-{section['pdf_id']}-{section['section_index']}",
                "pdfName": section['source_pdf'],
                "sectionTitle": section['section_title'],
                "content": section['content'][:300] + "..." if len(section['content']) > 300 else section['content'],
                "pageNumber": section['page_number'],
                "importanceRank": rank + 1,
                "relevanceScore": section['relevance_score']
            }
            insight_cards.append(insight_card)
        
        processing_time = time.time() - start_time
        
        # Return structured response
        result = {
            "insights": {
                "sections": insight_cards,
                "metadata": {
                    "processing_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "job_to_be_done": job_to_be_done,
                    "input_documents": [pdf.original_filename for pdf in pdfs],
                    "processing_time_seconds": round(processing_time, 3),
                    "total_sections_processed": len(all_sections),
                    "top_insights_returned": len(insight_cards)
                }
            }
        }
        
        print(f"✅ Generated {len(insight_cards)} insights in {processing_time:.3f} seconds")
        return result
        
    except Exception as e:
        print(f"❌ Error processing PDFs: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"Processing failed: {str(e)}"}

def get_model_status() -> Dict[str, Any]:
    """
    Get the status of the ML model.
    
    Returns:
        Dict[str, Any]: Model status information
    """
    from ml_model import get_model_status as get_ml_status
    return get_ml_status()

# Legacy function for backward compatibility
def generate_insights_instantly(job_to_be_done: str, pdf_paths: List[str], k: int = 5) -> Dict[str, Any]:
    """
    Legacy function - redirects to the new database-based approach.
    This maintains backward compatibility with existing code.
    """
    print("⚠️  Using legacy function - consider updating to use process_pdfs_with_ml with database IDs")
    
    # For backward compatibility, we'll need to map file paths to database IDs
    # This is a simplified approach - in production, you'd want proper mapping
    if not DB_AVAILABLE:
        return {"error": "Database not available for legacy function"}
    
    # This is a placeholder - in practice, you'd need to map file paths to PDF IDs
    # For now, we'll return an error suggesting the new approach
    return {
        "error": "Legacy function deprecated. Use process_pdfs_with_ml with database PDF IDs instead."
    }

if __name__ == "__main__":
    # Test the model loading
    print("🧪 Testing ML model...")
    status = get_model_status()
    print(f"Model status: {status}")
    
    if status['available']:
        print("✅ Model is ready for use!")
    else:
        print("❌ Model is not ready")