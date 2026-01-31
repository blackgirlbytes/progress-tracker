import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import goals configuration
import {
  QUARTERLY_GOALS,
  MONTHLY_GOALS,
  TAG_CATEGORY_MAP,
  TAG_NAME_MAP,
  QUARTER_CONFIG,
  END_OF_MONTH_DELIVERABLES,
  getCurrentQuarter,
  getAvailableQuarters,
} from './goals.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Asana configuration
const ASANA_TOKEN = process.env.ASANA_TOKEN;
const PROJECT_ID = '1204316590307635';
const WORKSPACE_ID = '8714041385240';
const BASE_URL = 'https://app.asana.com/api/1.0';

// ============================================
// EXCLUDED CONTRIBUTORS
// ============================================
// Tasks from these people will not be counted toward goals
const EXCLUDED_ASSIGNEES = [
  'Anthony Giuliano',
  'Eva Sasson',
  'Adewale Abati',
];

// ============================================
// CACHING SYSTEM
// ============================================
// - Past quarters: cached permanently (data won't change)
// - Current quarter: cached for 5 minutes
// - Current month: cached for 2 minutes
// ============================================

const cache = {
  quarters: new Map(),  // quarterId -> { data, timestamp, isPast }
  
  // Cache durations in milliseconds
  PAST_QUARTER_TTL: Infinity,        // Never expires (past data is static)
  CURRENT_QUARTER_TTL: 5 * 60 * 1000, // 5 minutes
  CURRENT_MONTH_TTL: 2 * 60 * 1000,   // 2 minutes (for more real-time feel)
};

function isQuarterPast(quarterId) {
  const config = QUARTER_CONFIG[quarterId];
  if (!config) return false;
  
  const endDate = new Date(config.endDate);
  const now = new Date();
  return endDate < now;
}

function isMonthPast(year, monthName) {
  const monthMap = {
    'January': 0, 'February': 1, 'March': 2,
    'April': 3, 'May': 4, 'June': 5,
    'July': 6, 'August': 7, 'September': 8,
    'October': 9, 'November': 10, 'December': 11,
  };
  
  const now = new Date();
  const monthEnd = new Date(year, monthMap[monthName] + 1, 0); // Last day of month
  return monthEnd < now;
}

function getCacheKey(quarterId) {
  return quarterId;
}

function isCacheValid(cacheEntry, quarterId) {
  if (!cacheEntry) return false;
  
  const isPast = isQuarterPast(quarterId);
  
  // Past quarters never expire
  if (isPast && cacheEntry.isPast) {
    return true;
  }
  
  // Current quarter: check TTL
  const age = Date.now() - cacheEntry.timestamp;
  return age < cache.CURRENT_QUARTER_TTL;
}

function setCache(quarterId, data) {
  const isPast = isQuarterPast(quarterId);
  cache.quarters.set(getCacheKey(quarterId), {
    data,
    timestamp: Date.now(),
    isPast,
  });
  
  console.log(`📦 Cached ${quarterId} (${isPast ? 'permanent' : 'TTL: 5min'})`);
}

function getCache(quarterId) {
  const key = getCacheKey(quarterId);
  const entry = cache.quarters.get(key);
  
  if (isCacheValid(entry, quarterId)) {
    console.log(`✅ Cache hit for ${quarterId}`);
    return entry.data;
  }
  
  if (entry) {
    console.log(`⏰ Cache expired for ${quarterId}`);
    cache.quarters.delete(key);
  }
  
  return null;
}

// ============================================
// RATE LIMITING PROTECTION
// ============================================

let requestCount = 0;
let requestWindowStart = Date.now();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 50;  // Asana allows ~150/min, we stay conservative

