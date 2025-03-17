# ELI5 Buddy - Chrome Extension

A Chrome extension that explains highlighted text in simple terms, like you're five years old.

## Features

- Highlight any text on a webpage and get a simplified explanation
- Clean, modern UI with intuitive controls
- Copy explanations to clipboard with one click
- Powered by OpenAI's GPT model

## Installation

### From Source

1. Clone this repository or download it as a ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The ELI5 Buddy extension should now be installed and visible in your Chrome toolbar

### From Chrome Web Store

*Coming soon*

## How to Use

1. Navigate to any webpage with text you want to understand better
2. Highlight the text you want explained
3. Click on the ELI5 Buddy extension icon in your toolbar
4. Click the "Explain Like I'm Five!" button
5. Read the simplified explanation
6. Use the copy button to copy the explanation to your clipboard if needed

## Development

### Prerequisites

- Chrome browser
- Basic knowledge of HTML, CSS, and JavaScript
- OpenAI API key (for the explanation service)

### Setup

1. Clone the repository
2. Update the `OPENAI_API_KEY` in `background.js` with your own API key
3. Load the extension in Chrome as described in the Installation section

### Generating Icons

To generate the PNG icons from the SVG file, you can use one of the methods described in `generate_icons.js`.

## License

MIT

## Acknowledgements

- OpenAI for providing the API that powers the explanations
- Font Awesome for the icons used in the UI
