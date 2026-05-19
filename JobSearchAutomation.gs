// ═══════════════════════════════════════════════════════════════════════════
// AI-POWERED C2C JOB SEARCH AUTOMATION — Google Apps Script
// For: Business Analyst | C2C Contract | Banking/Insurance/Healthcare
// Author: Kiro AI Assistant
// Date: May 2026
// Cost: $0 (Uses free Google Apps Script quotas)
// ═══════════════════════════════════════════════════════════════════════════

// ╔═══════════════════════════════════════╗
// ║       CONFIGURATION — EDIT HERE       ║
// ╚═══════════════════════════════════════╝

const CONFIG = {
  // Your Google Sheet ID (from the URL)
  SHEET_ID: '1Dman4U8LcYVuOZZHGWsgVUmX5OqQ2r2ViJQFgzujKn0',
  
  // Sheet tab name (first tab by default)
  SHEET_TAB: 'Sheet1',
  
  // Search parameters
  SEARCH_KEYWORDS: ['business analyst', 'systems analyst', 'product owner', 'BSA', 'technical analyst'],
  DOMAINS: ['banking', 'insurance', 'healthcare', 'mortgage', 'financial services', 'capital markets'],
  EMPLOYMENT_TYPES: ['c2c', 'corp-to-corp', 'corp to corp', 'contract independent', '1099', 'third party'],
  
  // Location
  TARGET_LOCATION: 'Chicago, IL',
  COUNTRY: 'US',
  
  // Experience
  MIN_EXPERIENCE: 3,
  MAX_EXPERIENCE: 6,
  
  // Pay
  MIN_PAY_RATE: 40,
  
  // Time filter (hours)
  MAX_AGE_HOURS: 48,
  
  // Reject titles containing these
  REJECT_TITLES: ['qa', 'developer', 'architect', 'engineer', 'trainer', 'manager', 
                  'director', 'recruiter', 'nurse', 'writer', 'attorney', 'devops',
                  'data engineer', 'software', 'full stack', 'front end', 'back end'],
  
  // Reject conditions
  REJECT_KEYWORDS: ['w2 only', 'w2 contract', 'security clearance required', 
                    'us citizen only', 'citizenship required', 'clearance required',
                    'permanent', 'full-time permanent', 'fte only']
};


// ╔═══════════════════════════════════════╗
// ║       MAIN ENTRY POINT                ║
// ╚═══════════════════════════════════════╝

/**
 * MAIN FUNCTION — Run this to execute the full job search
 * Can be triggered manually or set on a daily timer
 */
function runJobSearch() {
  const sheet = getSheet_();
  const existingJobs = getExistingJobs_(sheet);
  
  Logger.log('═══ JOB SEARCH STARTED ═══');
  Logger.log('Existing jobs in sheet: ' + existingJobs.length);
  
  let allJobs = [];
  let summary = {portals: []};
  
  // Portal 1: TechFetch
  Logger.log('\n--- PORTAL 1: TechFetch ---');
  let techfetchResult = searchTechFetch_();
  summary.portals.push(techfetchResult.summary);
  allJobs = allJobs.concat(techfetchResult.jobs);
  
  // Portal 2: Corp-Corp.com  
  Logger.log('\n--- PORTAL 2: Corp-Corp.com ---');
  let corpCorpResult = searchCorpCorp_();
  summary.portals.push(corpCorpResult.summary);
  allJobs = allJobs.concat(corpCorpResult.jobs);
  
  // Portal 3: JobServe
  Logger.log('\n--- PORTAL 3: JobServe ---');
  let jobServeResult = searchJobServe_();
  summary.portals.push(jobServeResult.summary);
  allJobs = allJobs.concat(jobServeResult.jobs);
  
  // Deduplicate and filter
  let newJobs = deduplicateJobs_(allJobs, existingJobs);
  Logger.log('\nAfter dedup: ' + newJobs.length + ' new jobs to add');
  
  // Write to sheet
  let addedCount = writeToSheet_(sheet, newJobs);
  
  // Print summary
  printSummary_(summary, newJobs, addedCount, existingJobs.length);
}


