import os
import subprocess
import requests
from pathlib import Path
from google.cloud import texttospeech

# Python libraries to be installed: requests, google-cloud-texttospeech, pydub(optional)
# Also install ffmpeg for pydub. This is required for smaller audio files to be merged.

"""
Unified Text-to-Speech Interface with Multi-Provider Support

This module provides a unified interface for text-to-speech using various providers
including Azure OpenAI TTS, Google Cloud Text-to-Speech, and local espeak-ng.

SETUP:
Users are expected to set appropriate environment variables for their chosen TTS provider
before calling the generate_audio function.

Environment Variables:

TTS_PROVIDER (default: "local")
    - "azure": Azure OpenAI TTS
    - "gcp": Google Cloud Text-to-Speech
    - "local": Local TTS implementation (default, uses espeak-ng)

TTS_CLOUD_MAX_CHARS (default: 3000)
    - Applies only to cloud providers: "azure" and "gcp"
    - Maximum number of characters per TTS API call
    - If the input text exceeds this limit, it will be split into chunks and synthesized sequentially,
      then concatenated into the final audio file
    - Set to a non-positive value to disable chunking
    - Requires `pydub` (and ffmpeg installed on the system) to merge chunked audio outputs

For Azure TTS:
    AZURE_TTS_KEY: Your Azure OpenAI API key
    AZURE_TTS_ENDPOINT: Azure OpenAI endpoint URL
    AZURE_TTS_VOICE (default: "alloy"): Voice to use (alloy, echo, fable, onyx, nova, shimmer)
    AZURE_TTS_DEPLOYMENT (default: "tts"): Deployment name
    AZURE_TTS_API_VERSION (default: "2025-03-01-preview"): API version

For Google Cloud TTS:
    GOOGLE_API_KEY: Your Google API key (recommended)
    GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON file (alternative)
    GCP_TTS_VOICE (default: "en-US-Neural2-F"): Voice to use
    GCP_TTS_LANGUAGE (default: "en-US"): Language code

For Local TTS (espeak-ng):
    ESPEAK_VOICE (default: "en"): Voice to use
    ESPEAK_SPEED (default: "150"): Speech rate (words per minute)
    Note: Participants can modify the local provider implementation to use any local TTS solution
    
    Installation:
        # Ubuntu/Debian
        sudo apt-get install espeak-ng
        
        # macOS
        brew install espeak
        
        # CentOS/RHEL
        sudo yum install espeak-ng

Usage:
    from tts import generate_audio
    
    # Basic usage with default provider (local)
    generate_audio("Hello, world!", "output.wav")
    
    # With specific provider
    generate_audio("Hello, world!", "output.mp3", provider="azure")
    
    # With custom voice
    generate_audio("Hello, world!", "output.wav", voice="alloy")
    

"""

def generate_audio(text, output_file, provider=None, voice=None):
    """
    Generate audio from text using the specified TTS provider.
    
    Args:
        text (str): Text to convert to speech
        output_file (str): Output file path
        provider (str, optional): TTS provider to use. Defaults to TTS_PROVIDER env var or "festival"
        voice (str, optional): Voice to use. Defaults to provider-specific default
    
    Returns:
        str: Path to the generated audio file
    
    Raises:
        RuntimeError: If TTS provider is not available or synthesis fails
        ValueError: If text is empty or invalid
    """
    if not text or not text.strip():
        raise ValueError("Text cannot be empty")
    
    provider = provider or os.getenv("TTS_PROVIDER", "local").lower()
    
    # Create audio directory if it doesn't exist
    audio_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio')
    os.makedirs(audio_dir, exist_ok=True)
    
    # Update output file path to be in the audio directory
    output_filename = os.path.basename(output_file)
    output_file = os.path.join(audio_dir, output_filename)
    
    # Create output directory if it doesn't exist
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Cloud input size limit handling via environment variable
    # TTS_CLOUD_MAX_CHARS: Maximum characters per request for cloud providers (azure/gcp)
    # Defaults to 3000 if not set. Local provider is never chunked.
    max_chars_env = os.getenv("TTS_CLOUD_MAX_CHARS", "3000")
    max_chars = None
    try:
        max_chars = int(max_chars_env)
        if max_chars <= 0:
            max_chars = None
    except (TypeError, ValueError):
        max_chars = 3000

    if provider in ("azure", "gcp") and max_chars and len(text) > max_chars:
        return _generate_cloud_tts_chunked(text, output_file, provider, voice, max_chars)

    if provider == "azure":
        return _generate_azure_tts(text, output_file, voice)
    elif provider == "gcp":
        return _generate_gcp_tts(text, output_file, voice)
    elif provider == "local":
        return _generate_local_tts(text, output_file, voice)
    else:
        raise ValueError(f"Unsupported TTS_PROVIDER: {provider}")