async function rateLimitedFetch(endpoint, options = {}) {
  // Reset window if needed
  if (Date.now() - requestWindowStart > RATE_LIMIT_WINDOW) {
    requestCount = 0;
    requestWindowStart = Date.now();
  }
  
  // Check rate limit
  if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
    const waitTime = RATE_LIMIT_WINDOW - (Date.now() - requestWindowStart);
    console.warn(`⚠️ Rate limit approaching, waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    requestCount = 0;
    requestWindowStart = Date.now();
  }
  
  requestCount++;
  
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ASANA_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  // Check for rate limit response
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 60;
    console.warn(`🚫 Rate limited! Waiting ${retryAfter}s`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return rateLimitedFetch(endpoint, options); // Retry
  }
  
  return response.json();
}

// ============================================
// ASANA API FUNCTIONS
// ============================================

async function searchCompletedTasks(startDate, endDate) {
  // Asana's search API has a 100-task limit without pagination
  // To work around this, we query in weekly chunks to ensure we get all tasks
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  
  let allTasks = [];
  
  // If date range is more than 7 days, split into weekly chunks
  if (daysDiff > 7) {
    console.log(`📅 Date range is ${daysDiff} days, splitting into weekly chunks...`);
    
    let currentStart = new Date(start);
    while (currentStart < end) {
      let currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + 7);
      if (currentEnd > end) currentEnd = new Date(end);
      
      const chunkStartStr = currentStart.toISOString().split('T')[0];
      const chunkEndStr = currentEnd.toISOString().split('T')[0];
      
      const url = `/workspaces/${WORKSPACE_ID}/tasks/search?projects.any=${PROJECT_ID}&completed=true&completed_on.after=${chunkStartStr}&completed_on.before=${chunkEndStr}&opt_fields=name,completed_at,tags,tags.name,tags.gid,assignee,assignee.name,followers,followers.name&limit=100`;
      const response = await rateLimitedFetch(url);
      const tasks = response.data || [];
      
      console.log(`  📦 ${chunkStartStr} to ${chunkEndStr}: ${tasks.length} tasks`);
      allTasks = allTasks.concat(tasks);
      
      currentStart = new Date(currentEnd);
    }
  } else {
    // Single query for short date ranges
    const url = `/workspaces/${WORKSPACE_ID}/tasks/search?projects.any=${PROJECT_ID}&completed=true&completed_on.after=${startDate}&completed_on.before=${endDate}&opt_fields=name,completed_at,tags,tags.name,tags.gid,assignee,assignee.name,followers,followers.name&limit=100`;
    const response = await rateLimitedFetch(url);
    allTasks = response.data || [];
  }
  
  // Remove duplicates (in case a task appears in multiple chunks due to boundary conditions)
  const uniqueTasks = [];
  const seenGids = new Set();
  for (const task of allTasks) {
    if (!seenGids.has(task.gid)) {
      seenGids.add(task.gid);
      uniqueTasks.push(task);
    }
  }
  
  // Filter out tasks from excluded assignees
  const filteredTasks = uniqueTasks.filter(task => {
    const assigneeName = task.assignee?.name;
    if (!assigneeName) return true; // Include unassigned tasks
    return !EXCLUDED_ASSIGNEES.includes(assigneeName);
  });
  
  const excludedCount = uniqueTasks.length - filteredTasks.length;
  if (excludedCount > 0) {
    console.log(`🚫 Filtered out ${excludedCount} tasks from excluded assignees`);
  }
  
  console.log(`✅ Found ${filteredTasks.length} tasks for ${startDate} to ${endDate}`);
  
  return filteredTasks;
}

// Search for open (incomplete) tasks with specific tags
async function searchOpenTasksByTag(tagGids) {
  const tagFilter = tagGids.join(',');
  const url = `/workspaces/${WORKSPACE_ID}/tasks/search?projects.any=${PROJECT_ID}&completed=false&tags.any=${tagFilter}&opt_fields=name,created_at,due_on,tags,tags.name,tags.gid,assignee,assignee.name,followers,followers.name&limit=100`;
  const response = await rateLimitedFetch(url);
  const tasks = response.data || [];
  
  // Filter out tasks from excluded assignees
  const filteredTasks = tasks.filter(task => {
    const assigneeName = task.assignee?.name;
    if (!assigneeName) return true; // Include unassigned tasks
    return !EXCLUDED_ASSIGNEES.includes(assigneeName);
  });
  
  return filteredTasks;
}

// Get open documentation tasks
async function getOpenDocumentationTasks() {
  // Documentation tag GIDs - includes all tags that indicate documentation work
  const docTagGids = [
    '1204316592156189', // documentation
    '1204463482160284', // guide
    '1207924330531310', // internal devrel
  ];
  
  const tasks = await searchOpenTasksByTag(docTagGids);
  
  // Filter to only include tasks that would categorize as Documentation
  const docTasks = tasks.filter(task => {
    const mapping = categorizeTask(task);
    return mapping && mapping.category === 'Documentation';
  });
  
  return docTasks.map(task => {
    const assigneeName = task.assignee?.name;
    const collaborators = (task.followers || [])
      .map(f => f.name)
      .filter(name => 
        name && 
        name !== assigneeName && 
        !EXCLUDED_ASSIGNEES.includes(name)
      );
    
    return {
      gid: task.gid,
      name: task.name,
      created_at: task.created_at,
      due_on: task.due_on,
      assignee: assigneeName || 'Unassigned',
      collaborators: collaborators,
      tags: task.tags?.map(t => t.name) || [],
    };
  });
}

// ============================================
// CATEGORIZATION LOGIC
// ============================================
// Based on goal definitions:
// - Side Project: Public repo using agentic practices (NOT private, NOT demo-only)
// - goose Contribution: Merged PR to goose repo (issue fix, feature, bug fix, docs-as-code)
// - Agentic Pattern: MCP, Skills, Elicitation, Recipes, Subagents, Code Mode, ACP, etc.
// - Tutorial Video: 6-15 min instructional video teaching a practice
// - Short: Under 60 seconds, quick tip or plug-and-play
// - Vibe Code stream: Livestream building side project with goose
// - Blog Post: Written content on agentic practices OR community pain points
// - Metrics Report: Community metrics/analytics report (NOT expense reports, status reports)
// ============================================

// Exclusion patterns - things that should NOT match certain categories
const EXCLUSION_PATTERNS = {
  'Blog posts': [
    /promo/i,           // "Promo blog" = promoting, not writing
    /promot/i,          // "promoted a blog"
    /share[ds]?\s+(the\s+)?blog/i,  // "shared the blog"
    /post(ed|ing)?\s+(on|to)\s+(social|twitter|linkedin|x\b)/i, // "posting to social media"
    /social\s*media/i,  // "Social Media Posting" is not a blog
    /automat/i,         // "automation" tools aren't blog posts
  ],
  'Shorts': [
    /schedul/i,         // "schedule short" is distribution, not creation
    /post(ed|ing)?\s+(on|to)/i,  // "posting short to socials"
    /share[ds]?/i,      // "share short"
    /social/i,          // "short on socials"
    /distribute/i,      // "distribute short"
    /upload/i,          // "upload short" (unless it's the final upload of created content)
    /promo/i,           // "promo short"
  ],
  'Tutorial videos': [
    /schedul/i,         // "schedule tutorial" is distribution
    /post(ed|ing)?\s+(on|to)/i,  // "posting tutorial"
    /share[ds]?/i,      // "share tutorial"
    /social/i,          // "tutorial on socials"
    /distribute/i,      // "distribute tutorial"
    /promo/i,           // "promo tutorial"
  ],
  'Newsletter issues': [
    /prep/i,            // "newsletter prep" is not a completed newsletter
    /plan(ning)?/i,     // "planning newsletter" is not done
    /draft/i,           // "newsletter draft" is not sent yet
    /outline/i,         // "newsletter outline"
    /idea/i,            // "newsletter ideas"
  ],
  'Metrics reports': [
    /expense/i,         // "expense report" is not metrics
    /status\s*report/i, // "status report" is not metrics
    /weekly\s*report/i, // "weekly report" (unless it's metrics)
    /progress\s*report/i, // "progress report"
  ],
  'goose contributions': [
    /session/i,         // "prepare goose session" is not a contribution
    /meeting/i,         // "goose meeting" is not a contribution
    /prep(are|aring)?/i, // "preparing" something isn't a contribution
    /schedul/i,         // "schedule goose" isn't a contribution
    /demo/i,            // "goose demo" isn't a contribution
    /review/i,          // "review goose" isn't a contribution (unless it's PR review)
    /learn/i,           // "learn goose" isn't a contribution
    /test(ing)?\s+goose/i, // "testing goose" isn't a contribution
    /goose\s*doc/i,     // "goose docs" goes to Documentation, not contributions
    /doc(s|umentation)?\s*(for\s+)?goose/i, // "docs for goose" 
  ],
  'Docs': [
    /expense/i,         // "expense doc" 
    // Note: "internal devrel" tag is valid for docs, so we don't exclude "internal" broadly
  ],
};

// Confirmation patterns - for keyword matching, require these to confirm the category
const CONFIRMATION_PATTERNS = {
  'goose contributions': [
    /\bpr\b/i,          // "PR" or "pr"
    /pull\s*request/i,  // "pull request"
    /merg(e|ed|ing)/i,  // "merged"
    /fix(ed|ing|es)?\b/i, // "fix", "fixed", "fixing"
    /\bbug\b/i,         // "bug"
    /feature/i,         // "feature"
    /contribut/i,       // "contribution", "contributed"
    /implement/i,       // "implemented"
    /ship(ped|ping)?/i, // "shipped"
    /issue\s*#?\d+/i,   // "issue #123"
    /resolv/i,          // "resolved"
    /clos(e|ed|ing)/i,  // "closed issue"
  ],
  'Blog posts': [
    /wro?te/i,          // "wrote"
    /writ(e|ing|ten)/i, // "write", "writing", "written"
    /publish/i,         // "published"
    /draft/i,           // "draft"
    /\bblog\s*(post|article)/i, // "blog post", "blog article"
    /author/i,          // "authored"
  ],
  'Metrics reports': [
    /metrics/i,         // must have "metrics"
    /community\s*(metrics|report)/i, // "community metrics"
    /analytics/i,       // "analytics report"
    /discord\s*(metrics|stats)/i, // "discord metrics"
    /github\s*(metrics|stats)/i,  // "github metrics"
  ],
  'Side projects': [
    /side\s*project/i,
    /\brepo\b/i,
    /repositor/i,
    /built/i,
    /building/i,
    /ship(ped)?/i,
  ],
};

// ============================================
// AGENTIC PATTERNS DETECTION
// ============================================
// These patterns are detected from content (Videos, Shorts, Blogs, Livestreams)
// to determine which agentic patterns each person is covering

const AGENTIC_PATTERNS = {
  'MCP Apps': [/mcp\s*app/i],
  'MCP Sampling': [/mcp\s*sampl/i, /\bsampling\b/i],
  'Skills': [/skill/i, /taste/i],  // "taste" = teaching agent preferences (a skill)
  'Elicitation': [/elicit/i],
  'Recipes': [/recipe/i],
  'Subagents': [/subagent/i, /sub-agent/i],
  'Code Mode': [/code\s*mode/i],
  'ACP': [/\bacp\b/i, /agent\s*client\s*protocol/i],
  'RPI': [/\brpi\b/i],
  'Ralph Wiggum Loop': [/ralph/i],
  'Context Engineering': [/context\s*engineer/i, /agents\.md/i, /goosehints/i],
  'ai-rules': [/ai-rules/i, /ai\s*rules/i],
  'Plans': [/\bplans?\b/i, /planning\s*mode/i],
  'Beads': [/\bbeads?\b/i],  // Beads agentic pattern
};

// Categories that count as "content" for agentic patterns
const CONTENT_CATEGORIES = ['Videos', 'Blogs', 'Livestreams'];
const CONTENT_DELIVERABLES = ['Tutorial videos', 'Shorts', 'Blog posts', 'Vibe Code w/ goose streams'];

// Detect which agentic patterns are mentioned in a task name
function detectAgenticPatterns(taskName) {
  const detected = [];
  for (const [patternName, regexes] of Object.entries(AGENTIC_PATTERNS)) {
    for (const regex of regexes) {
      if (regex.test(taskName)) {
        detected.push(patternName);
        break; // Only add each pattern once
      }
    }
  }
  return detected;
}

// Check if task name matches any exclusion pattern for a category
function isExcluded(taskName, category) {
  const patterns = EXCLUSION_PATTERNS[category];
  if (!patterns) return false;
  return patterns.some(pattern => pattern.test(taskName));
}

// Check if task name has confirmation patterns for a category
function hasConfirmation(taskName, category) {
  const patterns = CONFIRMATION_PATTERNS[category];
  if (!patterns) return true; // No confirmation needed
  return patterns.some(pattern => pattern.test(taskName));
}

// Categorize a task based on its tags and name
function categorizeTask(task) {
  const tags = task.tags || [];
  const taskName = task.name.toLowerCase();
  const taskNameOriginal = task.name; // Keep original for regex matching
  
  // ============================================
  // PHASE 0: Priority tags (check these FIRST regardless of order)
  // ============================================
  // These explicit tags take absolute priority over other categorizations
  
  // Check for explicit "side project" tag first
  const hasSideProjectTag = tags.some(t => t.gid === '1212903104247034' || t.name?.toLowerCase() === 'side project');
  if (hasSideProjectTag) {
    return { category: 'Build', deliverable: 'Side projects' };
  }
  
  // Check for explicit "cfp" tag
  const hasCfpTag = tags.some(t => t.gid === '1212892322315514' || t.name?.toLowerCase() === 'cfp');
  if (hasCfpTag) {
    return { category: 'Public Speaking', deliverable: 'CFPs (submitted or accepted)' };
  }
  
  // Check for explicit "goose contribution" tag (not generic "goose" tag)
  const hasGooseContributionTag = tags.some(t => t.gid === '1212903104247031' || t.name?.toLowerCase() === 'goose contribution');
  if (hasGooseContributionTag) {
    return { category: 'Build', deliverable: 'goose contributions' };
  }
  
  // ============================================
  // PHASE 1: Tag-based categorization with validation
  // ============================================
  for (const tag of tags) {
    if (TAG_CATEGORY_MAP[tag.gid]) {
      const mapping = TAG_CATEGORY_MAP[tag.gid];
      
      // Skip tags already handled in Phase 0
      if (tag.gid === '1212903104247034' || tag.gid === '1212892322315514' || tag.gid === '1212903104247031') {
        continue;
      }
      
      // Special handling for video tag - this confirms it's actually a video
      if (tag.gid === '1204316592156190') { // video tag
        const hasTutorialTag = tags.some(t => t.gid === '1208125190486880' || t.gid === '1204316592156255');
        // Check for shorts first - "short" in name or other short indicators
        // (but not if it's scheduling/distribution)
        if ((taskName.includes('short') || taskName.includes('[shorts]') || taskName.includes('quick tip') || /under\s*(60|1\s*min)/i.test(taskName)) &&
            !taskName.includes('shortcut') &&
            !isExcluded(taskNameOriginal, 'Shorts')) {
          return { category: 'Videos', deliverable: 'Shorts' };
        }
        // Tutorial video (has video tag + tutorial content, not distribution)
        if ((hasTutorialTag || taskName.includes('tutorial') || taskName.includes('plug & play') || 
            taskName.includes('plug and play') || taskName.includes('flight school')) &&
            !isExcluded(taskNameOriginal, 'Tutorial videos')) {
          return { category: 'Videos', deliverable: 'Tutorial videos' };
        }
        // Default video tag without tutorial = Shorts (if not excluded)
        if (!isExcluded(taskNameOriginal, 'Shorts')) {
          return { category: 'Videos', deliverable: 'Shorts' };
        }
        continue; // Excluded, try other tags
      }
      
      // Special handling for tutorial tag - need to check if it's a VIDEO tutorial or WRITTEN tutorial
      if (tag.gid === '1208125190486880' || tag.gid === '1204316592156255') { // tutorial tags
        const hasVideoTag = tags.some(t => t.gid === '1204316592156190');
        const hasVideoKeyword = taskName.includes('video') || taskName.includes('filmed') || 
                                taskName.includes('recorded') || taskName.includes('youtube');
        if (hasVideoTag || hasVideoKeyword) {
          return { category: 'Videos', deliverable: 'Tutorial videos' };
        }
        // Written tutorial → Docs
        return { category: 'Documentation', deliverable: 'Docs' };
      }
      
      // Explicit "goose contribution" tag - no confirmation needed, this IS a contribution
      if (tag.gid === '1212903104247031') { // goose contribution tag
        return { category: 'Build', deliverable: 'goose contributions' };
      }
      
      // Generic "goose" tag - require confirmation (goose can mean many things)
      if (tag.gid === '1208438924809387') { // goose tag
        if (isExcluded(taskNameOriginal, 'goose contributions')) {
          continue; // Skip this tag, try others
        }
        if (hasConfirmation(taskNameOriginal, 'goose contributions')) {
          return { category: 'Build', deliverable: 'goose contributions' };
        }
        continue; // Has goose tag but no confirmation - don't auto-categorize
      }
      
      // For other tags, check exclusions
      if (!isExcluded(taskNameOriginal, mapping.deliverable)) {
        return mapping;
      }
    }
  }
  
  // ============================================
  // PHASE 2: Tag name fallback with validation
  // ============================================
  for (const tag of tags) {
    const tagNameLower = tag.name.toLowerCase();
    if (TAG_NAME_MAP[tagNameLower]) {
      const mapping = TAG_NAME_MAP[tagNameLower];
      
      // Explicit "goose contribution" tag name - no confirmation needed
      if (tagNameLower === 'goose contribution') {
        return { category: 'Build', deliverable: 'goose contributions' };
      }
      
      // Generic "goose" tag name - require confirmation
      if (tagNameLower === 'goose') {
        if (isExcluded(taskNameOriginal, 'goose contributions')) {
          continue;
        }
        if (hasConfirmation(taskNameOriginal, 'goose contributions')) {
          return mapping;
        }
        continue;
      }
      
      if (!isExcluded(taskNameOriginal, mapping.deliverable)) {
        return mapping;
      }
    }
  }
  
  // ============================================
  // PHASE 3: Keyword matching with strict validation
  // ============================================
  
  // Videos - Shorts (check first, more specific) - must be creation, not distribution
  if ((taskName.includes('[shorts]') || taskName.includes('quick tip') || 
      (taskName.includes('short') && !taskName.includes('shortcut'))) &&
      !isExcluded(taskNameOriginal, 'Shorts')) {
    return { category: 'Videos', deliverable: 'Shorts' };
  }
  
  // Videos - Tutorials (must have video indicator, otherwise it's a written tutorial → Docs)
  // Video indicators: "video", "filmed", "recorded", "youtube", "published" (without "doc"/"blog")
  const hasVideoIndicator = taskName.includes('video') || 
                            taskName.includes('filmed') || 
                            taskName.includes('recorded') ||
                            taskName.includes('youtube') ||
                            (taskName.includes('published') && !taskName.includes('doc') && !taskName.includes('blog'));
  
  if ((taskName.includes('tutorial') || taskName.includes('plug & play') || 
       taskName.includes('plug and play') || taskName.includes('flight school')) &&
      hasVideoIndicator &&
      !isExcluded(taskNameOriginal, 'Tutorial videos')) {
    return { category: 'Videos', deliverable: 'Tutorial videos' };
  }
  
  // Written tutorials go to Docs (tutorial without video indicator)
  if ((taskName.includes('tutorial') || taskName.includes('plug & play') || 
       taskName.includes('plug and play')) &&
      !hasVideoIndicator &&
      !isExcluded(taskNameOriginal, 'Docs')) {
    return { category: 'Documentation', deliverable: 'Docs' };
  }
  
  // Livestreams - Vibe Code
  if (taskName.includes('livestream') || taskName.includes('vibe code') || 
      (taskName.includes('stream') && taskName.includes('goose'))) {
    return { category: 'Livestreams', deliverable: 'Vibe Code w/ goose streams' };
  }
  
  // Blog posts - require confirmation AND no exclusions
  if ((taskName.includes('blog') || taskName.includes('article')) && 
      !isExcluded(taskNameOriginal, 'Blog posts') && 
      hasConfirmation(taskNameOriginal, 'Blog posts')) {
    return { category: 'Blogs', deliverable: 'Blog posts' };
  }
  
  // Public Speaking - CFP
  if (taskName.includes('cfp') || 
      (taskName.includes('submit') && (taskName.includes('conference') || taskName.includes('talk')))) {
    return { category: 'Public Speaking', deliverable: 'CFPs (submitted or accepted)' };
  }
  
  // Public Speaking - Podcasts
  if (taskName.includes('podcast') || taskName.includes('guest recording') ||
      (taskName.includes('recording') && taskName.includes('guest'))) {
    return { category: 'Public Speaking', deliverable: 'Podcast recordings' };
  }
  
  // Public Speaking - Talks
  if (taskName.includes('keynote') || taskName.includes('workshop') ||
      (taskName.includes('talk') && (taskName.includes('deliver') || taskName.includes('gave') || taskName.includes('present')))) {
    return { category: 'Public Speaking', deliverable: 'Talks delivered' };
  }
  
  // Community - Newsletter (check exclusions - prep, draft, planning don't count)
  if (taskName.includes('newsletter') && 
      !isExcluded(taskNameOriginal, 'Newsletter issues')) {
    return { category: 'Community', deliverable: 'Newsletter issues' };
  }
  
  // Community - Spotlights
  if (taskName.includes('spotlight')) {
    return { category: 'Community', deliverable: 'Spotlights' };
  }
  
  // Community - Metrics reports (require confirmation, check exclusions)
  if ((taskName.includes('metrics') || taskName.includes('report')) && 
      !isExcluded(taskNameOriginal, 'Metrics reports') &&
      hasConfirmation(taskNameOriginal, 'Metrics reports')) {
    return { category: 'Community', deliverable: 'Metrics reports' };
  }
  
  // Build - goose contributions (require confirmation, check exclusions)
  if (taskName.includes('goose') && 
      !isExcluded(taskNameOriginal, 'goose contributions') &&
      hasConfirmation(taskNameOriginal, 'goose contributions')) {
    return { category: 'Build', deliverable: 'goose contributions' };
  }
  
  // Build - Side projects
  if ((taskName.includes('side project') || taskName.includes('sideproject')) &&
      hasConfirmation(taskNameOriginal, 'Side projects')) {
    return { category: 'Build', deliverable: 'Side projects' };
  }
  
  // NOTE: "Agentic patterns owned" is NOT directly categorized here
  // It's derived from content (Videos, Shorts, Blogs, Livestreams) in calculateProgress()
  
  // Documentation - goose docs (check before general docs)
  if ((taskName.includes('goose doc') || taskName.includes('goose-doc') ||
       /doc(s|umentation)?\s*(for\s+)?goose/i.test(taskNameOriginal) ||
       (taskName.includes('goose') && taskName.includes('documentation'))) &&
      !isExcluded(taskNameOriginal, 'Docs')) {
    return { category: 'Documentation', deliverable: 'Docs' };
  }
  
  // Documentation (with exclusions)
  if ((taskName.includes('documentation') || 
       (taskName.includes('doc') && (taskName.includes('wrote') || taskName.includes('update') || taskName.includes('add')))) &&
      !isExcluded(taskNameOriginal, 'Docs')) {
    return { category: 'Documentation', deliverable: 'Docs' };
  }
  
  return null;
}

// Calculate progress
function calculateProgress(tasks, goals) {
  const progress = {};
  
  // Track unique agentic patterns found in content
  const agenticPatternsFound = new Set();
  const agenticPatternsTasks = []; // Tasks that contribute to agentic patterns
  
  for (const [category, deliverables] of Object.entries(goals)) {
    progress[category] = {};
    for (const deliverable of Object.keys(deliverables)) {
      progress[category][deliverable] = {
        completed: 0,
        tasks: [],
      };
    }
  }
  
  for (const task of tasks) {
    const mapping = categorizeTask(task);
    if (mapping && progress[mapping.category]?.[mapping.deliverable]) {
      progress[mapping.category][mapping.deliverable].completed++;
      
      // Get collaborators (followers who aren't the assignee and aren't excluded)
      const assigneeName = task.assignee?.name;
      const collaborators = (task.followers || [])
        .map(f => f.name)
        .filter(name => 
          name && 
          name !== assigneeName && 
          !EXCLUDED_ASSIGNEES.includes(name)
        );
      
      // Detect agentic patterns in content (Videos, Shorts, Blogs, Livestreams)
      const patterns = detectAgenticPatterns(task.name);
      
      const taskData = {
        gid: task.gid,
        name: task.name,
        completed_at: task.completed_at,
        assignee: assigneeName || 'Unassigned',
        collaborators: collaborators,
        tags: task.tags?.map(t => t.name) || [],
        agenticPatterns: patterns, // Add detected patterns to task
      };
      
      progress[mapping.category][mapping.deliverable].tasks.push(taskData);
      
      // If this is content (Videos, Blogs, Livestreams), track patterns for "Agentic patterns owned"
      if (CONTENT_DELIVERABLES.includes(mapping.deliverable) && patterns.length > 0) {
        patterns.forEach(p => agenticPatternsFound.add(p));
        agenticPatternsTasks.push({
          ...taskData,
          sourceDeliverable: mapping.deliverable,
        });
      }
    }
  }
  
  // Populate "Agentic patterns owned" from detected patterns in content
  if (progress['Build']?.['Agentic patterns owned']) {
    progress['Build']['Agentic patterns owned'].completed = agenticPatternsFound.size;
    progress['Build']['Agentic patterns owned'].tasks = agenticPatternsTasks;
    progress['Build']['Agentic patterns owned'].patternsFound = Array.from(agenticPatternsFound);
  }
  
  return progress;
}

// Get month date range
// Note: Asana's completed_on.after and completed_on.before are EXCLUSIVE
// So we need to use the day before the start and day after the end
function getMonthDateRange(year, monthName) {
  const monthMap = {
    'January': { month: 0, days: 31 },
    'February': { month: 1, days: year % 4 === 0 ? 29 : 28 },
    'March': { month: 2, days: 31 },
    'April': { month: 3, days: 30 },
    'May': { month: 4, days: 31 },
    'June': { month: 5, days: 30 },
    'July': { month: 6, days: 31 },
    'August': { month: 7, days: 31 },
    'September': { month: 8, days: 30 },
    'October': { month: 9, days: 31 },
    'November': { month: 10, days: 30 },
    'December': { month: 11, days: 31 },
  };
  
  const monthInfo = monthMap[monthName];
  const monthNum = String(monthInfo.month + 1).padStart(2, '0');
  
  // Calculate the day before the 1st (last day of previous month)
  const startDate = new Date(year, monthInfo.month, 0); // Day 0 = last day of previous month
  const startStr = startDate.toISOString().split('T')[0];
  
  // Calculate the day after the last day (first day of next month)
  const endDate = new Date(year, monthInfo.month + 1, 1); // 1st of next month
  const endStr = endDate.toISOString().split('T')[0];
  
  return {
    start: startStr,
    end: endStr,
  };
}

// ============================================
// FETCH QUARTER DATA (with caching)
// ============================================

async function fetchQuarterData(quarterId) {
  // Check cache first
  const cached = getCache(quarterId);
  if (cached) {
    return cached;
  }
  
  console.log(`🔄 Fetching fresh data for ${quarterId}...`);
  
  const quarterConfig = QUARTER_CONFIG[quarterId];
  const quarterlyGoals = QUARTERLY_GOALS[quarterId];
  const monthlyGoals = MONTHLY_GOALS[quarterId];
  
  // Fetch quarterly tasks
  const quarterTasks = await searchCompletedTasks(quarterConfig.startDate, quarterConfig.endDate);
  
  // Fetch open documentation tasks (for "as-needed" display)
  const openDocTasks = await getOpenDocumentationTasks();
  
  // Fetch monthly tasks
  const year = parseInt(quarterId.split('-')[0]);
  const monthlyProgress = {};
  
  for (const monthName of quarterConfig.months) {
    const dateRange = getMonthDateRange(year, monthName);
    const monthTasks = await searchCompletedTasks(dateRange.start, dateRange.end);
    monthlyProgress[monthName] = calculateProgress(monthTasks, monthlyGoals[monthName]);
  }
  
  // Calculate quarterly progress
  const quarterlyProgress = calculateProgress(quarterTasks, quarterlyGoals);
  
  const data = {
    quarterId,
    quarterName: quarterConfig.name,
    quarterly: {
      goals: quarterlyGoals,
      progress: quarterlyProgress,
      totalTasks: quarterTasks.length,
    },
    monthly: {
      goals: monthlyGoals,
      progress: monthlyProgress,
      months: quarterConfig.months,
    },
    // Open documentation tasks (shared across all views since it's "as-needed")
    openDocumentation: openDocTasks,
    endOfMonthDeliverables: END_OF_MONTH_DELIVERABLES,
    currentDate: new Date().toISOString(),
    currentMonth: new Date().toLocaleString('default', { month: 'long' }),
    cached: false,
  };
  
  // Cache the result
  setCache(quarterId, data);
  
  return data;
}

// ============================================
// API ENDPOINTS
// ============================================

// Get available quarters
app.get('/api/quarters', (req, res) => {
  res.json({
    quarters: getAvailableQuarters(),
    current: getCurrentQuarter(),
  });
});

// Get progress data for a specific quarter
app.get('/api/progress/:quarterId', async (req, res) => {
  try {
    if (!ASANA_TOKEN) {
      return res.status(500).json({ error: 'ASANA_TOKEN not configured. Please add it to your .env file.' });
    }
    
    const quarterId = req.params.quarterId;
    
    if (!QUARTERLY_GOALS[quarterId]) {
      return res.status(404).json({ 
        error: `Quarter ${quarterId} not found in configuration`,
        available: getAvailableQuarters(),
      });
    }
    
    if (!QUARTER_CONFIG[quarterId]) {
      return res.status(404).json({ error: `Quarter config for ${quarterId} not found` });
    }
    
    const data = await fetchQuarterData(quarterId);
    
    // Mark if this came from cache
    const cacheEntry = cache.quarters.get(getCacheKey(quarterId));
    if (cacheEntry) {
      data.cached = true;
      data.cacheAge = Date.now() - cacheEntry.timestamp;
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Default to current quarter
app.get('/api/progress', async (req, res) => {
  res.redirect(`/api/progress/${getCurrentQuarter()}`);
});

// Force refresh cache for a quarter
app.post('/api/refresh/:quarterId', async (req, res) => {
  try {
    if (!ASANA_TOKEN) {
      return res.status(500).json({ error: 'ASANA_TOKEN not configured' });
    }
    
    const quarterId = req.params.quarterId;
    
    // Clear cache for this quarter
    cache.quarters.delete(getCacheKey(quarterId));
    console.log(`🗑️ Cache cleared for ${quarterId}`);
    
    // Fetch fresh data
    const data = await fetchQuarterData(quarterId);
    
    res.json({ 
      message: `Cache refreshed for ${quarterId}`,
      data,
    });
  } catch (error) {
    console.error('Error refreshing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get cache status
app.get('/api/cache-status', (req, res) => {
  const status = {};
  
  for (const [key, entry] of cache.quarters.entries()) {
    status[key] = {
      isPast: entry.isPast,
      age: Date.now() - entry.timestamp,
      ageFormatted: `${Math.round((Date.now() - entry.timestamp) / 1000)}s ago`,
      expiresIn: entry.isPast ? 'never' : `${Math.max(0, Math.round((cache.CURRENT_QUARTER_TTL - (Date.now() - entry.timestamp)) / 1000))}s`,
    };
  }
  
  res.json({
    cachedQuarters: Object.keys(status),
    entries: status,
    rateLimitStatus: {
      requestsInWindow: requestCount,
      maxRequests: MAX_REQUESTS_PER_WINDOW,
      windowResetIn: `${Math.round((RATE_LIMIT_WINDOW - (Date.now() - requestWindowStart)) / 1000)}s`,
    },
  });
});

// Get uncategorized tasks (for debugging)
app.get('/api/uncategorized/:quarterId?', async (req, res) => {
  try {
    if (!ASANA_TOKEN) {
      return res.status(500).json({ error: 'ASANA_TOKEN environment variable not set' });
    }
    
    const quarterId = req.params.quarterId || getCurrentQuarter();
    const quarterConfig = QUARTER_CONFIG[quarterId];
    
    if (!quarterConfig) {
      return res.status(404).json({ error: `Quarter ${quarterId} not found` });
    }
    
    const tasks = await searchCompletedTasks(quarterConfig.startDate, quarterConfig.endDate);
    const uncategorized = tasks.filter(task => !categorizeTask(task));
    
    res.json({
      quarterId,
      total: tasks.length,
      uncategorized: uncategorized.length,
      tasks: uncategorized.map(t => ({
        name: t.name,
        tags: t.tags?.map(tag => ({ gid: tag.gid, name: tag.name })) || [],
      })),
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATIC FILES & SERVER
// ============================================

app.use(express.static(join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Progress Tracker running at http://localhost:${PORT}`);
  console.log(`📊 Available quarters: ${getAvailableQuarters().map(q => q.id).join(', ')}`);
  console.log(`📅 Current quarter: ${getCurrentQuarter()}`);
  console.log(`💾 Caching: Past quarters=permanent, Current quarter=5min TTL`);
  if (!ASANA_TOKEN) {
    console.warn('⚠️  Warning: ASANA_TOKEN environment variable not set');
  }
});