// ╔═══════════════════════════════════════╗
// ║       PORTAL 1: TECHFETCH             ║
// ╚═══════════════════════════════════════╝

function searchTechFetch_() {
  let jobs = [];
  let opened = 0, rejected = 0, rejectionReasons = {};
  const pages = 3;
  
  for (let page = 1; page <= pages; page++) {
    try {
      // TechFetch search URL pattern
      let url = 'https://www.techfetch.com/job-search?' +
        'keywords=business+analyst+c2c' +
        '&emp_type=c2c' +
        '&page=' + page;
      
      let response = fetchWithRetry_(url);
      if (!response) continue;
      
      let html = response.getContentText();
      let listings = parseTechFetchListings_(html);
      
      for (let listing of listings) {
        opened++;
        let validation = validateJob_(listing);
        if (validation.valid) {
          listing.source = 'TechFetch';
          listing.score = calculateScore_(listing);
          jobs.push(listing);
        } else {
          rejected++;
          rejectionReasons[validation.reason] = (rejectionReasons[validation.reason] || 0) + 1;
        }
      }
      
      Utilities.sleep(2000); // Rate limiting
    } catch(e) {
      Logger.log('TechFetch page ' + page + ' error: ' + e.message);
    }
  }
  
  let topReason = getTopRejectionReason_(rejectionReasons);
  return {
    jobs: jobs,
    summary: {
      portal: 'TechFetch',
      pagesChecked: pages,
      jobsOpened: opened,
      added: jobs.length,
      rejected: rejected,
      topRejection: topReason
    }
  };
}


