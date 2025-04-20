// Simple proxy server for the ELI5 Buddy Chrome extension
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
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
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that explains complex topics in simple terms that a 5-year-old could understand. Keep your explanations concise and under 150 words. DO NOT include any other text or comments. Just the explanation.'
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Server setup
app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
}); 