/**
 * Embedding utilities for the recommendation system.
 * Uses Gemini embedding-001 (3072-dim) for both article and user taste vectors.
 */

const GEMINI_EMBEDDING_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

/**
 * Get embedding vector for a text string via Gemini REST API.
 * @param {string} text - Text to embed
 * @param {string} taskType - One of: RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY, CLUSTERING, SEMANTIC_SIMILARITY
 * @returns {Promise<number[]|null>} 3072-dim embedding array, or null on failure
 */
export async function getEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[embeddings] GEMINI_API_KEY not configured');
    return null;
  }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.error('[embeddings] Empty text provided');
    return null;
  }

  // Truncate to ~8000 chars to stay within token limits
  const truncated = text.slice(0, 8000);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${GEMINI_EMBEDDING_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: truncated }] },
          taskType,
        }),
      });

      if (response.status === 429 && attempt < 2) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[embeddings] API error ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json();
      return data?.embedding?.values || null;
    } catch (err) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      console.error('[embeddings] Fetch error:', err.message);
      return null;
    }
  }

  return null;
}

/**
 * Build a natural-language preference text from onboarding selections.
 * This text gets embedded to create the initial taste vector.
 */
export function buildPreferenceText(homeCountry, followedCountries, followedTopics) {
  const parts = [];

  if (homeCountry) {
    parts.push(`Based in ${homeCountry}, primarily interested in ${homeCountry} news.`);
  }

  if (followedCountries && followedCountries.length > 0) {
    parts.push(`Also follows news about ${followedCountries.join(', ')}.`);
  }

  if (followedTopics && followedTopics.length > 0) {
    // Convert codes to readable names
    const topicNames = followedTopics.map(code => {
      const readable = code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return readable;
    });
    parts.push(`Interested in: ${topicNames.join(', ')}.`);
  }

  return parts.join(' ');
}

/**
 * Cosine similarity between two vectors.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Similarity score between -1 and 1
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dot / denominator;
}

/**
 * Normalize a vector to unit length (in-place modification of a copy).
 * @param {number[]} vec
 * @returns {number[]} Unit-length vector
 */
export function normalizeVector(vec) {
  if (!vec || vec.length === 0) return vec;

  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);

  if (norm === 0) return vec;

  return vec.map(v => v / norm);
}

/**
 * Evolve a taste vector toward an article vector using exponential moving average.
 * @param {number[]} currentVector - Current user taste vector
 * @param {number[]} articleVector - Article embedding to move toward
 * @param {number} learningRate - How much to shift (default 0.1)
 * @returns {number[]} New normalized taste vector
 */
export function evolveTasteVector(currentVector, articleVector, learningRate = 0.1) {
  if (!currentVector || !articleVector || currentVector.length !== articleVector.length) {
    return currentVector;
  }

  const newVector = new Array(currentVector.length);
  for (let i = 0; i < currentVector.length; i++) {
    newVector[i] = (1 - learningRate) * currentVector[i] + learningRate * articleVector[i];
  }

  return normalizeVector(newVector);
}