function parseTechFetchListings_(html) {
  let listings = [];
  
  // Parse job cards from TechFetch HTML
  // TechFetch uses div-based job cards with class patterns
  let jobBlocks = html.split(/class="job[-_]?card|class="job[-_]?listing|class="search[-_]?result/i);
  
  for (let i = 1; i < jobBlocks.length; i++) {
    try {
      let block = jobBlocks[i];
      let listing = {
        title: extractBetween_(block, 'title">', '</') || extractBetween_(block, 'job-title">', '</') || '',
        company: extractBetween_(block, 'company">', '</') || extractBetween_(block, 'company-name">', '</') || '',
        location: extractBetween_(block, 'location">', '</') || '',
        pay: extractPayRate_(block),
        employmentType: extractEmploymentType_(block),
        postDate: extractDate_(block),
        recruiterName: extractBetween_(block, 'recruiter">', '</') || extractBetween_(block, 'contact">', '</') || '',
        recruiterEmail: extractEmail_(block),
        applyLink: extractLink_(block, 'techfetch.com'),
        description: block.substring(0, 2000),
        remote: detectRemote_(block),
        domain: detectDomain_(block),
        experience: extractExperience_(block),
        c2cConfirmed: /corp.?to.?corp|c2c|1099/i.test(block)
      };
      
      if (listing.title && listing.title.length > 3) {
        listings.push(listing);
      }
    } catch(e) {
      Logger.log('Parse error in TechFetch block: ' + e.message);
    }
  }
  
  return listings;
}


// ╔═══════════════════════════════════════╗
// ║       PORTAL 2: CORP-CORP.COM         ║
// ╚═══════════════════════════════════════╝

function searchCorpCorp_() {
  let jobs = [];
  let opened = 0, rejected = 0, rejectionReasons = {};
  const pages = 3;
  
  for (let page = 1; page <= pages; page++) {
    try {
      // Corp-Corp.com — entire site is C2C only
      let url = 'https://www.corp-corp.com/jobs?' +
        'q=business+analyst+banking+insurance+healthcare' +
        '&location=United+States' +
        '&page=' + page;
      
      let response = fetchWithRetry_(url);
      if (!response) continue;
      
      let html = response.getContentText();
      let listings = parseCorpCorpListings_(html);
      
      for (let listing of listings) {
        opened++;
        // Corp-Corp is ALL C2C, so mark it
        listing.c2cConfirmed = true;
        listing.employmentType = 'Corp-to-Corp';
        
        let validation = validateJob_(listing);
        if (validation.valid) {
          listing.source = 'Corp-Corp.com';
          listing.score = calculateScore_(listing);
          jobs.push(listing);
        } else {
          rejected++;
          rejectionReasons[validation.reason] = (rejectionReasons[validation.reason] || 0) + 1;
        }
      }
      
      Utilities.sleep(2000);
    } catch(e) {
      Logger.log('Corp-Corp page ' + page + ' error: ' + e.message);
    }
  }
  
  let topReason = getTopRejectionReason_(rejectionReasons);
  return {
    jobs: jobs,
    summary: {
      portal: 'Corp-Corp.com',
      pagesChecked: pages,
      jobsOpened: opened,
      added: jobs.length,
      rejected: rejected,
      topRejection: topReason
    }
  };
}


function parseCorpCorpListings_(html) {
  let listings = [];
  
  // Parse job cards from Corp-Corp HTML
  let jobBlocks = html.split(/class="job[-_]?card|class="listing|class="result[-_]?item|<article/i);
  
  for (let i = 1; i < jobBlocks.length; i++) {
    try {
      let block = jobBlocks[i];
      let listing = {
        title: extractBetween_(block, 'title">', '</') || extractBetween_(block, '<h2>', '</h2>') || extractBetween_(block, '<h3>', '</h3>') || '',
        company: extractBetween_(block, 'company">', '</') || extractBetween_(block, 'employer">', '</') || '',
        location: extractBetween_(block, 'location">', '</') || extractLocationFromText_(block),
        pay: extractPayRate_(block),
        employmentType: 'Corp-to-Corp',
        postDate: extractDate_(block),
        recruiterName: extractBetween_(block, 'posted-by">', '</') || '',
        recruiterEmail: extractEmail_(block),
        applyLink: extractLink_(block, 'corp-corp.com'),
        description: block.substring(0, 2000),
        remote: detectRemote_(block),
        domain: detectDomain_(block),
        experience: extractExperience_(block),
        c2cConfirmed: true
      };
      
      if (listing.title && listing.title.length > 3) {
        listings.push(listing);
      }
    } catch(e) {
      Logger.log('Parse error in Corp-Corp block: ' + e.message);
    }
  }
  
  return listings;
}


// ╔═══════════════════════════════════════╗
// ║       PORTAL 3: JOBSERVE              ║
// ╚═══════════════════════════════════════╝

function searchJobServe_() {
  let jobs = [];
  let opened = 0, rejected = 0, rejectionReasons = {};
  const pages = 3;
  
  for (let page = 1; page <= pages; page++) {
    try {
      // JobServe US contract search
      let url = 'https://www.jobserve.com/us/en/search-jobs-in-united-states/' +
        '?q=business+analyst+banking+insurance+healthcare+c2c' +
        '&l=United+States' +
        '&tp=2' +  // Last 2 days
        '&pg=' + page;
      
      let response = fetchWithRetry_(url);
      if (!response) continue;
      
      let html = response.getContentText();
      let listings = parseJobServeListings_(html);
      
      for (let listing of listings) {
        opened++;
        let validation = validateJob_(listing);
        if (validation.valid) {
          listing.source = 'JobServe';
          listing.score = calculateScore_(listing);
          jobs.push(listing);
        } else {
          rejected++;
          rejectionReasons[validation.reason] = (rejectionReasons[validation.reason] || 0) + 1;
        }
      }
      
      Utilities.sleep(2000);
    } catch(e) {
      Logger.log('JobServe page ' + page + ' error: ' + e.message);
    }
  }
  
  let topReason = getTopRejectionReason_(rejectionReasons);
  return {
    jobs: jobs,
    summary: {
      portal: 'JobServe',
      pagesChecked: pages,
      jobsOpened: opened,
      added: jobs.length,
      rejected: rejected,
      topRejection: topReason
    }
  };
}


function parseJobServeListings_(html) {
  let listings = [];
  
  // Parse JobServe results
  let jobBlocks = html.split(/class="job|class="result|class="jobItem|id="job_/i);
  
  for (let i = 1; i < jobBlocks.length; i++) {
    try {
      let block = jobBlocks[i];
      let listing = {
        title: extractBetween_(block, 'title">', '</') || extractBetween_(block, '<h2>', '</h2>') || extractBetween_(block, 'JobTitle">', '</') || '',
        company: extractBetween_(block, 'company">', '</') || extractBetween_(block, 'Company">', '</') || '',
        location: extractBetween_(block, 'location">', '</') || extractBetween_(block, 'Location">', '</') || '',
        pay: extractPayRate_(block),
        employmentType: extractEmploymentType_(block),
        postDate: extractDate_(block),
        recruiterName: extractBetween_(block, 'agency">', '</') || extractBetween_(block, 'Agency">', '</') || '',
        recruiterEmail: extractEmail_(block),
        applyLink: extractLink_(block, 'jobserve.com'),
        description: block.substring(0, 2000),
        remote: detectRemote_(block),
        domain: detectDomain_(block),
        experience: extractExperience_(block),
        c2cConfirmed: /corp.?to.?corp|c2c|1099|independent.?contract/i.test(block)
      };
      
      if (listing.title && listing.title.length > 3) {
        listings.push(listing);
      }
    } catch(e) {
      Logger.log('Parse error in JobServe block: ' + e.message);
    }
  }
  
  return listings;
}


// ╔═══════════════════════════════════════╗
// ║       VALIDATION & SCORING            ║
// ╚═══════════════════════════════════════╝

/**
 * Validates a job listing against all qualification/rejection rules
 * Returns {valid: true/false, reason: string}
 */
function validateJob_(listing) {
  let desc = (listing.description || '').toLowerCase();
  let title = (listing.title || '').toLowerCase();
  
  // REJECT: Wrong title
  for (let reject of CONFIG.REJECT_TITLES) {
    if (title.includes(reject) && !title.includes('analyst') && !title.includes('owner')) {
      return {valid: false, reason: 'Wrong title: ' + reject};
    }
  }
  
  // REJECT: Must have a valid title
  let hasValidTitle = false;
  for (let keyword of CONFIG.SEARCH_KEYWORDS) {
    if (title.includes(keyword.toLowerCase())) {
      hasValidTitle = true;
      break;
    }
  }
  if (!hasValidTitle) {
    return {valid: false, reason: 'Title not matching BA/SA/PO'};
  }
  
  // REJECT: W2 only or clearance required
  for (let reject of CONFIG.REJECT_KEYWORDS) {
    if (desc.includes(reject)) {
      return {valid: false, reason: 'Contains: ' + reject};
    }
  }
  
  // REJECT: Pay below $40/hr if explicitly stated
  if (listing.pay && listing.pay > 0 && listing.pay < CONFIG.MIN_PAY_RATE) {
    return {valid: false, reason: 'Pay below $40/hr'};
  }
  
  // REJECT: Not US location
  if (listing.location && !isUSLocation_(listing.location)) {
    return {valid: false, reason: 'Non-US location'};
  }
  
  // REJECT: Posted more than 48 hours ago
  if (listing.postDate && !isWithin48Hours_(listing.postDate)) {
    return {valid: false, reason: 'Older than 48 hours'};
  }
  
  // QUALIFY: Must be C2C/Contract
  if (!listing.c2cConfirmed) {
    let hasC2C = false;
    for (let empType of CONFIG.EMPLOYMENT_TYPES) {
      if (desc.includes(empType)) {
        hasC2C = true;
        break;
      }
    }
    if (!hasC2C) {
      return {valid: false, reason: 'C2C not confirmed'};
    }
  }
  
  return {valid: true, reason: ''};
}


/**
 * Calculate match score (0-100) based on scoring rules
 */
function calculateScore_(listing) {
  let score = 0;
  
  // +30 → C2C explicitly confirmed
  if (listing.c2cConfirmed) {
    score += 30;
  }
  
  // +20 → Remote work
  if (listing.remote === 'Remote') {
    score += 20;
  } else if (listing.remote === 'Hybrid') {
    score += 10;
  }
  
  // +20 → Domain match
  if (listing.domain && listing.domain !== 'Not specified') {
    score += 20;
  }
  
  // Pay scoring
  if (listing.pay >= 50) {
    score += 15;  // +15 → Pay ≥ $50/hr
  } else if (listing.pay >= 40) {
    score += 10;  // +10 → Pay $40–49/hr
  } else if (!listing.pay || listing.pay === 0) {
    score += 12;  // +12 → Market/DOE/not stated
  }
  
  // Experience scoring
  let exp = listing.experience || 0;
  if (exp >= 3 && exp <= 6) {
    score += 15;  // +15 → 3-6 years match
  } else if (exp > 6) {
    score += 10;  // +10 → Senior/Expert
  } else if (exp === 0) {
    score += 5;   // +5 → Not specified
  }
  
  return Math.min(score, 100);
}


// ╔═══════════════════════════════════════╗
// ║       HELPER FUNCTIONS                ║
// ╚═══════════════════════════════════════╝

/**
 * Fetch URL with retry logic and headers
 */
function fetchWithRetry_(url, retries) {
  retries = retries || 3;
  let options = {
    'method': 'get',
    'headers': {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    },
    'muteHttpExceptions': true,
    'followRedirects': true
  };
  
  for (let i = 0; i < retries; i++) {
    try {
      let response = UrlFetchApp.fetch(url, options);
      let code = response.getResponseCode();
      if (code === 200) return response;
      if (code === 429) {
        Utilities.sleep(5000 * (i + 1)); // Exponential backoff
        continue;
      }
      Logger.log('HTTP ' + code + ' for: ' + url);
      return null;
    } catch(e) {
      Logger.log('Fetch attempt ' + (i+1) + ' failed: ' + e.message);
      Utilities.sleep(3000);
    }
  }
  return null;
}

/**
 * Extract text between two markers
 */
function extractBetween_(text, start, end) {
  let startIdx = text.indexOf(start);
  if (startIdx === -1) return '';
  startIdx += start.length;
  let endIdx = text.indexOf(end, startIdx);
  if (endIdx === -1) return '';
  return text.substring(startIdx, endIdx).replace(/<[^>]+>/g, '').trim();
}


/**
 * Extract pay rate from text
 */
function extractPayRate_(text) {
  // Match patterns like $50/hr, $50/hour, $50 per hour, $50 - $60/hr
  let patterns = [
    /\$(\d+)\s*[-–]\s*\$?(\d+)\s*\/?\s*(?:hr|hour|h)/i,
    /\$(\d+)\s*\/?\s*(?:hr|hour|h)/i,
    /(\d+)\s*(?:per hour|\/hr|\/hour)/i,
    /rate[:\s]*\$?(\d+)/i
  ];
  
  for (let pattern of patterns) {
    let match = text.match(pattern);
    if (match) {
      // If range, take the lower value
      return parseInt(match[1]);
    }
  }
  return 0; // 0 means not stated (Market/DOE)
}

/**
 * Extract employment type from text
 */
function extractEmploymentType_(text) {
  let lower = text.toLowerCase();
  if (/corp.?to.?corp|c2c/i.test(lower)) return 'Corp-to-Corp';
  if (/1099/i.test(lower)) return '1099';
  if (/contract.?independent/i.test(lower)) return 'Contract Independent';
  if (/contract/i.test(lower)) return 'Contract';
  if (/third.?party/i.test(lower)) return 'Third Party';
  return 'Contract';
}

/**
 * Extract posting date from text
 */
function extractDate_(text) {
  // Try "Posted X hours/days ago" patterns
  let agoMatch = text.match(/(\d+)\s*(hour|hr|day|min)/i);
  if (agoMatch) {
    let num = parseInt(agoMatch[1]);
    let unit = agoMatch[2].toLowerCase();
    let now = new Date();
    if (unit.startsWith('hour') || unit.startsWith('hr')) {
      return new Date(now.getTime() - num * 60 * 60 * 1000);
    } else if (unit.startsWith('day')) {
      return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
    } else if (unit.startsWith('min')) {
      return new Date(now.getTime() - num * 60 * 1000);
    }
  }
  
  // Try date patterns like "May 19, 2026" or "05/19/2026"
  let dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    return new Date(dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3], 
                    parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
  }
  
  // Try "Today" or "Just now"
  if (/today|just now|just posted/i.test(text)) {
    return new Date();
  }
  
  return null; // Unknown date
}


/**
 * Extract email from text
 */
function extractEmail_(text) {
  let match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : '';
}

/**
 * Extract link from text
 */
function extractLink_(text, domain) {
  // Look for href links
  let hrefMatch = text.match(/href="([^"]*)/i);
  if (hrefMatch) {
    let link = hrefMatch[1];
    if (link.startsWith('/')) {
      return 'https://www.' + domain + link;
    }
    return link;
  }
  return '';
}