def _chunk_text_by_chars(text, max_chars):
    """Split text into chunks not exceeding max_chars, preferring whitespace boundaries.

    If a single token exceeds max_chars, it will be split hard.
    """
    import re

    if len(text) <= max_chars:
        return [text]

    tokens = re.findall(r"\S+\s*", text)
    chunks = []
    current = ""

    for token in tokens:
        if len(current) + len(token) <= max_chars:
            current += token
        else:
            if current:
                chunks.append(current.strip())
                current = ""
            # If token itself is longer than max_chars, split it
            if len(token) > max_chars:
                start = 0
                while start < len(token):
                    part = token[start:start + max_chars]
                    part = part.strip()
                    if part:
                        chunks.append(part)
                    start += max_chars
            else:
                current = token

    if current.strip():
        chunks.append(current.strip())

    # Final safety: ensure no empty strings
    return [c for c in chunks if c]

def _generate_cloud_tts_chunked(text, output_file, provider, voice, max_chars):
    """Chunk long text for cloud providers and concatenate resulting audio files.

    This function only applies to cloud providers (azure, gcp). Local provider is excluded.
    """
    from pathlib import Path
    from pydub import AudioSegment

    chunks = _chunk_text_by_chars(text, max_chars)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    temp_files = []
    try:
        for index, chunk in enumerate(chunks):
            temp_file = str(output_path.parent / f".tts_chunk_{index}.mp3")
            if provider == "azure":
                _generate_azure_tts(chunk, temp_file, voice)
            elif provider == "gcp":
                _generate_gcp_tts(chunk, temp_file, voice)
            else:
                raise ValueError("Chunked synthesis is only supported for cloud providers 'azure' and 'gcp'.")
            temp_files.append(temp_file)

        # Concatenate audio segments
        combined_audio = None
        for temp_file in temp_files:
            segment = AudioSegment.from_file(temp_file, format="mp3")
            if combined_audio is None:
                combined_audio = segment
            else:
                combined_audio += segment

        # Determine export format from output extension; default to mp3
        suffix = output_path.suffix.lower().lstrip(".") or "mp3"
        combined_audio.export(str(output_path), format=suffix)

        print(f"Chunked {provider.upper()} TTS audio saved to: {output_file} ({len(chunks)} chunks)")
        return str(output_path)
    finally:
        # Cleanup temporary files
        for temp_file in temp_files:
            try:
                os.remove(temp_file)
            except Exception:
                pass

