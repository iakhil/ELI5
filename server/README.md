# ELI5 Buddy Proxy Server

This is a simple proxy server for the ELI5 Buddy Chrome extension. It securely handles OpenAI API requests without exposing your API key in the client-side code.

## Why use a proxy server?

* **Security**: Keeps your OpenAI API key secure by storing it server-side only
* **Control**: Adds rate limiting and monitoring capabilities
* **Cost management**: Helps prevent abuse of your API key
* **Maintenance**: Allows updating the API key without pushing new extension versions

## API Endpoints

The server provides the following endpoints:

### `/api/explain`
- **Method**: POST
- **Purpose**: Explains text in simple terms
- **Request body**: `{ "text": "Text to explain" }`
- **Response**: `{ "explanation": "Simple explanation" }`

### `/api/explain-image`
- **Method**: POST
- **Purpose**: Directly analyzes and explains images without separate text extraction
- **Request body**: `{ "imageData": "base64-encoded image data" }`
- **Response**: `{ "extractedText": "Brief description of image content", "explanation": "Simple explanation of the image" }`

### `/api/extract-and-explain`
- **Method**: POST
- **Purpose**: First extracts text from an image, then explains it
- **Request body**: `{ "imageData": "base64-encoded image data" }`
- **Response**: `{ "extractedText": "Text extracted from image", "explanation": "Simple explanation of the text" }`

### `/api/flashcards`
- **Method**: POST
- **Purpose**: Generates flashcards from text content
- **Request body**: `{ "text": "Text to create flashcards from", "count": 5, "difficulty": "intermediate" }`
- **Response**: `{ "flashcards": [{ "front": "Q", "back": "A" }, ...] }`

### `/api/health`
- **Method**: GET
- **Purpose**: Checks if the server is running
- **Response**: `{ "status": "ok", "message": "Proxy server is running" }`

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- An OpenAI API key

### Installation

1. Clone this repository or copy the files to your server
   ```
   git clone <repository-url>
   cd server
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file by copying the example
   ```
   cp .env.example .env
   ```

4. Edit the `.env` file and add your OpenAI API key
   ```
   OPENAI_API_KEY=sk-your-openai-api-key
   ```

5. Start the server
   ```
   npm start
   ```

   For development with auto-reload:
   ```
   npm run dev
   ```

## Deployment

This server can be deployed to various platforms:

- Heroku
- Vercel
- Render
- Railway
- AWS, GCP, or Azure
- Any VPS that supports Node.js

Remember to set the environment variables in your deployment platform.

## Updating the Chrome Extension

After deploying your proxy server, update the URL in the Chrome extension's `background.js` file:

```javascript
const response = await fetch('https://your-actual-server-url.com/api/explain', {
  // ...
});
```

## Optional Enhancements

You might want to add:

- Rate limiting middleware
- Authentication for your API
- Logging and monitoring
- Caching for common requests

## License

MIT 