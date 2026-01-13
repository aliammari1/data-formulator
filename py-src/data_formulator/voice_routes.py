# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

"""
Voice-to-Voice Routes for Data Formulator

This module provides endpoints for:
- Speech-to-Text (using Whisper or browser Web Speech API)
- Text-to-Speech (using edge-tts or browser SpeechSynthesis)
"""

import flask
from flask import request, jsonify, Blueprint, Response
import logging
import io
import base64
import json

logger = logging.getLogger(__name__)

voice_bp = Blueprint('voice', __name__, url_prefix='/api/voice')


@voice_bp.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """
    Transcribe audio to text using OpenAI Whisper API.
    
    Expects:
    - audio_data: Base64 encoded audio data
    - model_config: Model configuration with API key
    
    Returns:
    - text: Transcribed text
    """
    try:
        data = request.json
        audio_data = data.get('audio_data')
        model_config = data.get('model_config', {})
        
        if not audio_data:
            return jsonify({'error': 'No audio data provided'}), 400
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(audio_data)
        
        # Use OpenAI Whisper API for transcription
        api_key = model_config.get('api_key')
        
        if not api_key:
            # Return a suggestion to use browser-based transcription
            return jsonify({
                'error': 'No API key configured for server-side transcription',
                'suggestion': 'Use browser Web Speech API for transcription'
            }), 400
        
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            
            # Create a file-like object from bytes
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = 'audio.webm'
            
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text"
            )
            
            return jsonify({'text': transcription})
            
        except Exception as e:
            logger.error(f"Whisper API error: {str(e)}")
            return jsonify({
                'error': f'Transcription failed: {str(e)}',
                'suggestion': 'Use browser Web Speech API for transcription'
            }), 500
            
    except Exception as e:
        logger.error(f"Transcribe error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@voice_bp.route('/synthesize', methods=['POST'])
def synthesize_speech():
    """
    Synthesize text to speech using edge-tts or OpenAI TTS.
    
    Expects:
    - text: Text to synthesize
    - voice: Voice name (optional)
    - model_config: Model configuration (optional)
    
    Returns:
    - audio_data: Base64 encoded audio data
    """
    try:
        data = request.json
        text = data.get('text', '')
        voice = data.get('voice', 'en-US-AriaNeural')
        model_config = data.get('model_config', {})
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        # Try using edge-tts (free, no API key needed)
        try:
            import edge_tts
            import asyncio
            
            async def synthesize():
                communicate = edge_tts.Communicate(text, voice)
                audio_data = b''
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        audio_data += chunk["data"]
                return audio_data
            
            # Run async function
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            audio_bytes = loop.run_until_complete(synthesize())
            loop.close()
            
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            return jsonify({
                'audio_data': audio_base64,
                'format': 'audio/mpeg'
            })
            
        except ImportError:
            # edge-tts not installed, try OpenAI TTS
            api_key = model_config.get('api_key')
            
            if api_key:
                try:
                    from openai import OpenAI
                    client = OpenAI(api_key=api_key)
                    
                    response = client.audio.speech.create(
                        model="tts-1",
                        voice="alloy",
                        input=text
                    )
                    
                    audio_bytes = response.content
                    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                    
                    return jsonify({
                        'audio_data': audio_base64,
                        'format': 'audio/mpeg'
                    })
                    
                except Exception as e:
                    logger.error(f"OpenAI TTS error: {str(e)}")
            
            # Fallback: suggest browser-based TTS
            return jsonify({
                'error': 'Server-side TTS not available',
                'suggestion': 'Use browser SpeechSynthesis API',
                'text': text
            }), 400
            
    except Exception as e:
        logger.error(f"Synthesize error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@voice_bp.route('/voices', methods=['GET'])
def list_voices():
    """
    List available voices for TTS.
    """
    try:
        try:
            import edge_tts
            import asyncio
            
            async def get_voices():
                voices = await edge_tts.list_voices()
                return voices
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            voices = loop.run_until_complete(get_voices())
            loop.close()
            
            # Filter to English voices and format response
            english_voices = [
                {
                    'name': v['Name'],
                    'shortName': v['ShortName'],
                    'gender': v['Gender'],
                    'locale': v['Locale']
                }
                for v in voices
                if v['Locale'].startswith('en-')
            ]
            
            return jsonify({'voices': english_voices})
            
        except ImportError:
            # Return default browser voices suggestion
            return jsonify({
                'voices': [],
                'suggestion': 'Use browser SpeechSynthesis API for voice list'
            })
            
    except Exception as e:
        logger.error(f"List voices error: {str(e)}")
        return jsonify({'error': str(e)}), 500
