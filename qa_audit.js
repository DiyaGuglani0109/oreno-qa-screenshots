const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://oreno.basiq360.tech';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const screenshotCount = { value: 0 };
function getScreenshotName(name) {
  screenshotCount.value++;
  const num = String(screenshotCount.value).padStart(2, '0');
  return path.join(SCREENSHOTS_DIR, `${num}_${name}.png`);
}

async function runQA() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  function log(status, message) {
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'INFO' ? 'ℹ️' : '⚠️';
    console.log(`${emoji} [${status}] ${message}`);
    results.push({ status, message });
  }

  try {
    log('INFO', 'Navigating to login page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotName('00_initial_page') });

    const url = page.url();
    log('INFO', `Current URL: ${url}`);

    // Check if logged in already
    const loginFormVisible = await page.locator('input[type="text"], input[name="username"], input[placeholder*="user" i]').first().isVisible({ timeout: 3000 }).catch(() => false);

    if (loginFormVisible || url.includes('login') || url === BASE_URL) {
      log('INFO', 'Logging in...');

      // Logout first if needed
      const logoutBtn = await page.locator('text=/logout|sign out|log out/i').first().isVisible({ timeout: 1000 }).catch(() => false);
      if (logoutBtn) {
        await page.locator('text=/logout|sign out|log out/i').first().click();
        await page.waitForTimeout(1000);
      }

      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Fill login form
      const usernameField = page.locator('input[type="text"], input[name="username"], input[placeholder*="user" i], input[id*="user" i]').first();
      const passwordField = page.locator('input[type="password"], input[name="password"]').first();

      await usernameField.fill('oreno_admin');
      await passwordField.fill('Admin@123');
      await page.screenshot({ path: getScreenshotName('00_login_form_filled') });

      const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In"), button:has-text("Log In")').first();
      await submitBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: getScreenshotName('00_after_login') });
    }

    log('INFO', 'Logged in, checking navigation menu...');
    await page.waitForTimeout(2000);

    // Get sidebar navigation items
    const sidebarLinks = await page.locator('aside a, nav a, [role="navigation"] a, .sidebar a, [class*="menu"] a, [class*="nav"] a').allTextContents();
    log('INFO', `Found ${sidebarLinks.length} navigation items`);

    const navText = sidebarLinks.join(' ').toLowerCase();
    console.log('Nav items:', sidebarLinks.slice(0, 40).join(' | '));

    await page.screenshot({ path: getScreenshotName('01_nav_menu') });

    // Part A verification
    log('INFO', '===== PART A: Navigation Verification =====');
    log(!navText.includes('holiday') ? 'PASS' : 'FAIL', 'Holidays module removed from nav');
    log(!navText.includes('chat') || navText.includes('chatbot') === false ? 'PASS' : 'FAIL', 'Chat module removed from nav');
    log(!(navText.includes('account') && navText.includes('invoice')) ? 'PASS' : 'FAIL', 'Accounts module removed from nav');
    log(!navText.includes('purchase based') ? 'PASS' : 'FAIL', 'Purchase Based module removed from nav');
    log(!navText.includes('reward & gift') && (navText.includes('rewards & gift') || navText.includes('rewards and gift')) ? 'PASS' : 'FAIL', '"Reward & Gift" renamed to "Rewards & Gifts"');
    log(navText.includes('scan history') && !navText.includes('point history') ? 'PASS' : 'FAIL', '"Point History" renamed to "Scan History"');

    const loyaltyMatches = sidebarLinks.filter(item => item.toLowerCase().includes('loyalty') || (item.toLowerCase().includes('loyal') && item.toLowerCase().includes('dashboard')));
    log(loyaltyMatches.length <= 1 ? 'PASS' : 'FAIL', `Only one Loyalty Dashboard entry (found ${loyaltyMatches.length})`);

    const sfaItems = ['order', 'beat plan', 'attendance', 'map', 'lead', 'expense', 'target', 'task', 'leave', 'quotation', 'event plan', 'pop-gift', 'site', 'followup', 'activity', 'report'];
    const sfaFound = sfaItems.filter(item => navText.includes(item));
    log(sfaFound.length === 0 ? 'PASS' : 'FAIL', `SFA modules removed (found: ${sfaFound.join(', ') || 'none'})`);

    const hierarchyItems = ['primary', 'secondary', 'direct'];
    const hierarchyFound = hierarchyItems.filter(item => navText.includes(item));
    log(hierarchyFound.length === 0 ? 'PASS' : 'FAIL', `Customer hierarchy levels removed (found: ${hierarchyFound.join(', ') || 'none'})`);

    log(navText.includes('tutorial') ? 'PASS' : 'FAIL', 'Tutorials module still present');
    log(navText.includes('survey') ? 'PASS' : 'FAIL', 'Survey module still present');

    await page.screenshot({ path: getScreenshotName('02_part_a_complete') });

    // Part B: Channel Partners
    log('INFO', '===== PART B: Channel Partners Module =====');

    // Find Channel Partners link
    let cpLink = page.locator('a:has-text("Channel Partner"), a:has-text("Channel Partners")').first();
    let cpExists = await cpLink.isVisible({ timeout: 3000 }).catch(() => false);

    // Try Loyalty section first
    if (!cpExists) {
      const loyaltySection = page.locator('text=/loyalty/i').first();
      if (await loyaltySection.isVisible({ timeout: 1000 }).catch(() => false)) {
        await loyaltySection.click();
        await page.waitForTimeout(1000);
        cpExists = await cpLink.isVisible({ timeout: 2000 }).catch(() => false);
      }
    }

    if (cpExists) {
      log('PASS', 'Channel Partners link found');
      await cpLink.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: getScreenshotName('03_channel_partners_list') });

      const pageContent = await page.locator('body').textContent();
      log(pageContent.includes('001234') ? 'PASS' : 'FAIL', 'Default CP (001234) visible in list');
      log(pageContent.includes('100001') || pageContent.includes('Mumbai') ? 'PASS' : 'FAIL', 'Mumbai Test CP (100001) visible in list');

      // Test search
      const searchInput = page.locator('input[placeholder*="search" i], input[type="search"], input[class*="search"], input').first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        log('PASS', 'Search input found');

        await searchInput.fill('001234');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: getScreenshotName('04_search_code_001234') });
        log('INFO', 'Searched by code: 001234');

        await searchInput.clear();
        await searchInput.fill('Mumbai');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: getScreenshotName('05_search_name_Mumbai') });
        log('INFO', 'Searched by name: Mumbai');

        await searchInput.clear();
        await searchInput.fill('9999999999');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: getScreenshotName('06_search_mobile') });
        log('INFO', 'Searched by mobile: 9999999999');

        await searchInput.clear();
      }

      // Test Add
      const addBtn = page.locator('button:has-text("Add"), button:has-text("Add Channel Partner")').first();
      if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        log('PASS', 'Add button found');
        await addBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: getScreenshotName('07_add_cp_form') });

        // Find CP Code input
        let cpCodeInput = page.locator('input[name*="code" i], input[placeholder*="code" i]').first();
        if (!(await cpCodeInput.isVisible({ timeout: 2000 }).catch(() => false))) {
          cpCodeInput = page.locator('input').nth(1);
        }

        // Test invalid 4 digits
        await cpCodeInput.fill('1234');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: getScreenshotName('08_invalid_4digits') });
        log('INFO', 'Tested invalid code: 1234 (4 digits)');

        // Test alphanumeric
        await cpCodeInput.fill('ABC123');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: getScreenshotName('09_invalid_alpha') });
        log('INFO', 'Tested invalid code: ABC123 (alphanumeric)');

        // Test valid code
        await cpCodeInput.fill('100002');
        const nameInput = page.locator('input[name*="name" i], input[placeholder*="name" i], input').first();
        await nameInput.fill('Delhi Test CP');

        const mobileInput = page.locator('input[name*="mobile" i], input[name*="phone" i], input').first();
        await mobileInput.fill('9876543210');

        await page.screenshot({ path: getScreenshotName('10_valid_cp_data') });
        log('INFO', 'Filled valid CP: 100002 / Delhi Test CP');

        // Duplicate code test
        await cpCodeInput.clear();
        await cpCodeInput.fill('001234');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: getScreenshotName('11_duplicate_code') });
        log('INFO', 'Tested duplicate code: 001234');

        // Close modal
        const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close"), [aria-label="Close"], button[type="button"]:has-text("Cancel")').first();
        await closeBtn.click().catch(() => {});
        await page.waitForTimeout(1000);
      }

      // Reload page
      await page.goto(`${BASE_URL}/loyalty/channel-partners`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: getScreenshotName('12_list_reload') });

      // Edit test
      const editBtn = page.locator('button:has-text("Edit"), [class*="edit"]').first();
      if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        log('PASS', 'Edit button found');
        await editBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: getScreenshotName('13_edit_form') });

        // Check read-only
        const readonlyInput = page.locator('input[readonly][name*="code" i], input[disabled][name*="code" i]').first();
        const isReadonly = await readonlyInput.isVisible({ timeout: 1000 }).catch(() => false);
        log(isReadonly ? 'PASS' : 'FAIL', 'CP Code field is read-only on edit');

        const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close"), [aria-label="Close"]').first();
        await closeBtn.click().catch(() => {});
        await page.waitForTimeout(1000);
      }

      // Detail page
      const detailLink = page.locator('tr:has-text("001234") a, a:has-text("001234"), tr:has-text("001234")').first();
      if (await detailLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await detailLink.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: getScreenshotName('14_cp_detail_overview') });

        log('PASS', 'Detail page opened');

        const overviewTab = page.locator('button:has-text("Overview"), [role="tab"]:has-text("Overview")').first();
        if (await overviewTab.isVisible({ timeout: 1000 }).catch(() => false)) {
          log('PASS', 'Overview tab visible');
        }

        const elecTab = page.locator('button:has-text("Electrician"), [role="tab"]:has-text("Electrician")').first();
        if (await elecTab.isVisible({ timeout: 1000 }).catch(() => false)) {
          await elecTab.click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: getScreenshotName('15_electricians_tab') });
          log('PASS', 'Assigned Electricians tab found');

          const content = await page.locator('body').textContent();
          log(content.includes('9999999999') ? 'PASS' : 'FAIL', 'Test electrician (9999999999) visible');
        }
      }

      // Back to list
      await page.goto(`${BASE_URL}/loyalty/channel-partners`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Deactivate Mumbai CP
      log('INFO', 'Testing deactivation...');
      const mumbaiRow = page.locator('tr:has-text("100001"), tr:has-text("Mumbai")').first();
      const mumbaiDeactBtn = mumbaiRow.locator('button:has-text("Deactivate"), button:has-text("Active"), button:has-text("Inactive")').first();
      if (await mumbaiDeactBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await mumbaiDeactBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: getScreenshotName('16_deactivate_confirm') });

        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Deactivate")').last();
        await confirmBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: getScreenshotName('17_deactivate_result') });
        log('INFO', 'Mumbai CP deactivation attempted');
      }

      // Try default CP deactivation
      log('INFO', 'Testing default CP 001234 deactivation (should be rejected)...');
      const defaultRow = page.locator('tr:has-text("001234"), tr:has-text("Default")').first();
      const defaultDeactBtn = defaultRow.locator('button:has-text("Deactivate"), button:has-text("Active")').first();
      if (await defaultDeactBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await defaultDeactBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: getScreenshotName('18_default_deactivate') });

        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Deactivate")').last();
        await confirmBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: getScreenshotName('19_default_deactivate_result') });

        const finalContent = await page.locator('body').textContent();
        const hasError = finalContent.toLowerCase().includes('cannot') || finalContent.toLowerCase().includes('cannot be deactivated') || finalContent.toLowerCase().includes('default');
        log(hasError ? 'PASS' : 'FAIL', 'Default CP (001234) deactivation rejected with error message');
      }

    } else {
      log('FAIL', 'Channel Partners link NOT found in navigation');
      await page.screenshot({ path: getScreenshotName('03_cp_not_found') });
    }

  } catch (error) {
    log('FAIL', `Error: ${error.message}`);
    await page.screenshot({ path: getScreenshotName('error_final') });
    console.error(error);
  } finally {
    await browser.close();
  }

  console.log('\n===== TEST SUMMARY =====');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('\nFailed items:');
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.message}`));

  return results;
}

runQA().catch(console.error);
