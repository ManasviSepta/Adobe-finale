from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.pdf import PDF
from models.database import db
from python_model.main import process_pdfs_with_ml, get_model_status
import json
import os

insights_bp = Blueprint('insights', __name__, url_prefix='/api/insights')

@insights_bp.route('/generate', methods=['POST'])
@insights_bp.route('/generate/', methods=['POST'])
@jwt_required()
def generate_insights():
    data = request.get_json()
    job_to_be_done = data.get('jobToBeDone')
    pdf_ids = data.get('pdfIds')  # list

    # Get user ID from JWT token
    user_id = get_jwt_identity()
    
    if not user_id:
        return jsonify({'error': 'User not authenticated'}), 401
    
    # Validate input
    if not job_to_be_done or not pdf_ids:
        return jsonify({'error': 'Missing required fields: jobToBeDone or pdfIds'}), 400
    
    # Convert string IDs to integers for database query
    try:
        pdf_id_ints = [int(pdf_id) for pdf_id in pdf_ids]
    except ValueError:
        return jsonify({'error': 'Invalid PDF ID format'}), 400
    
    try:
        # Call the new refactored ML processing function
        result = process_pdfs_with_ml(
            job_to_be_done=job_to_be_done,
            user_id=user_id,
            pdf_ids=pdf_id_ints
        )
        
        # Check if there was an error in ML processing
        if result.get('error'):
            return jsonify({
                'error': f'ML model processing failed: {result["error"]}',
                'details': result
            }), 500
        
        # The new function returns data in the correct format for frontend
        insights_data = result.get('insights', {})
        
        return jsonify({
            'message': 'Insights generated successfully using refactored ML model',
            'insights': insights_data
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to generate insights: {str(e)}'
        }), 500

@insights_bp.route('/model-status', methods=['GET'])
@insights_bp.route('/model-status/', methods=['GET'])
def get_ml_model_status():
    """Check the status of the ML model"""
    try:
        status = get_model_status()
        return jsonify(status)
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error checking model status: {str(e)}',
            'available': False
        }), 500

@insights_bp.route('/bulb', methods=['POST'])
@insights_bp.route('/bulb/', methods=['POST'])
def generate_insight_bulb():
    """Generate AI insights for a specific section using LLM"""
    data = request.get_json()
    fileName = data.get('fileName')
    heading = data.get('heading')
    snippet = data.get('snippet')
    pageNumber = data.get('pageNumber')
    
    if not all([fileName, heading, snippet, pageNumber]):
        missing_fields = []
        if not fileName: missing_fields.append('fileName')
        if not heading: missing_fields.append('heading')
        if not snippet: missing_fields.append('snippet')
        if not pageNumber: missing_fields.append('pageNumber')
        return jsonify({'error': f'Missing required fields: {missing_fields}'}), 400
    
    try:
        # Import the smart LLM function
        from chat_with_llm import generate_smart_card_insights, enhance_insights_with_pdf_facts
        
        # Generate insights using smart generation (content-first, then fallback)
        insights = generate_smart_card_insights(heading, snippet)
        
        # Note: This legacy endpoint doesn't have user context for PDF enhancement
        # For full enhancement, use the new on-demand endpoints
        
        return jsonify(insights)
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to generate insights: {str(e)}'
        }), 500

