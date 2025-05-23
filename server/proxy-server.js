// Simple proxy server for the ELI5 Buddy Chrome extension
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' })); // Increased limit for image data
app.use(cors());

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY environment variable is not set!');
  process.exit(1);
}

// Endpoint to explain text
app.post('/api/explain', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    
    // Call OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that explains complex topics in simple terms while still being accurate and technical. Do not oversimplify, ensure that the explanation covers all the key points. Keep your explanations concise and under 150 words. DO NOT include any other text or comments. Just the explanation.'
          },
          {
            role: 'user',
            content: `Please explain this in simple terms: ${text}`
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extract explanation from OpenAI response
    const explanation = response.data.choices[0].message.content.trim();
    
    // Return the explanation
    res.json({ explanation });
    
  } catch (error) {
    console.error('Error proxying request to OpenAI:', error.response?.data || error.message);
    res.status(500).json({ 
      error: error.response?.data?.error?.message || 'An error occurred processing your request' 
    });
  }
});

// Endpoint to generate flashcards
app.post('/api/flashcards', async (req, res) => {
  try {
    const { text, count = 5, difficulty = 'intermediate' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    
    // Map difficulty to appropriate system prompt
    let difficultyPrompt = "";
    switch(difficulty) {
      case "basic":
        difficultyPrompt = "Create simple, fundamental flashcards suitable for beginners.";
        break;
      case "advanced":
        difficultyPrompt = "Create advanced, detailed flashcards that explore deeper concepts and nuances.";
        break;
      default: // intermediate
        difficultyPrompt = "Create moderately challenging flashcards that balance fundamental and advanced concepts.";
    }
    
    // Call OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert educator who creates effective flashcards for learning and memorization. ${difficultyPrompt} 
            Format your response as a JSON array with exactly ${count} flashcards, each with 'front' and 'back' properties. 
            The 'front' should be a concise question or concept, and the 'back' should be a clear, concise answer or explanation.
            Make sure your response is valid JSON that can be parsed with JSON.parse().`
          },
          {
            role: 'user',
            content: `Create ${count} flashcards for studying and memorizing the key concepts in this text: ${text}`
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Get the response content
    const responseContent = response.data.choices[0].message.content.trim();
    
    // Try to parse the JSON from the response
    try {
      // First try to find a JSON array in the content
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      let flashcardsData;
      
      if (jsonMatch) {
        flashcardsData = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON array found, try parsing the entire content
        flashcardsData = JSON.parse(responseContent);
      }
      
      // Return the flashcards
      res.json({ flashcards: flashcardsData });
    } catch (parseError) {
      // If parsing fails, return the raw content
      res.json({ flashcards: responseContent });
    }
    
  } catch (error) {
    console.error('Error generating flashcards:', error.response?.data || error.message);
    res.status(500).json({ 
      error: error.response?.data?.error?.message || 'An error occurred generating flashcards' 
    });
  }
});

// Endpoint to extract text from image and explain it
app.post('/api/extract-and-explain', async (req, res) => {
  try {
    const { imageData } = req.body;
    
    console.log('=== EXTRACT-AND-EXPLAIN REQUEST RECEIVED ===');
    console.log('Request body contains imageData:', !!imageData);
    console.log('Image data length:', imageData ? imageData.length : 0);
    
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    
    // Extract the base64 image data (remove data URL prefix if present)
    const base64Image = imageData.startsWith('data:image/') 
      ? imageData.split(',')[1] 
      : imageData;
    
    console.log('Base64 image data length:', base64Image.length);
    
    // Use a single call to OpenAI's vision model to analyze and explain the image
    console.log('Sending image to GPT-4 for analysis and explanation...');
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4.1-mini', // Vision-capable model
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes images and explains them in simple terms while still being accurate and technical. First identify the key content, then provide a simple explanation in under 150 words. Your response should be in this format: "TEXT CONTENT: [extracted text from image]\n\nEXPLANATION: [simple explanation]". If there is no text in the image, just provide the explanation part.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract any text from this image and explain it in very simple terms.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Received API response');
    
    // Parse the content to extract both the text and explanation
    const responseContent = response.data.choices[0].message.content.trim();
    console.log('Raw response content:', responseContent);
    
    // Parse the response to separate extracted text and explanation
    let extractedText = '';
    let explanation = '';
    
    if (responseContent.includes('TEXT CONTENT:') && responseContent.includes('EXPLANATION:')) {
      // The response has both parts as requested
      const textStart = responseContent.indexOf('TEXT CONTENT:') + 'TEXT CONTENT:'.length;
      const explStart = responseContent.indexOf('EXPLANATION:');
      
      extractedText = responseContent.substring(textStart, explStart).trim();
      explanation = responseContent.substring(explStart + 'EXPLANATION:'.length).trim();
    } else {
      // Fallback if the response format is different
      explanation = responseContent;
      extractedText = 'Image analyzed directly';
    }
    
    console.log('Extracted text length:', extractedText.length);
    console.log('Extracted text sample:', extractedText.substring(0, 100) + (extractedText.length > 100 ? '...' : ''));
    console.log('Explanation length:', explanation.length);
    console.log('Explanation sample:', explanation.substring(0, 100) + (explanation.length > 100 ? '...' : ''));
    
    // Log full response
    console.log('=== SENDING RESPONSE TO CLIENT ===');
    console.log({
      extractedText: extractedText.substring(0, 100) + (extractedText.length > 100 ? '...' : ''),
      explanation: explanation.substring(0, 100) + (explanation.length > 100 ? '...' : '')
    });
    
    // Return both the extracted text and the explanation
    res.json({ 
      extractedText, 
      explanation 
    });
    
  } catch (error) {
    console.error('Error processing image:', error.response?.data || error.message);
    res.status(500).json({ 
      error: error.response?.data?.error?.message || 'An error occurred processing the image' 
    });
  }
});

// Endpoint to directly explain an image without separate text extraction
app.post('/api/explain-image', async (req, res) => {
  try {
    console.log('Received explain-image request');
    
    // Check if we have image data
    if (!req.body || !req.body.imageData) {
      console.error('Missing imageData in request body');
      return res.status(400).json({ error: 'No image data provided' });
    }
    
    const { imageData } = req.body;
    console.log('Image data received, approximate length:', imageData.length);
    
    // Extract the base64 image data (remove data URL prefix if present)
    let base64Image = imageData;
    if (imageData.startsWith('data:image/')) {
      console.log('Converting data URL to base64');
      base64Image = imageData.split(',')[1];
    }
    
    if (!base64Image || base64Image.length < 100) {
      console.error('Invalid image data format or too small');
      return res.status(400).json({ error: 'Invalid image data format' });
    }
    
    console.log('Processing image for explanation with base64 length:', base64Image.length);
    
    // Use a simpler approach with the vision model
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Explain this image in simple terms that a 5-year-old would understand.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 300
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Received API response');
      
      // Get the explanation directly
      const explanation = response.data.choices[0].message.content.trim();
      console.log('Generated explanation:', explanation.substring(0, 50) + '...');
      
      // Return the explanation
      return res.json({ 
        explanation,
        extractedText: 'Image analyzed'
      });
    } catch (apiError) {
      console.error('OpenAI API error:', apiError.response?.data || apiError.message);
      return res.status(500).json({ 
        error: apiError.response?.data?.error?.message || 'Error processing image with OpenAI API'
      });
    }
  } catch (error) {
    console.error('Error handling explain-image request:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred processing the image'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Debug endpoint to check API connectivity
app.get('/api/debug', async (req, res) => {
  try {
    console.log('Running debug checks...');
    
    // Version info
    const debugInfo = {
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      api: {
        hasApiKey: !!OPENAI_API_KEY,
        apiKeyLength: OPENAI_API_KEY ? OPENAI_API_KEY.length : 0
      }
    };
    
    // Test OpenAI connectivity with a simple request
    try {
      console.log('Testing OpenAI API connectivity...');
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: 'Say hello for a connectivity test'
            }
          ],
          max_tokens: 20
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const apiMessage = response.data.choices[0].message.content.trim();
      debugInfo.apiTest = {
        status: 'success',
        message: apiMessage,
        responseTime: `${response.headers['openai-processing-ms'] || 'unknown'} ms`
      };
    } catch (apiError) {
      debugInfo.apiTest = {
        status: 'failed',
        error: apiError.message,
        details: apiError.response?.data || 'No additional details'
      };
    }
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    debugInfo.memory = {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    };
    
    res.json(debugInfo);
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ 
      status: 'error',
      message: error.message
    });
  }
});

// Server setup
app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
}); 