/**
 * Extract experience years from text
 */
function extractExperience_(text) {
  let match = text.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)/i);
  if (match) return parseInt(match[1]);
  
  match = text.match(/experience[:\s]*(\d+)/i);
  if (match) return parseInt(match[1]);
  
  return 0;
}

/**
 * Detect if job is remote/hybrid/onsite
 */
function detectRemote_(text) {
  let lower = text.toLowerCase();
  if (/fully?\s*remote|100%\s*remote|work\s*from\s*home|remote\s*position/i.test(lower)) {
    return 'Remote';
  }
  if (/hybrid/i.test(lower)) {
    return 'Hybrid';
  }
  return 'Onsite';
}

/**
 * Detect domain/industry from text
 */
function detectDomain_(text) {
  let lower = text.toLowerCase();
  if (/banking|bank\b/i.test(lower)) return 'Banking';
  if (/insurance/i.test(lower)) return 'Insurance';
  if (/healthcare|health\s*care|hospital|medical/i.test(lower)) return 'Healthcare';
  if (/mortgage/i.test(lower)) return 'Mortgage';
  if (/financial\s*services|fintech|finance/i.test(lower)) return 'Financial Services';
  if (/capital\s*markets|trading|investment/i.test(lower)) return 'Capital Markets';
  return 'Not specified';
}

