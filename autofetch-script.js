/* ============================================================
   INSTAGRAM ENGAGEMENT RATE CALCULATOR - AUTO-FETCH VERSION
   autofetch-script.js — BuyRealFollows.com
   ============================================================ */

'use strict';

// ⚠️ IMPORTANT: Replace this with your deployed Vercel URL
const API_ENDPOINT = 'https://YOUR-PROJECT-NAME.vercel.app/api/instagram';
// Example: 'https://instagram-api-abc123.vercel.app/api/instagram'

/* ─── BENCHMARK TIERS ────────────────────────────────────────── */
const TIERS = [
  { name: 'Nano',     min: 1000,    max: 10000,   avgER: 4.5, low: 2,   good: 5,   great: 7  },
  { name: 'Micro',    min: 10001,   max: 100000,  avgER: 3,   low: 1.5, good: 4,   great: 6  },
  { name: 'Mid-Tier', min: 100001,  max: 500000,  avgER: 2.5, low: 1,   good: 3.5, great: 5  },
  { name: 'Macro',    min: 500001,  max: 1000000, avgER: 1.5, low: 0.5, good: 2.5, great: 3.5},
  { name: 'Mega',     min: 1000001, max: Infinity, avgER: 1,   low: 0.3, good: 2,   great: 3  }
];

