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

  const { topic, accentColor: providedColor } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  // Pick accent color: use provided or random from preset palette
  const ACCENT_PALETTE = ['#BFFF00', '#FF6B35', '#7B68EE', '#FF4757', '#00D2FF'];
  const accentColor = providedColor || ACCENT_PALETTE[Math.floor(Math.random() * ACCENT_PALETTE.length)];

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not configured');
    return res.status(500).json({ 
      success: false,
      error: 'GEMINI_API_KEY not configured'
    });
  }

  // Prompt for Gemini image generation
  const prompt = `Create a conceptual editorial illustration about ${topic}.

STYLE (CRITICAL — follow exactly):
– Loose, energetic, hand-drawn black ink illustration with raw expressive energy
– Lines should feel fast, confident, and alive — like an illustrator sketching rapidly with a thick brush pen or marker
– Varying line weight: bold sweeping strokes mixed with quick scratchy marks and flicks
– Lines should have natural wobble, drips, and imperfections — NOT clean, NOT digital, NOT vector-like
– Visible drawing energy: speed lines, motion marks, splatter dots, quick hatching for emphasis
– The overall feel should be like a brilliant illustrator's spontaneous editorial sketch — raw and alive
– Playful, witty, punchy, slightly provocative tone — NOT corporate, NOT polished, NOT stiff
– Think: Ralph Steadman meets Christoph Niemann meets modern political cartoon sketchbook
– Exactly ONE accent color: ${accentColor} (e.g. #BFFF00, #FF6B35, #7B68EE, #FF4757, #00D2FF)
– The accent color is splashed on boldly — slightly messy edges, bleeding outside the lines, raw and loose
– NO other colors besides black ink, the single accent color, and the background

FIGURES — FACE STYLE (ABSOLUTE RULE — NO EXCEPTIONS):
– Faces MUST be extremely simple: oval head, two tiny dot/dash eyes, small line mouth
– Think: emoticon-level simplicity — :( drawn on an egg shape
– NEVER draw realistic noses, ears, jawlines, eyebrows, or hair
– NEVER distinguish gender through facial features or hairstyles
– ALL figures must have the same abstract face style — no exceptions
– If a figure needs to be distinguished (e.g. two opposing sides), use clothing/props NOT facial features
– Reference: the absolute simplest face that still conveys basic emotion

FIGURES — BODY STYLE:
– Exaggerated, dynamic, full-of-life human characters
– Elongated/oval heads with personality — NOT perfect circles, NOT realistic
– EXTREME body language — leaning hard, pulling, pushing, falling, reaching, struggling
– Poses should feel like frozen mid-action — maximum kinetic energy
– Bodies drawn with fast continuous flowing black strokes — gestural and loose
– Limbs can be exaggerated in length for dramatic effect
– Some areas use solid black fills (suits, shoes) for punchy contrast
– Figures should feel ALIVE — like they could leap off the page
– Maximum 2-4 figures per illustration

ENERGY AND MOVEMENT (CRITICAL):
– Every illustration must feel like it has MOTION and TENSION
– Add speed lines, action marks, small impact bursts, or motion trails
– Objects can be tilting, cracking, exploding, colliding, or breaking apart
– The scene should feel like a frozen moment of dramatic action
– Small detail marks: tiny lines radiating from impact points, small dots for dust/debris, quick zigzag lines for electricity/tension

BACKGROUND (CRITICAL):
– The background must be a visible, colored tint inspired by the accent color
– It should be OBVIOUSLY colored — the viewer should immediately notice it is NOT grey
– Examples based on accent color:
  - If accent is #BFFF00 (lime): background = soft yellow-green (#D8D8B0)
  - If accent is #FF6B35 (orange): background = soft warm peach (#E8CDB8)
  - If accent is #7B68EE (purple): background = soft lavender (#D0C4E8)
  - If accent is #FF4757 (red): background = soft warm salmon (#E8C8B8)
  - If accent is #00D2FF (blue): background = soft sky blue (#B8D4E8)
  - If accent is #FFD700 (gold): background = soft warm cream (#E8DDB8)
  - If accent is #FF1493 (pink): background = soft rose (#E8C0D0)
  - If accent is #32CD32 (green): background = soft mint (#B8E0C0)
  - If accent is #FF8C00 (dark orange): background = soft apricot (#E8D0B0)
  - If accent is #6A5ACD (slate blue): background = soft periwinkle (#C8C0E0)
  - If accent is #DC143C (crimson): background = soft blush (#E0C0B8)
  - If accent is #20B2AA (teal): background = soft seafoam (#B8D8D4)
  - If accent is #FF69B4 (hot pink): background = soft pink (#E8C8D8)
  - If accent is #4169E1 (royal blue): background = soft powder blue (#B8C8E0)
  - If accent is #8B4513 (brown): background = soft tan (#DDD0C0)
– The tint should be clearly obvious — approximately 50-60% grey, 40-50% color
– For any accent color not listed: derive a light, desaturated, pastel version at ~40% saturation and ~85% lightness
– NO gradients, NO textures, NO patterns, NO noise
– The entire background must be uniform

COLOR RULES (CRITICAL):
– Only 3 elements: black ink lines/fills, ONE accent color, tinted background
– The accent color MUST appear — used boldly on 1-3 key elements for visual punch
– Accent color fills should feel loose and energetic, not perfectly precise
– Solid black fills allowed for clothing and contrast
– NO shadows, NO gradients — flat color only
– NO additional colors — strict 3-element palette
– If the topic involves multiple sides, use shapes/symbols NOT multiple colors

CREATIVITY AND CONCEPT (CRITICAL):
– The concept must be ORIGINAL and UNEXPECTED — avoid obvious literal depictions
– Use surprising visual metaphors: e.g. a melting chess king for political downfall, a puppet with cut strings for independence, a cracked hourglass for a deadline crisis
– Combine two unrelated objects to create a new meaning — this is the heart of great editorial illustration
– Avoid cliché metaphors: no generic handshakes, no simple tug-of-war unless reimagined in a fresh way
– The illustration should make someone stop scrolling — it needs to be visually surprising and intellectually clever
– Think like a top editorial illustrator pitching a cover concept — what image would make an editor say "that's brilliant"
– Each illustration should feel like it could only belong to THIS specific story — not a generic template

COMPOSITION (CRITICAL):
– All illustration elements in the TOP TWO-THIRDS of the image
– BOTTOM ONE-THIRD completely empty — only the tinted background color
– No objects, figures, ground lines, or any elements in the bottom third
– Centered composition within the top two-thirds
– Balanced left-right weight
– Allow slight asymmetry for dynamic tension

OUTPUT:
– Square format (1:1 aspect ratio)
– High resolution
– Text and symbols (e.g. $, €, compass directions) are allowed when they serve the concept
– No captions, no watermarks, no logos`;

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
              aspectRatio: '1:1'
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