/**
 * Extract location from free text
 */
function extractLocationFromText_(text) {
  // Match "City, ST" pattern
  let match = text.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2})/);
  if (match) return match[0];
  return '';
}


/**
 * Check if location is in the US
 */
function isUSLocation_(location) {
  if (!location) return true; // If no location, don't reject
  let lower = location.toLowerCase();
  
  // Reject if clearly non-US
  let nonUS = ['india', 'uk', 'canada', 'australia', 'europe', 'singapore', 'london', 'toronto', 'mumbai', 'bangalore'];
  for (let loc of nonUS) {
    if (lower.includes(loc)) return false;
  }
  
  // US state abbreviations
  let usStates = ['al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
                  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
                  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
                  'va','wa','wv','wi','wy','dc'];
  
  for (let state of usStates) {
    if (lower.includes(', ' + state) || lower.endsWith(' ' + state)) return true;
  }
  
  if (lower.includes('united states') || lower.includes('usa') || lower.includes('remote')) return true;
  
  return true; // Default: don't reject if unsure
}

/**
 * Check if date is within last 48 hours
 */
function isWithin48Hours_(date) {
  if (!date) return true; // If no date, don't reject
  let now = new Date();
  let diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  return diffHours <= CONFIG.MAX_AGE_HOURS;
}

