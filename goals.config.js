// ============================================
// GOALS CONFIGURATION FILE
// ============================================
// 
// HOW TO USE:
// 1. Each quarter, add a new entry to QUARTERLY_GOALS and MONTHLY_GOALS
// 2. Share this file with your AI assistant (Goose) and describe your new goals
// 3. Goose will update this file with the correct structure
//
// STRUCTURE:
// - Each quarter is identified by "YYYY-QN" (e.g., "2026-Q1", "2026-Q2")
// - Goals with numeric targets use numbers
// - Goals tracked "as needed" use null
// ============================================

export const QUARTERLY_GOALS = {
  // ==========================================
  // Q1 2026 (January - March)
  // ==========================================
  '2026-Q1': {
    'Build': {
      'Side projects': 4,
      'goose contributions': 4,
      'Agentic patterns owned': 4,
    },
    'Videos': {
      'Tutorial videos': 4,
      'Shorts': 6,
    },
    'Blogs': {
      'Blog posts': 10,
    },
    'Livestreams': {
      'Vibe Code w/ goose streams': 6,
    },
    'Public Speaking': {
      'CFPs (submitted or accepted)': 6,
      'Talks delivered': 4,
      'Podcast recordings': 4,
    },
    'Community': {
      'Newsletter issues': 3,
      'Spotlights': 3,
      'Metrics reports': 3,
    },
    'Documentation': {
      'Docs': null, // As needed basis
    },
  },

  // ==========================================
  // Q2 2026 (April - June) - TEMPLATE
  // ==========================================
  // Uncomment and modify when Q2 starts:
  /*
  '2026-Q2': {
    'Build': {
      'Side projects': 4,
      'goose contributions': 4,
      'Agentic patterns owned': 4,
    },
    'Videos': {
      'Tutorial videos': 4,
      'Shorts': 6,
    },
    'Blogs': {
      'Blog posts': 10,
    },
    'Livestreams': {
      'Vibe Code w/ goose streams': 6,
    },
    'Public Speaking': {
      'CFP applications': 6,
      'Talks delivered': 4,
      'Podcast recordings': 4,
    },
    'Community': {
      'Newsletter issues': 3,
      'Spotlights': 3,
      'Metrics reports': 3,
    },
    'Documentation': {
      'Docs': null,
    },
  },
  */
};

export const MONTHLY_GOALS = {
  // ==========================================
  // Q1 2026 Monthly Breakdown
  // ==========================================
  '2026-Q1': {
    'January': {
      'Build': { 'Side projects': 2, 'goose contributions': 2, 'Agentic patterns owned': 2 },
      'Videos': { 'Tutorial videos': 2, 'Shorts': 2 },
      'Blogs': { 'Blog posts': 4 },
      'Livestreams': { 'Vibe Code w/ goose streams': 2 },
      'Public Speaking': { 'CFPs (submitted or accepted)': 2, 'Talks delivered': 0, 'Podcast recordings': 0 },
      'Community': { 'Newsletter issues': 1, 'Spotlights': 1, 'Metrics reports': 1 },
      'Documentation': { 'Docs': null },
    },
    'February': {
      'Build': { 'Side projects': 2, 'goose contributions': 2, 'Agentic patterns owned': 2 },
      'Videos': { 'Tutorial videos': 2, 'Shorts': 2 },
      'Blogs': { 'Blog posts': 4 },
      'Livestreams': { 'Vibe Code w/ goose streams': 2 },
      'Public Speaking': { 'CFPs (submitted or accepted)': 2, 'Talks delivered': 2, 'Podcast recordings': 2 },
      'Community': { 'Newsletter issues': 1, 'Spotlights': 1, 'Metrics reports': 1 },
      'Documentation': { 'Docs': null },
    },
    'March': {
      'Build': { 'Side projects': null, 'goose contributions': null, 'Agentic patterns owned': null },
      'Videos': { 'Tutorial videos': null, 'Shorts': 2 },
      'Blogs': { 'Blog posts': 2 },
      'Livestreams': { 'Vibe Code w/ goose streams': 2 },
      'Public Speaking': { 'CFPs (submitted or accepted)': 2, 'Talks delivered': 2, 'Podcast recordings': 2 },
      'Community': { 'Newsletter issues': 1, 'Spotlights': 1, 'Metrics reports': 1 },
      'Documentation': { 'Docs': null },
    },
  },

  // ==========================================
  // Q2 2026 Monthly Breakdown - TEMPLATE
  // ==========================================
  // Uncomment and modify when Q2 starts:
  /*
  '2026-Q2': {
    'April': {
      'Build': { 'Side projects': 2, 'goose contributions': 2, 'Agentic patterns owned': 2 },
      'Videos': { 'Tutorial videos': 2, 'Shorts': 2 },
      'Blogs': { 'Blog posts': 4 },
      'Livestreams': { 'Vibe Code w/ goose streams': 2 },
      'Public Speaking': { 'CFP applications': 2, 'Talks delivered': 2, 'Podcast recordings': 2 },
      'Community': { 'Newsletter issues': 1, 'Spotlights': 1, 'Metrics reports': 1 },
      'Documentation': { 'Docs': null },
    },
    'May': {
      // ... copy structure from above
    },
    'June': {
      // ... copy structure from above
    },
  },
  */
};

// ============================================
// TAG MAPPINGS
// ============================================
// Maps Asana tags to goal categories/deliverables
// Update this when you add new categories or change tagging conventions

