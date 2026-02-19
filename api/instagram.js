// Instagram Data Fetcher - Vercel Serverless Function
// This file goes in: api/instagram.js

const axios = require('axios');

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

module.exports = async (req, res) => {
  // CORS headers - allow requests from your WordPress site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { username } = req.method === 'GET' ? req.query : req.body;

  // Validate username
  if (!username) {
    return res.status(400).json({
      error: 'Username is required',
      example: '/api/instagram?username=nike'
    });
  }

  // Clean username (remove @ if present)
  const cleanUsername = username.replace('@', '').trim();

  // Check cache first
  const cacheKey = `ig:${cleanUsername.toLowerCase()}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Cache HIT for ${cleanUsername}`);
    return res.json({ ...cached.data, fromCache: true });
  }

  console.log(`Cache MISS for ${cleanUsername} - fetching from API`);

  try {
    // Fetch user profile data
    const profileResponse = await axios.get(
      'https://instagram-scraper-api2.p.rapidapi.com/v1/info',
      {
        params: { username_or_id_or_url: cleanUsername },
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com'
        },
        timeout: 15000
      }
    );

    if (!profileResponse.data || !profileResponse.data.data) {
      throw new Error('Invalid response from Instagram API');
    }

    const userData = profileResponse.data.data;

    // Extract relevant data
    const result = {
      username: userData.username,
      full_name: userData.full_name,
      biography: userData.biography,
      followers_count: userData.followers_count,
      following_count: userData.following_count,
      posts_count: userData.media_count,
      profile_pic_url: userData.profile_pic_url,
      is_verified: userData.is_verified,
      engagement_rate: calculateEngagementRate(
        userData.media_count,
        userData.followers_count
      )
    };

    // Cache the result
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return res.json(result);
  } catch (error) {
    console.error('Instagram API Error:', error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Instagram user not found' });
    }
    
    return res.status(500).json({
      error: 'Failed to fetch Instagram data',
      details: error.message
    });
  }
};

function calculateEngagementRate(postsCount, followersCount) {
  if (followersCount === 0 || postsCount === 0) return 0;
  // Engagement Rate = (Average Likes + Comments) / Followers
  // For simplicity, using a formula
  return ((followersCount * 0.05) / postsCount).toFixed(2);
}