@insights_bp.route('/podcast', methods=['POST'])
@insights_bp.route('/podcast/', methods=['POST'])
def generate_podcast_audio():
    """Generate audio summary for a specific section using TTS"""
    data = request.get_json()
    fileName = data.get('fileName')
    heading = data.get('heading')
    snippet = data.get('snippet')
    pageNumber = data.get('pageNumber')
    
    if not all([fileName, heading, snippet, pageNumber]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        # Import the audio generation function
        from generate_audio import generate_audio
        
        # Create a summary text for TTS
        summary_text = f"""
        Section: {heading}
        From document: {fileName}
        Page: {pageNumber}
        
        Summary: {snippet[:300]}...
        
        This section provides key information that could be valuable for your research or analysis.
        """
        
        # Generate audio file
        output_file = f"temp_audio_{fileName.replace(' ', '_')}_{pageNumber}.mp3"
        audio_path = generate_audio(summary_text, output_file)
        
        # Return the audio file path or data
        return jsonify({
            'message': 'Audio generated successfully',
            'audioPath': audio_path,
            'fileName': output_file
        })
        
    except Exception as e:
        print(f"❌ Error generating podcast audio: {str(e)}")
        return jsonify({
            'error': f'Failed to generate audio: {str(e)}'
        }), 500

@insights_bp.route('/job-insights', methods=['POST'])
@insights_bp.route('/job-insights/', methods=['POST'])
def generate_job_insights():
    """Generate AI insights about the job description itself"""
    data = request.get_json()
    jobDescription = data.get('jobDescription')
    
    if not jobDescription:
        return jsonify({'error': 'Missing jobDescription field'}), 400
    
    try:
        # Import the smart LLM function
        from chat_with_llm import generate_smart_card_insights, enhance_insights_with_pdf_facts
        
        # Generate insights using smart generation (content-first, then fallback)
        insights = generate_smart_card_insights(jobDescription, "")
        
        # Try to enhance with facts from user's PDFs
        try:
            # Get user ID from request context (this endpoint doesn't have JWT)
            # For now, we'll skip PDF enhancement for job insights
            # User authentication will be added to job insights endpoint in future version
            pass
        except Exception as e:
            print(f"⚠️ Could not enhance job insights with PDF facts: {e}")
            # Continue with original insights
        
        return jsonify(insights)
        
    except Exception as e:
        print(f"❌ Error generating job insights: {str(e)}")
        return jsonify({
            'error': f'Failed to generate job insights: {str(e)}'
        }), 500

@insights_bp.route('/enhanced-generate', methods=['POST'])
@insights_bp.route('/enhanced-generate/', methods=['POST'])
@jwt_required()
def generate_enhanced_insights():
    """
    Enhanced insights generation - ML processing only (no LLM or podcast generation)
    """
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get request data
        data = request.get_json()
        pdf_ids = data.get('pdfIds', [])
        job_to_be_done = data.get('jobToBeDone', '')
        
        if not pdf_ids:
            return jsonify({'error': 'No PDF IDs provided'}), 400
        
        # Convert string IDs to integers
        pdf_id_ints = [int(pdf_id) for pdf_id in pdf_ids]
        
        print(f"🎯 Enhanced insights generation for user {user_id}")
        print(f"📊 Processing {len(pdf_id_ints)} PDFs")
        print(f"🎯 Job to be done: {job_to_be_done}")
        
        # Step 1: Process PDFs to get card frontside content (ML only)
        print("📊 Step 1: Processing PDFs with ML model...")
        result = process_pdfs_with_ml(
            job_to_be_done=job_to_be_done,
            user_id=user_id,
            pdf_ids=pdf_id_ints
        )
        
        if result.get('error'):
            print(f"❌ ML model error: {result['error']}")
            return jsonify({
                'error': f'ML model processing failed: {result["error"]}',
                'details': result
            }), 500
        
        insights_data = result.get('insights', {})
        sections = insights_data.get('sections', [])
        
        print(f"✅ Generated {len(sections)} insight cards with frontside content only")
        
        # Return sections without backside insights or podcasts
        # These will be generated on-demand when users click bulb or podcast buttons
        return jsonify({
            'message': 'Enhanced insights generated successfully (ML processing only)',
            'insights': {
                'sections': sections,
                'totalCards': len(sections)
            },
            'note': 'Backside insights and podcasts will be generated on-demand when requested'
        })
    except Exception as e:
        print(f"❌ Error in enhanced insights generation: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to generate enhanced insights: {str(e)}'}), 500

@insights_bp.route('/generate-bulb-insights', methods=['POST'])
@insights_bp.route('/generate-bulb-insights/', methods=['POST'])
@jwt_required()
def generate_bulb_insights_on_demand():
    """
    Generate backside insights for a specific card on-demand
    """
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401

        # Get request data
        data = request.get_json()
        card_heading = data.get('heading')
        card_content = data.get('content', '')
        pdf_name = data.get('pdfName', '')
        page_number = data.get('pageNumber', '')

        if not card_heading:
            return jsonify({'error': 'Card heading is required'}), 400

        print(f"💡 Generating bulb insights on-demand for: {card_heading}")

        # Prepare PDF context for better insights
        pdf_context = None
        if pdf_name or page_number:
            pdf_context = {
                'pdf_name': pdf_name,
                'page_number': page_number,
                'related_sections': 'From PDF content'
            }

        # Generate backside insights using smart LLM generation
        try:
            from chat_with_llm import generate_smart_card_insights, enhance_insights_with_pdf_facts

            print(f"🔄 Generating insights for heading: '{card_heading}'")
            print(f"📄 Content length: {len(card_content) if card_content else 0}")

            # First generate insights
            backside_insights = generate_smart_card_insights(card_heading, card_content, pdf_context)
            if not backside_insights:
                raise Exception("No insights generated from LLM")

            print(f"✅ Base insights generated: {backside_insights}")

            # Optimize PDF fact enhancement for faster response
            try:
                from models.pdf import PDF
                # Only get recent PDFs (limit to 3 most recent) for faster processing
                user_pdfs = PDF.query.filter_by(user_id=user_id).order_by(PDF.upload_date.desc()).limit(5).all()
                if user_pdfs:
                    pdf_ids = [pdf.id for pdf in user_pdfs]
                    print(f"🔍 Enhancing with facts from {len(pdf_ids)} recent PDFs...")
                    backside_insights = enhance_insights_with_pdf_facts(
                        backside_insights,
                        card_heading,
                        user_id,
                        pdf_ids
                    )
                    print("✅ Insights enhanced with PDF facts")
                else:
                    print("ℹ️ No PDFs found for enhancement")
            except Exception as e:
                print(f"⚠️ Could not enhance insights with PDF facts: {e}")
                # Continue with base insights if enhancement fails

            print(f"✅ Bulb insights generated successfully for: {card_heading}")
            return jsonify({
                'message': 'Bulb insights generated successfully',
                'backsideInsights': backside_insights
            })
        except Exception as e:
            print(f"❌ Error in bulb insights generation: {e}")
            import traceback
            traceback.print_exc()
            fallback_insights = {
                'keyInsights': [f"Key insight about {card_heading}", f"Important point regarding {card_heading}"],
                'didYouKnow': [f"Research shows {card_heading} has evolved significantly", f"Industry experts consider {card_heading} a key factor"],
                'contradictions': [f"Some approaches to {card_heading} may conflict", f"Different perspectives exist on {card_heading}"],
                'inspirations': [f"Emerging technologies are transforming {card_heading}", f"Global trends suggest {card_heading} will grow in importance"]
            }
            return jsonify({
                'message': 'Bulb insights generated with fallback due to error',
                'backsideInsights': fallback_insights,
                'warning': f'Original generation failed: {str(e)}'
            })
    except Exception as e:
        print(f"❌ Error generating bulb insights: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to generate bulb insights: {str(e)}'}), 500

@insights_bp.route('/generate-podcast', methods=['POST'])
@insights_bp.route('/generate-podcast/', methods=['POST'])
@jwt_required()
def generate_podcast_on_demand():
    """
    Generate podcast for a specific card on-demand
    First generates backside insights if not available, then creates podcast
    """
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401

        # Get request data
        data = request.get_json()
        card_heading = data.get('heading')
        card_content = data.get('content', '')
        card_id = data.get('cardId')
        existing_backside_insights = data.get('backsideInsights')
        pdf_name = data.get('pdfName', '')
        page_number = data.get('pageNumber', '')

        if not card_heading or not card_id:
            return jsonify({'error': 'Card heading and cardId are required'}), 400

        print(f"🎙️ Generating podcast on-demand for: {card_heading}")

        # Step 1: Generate backside insights if not available
        backside_insights = existing_backside_insights
        if not backside_insights:
            print("💡 No backside insights found, generating them first...")
            pdf_context = None
            if pdf_name or page_number:
                pdf_context = {
                    'pdf_name': pdf_name,
                    'page_number': page_number,
                    'related_sections': 'From PDF content'
                }
            from chat_with_llm import generate_smart_card_insights, enhance_insights_with_pdf_facts
            backside_insights = generate_smart_card_insights(card_heading, card_content, pdf_context)
            try:
                from models.pdf import PDF
                # Only get recent PDFs (limit to 3 most recent) for faster processing
                user_pdfs = PDF.query.filter_by(user_id=user_id).order_by(PDF.upload_date.desc()).limit(3).all()
                if user_pdfs:
                    pdf_ids = [pdf.id for pdf in user_pdfs]
                    print(f"🔍 Enhancing podcast insights with facts from {len(pdf_ids)} recent PDFs...")
                    backside_insights = enhance_insights_with_pdf_facts(
                        backside_insights,
                        card_heading,
                        user_id,
                        pdf_ids
                    )
                    print("✅ Podcast insights enhanced with PDF facts")
                else:
                    print("ℹ️ No PDFs found for podcast enhancement")
            except Exception as e:
                print(f"⚠️ Could not enhance insights with PDF facts: {e}")
                # Continue with base insights if enhancement fails
            print("✅ Backside insights generated for podcast")

        # Step 2: Generate podcast
        print("🎙️ Generating podcast audio...")
        from generate_audio import generate_podcast_conversation
        card_data = {
            'frontside_heading': card_heading,
            'frontside_content': card_content,
            'backside_insights': backside_insights,
            'related_cards': []
        }
        podcast_filename = f"podcast_{card_id}.mp3"
        podcast_path = generate_podcast_conversation(
            card_data,
            output_file=podcast_filename,
            provider="azure"
        )
        podcast_data = {
            'audioPath': f"/api/insights/podcast-audio/{podcast_filename}",
            'fileName': podcast_filename,
            'cardId': card_id,
            'cardTitle': card_heading,
            'duration': '2-5 minutes',
            'format': 'MP3'
        }
        print(f"✅ Podcast generated successfully: {podcast_path}")
        return jsonify({
            'message': 'Podcast generated successfully',
            'podcast': podcast_data,
            'backsideInsights': backside_insights
        })
    except Exception as e:
        print(f"❌ Error generating podcast: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to generate podcast: {str(e)}'}), 500

@insights_bp.route('', methods=['GET'])
@insights_bp.route('/', methods=['GET'])
@jwt_required()
def list_insights():
    # Get user ID from JWT token
    user_id = get_jwt_identity()
    
    if not user_id:
        return jsonify({'error': 'User not authenticated'}), 401
    pdfs = PDF.query.filter_by(user_id=user_id).all()
    insights = []
    for pdf in pdfs:
        if pdf.content_json:
            insights.append({"pdfId": pdf.id, "content": pdf.content_json})
    return jsonify({"insights": insights})

@insights_bp.route('/section-content/<int:pdf_id>/<int:page_number>', methods=['GET'])
@insights_bp.route('/section-content/<int:pdf_id>/<int:page_number>/', methods=['GET'])
@jwt_required()
def get_section_content(pdf_id: int, page_number: int):
    """Get the full content of a section for highlighting purposes"""
    try:
        # Get user ID from JWT token
        user_id = get_jwt_identity()
        
        if not user_id:
            return jsonify({'error': 'User not authenticated'}), 401
        
        # Get the PDF and its sections
        pdf = PDF.query.filter_by(id=pdf_id, user_id=user_id).first()
        if not pdf:
            return jsonify({'error': 'PDF not found'}), 404
        
        # Get sections for the specific page
        sections = pdf.get_sections()
        page_sections = [section for section in sections if section.page_number == page_number]
        
        if not page_sections:
            return jsonify({'error': 'No sections found for this page'}), 404
        
        # Return the full content of all sections on this page
        section_data = []
        for section in page_sections:
            section_data.append({
                'section_title': section.section_title,
                'content': section.content,
                'page_number': section.page_number
            })
        
        return jsonify({
            'pdf_id': pdf_id,
            'page_number': page_number,
            'sections': section_data
        })
        
    except Exception as e:
        print(f"❌ Error getting section content: {str(e)}")
        return jsonify({
            'error': f'Failed to get section content: {str(e)}'
        }), 500

@insights_bp.route('/podcast-audio/<filename>')
def serve_podcast_audio(filename):
    """Serve podcast audio files"""
    try:
        print(f"🎵 Audio request for: {filename}")
        
        # Get the audio directory path
        import os
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        audio_dir = os.path.join(backend_dir, 'audio')
        audio_path = os.path.join(audio_dir, filename)
        
        print(f"🔍 Looking for audio at: {audio_path}")
        print(f"📁 Audio directory exists: {os.path.exists(audio_dir)}")
        print(f"📁 Audio directory contents: {os.listdir(audio_dir) if os.path.exists(audio_dir) else 'N/A'}")
        
        if os.path.exists(audio_path):
            from flask import send_file
            print(f"✅ Serving audio file: {audio_path}")
            return send_file(audio_path, mimetype='audio/mpeg')
        else:
            print(f"❌ Audio file not found: {audio_path}")
            return jsonify({'error': 'Audio file not found'}), 404
            
    except Exception as e:
        print(f"❌ Error serving podcast audio: {e}")
        return jsonify({'error': f'Failed to serve audio: {str(e)}'}), 500