export const TAG_CATEGORY_MAP = {
  // Build - Side projects (explicit tag takes priority)
  '1212903104247034': { category: 'Build', deliverable: 'Side projects' }, // side project
  
  // Build - goose contributions
  '1208438924809387': { category: 'Build', deliverable: 'goose contributions' }, // goose
  '1212903104247031': { category: 'Build', deliverable: 'goose contributions' }, // goose contribution (explicit tag)
  
  // Videos
  '1208125190486880': { category: 'Videos', deliverable: 'Tutorial videos' }, // Video Tutorial
  '1204316592156255': { category: 'Videos', deliverable: 'Tutorial videos' }, // tutorial
  '1204316592156190': { category: 'Videos', deliverable: 'Shorts' }, // video (default to shorts)
  
  // Blogs
  '1204316592156209': { category: 'Blogs', deliverable: 'Blog posts' }, // blog
  
  // Livestreams
  '1205607058770995': { category: 'Livestreams', deliverable: 'Vibe Code w/ goose streams' }, // livestream
  
  // Public Speaking (consolidated)
  '1212892322315514': { category: 'Public Speaking', deliverable: 'CFPs (submitted or accepted)' }, // cfp
  '1204316592156237': { category: 'Public Speaking', deliverable: 'Talks delivered' }, // public speaking
  '1204316592156228': { category: 'Public Speaking', deliverable: 'Podcast recordings' }, // podcast
  '1206441534238594': { category: 'Public Speaking', deliverable: 'Talks delivered' }, // workshop
  
  // Community
  '1200006700367828': { category: 'Community', deliverable: 'Newsletter issues' }, // Newsletter
  '1204364638447788': { category: 'Community', deliverable: 'Community' }, // community (general)
  
  // Documentation
  '1204316592156189': { category: 'Documentation', deliverable: 'Docs' }, // documentation
  '1204463482160284': { category: 'Documentation', deliverable: 'Docs' }, // guide
  '1207924330531310': { category: 'Documentation', deliverable: 'Docs' }, // internal devrel
};

// Fallback: Tag names to Category mapping
export const TAG_NAME_MAP = {
  // Build
  'side project': { category: 'Build', deliverable: 'Side projects' },
  'goose': { category: 'Build', deliverable: 'goose contributions' },
  'goose contribution': { category: 'Build', deliverable: 'goose contributions' },
  
  // Videos
  'video tutorial': { category: 'Videos', deliverable: 'Tutorial videos' },
  'tutorial': { category: 'Videos', deliverable: 'Tutorial videos' },
  'video': { category: 'Videos', deliverable: 'Shorts' },
  
  // Blogs
  'blog': { category: 'Blogs', deliverable: 'Blog posts' },
  
  // Livestreams
  'livestream': { category: 'Livestreams', deliverable: 'Vibe Code w/ goose streams' },
  
  // Public Speaking
  'cfp': { category: 'Public Speaking', deliverable: 'CFPs (submitted or accepted)' },
  'public speaking': { category: 'Public Speaking', deliverable: 'Talks delivered' },
  'podcast': { category: 'Public Speaking', deliverable: 'Podcast recordings' },
  'workshop': { category: 'Public Speaking', deliverable: 'Talks delivered' },
  
  // Community
  'newsletter': { category: 'Community', deliverable: 'Newsletter issues' },
  'community': { category: 'Community', deliverable: 'Community' },
  
  // Documentation
  'documentation': { category: 'Documentation', deliverable: 'Docs' },
  'guide': { category: 'Documentation', deliverable: 'Docs' },
  'internal devrel': { category: 'Documentation', deliverable: 'Docs' },
};

// ============================================
// END-OF-MONTH DELIVERABLES
// ============================================
// These deliverables are typically completed at the end of the month
// They will show "Pending" instead of "Behind" until the last week of the month

export const END_OF_MONTH_DELIVERABLES = [
  'Newsletter issues',
  'Spotlights',
  'Metrics reports',
];

// ============================================
// QUARTER METADATA
// ============================================
// Defines date ranges for each quarter
// NOTE: Asana's completed_on.after and completed_on.before are EXCLUSIVE
// So startDate should be the day BEFORE the quarter starts
// And endDate should be the day AFTER the quarter ends

export const QUARTER_CONFIG = {
  '2026-Q1': {
    name: 'Q1 2026',
    startDate: '2025-12-31',  // Day before Jan 1
    endDate: '2026-04-01',    // Day after Mar 31
    months: ['January', 'February', 'March'],
  },
  '2026-Q2': {
    name: 'Q2 2026',
    startDate: '2026-03-31',  // Day before Apr 1
    endDate: '2026-07-01',    // Day after Jun 30
    months: ['April', 'May', 'June'],
  },
  '2026-Q3': {
    name: 'Q3 2026',
    startDate: '2026-06-30',  // Day before Jul 1
    endDate: '2026-10-01',    // Day after Sep 30
    months: ['July', 'August', 'September'],
  },
  '2026-Q4': {
    name: 'Q4 2026',
    startDate: '2026-09-30',  // Day before Oct 1
    endDate: '2027-01-01',    // Day after Dec 31
    months: ['October', 'November', 'December'],
  },
};

// ============================================
// HELPER: Get current quarter
// ============================================
export function getCurrentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  
  let quarter;
  if (month < 3) quarter = 1;
  else if (month < 6) quarter = 2;
  else if (month < 9) quarter = 3;
  else quarter = 4;
  
  return `${year}-Q${quarter}`;
}

// ============================================
// HELPER: Get available quarters (for dropdown)
// ============================================
export function getAvailableQuarters() {
  return Object.keys(QUARTERLY_GOALS).map(key => ({
    id: key,
    name: QUARTER_CONFIG[key]?.name || key,
  }));
}
