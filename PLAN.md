### Implementation Plan

1. **Backend Architecture (Flask + LiteLLM)**
- Environment Configuration:
  ```python
  # Load environment variables from .env
  from dotenv import load_dotenv
  load_dotenv()
  
  # Access API key from backend environment
  OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
  if not OPENAI_API_KEY:
      raise ValueError('OPENAI_API_KEY environment variable not set in backend.')

  # Model configuration (handled by backend)
  DEFAULT_MODEL = 'gpt-4'
  DEFAULT_TEMPERATURE = 0.7
  ```

- API Endpoints:
  ```python
  @app.route("/api/ai/generate", methods=["POST"])
  @validate_request
  @rate_limit
  async def generate():
      try:
          data = validate_schema(request.json)
          return await handle_streaming_response(
              data, 
              user_context=get_user_context()
          )
      except AIServiceError as e:
          return handle_error(e)
  ```

2. **Frontend AI Service Layer**
- API Client Configuration:
  ```typescript
  export class APIClient {
      private readonly apiEndpoint: string;
      private readonly maxRetries: number;
      private readonly retryDelay: number;
      
      constructor(config: AIConfig) {
          this.apiEndpoint = config.apiEndpoint || 'http://127.0.0.1:5002';
          this.maxRetries = config.maxRetries || 3;
          this.retryDelay = config.retryDelay || 1000;
      }
      
      // Format messages for backend compatibility
      private formatMessages(params: AIRequestParams): string {
          return params.messages.map(msg => {
              if (msg.role === 'system') {
                  return `Instructions: ${msg.content}\n\n`;
              }
              return msg.content;
          }).join('\n');
      }
  }
  ```

### Fixed Issues

1. **Message Format Mismatch**
   - Problem: Frontend was sending messages array while backend expected single prompt
   - Solution: Added message formatting in APIClient to combine messages into proper prompt format
   - Backend updated to handle system messages separately

2. **Port Configuration**
   - Problem: Port conflict with other services
   - Solution: Moved backend to port 5002

3. **Model Configuration**
   - Problem: Model selection exposed in frontend
   - Solution: Moved all model configuration to backend
   - Frontend now only sends prompt and temperature

4. **Error Handling**
   - Added better error logging in backend
   - Improved error propagation to frontend
   - Added request validation for prompt format

### Running the Application

1. Backend Setup:
```bash
# Create .env file in backend directory with:
OPENAI_API_KEY=your_api_key_here
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600

# Install dependencies
pip install -r requirements.txt

# Run the backend server (will run on port 5002)
python app.py
```

2. Frontend Setup:
```bash
# Install dependencies
bun install

# Run the frontend development server
bun run dev
```

### Troubleshooting

1. **Message Format**
   - Ensure system messages are properly formatted with "Instructions:" prefix
   - Check backend logs for any message parsing errors
   - Verify frontend is using formatMessages correctly

2. **API Communication**
   - Confirm backend is running on port 5002
   - Check network tab for request/response format
   - Verify CORS is properly configured

3. **Error Handling**
   - Check backend logs for detailed error messages
   - Verify frontend displays error messages to user
   - Check rate limiting headers in responses

The backend server handles all API key management, model selection, and rate limiting. The frontend communicates with the backend API endpoints without needing direct access to API keys or model configuration.

### Testing

```bash
# Run backend tests
cd backend && python -m pytest

# Run frontend tests
bun test
```

### Monitoring

1. **Backend Logs**
   - Check terminal output for backend errors
   - Monitor rate limiting status
   - Track API usage and errors

2. **Frontend Monitoring**
   - Check browser console for errors
   - Monitor network requests in DevTools
   - Track user feedback and error states