def _generate_azure_tts(text, output_file, voice=None):
    """Generate audio using Azure Speech Service TTS."""
    api_key = os.getenv("AZURE_TTS_KEY")
    endpoint = os.getenv("AZURE_TTS_ENDPOINT")
    voice = voice or os.getenv("AZURE_TTS_VOICE", "en-US-JennyNeural")
    
    if not api_key or not endpoint:
        raise ValueError("AZURE_TTS_KEY and AZURE_TTS_ENDPOINT must be set for Azure Speech Service TTS")
    
    # Remove trailing slash from endpoint if present
    endpoint = endpoint.rstrip('/')
    
    # Azure Speech Service REST API endpoint
    # Convert from Azure OpenAI endpoint to Speech Service endpoint
    if 'api.cognitive.microsoft.com' in endpoint:
        # Extract region from the endpoint
        region = endpoint.split('.')[0].replace('https://', '')
        url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    else:
        # If it's already a Speech Service endpoint, use as is
        url = f"{endpoint}/cognitiveservices/v1"
    
    headers = {
        "Ocp-Apim-Subscription-Key": api_key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3"
    }
    
    # Create SSML with the specified voice
    # Determine gender based on voice name
    gender = 'Female' if 'Amanda' in voice or 'Jenny' in voice else 'Male'
    
    ssml = f"""<speak version='1.0' xml:lang='en-US'>
    <voice xml:lang='en-US' xml:gender='{gender}' name='{voice}'>
        {text}
    </voice>
</speak>"""
    
    try:
        print(f"🔗 Making request to: {url}")
        print(f"🔑 Using voice: {voice}")
        print(f"📝 SSML length: {len(ssml)} characters")
        
        response = requests.post(url, headers=headers, data=ssml, timeout=30)
        response.raise_for_status()
        
        with open(output_file, "wb") as f:
            f.write(response.content)
        
        print(f"✅ Azure Speech Service TTS audio saved to: {output_file}")
        return output_file
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Azure TTS Error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response status: {e.response.status_code}")
            print(f"Response text: {e.response.text}")
            print(f"Request URL: {url}")
            print(f"Request headers: {headers}")
        raise RuntimeError(f"Azure Speech Service TTS failed: {e}")

def _generate_gcp_tts(text, output_file, voice=None):
    """Generate audio using Google Cloud Text-to-Speech."""
    api_key = os.getenv("GOOGLE_API_KEY")
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    gcp_voice = voice or os.getenv("GCP_TTS_VOICE", "en-US-Neural2-F")
    language = os.getenv("GCP_TTS_LANGUAGE", "en-US")
    
    if not api_key and not credentials_path:
        raise ValueError("Either GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS must be set for Google Cloud TTS")
    
    try:
        # Use API key if available, otherwise use service account credentials
        if api_key:
            # For API key authentication, we need to use the REST API directly
            import requests
            
            url = "https://texttospeech.googleapis.com/v1/text:synthesize"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "input": {"text": text},
                "voice": {
                    "languageCode": language,
                    "name": gcp_voice
                },
                "audioConfig": {
                    "audioEncoding": "MP3"
                }
            }
            
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            
            # Decode the base64 audio content
            import base64
            audio_content = base64.b64decode(response.json()["audioContent"])
            
            with open(output_file, "wb") as f:
                f.write(audio_content)
                
        else:
            # Use service account credentials
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
            client = texttospeech.TextToSpeechClient()
            
            input_text = texttospeech.SynthesisInput(text=text)
            
            voice_params = texttospeech.VoiceSelectionParams(
                language_code=language,
                name=gcp_voice
            )
            
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3
            )
            
            response = client.synthesize_speech(
                input=input_text,
                voice=voice_params,
                audio_config=audio_config
            )
            
            with open(output_file, "wb") as f:
                f.write(response.audio_content)
        
        print(f"Google Cloud TTS audio saved to: {output_file}")
        return output_file
        
    except Exception as e:
        raise RuntimeError(f"Google Cloud TTS failed: {e}")

