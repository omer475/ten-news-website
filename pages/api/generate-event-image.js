// API endpoint to generate event images using Gemini 2.5 Flash Image
// Uses Gemini's native image generation (Nano Banana) model
// Returns a generated image as base64 and blur color for the given topic

// Extract dominant color from base64 image data
function extractBlurColorFromBase64(base64Data) {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Sample bytes from different parts of the image
    const sampleSize = Math.min(buffer.length, 10000);
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    
    // Skip PNG header and sample RGB-like patterns
    for (let i = 100; i < sampleSize - 3; i += 4) {
      const r = buffer[i];
      const g = buffer[i + 1];
      const b = buffer[i + 2];
      
      // Only count pixels that look like actual colors (not metadata)
      if (r > 20 && r < 240 && g > 20 && g < 240 && b > 20 && b < 240) {
        rSum += r;
        gSum += g;
        bSum += b;
        count++;
      }
    }
    
    if (count > 0) {
      const avgR = Math.round(rSum / count);
      const avgG = Math.round(gSum / count);
      const avgB = Math.round(bSum / count);
      
      // Make it darker for blur effect
      const darkR = Math.round(avgR * 0.5);
      const darkG = Math.round(avgG * 0.5);
      const darkB = Math.round(avgB * 0.5);
      
      const toHex = (n) => n.toString(16).padStart(2, '0');
      return `#${toHex(darkR)}${toHex(darkG)}${toHex(darkB)}`;
    }
  } catch (e) {
    console.log('Color extraction failed:', e);
  }
  
  // Default fallback color
  return '#1a365d';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not configured');
    return res.status(500).json({ 
      success: false,
      error: 'GEMINI_API_KEY not configured'
    });
  }

  // Prompt for Gemini image generation
  const prompt = `Create a newspaper-cover-style editorial illustration about ${topic}.

The image should feel like a lead illustration or cover visual from TIME magazine, The Independent, The New York Times, or The Economist: intelligent, concept-driven, visually clever, and engaging rather than literal.

STYLE:
– detailed, expressive editorial illustration
– recognisable public figures allowed if relevant
– slightly exaggerated features allowed for wit and character
– not photorealistic, not cartoonish
– sophisticated, modern newspaper illustration aesthetic

BACKGROUND (CRITICAL):
– background must be pure white (#ffffff)
– no colour tint, no grey, no off-white
– no gradients, no texture, no patterns
– no shadows or lighting effects on the background

LAYOUT:
– illustration positioned entirely in the top two-thirds of the image
– bottom one-third must remain completely empty
– bottom one-third contains only pure white background
– no objects, details, fade, or visual elements in the bottom section

COMPOSITION:
– strong, balanced composition in the upper area
– clear separation between illustration and background
– cover-ready framing suitable for a newspaper or magazine front page

OUTPUT:
– high resolution
– newspaper-cover quality finish
– no text, no headlines, no captions`;

  try {
    // Call Gemini 2.5 Flash Image model using generateContent
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: '21:9'
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return res.status(500).json({ 
        success: false,
        error: `Gemini API error: ${response.status}`
      });
    }

    const data = await response.json();
    
    // Extract image from response
    const parts = data.candidates?.[0]?.content?.parts || [];
    
    for (const part of parts) {
      if (part.inlineData) {
        const base64Data = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || 'image/png';
        
        // Extract blur color from the generated image
        const blurColor = extractBlurColorFromBase64(base64Data);
        
        // Return base64 image as data URL
        const imageUrl = `data:${mimeType};base64,${base64Data}`;
        
        return res.status(200).json({ 
          success: true,
          imageUrl,
          blurColor,
          topic,
          source: 'gemini-ai'
        });
      }
    }
    
    // No image in response
    console.log('No image in Gemini response');
    return res.status(500).json({ 
      success: false,
      error: 'No image generated by Gemini'
    });
    
  } catch (error) {
    console.error('Image generation error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Image generation failed'
    });
  }
}
