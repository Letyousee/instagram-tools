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

    // Check if account is private
    if (userData.is_private) {
      return res.status(403).json({ 
        error: 'This account is private',
        message: 'Only public Instagram accounts can be analyzed'
      });
    }

    // Fetch recent posts for engagement calculation
    let avgLikes = 0;
    let avgComments = 0;
    let postsAnalyzed = 0;

    try {
      const postsResponse = await axios.get(
        'https://instagram-scraper-api2.p.rapidapi.com/v1/posts',
        {
          params: { 
            username_or_id_or_url: cleanUsername,
            count: 12 
          },
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'instagram-scraper-api2.p.rapidapi.com'
          },
          timeout: 15000
        }
      );

      const posts = postsResponse.data?.data?.items || [];
      
      if (posts.length > 0) {
        let totalLikes = 0;
        let totalComments = 0;
        
        posts.forEach(post => {
          totalLikes += post.like_count || 0;
          totalComments += post.comment_count || 0;
        });

        avgLikes = Math.round(totalLikes / posts.length);
        avgComments = Math.round(totalComments / posts.length);
        postsAnalyzed = posts.length;
      }
    } catch (postsError) {
      console.warn('Could not fetch posts, using profile data only:', postsError.message);
      // Continue with profile data only
    }

    // Prepare response data
    const data = {
      username: userData.username,
      fullName: userData.full_name || userData.username,
      followers: userData.follower_count || 0,
      following: userData.following_count || 0,
      posts: userData.media_count || 0,
      avgLikes,
      avgComments,
      postsAnalyzed,
      isVerified: userData.is_verified || false,
      isPrivate: userData.is_private || false,
      bio: userData.biography || '',
      profilePic: userData.profile_pic_url || '',
      externalUrl: userData.external_url || null
    };

    // Cache the result
    cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    // Basic cache cleanup - keep only 1000 most recent
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    console.log(`Successfully fetched data for ${cleanUsername}`);
    res.json(data);

  } catch (error) {
    console.error('API Error:', error.message);
    
    // Handle specific error cases
    if (error.response) {
      const status = error.response.status;
      
      if (status === 404) {
        return res.status(404).json({ 
          error: 'Account not found',
          message: `Instagram user "${cleanUsername}" does not exist`
        });
      }
      
      if (status === 429) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again in a few minutes.'
        });
      }

      if (status === 401 || status === 403) {
        return res.status(500).json({ 
          error: 'API authentication failed',
          message: 'Please check your RapidAPI key configuration'
        });
      }
    }

    // Network or timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({ 
        error: 'Request timeout',
        message: 'Instagram API is taking too long to respond. Please try again.'
      });
    }

    // Generic error
    res.status(500).json({ 
      error: 'Failed to fetch Instagram data',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
