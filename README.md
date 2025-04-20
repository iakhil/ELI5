# ELI5 Buddy - Chrome Extension

ELI5 (Explain Like I'm Five) Buddy is a Chrome extension that explains complex text in simple terms. Highlight any difficult text on a webpage, click the extension button, and get an explanation that a 5-year-old could understand.

## Project Structure

This repository contains two main components:

1. **Chrome Extension**: The front-end extension that users interact with in their browser
2. **Proxy Server**: A secure backend that handles API calls to OpenAI without exposing your API key

## Security Features

Instead of embedding the OpenAI API key directly in the extension (which would be insecure), this project uses a proxy server architecture:

- The Chrome extension sends highlighted text to your server
- Your server adds the API key and forwards the request to OpenAI
- The explanation is returned to the extension

This approach keeps your API key secure and gives you control over usage.

## Setup Instructions

### Setting up the Proxy Server

See the [server README](./server/README.md) for detailed instructions on setting up and deploying the proxy server.

#### Deploying to Render

1. **Sign up/login to Render**: Go to [render.com](https://render.com/) and create an account if you don't have one

2. **Create a new Web Service**:
   - Click "New +" and select "Web Service"
   - Connect your GitHub repository
   - Select the repository that contains your ELI5 project

3. **Configure the service**:
   - **Name**: `eli5-proxy-server` (or whatever you prefer)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or select paid if you need more resources)

4. **Add environment variables**:
   - Under the "Environment" tab, add the following:
   - `OPENAI_API_KEY`: Your actual OpenAI API key
   - `PORT`: 10000 (Render will automatically use this for the internal port)

5. **Deploy**:
   - Click "Create Web Service"
   - Render will automatically build and deploy your service

6. **Update your extension**:
   - After successful deployment, Render will provide you with a URL (something like `https://eli5-proxy-server.onrender.com`)
   - Update your `background.js` file with this URL:
   ```javascript
   // In background.js
   const PROXY_SERVER_URL = 'https://eli5-proxy-server.onrender.com/api';
   ```

### Setting up the Chrome Extension

1. Update the proxy server URL in `background.js`:
   ```javascript
   const response = await fetch('https://your-deployed-server.com/api/explain', {
     // ...
   });
   ```

2. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select this project's directory

3. Create actual icon files:
   - Replace the placeholder files in the `images` directory with real icons:
     - `icon16.png` (16x16 px)
     - `icon48.png` (48x48 px)
     - `icon128.png` (128x128 px)

### Publishing to Chrome Web Store

1. Create a ZIP file of your extension directory
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
3. Pay the one-time $5.00 USD developer registration fee (if you haven't already)
4. Click "New Item" and upload your ZIP file
5. Fill in the store listing information
6. Submit for review

## Usage

1. Highlight text on any webpage
2. Click the ELI5 Buddy extension icon
3. Click "Explain Like I'm Five!"
4. Get a simple explanation
5. Copy the explanation if needed

## License

MIT License

## Features

- Highlight any text on a webpage and get a simplified explanation
- Generate flashcards from highlighted text for studying and memorization
- Interactive flashcards with reveal/hide answer functionality for effective learning
- Customize the number of flashcards and difficulty level
- Export flashcards as CSV for use with popular flashcard apps
- Clean, modern UI with intuitive controls
- Copy explanations and flashcards to clipboard with one click
- Powered by OpenAI's GPT model

## Development

### Prerequisites

- Chrome browser
- Basic knowledge of HTML, CSS, and JavaScript
- OpenAI API key (for the explanation and flashcard generation services)

### Setup

1. Clone the repository
2. Update the `PROXY_SERVER_URL` in `background.js` with your deployed server URL
3. Load the extension in Chrome as described in the Installation section

### Generating Icons

To generate the PNG icons from the SVG file, you can use one of the methods described in `generate_icons.js`.

## License

MIT

## Acknowledgements

- OpenAI for providing the API that powers the explanations and flashcards
- Font Awesome for the icons used in the UI
