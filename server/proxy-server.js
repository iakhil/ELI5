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
            content: 'You are a helpful assistant that explains complex topics in simple terms that a 5-year-old could understand. Keep your explanations concise and under 150 words.'
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

// Server setup
app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
}); 