/**
 * Get top rejection reason from map
 */
function getTopRejectionReason_(reasons) {
  let topReason = 'N/A';
  let topCount = 0;
  for (let reason in reasons) {
    if (reasons[reason] > topCount) {
      topCount = reasons[reason];
      topReason = reason;
    }
  }
  return topReason;
}


// ╔═══════════════════════════════════════╗
// ║       SHEET OPERATIONS                ║
// ╚═══════════════════════════════════════╝

/**
 * Get the target spreadsheet and sheet
 */
function getSheet_() {
  let ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_TAB);
  if (!sheet) {
    sheet = ss.getSheets()[0]; // Fallback to first sheet
  }
  return sheet;
}

/**
 * Get existing jobs from sheet for dedup
 * Returns array of {title, company} objects
 */
function getExistingJobs_(sheet) {
  let lastRow = sheet.getLastRow();
  if (lastRow < 2) return []; // Only header or empty
  
  // Read columns B (title) and C (company)
  let titles = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  let companies = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
  
  let existing = [];
  for (let i = 0; i < titles.length; i++) {
    if (titles[i][0]) {
      existing.push({
        title: titles[i][0].toString().toLowerCase().trim(),
        company: companies[i][0].toString().toLowerCase().trim()
      });
    }
  }
  return existing;
}