/* ─── MAIN ANALYSIS FUNCTION ─────────────────────────────────── */
async function analyzeByUsername() {
  const usernameInput = document.getElementById('username');
  const username = usernameInput.value.trim().replace('@', '');
  
  // Validate username
  if (!username) {
    showError('Please enter an Instagram username');
    usernameInput.focus();
    return;
  }

  // Basic username validation
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) {
    showError('Invalid username format. Use only letters, numbers, dots and underscores.');
    return;
  }

  clearError();
  showLoading('Fetching account data...');
  hideResults();

  try {
    // Call backend API
    const response = await fetch(`${API_ENDPOINT}?username=${encodeURIComponent(username)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Validate we got data
    if (!data.username || data.followers === undefined) {
      throw new Error('Invalid data received from API');
    }

    // Calculate engagement rate
    const engagementRate = data.followers > 0 
      ? ((data.avgLikes + data.avgComments) / data.followers) * 100 
      : 0;

    const tier = getTier(data.followers);
    const classification = classifyER(engagementRate, tier);
    const qualityScore = calculateQualityScore(engagementRate, tier);

    // Display results
    displayResults({
      username: data.username,
      fullName: data.fullName,
      followers: data.followers,
      following: data.following,
      posts: data.posts,
      avgLikes: data.avgLikes,
      avgComments: data.avgComments,
      postsAnalyzed: data.postsAnalyzed,
      engagementRate,
      tier,
      classification,
      qualityScore,
      isVerified: data.isVerified,
      fromCache: data.fromCache
    });

    hideLoading();

  } catch (error) {
    hideLoading();
    console.error('Analysis error:', error);
    
    // User-friendly error messages
    let errorMessage = error.message;
    
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      errorMessage = `Account "@${username}" not found. Check the username and try again.`;
    } else if (errorMessage.includes('private')) {
      errorMessage = 'This account is private. Only public accounts can be analyzed.';
    } else if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
      errorMessage = 'Too many requests. Please try again in a few minutes.';
    } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      errorMessage = 'Cannot connect to server. Please check your internet connection.';
    } else if (!errorMessage || errorMessage === 'Unknown error') {
      errorMessage = 'Unable to analyze this account. Please try again later.';
    }
    
    showError(errorMessage);
  }
}

/* ─── HELPER FUNCTIONS ───────────────────────────────────────── */

function getTier(followers) {
  return TIERS.find(t => followers >= t.min && followers <= t.max) || TIERS[TIERS.length - 1];
}

function classifyER(er, tier) {
  if (er >= tier.great) {
    return { grade: 'A', label: 'Excellent', color: '#10b981', bg: '#d1fae5', border: '#34d399' };
  } else if (er >= tier.good) {
    return { grade: 'B', label: 'Good', color: '#3b82f6', bg: '#dbeafe', border: '#60a5fa' };
  } else if (er >= tier.avgER) {
    return { grade: 'C', label: 'Average', color: '#f59e0b', bg: '#fef3c7', border: '#fbbf24' };
  } else if (er >= tier.low) {
    return { grade: 'C', label: 'Below Average', color: '#f59e0b', bg: '#fef3c7', border: '#fbbf24' };
  } else {
    return { grade: 'D', label: 'Low', color: '#ef4444', bg: '#fee2e2', border: '#f87171' };
  }
}

function calculateQualityScore(er, tier) {
  return Math.min(100, Math.round((er / tier.great) * 100));
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}

/* ─── DISPLAY RESULTS ────────────────────────────────────────── */

function displayResults(data) {
  const resultsEl = document.getElementById('results');

  // Reset animations
  resultsEl.querySelectorAll('.result-animate').forEach(el => {
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = '';
  });

  // Account info
  document.getElementById('account-name').textContent = data.fullName || data.username;
  document.getElementById('account-username').textContent = '@' + data.username;
  document.getElementById('account-followers').textContent = formatNumber(data.followers);
  document.getElementById('account-posts').textContent = formatNumber(data.posts);

  // Primary ER score
  document.getElementById('er-number').textContent = data.engagementRate.toFixed(2) + '%';
  
  const ratingEl = document.getElementById('er-rating');
  ratingEl.textContent = data.classification.label;
  ratingEl.style.background = data.classification.bg;
  ratingEl.style.border = '1px solid ' + data.classification.border;
  ratingEl.style.color = data.classification.color;

  const gradeEl = document.getElementById('er-grade');
  gradeEl.textContent = data.classification.grade;
  gradeEl.style.background = data.classification.bg;
  gradeEl.style.borderColor = data.classification.color;
  gradeEl.style.color = data.classification.color;

  // Benchmark
  document.getElementById('bench-tier').textContent = data.tier.name;
  document.getElementById('bar-mid').textContent = data.tier.avgER.toFixed(1) + '%';
  document.getElementById('bar-max').textContent = data.tier.great + '%+';

  // Needle position
  const needleMax = data.tier.great * 1.4;
  const needlePct = Math.min(96, Math.max(4, (data.engagementRate / needleMax) * 100));
  requestAnimationFrame(() => {
    document.getElementById('bar-needle').style.left = needlePct + '%';
  });

  // Metrics
  document.getElementById('m-likes').textContent = formatNumber(data.avgLikes);
  document.getElementById('m-comments').textContent = formatNumber(data.avgComments);
  
  const ratio = data.avgComments > 0 ? (data.avgLikes / data.avgComments).toFixed(1) : 'N/A';
  document.getElementById('m-ratio').textContent = ratio + (ratio !== 'N/A' ? ':1' : '');
  
  document.getElementById('m-quality').textContent = data.qualityScore + '/100';
  document.getElementById('m-posts-analyzed').textContent = data.postsAnalyzed || '—';
  document.getElementById('m-tier').textContent = data.tier.name;

  // Recommendation text
  const recTexts = {
    excellent: `This account has outstanding engagement (${data.engagementRate.toFixed(1)}%)! The audience is highly active and genuinely interested in the content. This level of engagement is in the top tier for ${data.tier.name} accounts and indicates strong community building.`,
    good: `This account shows good engagement (${data.engagementRate.toFixed(1)}%), performing above average for ${data.tier.name} accounts. The audience is actively engaged, though there's room to push into the excellent range with consistent quality content.`,
    average: `This account has average engagement (${data.engagementRate.toFixed(1)}%) for the ${data.tier.name} tier. While performance is on par with most accounts of this size, focusing on content quality and posting consistency could significantly improve results.`,
    low: `This account's engagement (${data.engagementRate.toFixed(1)}%) is below average for ${data.tier.name} accounts. This may indicate inactive followers, content-audience mismatch, or poor posting timing. Consider auditing your audience and refreshing your content strategy.`
  };

  document.getElementById('rec-text').textContent = recTexts[data.classification.grade === 'A' ? 'excellent' : 
    data.classification.grade === 'B' ? 'good' : 
    data.classification.grade === 'C' ? 'average' : 'low'];

  // CTA variants
  const ctas = {
    excellent: {
      head: '✨ Maintain Your Excellence',
      sub: 'Your engagement is outstanding. Keep growing with quality.',
      href: 'https://www.buyrealfollows.com/'
    },
    good: {
      head: '📈 Push to Excellent',
      sub: 'You\'re close! Strategic growth can take you to the top tier.',
      href: 'https://www.buyrealfollows.com/buy-instagram-followers/'
    },
    average: {
      head: '⚡ Improve Your Engagement',
      sub: 'Real, active followers make every post perform better.',
      href: 'https://www.buyrealfollows.com/buy-instagram-followers/'
    },
    low: {
      head: '🚀 Rebuild with Real Followers',
      sub: 'Replace disengaged followers with authentic engagement.',
      href: 'https://www.buyrealfollows.com/buy-instagram-followers/'
    }
  };

  const ctaKey = data.classification.grade === 'A' ? 'excellent' : 
    data.classification.grade === 'B' ? 'good' : 
    data.classification.grade === 'C' ? 'average' : 'low';

  document.getElementById('cta-head').textContent = ctas[ctaKey].head;
  document.getElementById('cta-sub').textContent = ctas[ctaKey].sub;
  document.getElementById('cta-link').href = ctas[ctaKey].href;

  // Show cache notice if applicable
  if (data.fromCache) {
    showCacheNotice();
  }

  // Display results
  resultsEl.style.display = 'block';
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ─── UI STATE FUNCTIONS ─────────────────────────────────────── */

function showLoading(message = 'Loading...') {
  document.getElementById('loading-msg').style.display = 'flex';
  document.getElementById('loading-text').textContent = message;
  document.getElementById('analyze-btn').disabled = true;
}

function hideLoading() {
  document.getElementById('loading-msg').style.display = 'none';
  document.getElementById('analyze-btn').disabled = false;
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearError() {
  document.getElementById('error-msg').style.display = 'none';
}

function hideResults() {
  document.getElementById('results').style.display = 'none';
}

function showCacheNotice() {
  const notice = document.createElement('div');
  notice.className = 'cache-notice';
  notice.innerHTML = '📊 <strong>Cached data:</strong> Updated within last 24 hours';
  
  const results = document.getElementById('results');
  const firstChild = results.querySelector('.result-animate');
  results.insertBefore(notice, firstChild);
}

/* ─── EVENT LISTENERS ────────────────────────────────────────── */

// Enter key support
document.getElementById('username').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    analyzeByUsername();
  }
});

// Clean username input (remove @ if pasted)
document.getElementById('username').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace('@', '');
});

// Clear error when user starts typing
document.getElementById('username').addEventListener('input', () => {
  clearError();
});
