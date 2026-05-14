const { chromium } = require('playwright');

const BASE_URL = 'https://oreno.basiq360.tech';
const SCREENSHOTS_DIR = 'C:\\Users\\harsh\\OneDrive\\Desktop\\2026\\WebsiteTesting\\screenshots';
const CREDENTIALS = { username: 'oreno_admin', password: 'Admin@123' };

let browser, context, page;
let testResults = [];

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

async function screenshot(name) {
  const path = `${SCREENSHOTS_DIR}\\${name}.png`;
  try {
    await page.screenshot({ path, fullPage: true });
    log(`Screenshot saved: ${path}`);
  } catch (e) {
    log(`Screenshot failed: ${e.message}`);
  }
  return path;
}

async function run() {
  try {
    log('Starting Oreno CRM QA Test Suite v2...');
    log(`Target: ${BASE_URL}`);

    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true
    });
    page = await context.newPage();

    // Handle console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        log(`BROWSER ERROR: ${msg.text()}`);
      }
    });

    // Step 1: Navigate to login page
    log('Step 1: Navigating to login page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot('v2_01_landing');

    // Step 2: Click "Switch to Corporate Login" if present
    log('Step 2: Looking for corporate login option...');
    const corporateLink = page.getByText('Switch to Corporate Login', { exact: false });
    if (await corporateLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      log('Found "Switch to Corporate Login" - clicking it');
      await corporateLink.click();
      await page.waitForTimeout(2000);
      await screenshot('v2_02_corporate_login');
    } else {
      log('"Switch to Corporate Login" not found, checking current state...');
      await screenshot('v2_02_no_switch');
    }

    // Step 3: Try to find username field (could be email, username, etc.)
    log('Step 3: Looking for login form...');
    const pageContent = await page.content();
    log(`Page title: ${await page.title()}`);

    // Try various selectors for username/email field
    let usernameField = null;
    const selectors = [
      'input[name="username"]',
      'input[name="email"]',
      'input[type="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="user" i]',
      'input[placeholder*="Email" i]',
      'input[placeholder*="Username" i]',
      '#email',
      '#username',
    ];

    for (const sel of selectors) {
      try {
        const field = page.locator(sel);
        if (await field.isVisible({ timeout: 1000 })) {
          usernameField = field;
          log(`Found username field with selector: ${sel}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (usernameField) {
      await usernameField.fill(CREDENTIALS.username);
      await screenshot('v2_03_username_filled');

      // Try to find password field
      let passwordField = null;
      const pwdSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        '#password',
      ];

      for (const sel of pwdSelectors) {
        try {
          const field = page.locator(sel);
          if (await field.isVisible({ timeout: 1000 })) {
            passwordField = field;
            log(`Found password field with selector: ${sel}`);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (passwordField) {
        await passwordField.fill(CREDENTIALS.password);
        await screenshot('v2_04_password_filled');
      }

      // Submit the form
      const submitBtn = page.getByRole('button', { name: /login|sign in|submit/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
        await screenshot('v2_05_after_submit');
      }
    } else {
      log('Could not find login form');
      await screenshot('v2_03_no_form');
    }

    // Step 4: Check if we're logged in
    const currentUrl = page.url();
    log(`Current URL after login attempt: ${currentUrl}`);

    if (currentUrl.includes('login') || currentUrl.includes('auth')) {
      log('Login may have failed - still on login page');
      await screenshot('v2_06_login_failed');
    } else {
      log('Login appears successful - on dashboard page');
      await screenshot('v2_07_dashboard');
    }

    // Step 5: Part A - Check navigation menu
    log('\n=== PART A: Navigation Menu Verification ===');
    testResults.push('\n=== PART A: Navigation Menu Verification ===');

    await page.waitForTimeout(2000);
    await screenshot('v2_08_nav_check');

    // Get sidebar nav text
    const navText = await page.evaluate(() => {
      // Try various sidebar selectors
      const selectors = [
        '[class*="sidebar"]',
        'aside',
        'nav',
        '[class*="menu"]',
        '[class*="nav"]',
        '[role="navigation"]'
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText && el.innerText.length > 50) {
          return el.innerText;
        }
      }

      // Fallback to full body text
      return document.body.innerText.substring(0, 5000);
    });

    log(`Nav text (${navText.length} chars):\n${navText.substring(0, 2000)}`);

    // Define Part A checks
    const checks = [
      { name: 'Holidays NOT in nav', pattern: /holidays?/i, shouldBe: false },
      { name: 'Chat NOT in nav', pattern: /^\s*chat\s*$/im, shouldBe: false },
      { name: 'Accounts NOT in nav', pattern: /^\s*accounts?\s*$/im, shouldBe: false },
      { name: 'Purchase Based NOT in nav', pattern: /purchase\s*based/i, shouldBe: false },
      { name: '"Rewards & Gifts" in nav', pattern: /rewards?\s*&\s*gifts?/i, shouldBe: true },
      { name: '"Scan History" in nav', pattern: /scan\s*history/i, shouldBe: true },
      { name: 'No duplicate Loyalty Dashboard', pattern: /loyalty\s*dashboard/gi, shouldBe: true, unique: true },
      { name: 'Orders NOT in nav', pattern: /^\s*orders?\s*$/im, shouldBe: false },
      { name: 'Beat Plan NOT in nav', pattern: /beat\s*plan/i, shouldBe: false },
      { name: 'Attendance NOT in nav', pattern: /^\s*attendance\s*$/im, shouldBe: false },
      { name: 'Map NOT in nav', pattern: /^\s*map\s*$/im, shouldBe: false },
      { name: 'Leads NOT in nav', pattern: /^\s*leads?\s*$/im, shouldBe: false },
      { name: 'Expense NOT in nav', pattern: /^\s*expenses?\s*$/im, shouldBe: false },
      { name: 'Target NOT in nav', pattern: /^\s*target\s*$/im, shouldBe: false },
      { name: 'Task NOT in nav', pattern: /^\s*task\s*$/im, shouldBe: false },
      { name: 'Leave NOT in nav', pattern: /^\s*leave\s*$/im, shouldBe: false },
      { name: 'Quotation NOT in nav', pattern: /^\s*quotation/i, shouldBe: false },
      { name: 'Event Plan NOT in nav', pattern: /event\s*plan/i, shouldBe: false },
      { name: 'Pop-Gift NOT in nav', pattern: /pop[\s-]*gift/i, shouldBe: false },
      { name: 'Sites NOT in nav', pattern: /^\s*sites?\s*$/im, shouldBe: false },
      { name: 'Followup NOT in nav', pattern: /^\s*follow[\s-]*?up\s*$/im, shouldBe: false },
      { name: 'Activity NOT in nav', pattern: /^\s*activity\s*$/im, shouldBe: false },
      { name: 'Reports NOT in nav', pattern: /^\s*reports?\s*$/im, shouldBe: false },
      { name: 'Primary customer NOT in nav', pattern: /^\s*primary\s*customer/i, shouldBe: false },
      { name: 'Secondary customer NOT in nav', pattern: /^\s*secondary\s*customer/i, shouldBe: false },
      { name: 'Direct customer NOT in nav', pattern: /^\s*direct\s*customer/i, shouldBe: false },
      { name: 'Tutorials STILL in nav', pattern: /tutorials?/i, shouldBe: true },
      { name: 'Survey STILL in nav', pattern: /survey/i, shouldBe: true },
    ];

    for (const check of checks) {
      const matches = navText.match(check.pattern);
      const found = matches && matches.length > 0;
      let pass;

      if (check.unique) {
        pass = !found || (matches.length === 1);
      } else {
        pass = check.shouldBe ? found : !found;
      }

      const status = pass ? 'PASS' : 'FAIL';
      const foundText = found ? ` (found: "${matches ? matches.join('", "') : ''}")` : ' (not found)';
      log(`[${status}] ${check.name}${foundText}`);
      testResults.push(`[${status}] ${check.name}${foundText}`);

      await page.screenshot({ path: `${SCREENSHOTS_DIR}\\v2_parta_${check.name.replace(/[^a-z0-9]/gi, '_')}_${status.toLowerCase()}.png`, fullPage: true }).catch(() => {});
    }

    // Step 6: Part B - Channel Partners Module
    if (!currentUrl.includes('login')) {
      log('\n=== PART B: Channel Partners Module ===');
      testResults.push('\n=== PART B: Channel Partners Module ===');

      // Navigate to Channel Partners
      log('Navigating to Loyalty > Channel Partners...');
      await screenshot('v2_partb_01_nav_loyalty');

      // Try to expand Loyalty menu
      try {
        await page.click('text=Loyalty', { timeout: 2000 });
        await page.waitForTimeout(1000);
      } catch (e) {
        log('Could not expand Loyalty menu');
      }

      // Try Channel Partners
      try {
        await page.click('text=Channel Partners', { timeout: 2000 });
        await page.waitForTimeout(2000);
        await screenshot('v2_partb_02_channel_partners');
      } catch (e) {
        log('Could not find Channel Partners, trying direct URL...');
        await page.goto(`${BASE_URL}/loyalty/channel-partners`, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(3000);
        await screenshot('v2_partb_02_direct_nav');
      }

      log(`URL after nav: ${page.url()}`);

      // B2: Check list page
      const listContent = await page.evaluate(() => document.body.innerText.substring(0, 5000));
      log(`List page content (${listContent.length} chars):\n${listContent.substring(0, 2000)}`);

      const has001234 = listContent.includes('001234');
      const has100001 = listContent.includes('100001');
      const hasDefault = listContent.includes('Default Channel Partner') || listContent.includes('Default');
      const hasMumbai = listContent.includes('Mumbai');

      log(`[${has001234 ? 'PASS' : 'FAIL'}] 001234 found in list`);
      testResults.push(`[${has001234 ? 'PASS' : 'FAIL'}] 001234 found in list`);
      log(`[${has100001 ? 'PASS' : 'FAIL'}] 100001 found in list`);
      testResults.push(`[${has100001 ? 'PASS' : 'FAIL'}] 100001 found in list`);
      log(`[${hasDefault ? 'PASS' : 'FAIL'}] Default Channel Partner found`);
      testResults.push(`[${hasDefault ? 'PASS' : 'FAIL'}] Default Channel Partner found`);
      log(`[${hasMumbai ? 'PASS' : 'FAIL'}] Mumbai Test CP found`);
      testResults.push(`[${hasMumbai ? 'PASS' : 'FAIL'}] Mumbai Test CP found`);

      await screenshot('v2_partb_03_list_check');

    } else {
      log('Skipping Part B - login failed');
      testResults.push('[SKIP] Part B skipped - login failed');
    }

    // Final summary
    log('\n=== TEST SUMMARY ===');
    for (const r of testResults) {
      console.log(r);
    }

    const passCount = testResults.filter(r => r.includes('[PASS]')).length;
    const failCount = testResults.filter(r => r.includes('[FAIL]')).length;
    log(`\nTotal: ${passCount} PASS, ${failCount} FAIL, ${testResults.filter(r => r.includes('[SKIP]')).length} SKIPPED`);
    log('All tests complete.');

  } catch (e) {
    log(`FATAL ERROR: ${e.message}`);
    await screenshot('v2_fatal_error');
  } finally {
    if (browser) await browser.close();
  }
}

run();