/**
 * Deduplicate jobs against existing sheet entries
 */
function deduplicateJobs_(newJobs, existingJobs) {
  let unique = [];
  let seen = new Set();
  
  for (let job of newJobs) {
    let key = (job.title + '|' + job.company).toLowerCase().trim();
    
    // Skip if already in sheet
    let isDupe = existingJobs.some(function(existing) {
      return existing.title === job.title.toLowerCase().trim() && 
             existing.company === job.company.toLowerCase().trim();
    });
    
    // Skip if duplicate within this batch
    if (isDupe || seen.has(key)) continue;
    
    seen.add(key);
    unique.push(job);
  }
  
  return unique;
}


/**
 * Write qualifying jobs to the Google Sheet
 * Columns A through S (S = Applied Date, always blank)
 */
function writeToSheet_(sheet, jobs) {
  if (jobs.length === 0) {
    Logger.log('No new jobs to add.');
    return 0;
  }
  
  let lastRow = sheet.getLastRow();
  let startRow = lastRow + 1;
  
  for (let i = 0; i < jobs.length; i++) {
    let job = jobs[i];
    let row = startRow + i;
    
    // Determine Local Only and Relocation
    let isLocal = isLocalToChicago_(job.location) ? 'Yes' : 'No';
    
    // Format pay
    let payDisplay = job.pay > 0 ? '$' + job.pay + '/hr' : 'Market/DOE';
    
    // Format experience
    let expDisplay = job.experience > 0 ? job.experience + ' years' : 'Not specified';
    
    // Format skills match
    let skillsMatch = getSkillsMatch_(job.description);
    
    // Format posting date
    let postDateDisplay = job.postDate ? Utilities.formatDate(job.postDate, 'America/Chicago', 'MM/dd/yyyy') : 'Recent';
    
    // Row data: A through R (S is always blank)
    let rowData = [
      job.score,                    // A: Match Score
      job.title,                    // B: Job Title
      job.company,                  // C: Company Name
      job.location,                 // D: Location
      job.remote,                   // E: Remote/Hybrid/Onsite
      isLocal,                      // F: Local Only
      'No',                         // G: Relocation Allowed (default No for contract)
      job.employmentType,           // H: Employment Type
      payDisplay,                   // I: Pay Rate
      expDisplay,                   // J: Required Experience
      job.domain,                   // K: Domain
      skillsMatch,                  // L: Skills Match
      postDateDisplay,              // M: Posting Date
      job.recruiterName,            // N: Recruiter Name
      job.recruiterEmail,           // O: Recruiter Email
      job.source,                   // P: Source Portal
      'Yes',                        // Q: Verified Active
      job.applyLink,                // R: Apply Link
      ''                            // S: Applied Date (ALWAYS BLANK)
    ];
    
    sheet.getRange(row, 1, 1, 19).setValues([rowData]);
  }
  
  Logger.log('Added ' + jobs.length + ' new jobs starting at row ' + startRow);
  return jobs.length;
}

/**
 * Check if location is local to Chicago
 */
function isLocalToChicago_(location) {
  if (!location) return false;
  let lower = location.toLowerCase();
  return lower.includes('chicago') || lower.includes(', il') || lower.includes('illinois');
}

/**
 * Get skills match summary from description
 */
function getSkillsMatch_(description) {
  if (!description) return '';
  let lower = description.toLowerCase();
  let skills = [];
  
  let checkSkills = ['sql', 'jira', 'agile', 'scrum', 'requirements', 'user stories',
                     'uml', 'visio', 'excel', 'tableau', 'power bi', 'python',
                     'data analysis', 'stakeholder', 'brd', 'frd', 'gap analysis',
                     'process mapping', 'confluence', 'api', 'uat'];
  
  for (let skill of checkSkills) {
    if (lower.includes(skill)) {
      skills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
    }
  }
  
  return skills.slice(0, 6).join(', '); // Top 6 skills
}


