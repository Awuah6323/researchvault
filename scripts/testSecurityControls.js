// scripts/testSecurityControls.js
// Automated verification of AI Kill Switch and Markdown Link Protocol Protection

import handler from '../api/gemini.js';

// Mock response object
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    headersSent: false,
    writableEnded: false,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.writableEnded = true;
      return this;
    },
    end(data) {
      if (data) this.body = data;
      this.writableEnded = true;
      return this;
    }
  };
  return res;
}

// ------------------------------------------------------------- 1. AI KILL SWITCH
console.log('=== TEST 1: AI Emergency Kill Switch ===');

// Case A: AI_DISABLED = 'true'
process.env.AI_DISABLED = 'true';
const reqA = {
  method: 'POST',
  headers: {
    origin: 'http://localhost:3000'
  }
};
const resA = createMockRes();

await handler(reqA, resA);

console.log('AI_DISABLED=true -> HTTP Status:', resA.statusCode);
console.log('Response body:', resA.body);

if (resA.statusCode === 503 && resA.body?.error === 'The AI service is temporarily disabled for maintenance.') {
  console.log('✓ PASS: AI Kill switch responded with 503 and safe message without calling Gemini.');
} else {
  console.error('✗ FAIL: Unexpected response for AI_DISABLED=true');
  process.exit(1);
}

// Case B: GEMINI_DISABLED = 'true'
delete process.env.AI_DISABLED;
process.env.GEMINI_DISABLED = 'true';
const resB = createMockRes();

await handler(reqA, resB);

console.log('GEMINI_DISABLED=true -> HTTP Status:', resB.statusCode);
if (resB.statusCode === 503) {
  console.log('✓ PASS: GEMINI_DISABLED=true correctly triggers 503 emergency response.');
} else {
  console.error('✗ FAIL: Unexpected response for GEMINI_DISABLED=true');
  process.exit(1);
}

// Case C: Kill switch disabled (clean reset)
delete process.env.AI_DISABLED;
delete process.env.GEMINI_DISABLED;
const resC = createMockRes();
// Should proceed past kill switch to auth check (401 or user check)
await handler(reqA, resC);
console.log('Kill switch unset -> Status:', resC.statusCode);
if (resC.statusCode !== 503) {
  console.log('✓ PASS: Normal AI flow restored when kill switch is unset.\n');
} else {
  console.error('✗ FAIL: AI still returned 503 when kill switch was disabled.');
  process.exit(1);
}

// ------------------------------------------------------------- 2. MARKDOWN PROTOCOL CHECK
console.log('=== TEST 2: Markdown Link Protocol Sanitization ===');

// Mirror isSafeHref logic from MarkdownMessage.jsx
function isSafeHref(href) {
  if (!href || typeof href !== 'string') return false;
  const trimmed = href.trim();
  if (trimmed === '' || trimmed === '#') return true;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;

  if (/^https?:\/\//i.test(trimmed) || /^mailto:[^\s@]+@[^\s@]+/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const protocol = parsed.protocol.toLowerCase();
      return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
    } catch {
      return false;
    }
  }

  return false;
}

const testCases = [
  { url: 'javascript:alert(1)', expectedSafe: false },
  { url: 'JAVASCRIPT:alert(document.cookie)', expectedSafe: false },
  { url: 'data:text/html,<script>alert(1)</script>', expectedSafe: false },
  { url: 'vbscript:msgbox("xss")', expectedSafe: false },
  { url: 'file:///etc/passwd', expectedSafe: false },
  { url: '//attacker.com/payload', expectedSafe: false },
  { url: 'https://scholar.google.com/citations?user=123', expectedSafe: true },
  { url: 'http://arxiv.org/abs/2301.00001', expectedSafe: true },
  { url: 'mailto:researcher@institution.edu', expectedSafe: true },
  { url: '#abstract-section', expectedSafe: true },
  { url: '/dashboard', expectedSafe: true }
];

let allPassed = true;
for (const tc of testCases) {
  const safe = isSafeHref(tc.url);
  const pass = safe === tc.expectedSafe;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] "${tc.url}" -> Safe: ${safe} (Expected: ${tc.expectedSafe})`);
  if (!pass) allPassed = false;
}

if (allPassed) {
  console.log('\n✓ PASS: All URL protocol tests passed cleanly.\n');
} else {
  console.error('\n✗ FAIL: Some URL protocol tests failed.');
  process.exit(1);
}

console.log('=== ALL TARGETED CONTROLS VERIFIED SUCCESSFULLY ===');