def _generate_local_tts(text, output_file, voice=None):
    """Generate speech using local espeak-ng TTS"""
    try:
        # Try to find espeak-ng in common Windows locations
        espeak_paths = [
            "espeak-ng",  # If in PATH
            r"C:\Program Files\eSpeak NG\espeak-ng.exe",  # Standard Chocolatey install
            r"C:\Program Files (x86)\eSpeak NG\espeak-ng.exe",  # 32-bit install
            r"C:\espeak-ng\espeak-ng.exe",  # Manual install
        ]
        
        espeak_cmd = None
        for path in espeak_paths:
            try:
                if path == "espeak-ng":
                    # Test if it's in PATH
                    result = subprocess.run(['espeak-ng', '--version'], capture_output=True, timeout=5)
                    if result.returncode == 0:
                        espeak_cmd = path
                        break
                else:
                    # Test full path
                    if os.path.exists(path):
                        result = subprocess.run([path, '--version'], capture_output=True, timeout=5)
                        if result.returncode == 0:
                            espeak_cmd = path
                            break
            except:
                continue
        
        if not espeak_cmd:
            raise RuntimeError("espeak-ng not found in PATH or common locations")
        
        print(f"🎤 Using espeak-ng at: {espeak_cmd}")
        
        # Set voice parameters
        voice_param = voice or os.getenv("ESPEAK_VOICE", "en")
        speed_param = os.getenv("ESPEAK_SPEED", "150")
        
        # Create temporary WAV file
        temp_wav_file = output_file.replace('.mp3', '.wav')
        
        # Run espeak-ng command
        cmd = [
            espeak_cmd,
            '-v', voice_param,
            '-s', speed_param,
            '-w', temp_wav_file,
            text
        ]
        
        print(f"🔊 Running command: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            print(f"espeak-ng stderr: {result.stderr}")
            raise RuntimeError(f"espeak-ng failed with return code {result.returncode}")
        
        # Check if temporary WAV file was created
        if not os.path.exists(temp_wav_file):
            raise RuntimeError(f"espeak-ng did not create output file {temp_wav_file}")
        
        # Convert WAV to MP3 if output file is MP3
        if output_file.endswith('.mp3'):
            try:
                from pydub import AudioSegment
                
                # Load WAV file
                audio = AudioSegment.from_wav(temp_wav_file)
                
                # Export as MP3
                audio.export(output_file, format="mp3")
                
                # Remove temporary WAV file
                os.remove(temp_wav_file)
                
                print(f"Local TTS audio saved to: {output_file}")
                return output_file
                
            except ImportError:
                raise RuntimeError("pydub library not installed. Please install it with: pip install pydub")
            except Exception as e:
                raise RuntimeError(f"Failed to convert WAV to MP3: {e}")
        else:
            # If output is WAV, just rename the file
            os.rename(temp_wav_file, output_file)
            print(f"Local TTS audio saved to: {output_file}")
            return output_file
        
    except subprocess.TimeoutExpired:
        raise RuntimeError("espeak-ng synthesis timed out")
    except FileNotFoundError:
        raise RuntimeError("espeak-ng is not installed. Please install it first:\nUbuntu/Debian: sudo apt-get install espeak-ng\nmacOS: brew install espeak\nCentOS/RHEL: sudo yum install espeak-ng\nWindows: Use Chocolatey: choco install espeak-ng")
    except Exception as e:
        raise RuntimeError(f"Local TTS synthesis error: {str(e)}")

def _test_tts_providers():
    """Internal test function for TTS providers."""
    test_text = "Hello, this is a test of text to speech functionality. "
    test_file = "test_output"
    
    providers = ["local", "azure", "gcp"]
    
    for provider in providers:
        try:
            output_file = generate_audio(test_text, f"{test_file}_{provider}", provider=provider)
            return True
        except Exception as e:
            return False

def list_available_providers():
    """List available TTS providers and their status."""
    providers = {
        "local": "Local TTS implementation (uses espeak-ng, can be modified)",
        "azure": "Azure OpenAI TTS (requires AZURE_TTS_KEY and AZURE_TTS_ENDPOINT)",
        "gcp": "Google Cloud Text-to-Speech (requires GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS)"
    }
    
    print("Available TTS Providers:")
    for provider, description in providers.items():
        status = "✅ Available" if _test_provider(provider) else "❌ Not available"
        print(f"  {provider}: {description} - {status}")

def _test_provider(provider):
    """Test if a specific provider is available."""
    try:
        if provider == "local":
            result = subprocess.run(['espeak-ng', '--version'], capture_output=True, timeout=5)
            return result.returncode == 0
        elif provider == "azure":
            return bool(os.getenv("AZURE_TTS_KEY") and os.getenv("AZURE_TTS_ENDPOINT"))
        elif provider == "gcp":
            return bool(os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
        return False
    except:
        return False

def generate_podcast_conversation(card_data, output_file="podcast.mp3", provider=None):
    """
    Generate a conversational podcast between two speakers about a card's content.
    
    Args:
        card_data (dict): Dictionary containing card information
        output_file (str): Output filename for the podcast
        provider (str): TTS provider to use (gcp, azure, local)
    
    Returns:
        str: Path to the generated podcast file
    """
    try:
        from pydub import AudioSegment
        import tempfile
        import os
        
        # Ensure audio directory exists
        audio_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio')
        os.makedirs(audio_dir, exist_ok=True)
        
        # Update output file path to be in audio directory
        output_filename = os.path.basename(output_file)
        output_file = os.path.join(audio_dir, output_filename)
        
        print(f"🎙️ Generating podcast conversation for: {card_data.get('frontside_heading', 'Unknown')}")
        print(f"📁 Output will be saved to: {output_file}")
        
        # Extract card data
        frontside_heading = card_data.get('frontside_heading', 'Unknown Topic')
        frontside_content = card_data.get('frontside_content', '')
        backside_insights = card_data.get('backside_insights', {})
        related_cards = card_data.get('related_cards', [])
        
        # Create the conversation script
        conversation_script = _create_podcast_script(
            frontside_heading, 
            frontside_content, 
            backside_insights, 
            related_cards
        )
        
        print(f"🎙️ Generated podcast script: {len(conversation_script)} segments")
        
        # Generate audio for each speaker segment
        audio_segments = []
        temp_files = []
        
        for i, segment in enumerate(conversation_script):
            speaker = segment['speaker']
            text = segment['text']
            
            # Use specific Azure Speech Service voices for each speaker
            # Using voices that are available in Central India region
            if speaker == 'Speaker 1':
                voice = 'en-IN-NeerjaNeural'  # Female voice - starts the podcast (available in India)
            else:
                voice = 'en-IN-PrabhatNeural'  # Male voice - answers (available in India)
            
            # Create temporary file for this segment
            temp_file = f"temp_segment_{i}_{speaker.replace(' ', '_')}.mp3"
            temp_files.append(temp_file)
            
            print(f"🎤 Generating audio for {speaker} ({voice}): {text[:50]}...")
            
            # Generate audio for this segment
            try:
                audio_path = generate_audio(text, temp_file, provider=provider, voice=voice)
                audio_segments.append(audio_path)
                print(f"✅ Audio generated for {speaker}: {audio_path}")
            except Exception as e:
                print(f"❌ Failed to generate audio for {speaker} with {provider}: {e}")
                print(f"🔄 Trying fallback to local TTS...")
                try:
                    # Fallback to local TTS
                    fallback_voice = 'en+m1' if speaker == 'Speaker 1' else 'en+f1'
                    audio_path = generate_audio(text, temp_file, provider="local", voice=fallback_voice)
                    audio_segments.append(audio_path)
                    print(f"✅ Fallback audio generated for {speaker}: {audio_path}")
                except Exception as fallback_error:
                    print(f"❌ Fallback also failed for {speaker}: {fallback_error}")
                    raise RuntimeError(f"Both {provider} and local TTS failed for {speaker}: {e}")
        
        # Concatenate all audio segments
        print("🔗 Concatenating audio segments...")
        combined_audio = None
        
        for audio_file in audio_segments:
            if os.path.exists(audio_file):
                segment = AudioSegment.from_file(audio_file, format="mp3")
                if combined_audio is None:
                    combined_audio = segment
                else:
                    # Add a small pause between speakers
                    pause = AudioSegment.silent(duration=300)  # 300ms pause
                    combined_audio = combined_audio + pause + segment
        
        if combined_audio:
            # Export final podcast
            combined_audio.export(output_file, format="mp3")
            print(f"✅ Podcast generated successfully: {output_file}")
            
            # Clean up temporary files
            for temp_file in temp_files:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
            
            return output_file
        else:
            raise RuntimeError("Failed to generate any audio segments")
             
    except ImportError:
        raise RuntimeError("pydub library required for podcast generation. Install with: pip install pydub")
    except Exception as e:
        raise RuntimeError(f"Podcast generation failed: {str(e)}")

def _create_podcast_script(frontside_heading, frontside_content, backside_insights, related_cards):
    """
    Create a natural conversation script between two speakers.
    """
    # Extract insights
    key_insights = backside_insights.get('keyInsights', [])
    did_you_know = backside_insights.get('didYouKnow', [])
    contradictions = backside_insights.get('contradictions', [])
    trends = backside_insights.get('inspirations', [])
    
    # Create conversation flow
    conversation = []
    
    # Introduction
    conversation.append({
        'speaker': 'Speaker 1',
        'text': f"Welcome! Today we're exploring {frontside_heading}. Can you share the key insights from this section?"
    })
    
    # Key insights response
    if key_insights:
        insights_text = f"Sure! The most important points are: {key_insights[0] if len(key_insights) > 0 else 'This section provides valuable information'}. "
        if len(key_insights) > 1:
            insights_text += f"Also, {key_insights[1]}."
        conversation.append({
            'speaker': 'Speaker 2',
            'text': insights_text
        })
    else:
        conversation.append({
            'speaker': 'Speaker 2',
            'text': f"This section on {frontside_heading} contains important information that's relevant to our discussion."
        })
    
    # Did you know facts
    conversation.append({
        'speaker': 'Speaker 1',
        'text': "That's interesting. Are there any 'Did you know?' facts in this section?"
    })
    
    if did_you_know:
        facts_text = f"Yes, here are two you might like: {did_you_know[0] if len(did_you_know) > 0 else 'This topic has fascinating aspects'}. "
        if len(did_you_know) > 1:
            facts_text += f"And {did_you_know[1]}."
        conversation.append({
            'speaker': 'Speaker 2',
            'text': facts_text
        })
    else:
        conversation.append({
            'speaker': 'Speaker 2',
            'text': "This section contains some really interesting details that add depth to our understanding."
        })
    
    # Counterpoints/Contradictions
    conversation.append({
        'speaker': 'Speaker 1',
        'text': "What about counterpoints or contradictions? Are there areas where this might be challenged?"
    })
    
    if contradictions:
        contra_text = f"Good question. One area to consider is {contradictions[0] if len(contradictions) > 0 else 'potential challenges'}. "
        if len(contradictions) > 1:
            contra_text += f"Also, {contradictions[1]}."
        conversation.append({
            'speaker': 'Speaker 2',
            'text': contra_text
        })
    else:
        conversation.append({
            'speaker': 'Speaker 2',
            'text': "While this section presents solid information, it's always good to consider different perspectives and potential challenges."
        })
    
    # Related content connections
    if related_cards:
        conversation.append({
            'speaker': 'Speaker 1',
            'text': "How does this connect to other sections we've discussed?"
        })
        
        related_text = f"Well, this connects to {related_cards[0] if len(related_cards) > 0 else 'other relevant topics'}. "
        if len(related_cards) > 1:
            related_text += f"It also relates to {related_cards[1]}."
        conversation.append({
            'speaker': 'Speaker 2',
            'text': related_text
        })
    
    # Trends and future outlook
    conversation.append({
        'speaker': 'Speaker 1',
        'text': "What about current trends or future developments in this area?"
    })
    
    if trends:
        trends_text = f"Great question. One current trend is {trends[0] if len(trends) > 0 else 'ongoing developments'}. "
        if len(trends) > 1:
            trends_text += f"And we're seeing {trends[1]}."
        conversation.append({
            'speaker': 'Speaker 2',
            'text': trends_text
        })
    else:
        conversation.append({
            'speaker': 'Speaker 2',
            'text': "This is an evolving field with ongoing developments that we should keep an eye on."
        })
    
    # Wrap up
    conversation.append({
        'speaker': 'Speaker 1',
        'text': "That's really insightful. Thanks for breaking down this section for us."
    })
    
    conversation.append({
        'speaker': 'Speaker 2',
        'text': "You're welcome! This section really highlights the key points we need to understand."
    })
    
    return conversation

if __name__ == "__main__":
    # Get the provider from environment variable
    provider = os.getenv("TTS_PROVIDER", "local").lower()
    
    print(f"Testing TTS provider: {provider.upper()}")
    print("="*50)
    
    # Test the specified provider
    test_text = "Hello, this is a test of text to speech functionality."
    test_file = f"test_output_{provider}.mp3"
    
    try:
        output_file = generate_audio(test_text, test_file, provider=provider)
        print(f"✅ {provider.upper()} TTS test successful: {output_file}")
    except Exception as e:
        print(f"❌ {provider.upper()} TTS test failed: {e}")
        print("\nAvailable providers and their status:")
        list_available_providers() 