// ╔═══════════════════════════════════════╗
// ║       SUMMARY & REPORTING             ║
// ╚═══════════════════════════════════════╝

/**
 * Print execution summary to logs
 */
function printSummary_(summary, newJobs, addedCount, existingCount) {
  Logger.log('\n═══════════════════════════════════════');
  Logger.log('       JOB SEARCH SUMMARY');
  Logger.log('═══════════════════════════════════════');
  
  Logger.log('\nPortal Summary:');
  Logger.log('| Portal        | Pages | Opened | Added | Rejected | Top Rejection |');
  Logger.log('|---------------|-------|--------|-------|----------|---------------|');
  
  for (let p of summary.portals) {
    Logger.log('| ' + padRight_(p.portal, 13) + ' | ' + 
               padRight_(p.pagesChecked.toString(), 5) + ' | ' +
               padRight_(p.jobsOpened.toString(), 6) + ' | ' +
               padRight_(p.added.toString(), 5) + ' | ' +
               padRight_(p.rejected.toString(), 8) + ' | ' +
               padRight_(p.topRejection, 13) + ' |');
  }
  
  if (newJobs.length > 0) {
    Logger.log('\nNew Rows Added:');
    Logger.log('| Score | Job Title                    | Company        | Location    | Pay      | Source     |');
    Logger.log('|-------|------------------------------|----------------|-------------|----------|------------|');
    
    for (let job of newJobs) {
      Logger.log('| ' + padRight_(job.score.toString(), 5) + ' | ' +
                 padRight_(job.title.substring(0, 28), 28) + ' | ' +
                 padRight_((job.company || '').substring(0, 14), 14) + ' | ' +
                 padRight_((job.location || '').substring(0, 11), 11) + ' | ' +
                 padRight_(job.pay > 0 ? '$'+job.pay+'/hr' : 'Market', 8) + ' | ' +
                 padRight_(job.source.substring(0, 10), 10) + ' |');
    }
  }
  
  Logger.log('\n───────────────────────────────────────');
  Logger.log('Total added this session: ' + addedCount);
  Logger.log('Total in sheet now: ' + (existingCount + addedCount));
  Logger.log('───────────────────────────────────────');
}

function padRight_(str, len) {
  str = str || '';
  while (str.length < len) str += ' ';
  return str.substring(0, len);
}


// ╔═══════════════════════════════════════╗
// ║       DAILY TRIGGER SETUP             ║
// ╚═══════════════════════════════════════╝

/**
 * Set up daily automatic trigger
 * Run this ONCE to enable daily auto-search at 8 AM Chicago time
 */
function setupDailyTrigger() {
  // Delete existing triggers first
  let triggers = ScriptApp.getProjectTriggers();
  for (let trigger of triggers) {
    if (trigger.getHandlerFunction() === 'runJobSearch') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  
  // Create new daily trigger at 8 AM Central Time
  ScriptApp.newTrigger('runJobSearch')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone('America/Chicago')
    .create();
  
  Logger.log('Daily trigger set! Job search will run at 8 AM Chicago time every day.');
}

/**
 * Remove all triggers (stop auto-search)
 */
function removeTriggers() {
  let triggers = ScriptApp.getProjectTriggers();
  for (let trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }
  Logger.log('All triggers removed.');
}

// ╔═══════════════════════════════════════╗
// ║       MANUAL TEST FUNCTION            ║
// ╚═══════════════════════════════════════╝

/**
 * Quick test — checks if script can access the sheet
 */
function testConnection() {
  try {
    let sheet = getSheet_();
    let lastRow = sheet.getLastRow();
    Logger.log('✅ Connected to sheet successfully!');
    Logger.log('Sheet name: ' + sheet.getName());
    Logger.log('Current rows: ' + lastRow);
    Logger.log('Sheet ID: ' + CONFIG.SHEET_ID);
    return true;
  } catch(e) {
    Logger.log('❌ Error: ' + e.message);
    Logger.log('Make sure the Sheet ID in CONFIG is correct.');
    return false;
  }
}
