#!/usr/bin/env python3
import json
import os
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import wraps
from typing import Any

from dotenv import load_dotenv
from litellm import completion
from quart import Quart, Response, request
from quart_cors import cors

load_dotenv()

app = Quart(__name__)
app = cors(app, allow_origin=['http://localhost:5173', 'http://127.0.0.1:5173'])

# Environment validation
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError('GEMINI_API_KEY environment variable not set in backend.')

# Rate limiting configuration
RATE_LIMIT_REQUESTS = int(os.environ.get('RATE_LIMIT_REQUESTS', '100'))  # requests
RATE_LIMIT_WINDOW = int(os.environ.get('RATE_LIMIT_WINDOW', '3600'))  # seconds

# do not change this model!!!
DEFAULT_MODEL = 'gemini/gemini-2.0-flash-exp'  # do not change this model!!!
DEFAULT_TEMPERATURE = 0.7


@dataclass
class RateLimitEntry:
    count: int
    window_start: datetime


# In-memory rate limiting store
rate_limit_store = defaultdict(lambda: RateLimitEntry(count=0, window_start=datetime.now()))


# Custom error class
class AIServiceError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


# Request validation decorator
def validate_request(f):
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        if request.method == 'OPTIONS':
            return Response('')
        if not request.is_json:
            raise AIServiceError('Content-Type must be application/json', 400)
        return await f(*args, **kwargs)

    return decorated_function


# Rate limiting decorator with sliding window
def rate_limit(f):
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        if request.method == 'OPTIONS':
            return Response('')

        # Get client identifier (IP address or API key if available)
        client_id = request.headers.get('X-API-Key') or request.remote_addr

        # Get or create rate limit entry
        entry = rate_limit_store[client_id]
        now = datetime.now()

        # Reset if window has expired
        window_end = entry.window_start + timedelta(seconds=RATE_LIMIT_WINDOW)
        if now > window_end:
            entry.count = 0
            entry.window_start = now

        # Check rate limit
        if entry.count >= RATE_LIMIT_REQUESTS:
            reset_time = window_end.timestamp()
            raise AIServiceError(f'Rate limit exceeded. Try again after {reset_time}', 429)

        # Increment counter
        entry.count += 1
        rate_limit_store[client_id] = entry

        # Add rate limit headers
        response = await f(*args, **kwargs)
        if isinstance(response, Response):
            response.headers['X-RateLimit-Limit'] = str(RATE_LIMIT_REQUESTS)
            response.headers['X-RateLimit-Remaining'] = str(RATE_LIMIT_REQUESTS - entry.count)
            response.headers['X-RateLimit-Reset'] = str(window_end.timestamp())
        return response

    return decorated_function


async def validate_schema(data: dict[str, Any]) -> dict[str, Any]:
    """Validate request schema"""
    if not isinstance(data, dict):
        raise AIServiceError('Invalid request format', 400)

    if 'prompt' not in data:
        raise AIServiceError("Missing 'prompt' field", 400)

    # Extract system message if present
    prompt = data['prompt']
    system_message = None
    if prompt.startswith('Instructions:'):
        parts = prompt.split('\n\n', 1)
        if len(parts) == 2:
            system_message = parts[0].replace('Instructions:', '').strip()
            prompt = parts[1].strip()

    return {
        'prompt': prompt,
        'system_message': system_message,
        'temperature': data.get('temperature', DEFAULT_TEMPERATURE),
        'stream': data.get('stream', True),
    }


def handle_error(error: Exception) -> Response:
    """Unified error handling"""
    if isinstance(error, AIServiceError):
        status_code = error.status_code
    else:
        status_code = 500

    error_message = str(error)
    print(f'Error occurred: {error_message}')  # Log error for debugging

    return Response(json.dumps({'error': error_message, 'status': status_code}), status=status_code, mimetype='application/json')


async def get_user_context() -> dict[str, Any] | None:
    """Get user context from request"""
    api_key = request.headers.get('X-API-Key')
    if api_key:
        return {'api_key': api_key}
    return None


async def handle_streaming_response(data: dict[str, Any], user_context: dict[str, Any] | None = None):
    """Handle streaming response generation"""
    try:

        async def generate_stream():
            try:
                messages = []
                if data.get('system_message'):
                    messages.append({'role': 'system', 'content': data['system_message']})
                messages.append({'role': 'user', 'content': data['prompt']})

                response_stream = completion(
                    model=DEFAULT_MODEL,
                    messages=messages,
                    stream=True,
                    api_key=GEMINI_API_KEY,
                    temperature=data['temperature'],
                )

                for chunk in response_stream:
                    if chunk.get('choices'):
                        delta_content = chunk['choices'][0]['delta'].get('content', '')
                        if delta_content:
                            yield delta_content

            except Exception as e:
                print(f'Streaming error: {e!s}')  # Log error for debugging
                yield f'Error: {e!s}'

        return Response(generate_stream(), mimetype='text/plain')

    except Exception as e:
        print(f'Response handling error: {e!s}')  # Log error for debugging
        return handle_error(e)


@app.route('/api/ai/generate', methods=['POST', 'OPTIONS'])
@validate_request
@rate_limit
async def generate():
    """Main generation endpoint with proper error handling and validation"""
    try:
        data = await validate_schema(await request.get_json())
        return await handle_streaming_response(data, user_context=await get_user_context())
    except Exception as e:
        return handle_error(e)


@app.route('/api/ai/proofread', methods=['POST', 'OPTIONS'])
@validate_request
@rate_limit
async def proofread():
    """Specialized endpoint for proofreading text"""
    try:
        data = await validate_schema(await request.get_json())
        # Add proofreading-specific system message
        data['system_message'] = """You are a professional proofreader. Your task is to:
1. Fix spelling, grammar, and punctuation errors
2. Maintain the original tone and style
3. Only make necessary corrections
4. Do not add explanations or comments"""

        return await handle_streaming_response(data, user_context=await get_user_context())
    except Exception as e:
        return handle_error(e)


@app.route('/api/ai/complete', methods=['POST', 'OPTIONS'])
@validate_request
@rate_limit
async def complete():
    """Specialized endpoint for text completion"""
    try:
        data = await validate_schema(await request.get_json())
        # Optimize for completion
        data['temperature'] = min(data.get('temperature', 0.7), 0.8)
        data['system_message'] = 'You are a helpful AI assistant. Complete the text naturally and coherently.'
        return await handle_streaming_response(data, user_context=await get_user_context())
    except Exception as e:
        return handle_error(e)


# Document storage
documents = {}


@app.route('/api/document/save', methods=['POST', 'OPTIONS'])
@validate_request
async def save_document():
    """Save document state"""
    try:
        data = await request.get_json()
        if 'id' not in data or 'content' not in data:
            raise AIServiceError("Missing 'id' or 'content' field", 400)

        doc_id = data['id']
        documents[doc_id] = {'content': data['content'], 'timestamp': datetime.now().isoformat()}
        return Response(json.dumps({'status': 'success'}), mimetype='application/json')
    except Exception as e:
        return handle_error(e)


@app.route('/api/document/load/<doc_id>', methods=['GET', 'OPTIONS'])
async def load_document(doc_id):
    """Load document state"""
    try:
        if doc_id not in documents:
            raise AIServiceError('Document not found', 404)
        return Response(json.dumps(documents[doc_id]), mimetype='application/json')
    except Exception as e:
        return handle_error(e)


if __name__ == '__main__':
    print('Starting server on port 5002...')  # Log server start
    app.run(debug=True, port=5002)
