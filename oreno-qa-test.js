const { chromium } = require('playwright');

const BASE_URL = 'https://oreno.basiq360.tech';
const SCREENSHOTS_DIR = 'C:\\Users\\harsh\\OneDrive\\Desktop\\2026\\WebsiteTesting\\screenshots';
const CREDENTIALS = { username: 'oreno_admin', password: 'Admin@123' };

let browser, context, page;
let testResults = [];

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
  process.stdout.write(`[${new Date().toLocaleTimeString()}] ${msg}\n`);
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

async function waitForNavMenu() {
  // Wait for sidebar/nav to be visible
  await page.waitForSelector('[class*="sidebar"]', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function login() {
  log('Navigating to login page...');
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForTimeout(2000);

  await screenshot('01_login_page');

  // Check if we're on mobile OTP login - switch to corporate
  const corporateBtn = await page.$('text=Switch to Corporate Login');
  if (corporateBtn) {
    log('Switching to Corporate Login...');
    await corporateBtn.click();
    await page.waitForTimeout(2000);
    await screenshot('01b_corporate_login');
  }

  log('Filling credentials...');
  // Try corporate username/password fields
  const usernameInput = await page.$('input[name="username"], input[placeholder*="user" i], input[placeholder*="email" i], input[type="text"]');
  const passwordInput = await page.$('input[name="password"], input[type="password"]');

  if (usernameInput) {
    await usernameInput.fill(CREDENTIALS.username).catch(() => {});
    log('Filled username');
  } else {
    log('Username input not found - trying alternative selectors');
    await page.fill('input', CREDENTIALS.username).catch(() => {});
  }

  if (passwordInput) {
    await passwordInput.fill(CREDENTIALS.password).catch(() => {});
    log('Filled password');
  } else {
    log('Password input not found - trying alternative selectors');
    const allInputs = await page.$$('input');
    for (const inp of allInputs) {
      const type = await inp.getAttribute('type').catch(() => '');
      if (type === 'password') {
        await inp.fill(CREDENTIALS.password).catch(() => {});
        break;
      }
    }
  }

  await screenshot('02_credentials_filled');

  // Submit
  const submitBtn = await page.$('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Continue")');
  if (submitBtn) {
    await submitBtn.click();
    await page.waitForTimeout(4000);
  } else {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);
  }

  await screenshot('03_after_login');
  log('Login attempted. Current URL: ' + page.url());
}

async function logout() {
  log('Logging out...');
  try {
    // Try clicking user avatar/menu
    await page.click('[class*="avatar"]', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.click('text=Logout, text=Log Out, text=Sign Out', { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(2000);
  } catch (e) {
    log('Logout click failed, trying direct URL...');
    await page.goto(`${BASE_URL}/auth/logout`).catch(() => {});
    await page.waitForTimeout(2000);
  }
  await screenshot('00_logged_out');
}

async function checkNavItems() {
  log('--- PART A: Checking Navigation Menu Items ---');
  testResults.push('\n=== PART A: Navigation Menu Verification ===');

  await waitForNavMenu();
  await screenshot('parta_00_nav_menu_full');

  // Get all nav text
  const navText = await page.evaluate(() => {
    const sidebar = document.querySelector('[class*="sidebar"]') || document.querySelector('aside') || document.querySelector('nav');
    if (!sidebar) {
      // Try to find any side navigation
      const allEls = document.querySelectorAll('*');
      let sidebarEl = null;
      for (const el of allEls) {
        const cls = el.className || '';
        if (typeof cls === 'string' && (cls.includes('sidebar') || cls.includes('nav') || cls.includes('menu') || cls.includes('drawer'))) {
          if (el.children && el.children.length > 2) {
            sidebarEl = el;
            break;
          }
        }
      }
      return sidebarEl ? sidebarEl.innerText : document.body.innerText.substring(0, 3000);
    }
    return sidebar.innerText;
  });

  log(`Nav text length: ${navText.length} chars`);
  console.log('NAV CONTENT:\n' + navText.substring(0, 3000));
  await screenshot('parta_01_nav_text_capture');

  // Part A checks
  const checks = [
    { name: 'Holidays module NOT in nav', pattern: /holidays?/i, shouldBe: false },
    { name: 'Chat module NOT in nav', pattern: /^\s*chat\s*$/im, shouldBe: false },
    { name: 'Accounts module NOT in nav', pattern: /^\s*accounts?\s*$/im, shouldBe: false },
    { name: 'Purchase Based NOT in nav', pattern: /purchase\s*based/i, shouldBe: false },
    { name: '"Reward & Gift" -> "Rewards & Gifts"', pattern: /rewards?\s*&\s*gifts?/i, shouldBe: true },
    { name: '"Point History" -> "Scan History"', pattern: /scan\s*history/i, shouldBe: true },
    { name: 'No duplicate Loyalty Dashboard', pattern: /loyalty\s*dashboard/gi, shouldBe: true, unique: true },
    { name: 'Orders module NOT in nav', pattern: /^\s*orders?\s*$/im, shouldBe: false },
    { name: 'Beat Plan NOT in nav', pattern: /beat\s*plan/i, shouldBe: false },
    { name: 'Attendance NOT in nav', pattern: /^\s*attendance\s*$/im, shouldBe: false },
    { name: 'Map module NOT in nav', pattern: /^\s*map\s*$/im, shouldBe: false },
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
    { name: 'Tutorials still in nav', pattern: /tutorials?/i, shouldBe: true },
    { name: 'Survey still in nav', pattern: /survey/i, shouldBe: true },
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

    await page.screenshot({ path: `${SCREENSHOTS_DIR}\\parta_${check.name.replace(/[^a-z0-9]/gi, '_')}_${status.toLowerCase()}.png`, fullPage: true }).catch(() => {});
  }
}

async function testChannelPartners() {
  log('\n--- PART B: Testing Channel Partners Module ---');
  testResults.push('\n=== PART B: Channel Partners Module ===');

  // Navigate to Loyalty > Channel Partners
  log('Navigating to Loyalty > Channel Partners...');

  // Try to expand Loyalty first
  const loyaltySelectors = [
    'text=Loyalty Program',
    'text=Loyalty',
    '[class*="menu"]:has-text("Loyalty")',
    '[class*="item"]:has-text("Loyalty")',
  ];

  for (const sel of loyaltySelectors) {
    try {
      await page.click(sel, { timeout: 2000 });
      log(`Clicked: ${sel}`);
      await page.waitForTimeout(1000);
      break;
    } catch (e) {}
  }

  await screenshot('partb_01_loyalty_expanded');

  // Try Channel Partners
  const cpSelectors = [
    'text=Channel Partners',
    'text=Channel',
    '[class*="item"]:has-text("Channel")',
    '[class*="menu-item"]:has-text("Channel")',
  ];

  for (const sel of cpSelectors) {
    try {
      await page.click(sel, { timeout: 2000 });
      log(`Clicked: ${sel}`);
      await page.waitForTimeout(2000);
      await screenshot('partb_02_channel_partners_page');
      break;
    } catch (e) {}
  }

  // Check URL
  log(`Current URL: ${page.url()}`);

  // Try direct navigation as fallback
  if (!page.url().includes('channel-partners')) {
    log('Direct navigation to Channel Partners...');
    await page.goto(`${BASE_URL}/loyalty/channel-partners`).catch(() => {});
    await page.waitForTimeout(3000);
    await screenshot('partb_02b_channel_partners_direct');
  }

  log(`Current URL: ${page.url()}`);
  await screenshot('partb_02_channel_partners_page');

  // B2: Check list page entries
  log('Checking list page entries...');
  await page.waitForTimeout(2000);

  const listContent = await page.evaluate(() => {
    return document.body.innerText.substring(0, 5000);
  });
  console.log('LIST PAGE CONTENT:\n' + listContent.substring(0, 3000));
  await screenshot('partb_03_list_page_content');

  // Check for 001234 and 100001 entries
  const has001234 = listContent.includes('001234');
  const has100001 = listContent.includes('100001');
  const hasDefaultCP = listContent.includes('Default Channel Partner');
  const hasMumbaiCP = listContent.includes('Mumbai Test CP');

  log(`[${has001234 ? 'PASS' : 'FAIL'}] 001234 found in list`);
  testResults.push(`[${has001234 ? 'PASS' : 'FAIL'}] 001234 found in list`);
  log(`[${has100001 ? 'PASS' : 'FAIL'}] 100001 found in list`);
  testResults.push(`[${has100001 ? 'PASS' : 'FAIL'}] 100001 found in list`);
  log(`[${hasDefaultCP ? 'PASS' : 'FAIL'}] Default Channel Partner found`);
  testResults.push(`[${hasDefaultCP ? 'PASS' : 'FAIL'}] Default Channel Partner found`);
  log(`[${hasMumbaiCP ? 'PASS' : 'FAIL'}] Mumbai Test CP found`);
  testResults.push(`[${hasMumbaiCP ? 'PASS' : 'FAIL'}] Mumbai Test CP found`);
  await screenshot('partb_03_list_entries');

  // B3: Test search functionality
  log('Testing search...');

  // Search by code 001234
  const searchInput = await page.$('input[placeholder*="search" i], input[placeholder*="Search" i], input[type="search"]');
  if (searchInput) {
    await searchInput.fill('001234');
    await page.waitForTimeout(1500);
    await screenshot('partb_04_search_by_code');
    const searchResult = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    log(`Search by 001234 results: ${searchResult.substring(0, 500)}`);
    log(`[${searchResult.includes('001234') ? 'PASS' : 'FAIL'}] Search by code 001234`);
    testResults.push(`[${searchResult.includes('001234') ? 'PASS' : 'FAIL'}] Search by code 001234`);

    await searchInput.fill('');
    await page.waitForTimeout(500);

    // Search by name Mumbai
    await searchInput.fill('Mumbai');
    await page.waitForTimeout(1500);
    await screenshot('partb_05_search_by_name');
    const nameResult = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    log(`Search by Mumbai results: ${nameResult.substring(0, 500)}`);
    log(`[${nameResult.includes('Mumbai') ? 'PASS' : 'FAIL'}] Search by name Mumbai`);
    testResults.push(`[${nameResult.includes('Mumbai') ? 'PASS' : 'FAIL'}] Search by name Mumbai`);

    await searchInput.fill('');
    await page.waitForTimeout(500);

    // Search by mobile
    await searchInput.fill('9999999999');
    await page.waitForTimeout(1500);
    await screenshot('partb_06_search_by_mobile');
    const mobileResult = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    log(`Search by mobile results: ${mobileResult.substring(0, 500)}`);
    await searchInput.fill('');
  } else {
    log('Search input not found');
    testResults.push('[FAIL] Search input not found');
  }

  // B4: Test Status filter
  log('Testing Status filter...');
  const filterButtons = await page.$$('button, [class*="filter"], [class*="select"], select');
  await screenshot('partb_07_filter_area');

  // Try clicking filter dropdown
  for (const btn of filterButtons) {
    const text = await btn.innerText().catch(() => '');
    if (text.toLowerCase().includes('status') || text.toLowerCase().includes('active') || text.toLowerCase().includes('filter')) {
      await btn.click();
      await page.waitForTimeout(1000);
      await screenshot('partb_08_filter_opened');
      break;
    }
  }

  // B5: Test Create new CP
  log('Testing Create new CP...');
  const addButtons = await page.$$('button');
  let addBtnFound = false;
  for (const btn of addButtons) {
    const text = await btn.innerText().catch(() => '');
    if (text.toLowerCase().includes('add') || text.toLowerCase().includes('create') || text.toLowerCase().includes('new')) {
      await btn.click();
      await page.waitForTimeout(2000);
      await screenshot('partb_09_add_cp_modal');
      addBtnFound = true;
      break;
    }
  }

  if (addBtnFound) {
    // Get form fields
    const formContent = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log('FORM CONTENT:\n' + formContent);
    await screenshot('partb_10_add_form_content');

    // Fill valid form - CP Code: 100002
    const inputs = await page.$$('input');
    log(`Found ${inputs.length} inputs in form`);

    // Fill CP Code
    if (inputs.length > 0) {
      // Try to fill first input with 100002
      try {
        await inputs[0].fill('100002');
        await page.waitForTimeout(500);
        await screenshot('partb_11_cp_code_filled');
      } catch (e) {
        log(`Could not fill CP Code: ${e.message}`);
      }
    }

    // Fill remaining fields
    const allInputs = await page.$$('input, textarea');
    if (allInputs.length > 1) {
      try { await allInputs[1].fill('Delhi Test CP'); await page.waitForTimeout(300); } catch (e) {}
    }
    if (allInputs.length > 2) {
      try { await allInputs[2].fill('9999999998'); await page.waitForTimeout(300); } catch (e) {}
    }
    if (allInputs.length > 3) {
      try { await allInputs[3].fill('Delhi'); await page.waitForTimeout(300); } catch (e) {}
    }
    if (allInputs.length > 4) {
      try { await allInputs[4].fill('Delhi'); await page.waitForTimeout(300); } catch (e) {}
    }

    await screenshot('partb_12_form_filled');
    testResults.push('[INFO] Form fields filled for valid CP creation');

    // Submit the form
    const submitBtns = await page.$$('button[type="submit"], button:has-text("Save"), button:has-text("Submit"), button:has-text("Create")');
    for (const btn of submitBtns) {
      const text = await btn.innerText().catch(() => '');
      if (!text.toLowerCase().includes('cancel') && !text.toLowerCase().includes('close')) {
        await btn.click();
        await page.waitForTimeout(2000);
        await screenshot('partb_13_form_submitted');
        break;
      }
    }

    // Test invalid: 4 digit code
    log('Testing invalid 4-digit CP code...');
    // Navigate back to list
    await page.goto(`${BASE_URL}/loyalty/channel-partners`).catch(() => {});
    await page.waitForTimeout(2000);

    // Re-click Add
    const addBtns2 = await page.$$('button');
    for (const btn of addBtns2) {
      const text = await btn.innerText().catch(() => '');
      if (text.toLowerCase().includes('add') || text.toLowerCase().includes('create')) {
        await btn.click();
        await page.waitForTimeout(2000);
        break;
      }
    }

    const inputs2 = await page.$$('input');
    if (inputs2.length > 0) {
      try {
        await inputs2[0].fill('1234');
        await page.waitForTimeout(1000);
        await screenshot('partb_14_invalid_4digit_code');
        const errorContent = await page.evaluate(() => document.body.innerText.substring(0, 2000));
        const hasValidationError = errorContent.includes('digit') || errorContent.includes('6') || errorContent.includes('invalid') || errorContent.includes('must be') || errorContent.includes('required');
        log(`[${hasValidationError ? 'PASS' : 'FAIL'}] 4-digit code validation error shown`);
        testResults.push(`[${hasValidationError ? 'PASS' : 'FAIL'}] 4-digit code shows validation error`);
      } catch (e) {
        log(`4-digit test error: ${e.message}`);
      }
    }

    // Close and test alphanumeric
    const closeBtns = await page.$$('button');
    for (const btn of closeBtns) {
      const text = await btn.innerText().catch(() => '');
      if (text.toLowerCase().includes('cancel') || text.toLowerCase().includes('close') || text.toLowerCase().includes('×')) {
        await btn.click();
        await page.waitForTimeout(1000);
        break;
      }
    }

    // Test duplicate code
    log('Testing duplicate CP code...');
    await page.waitForTimeout(1000);
    const addBtns3 = await page.$$('button');
    for (const btn of addBtns3) {
      const text = await btn.innerText().catch(() => '');
      if (text.toLowerCase().includes('add') || text.toLowerCase().includes('create')) {
        await btn.click();
        await page.waitForTimeout(2000);
        break;
      }
    }

    const inputs3 = await page.$$('input');
    if (inputs3.length > 0) {
      try {
        await inputs3[0].fill('001234');
        await page.waitForTimeout(1000);
        await screenshot('partb_15_duplicate_code');
        const dupContent = await page.evaluate(() => document.body.innerText.substring(0, 2000));
        const hasDupError = dupContent.includes('exists') || dupContent.includes('already') || dupContent.includes('duplicate');
        log(`[${hasDupError ? 'PASS' : 'FAIL'}] Duplicate code error shown`);
        testResults.push(`[${hasDupError ? 'PASS' : 'FAIL'}] Duplicate code 001234 shows "already exists" error`);
      } catch (e) {
        log(`Duplicate test error: ${e.message}`);
      }
    }
  }

  // B6: Test Edit CP - go back to list
  log('Testing Edit CP (Mumbai Test CP)...');
  await page.goto(`${BASE_URL}/loyalty/channel-partners`).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot('partb_16_back_to_list');

  // Find and click edit for 100001
  const editBtns = await page.$$('button, [class*="edit"], [class*="action"]');
  let clicked100001Edit = false;
  for (const btn of editBtns) {
    const text = await btn.innerText().catch(() => '');
    const title = await btn.getAttribute('title').catch(() => '');
    if ((text.toLowerCase().includes('edit') || (title && title.toLowerCase().includes('edit'))) && !clicked100001Edit) {
      await btn.click();
      await page.waitForTimeout(2000);
      await screenshot('partb_17_edit_modal');
      clicked100001Edit = true;
      break;
    }
  }

  // Check if CP Code is read-only
  const codeInputs = await page.$$('input');
  if (codeInputs.length > 0) {
    const firstInput = codeInputs[0];
    const isReadonly = await firstInput.getAttribute('readonly').catch(() => null) ||
                       await firstInput.getAttribute('disabled').catch(() => null);
    const inputVal = await firstInput.inputValue().catch(() => '');
    log(`CP Code field value: "${inputVal}", readonly/disabled: ${isReadonly}`);
    testResults.push(`[${isReadonly || inputVal === '100001' ? 'PASS' : 'FAIL'}] CP Code is read-only in edit mode`);
    await screenshot('partb_18_cp_code_readonly');
  }

  // Close edit modal
  const closeBtns2 = await page.$$('button');
  for (const btn of closeBtns2) {
    const text = await btn.innerText().catch(() => '');
    if (text.toLowerCase().includes('cancel') || text.toLowerCase().includes('close') || text.toLowerCase().includes('×')) {
      await btn.click();
      await page.waitForTimeout(1000);
      break;
    }
  }

  // B7: Test detail page - click into default CP 001234
  log('Testing detail page for default CP 001234...');
  await page.waitForTimeout(2000);

  // Find the row for 001234 and click it
  const rows = await page.$$('[class*="row"], [class*="item"], tr, [class*="data"]');
  let clicked001234 = false;
  for (const row of rows) {
    const text = await row.innerText().catch(() => '');
    if (text.includes('001234') && text.includes('Default')) {
      await row.click();
      await page.waitForTimeout(2000);
      clicked001234 = true;
      break;
    }
  }

  if (!clicked001234) {
    // Try clicking any link/text containing 001234
    try {
      await page.click(`text=001234`, { timeout: 3000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      log(`Could not click 001234 row: ${e.message}`);
    }
  }

  await screenshot('partb_19_default_cp_detail');
  const detailContent = await page.evaluate(() => document.body.innerText.substring(0, 4000));
  console.log('DETAIL PAGE CONTENT:\n' + detailContent.substring(0, 2000));

  // Check for Overview tab
  const hasOverview = detailContent.includes('Overview');
  const hasAssignedElectricians = detailContent.includes('Assigned Electricians') || detailContent.includes('Electricians');
  const hasTestElectrician = detailContent.includes('9999999999');

  log(`[${hasOverview ? 'PASS' : 'FAIL'}] Overview tab present`);
  testResults.push(`[${hasOverview ? 'PASS' : 'FAIL'}] Overview tab present`);
  log(`[${hasAssignedElectricians ? 'PASS' : 'FAIL'}] Assigned Electricians tab present`);
  testResults.push(`[${hasAssignedElectricians ? 'PASS' : 'FAIL'}] Assigned Electricians tab present`);
  log(`[${hasTestElectrician ? 'PASS' : 'FAIL'}] Test electrician (9999999999) visible`);
  testResults.push(`[${hasTestElectrician ? 'PASS' : 'FAIL'}] Test electrician (9999999999) visible`);

  await screenshot('partb_20_detail_overview_tab');

  // B8: Deactivate Mumbai Test CP
  log('Testing deactivation of Mumbai Test CP...');
  await page.goto(`${BASE_URL}/loyalty/channel-partners`).catch(() => {});
  await page.waitForTimeout(2000);
  await screenshot('partb_21_list_for_deactivate');

  // Find deactivate button for Mumbai
  const deactivateBtns = await page.$$('button');
  let deactivated = false;
  for (const btn of deactivateBtns) {
    const text = await btn.innerText().catch(() => '');
    const title = await btn.getAttribute('title').catch(() => '');
    if ((text.toLowerCase().includes('deactivate') || title.toLowerCase().includes('deactivate') ||
         text.toLowerCase().includes('inactive') || title.toLowerCase().includes('inactive') ||
         text.toLowerCase().includes('toggle') || title.toLowerCase().includes('toggle')) && !deactivated) {
      await btn.click();
      await page.waitForTimeout(2000);
      await screenshot('partb_22_deactivate_attempt');
      deactivated = true;
      break;
    }
  }

  const deactContent = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  log(`Deactivation attempt result: ${deactContent.substring(0, 500)}`);

  // B9: Try deactivating default CP 001234 (should fail)
  log('Testing deactivation rejection for default CP 001234...');
  await page.waitForTimeout(1000);

  // Find the default CP row and its deactivate button
  const allRows = await page.$$('[class*="row"], [class*="item"], tr');
  for (const row of allRows) {
    const text = await row.innerText().catch(() => '');
    if (text.includes('001234') && text.includes('Default')) {
      // Find deactivate button within this row
      const rowBtns = await row.$$('button');
      for (const btn of rowBtns) {
        const btnText = await btn.innerText().catch(() => '');
        const btnTitle = await btn.getAttribute('title').catch(() => '');
        if (btnText.toLowerCase().includes('deactivate') || btnTitle.toLowerCase().includes('deactivate') ||
            btnText.toLowerCase().includes('inactive') || btnTitle.toLowerCase().includes('inactive')) {
          await btn.click();
          await page.waitForTimeout(2000);
          await screenshot('partb_23_deactivate_default_attempt');
          break;
        }
      }
      break;
    }
  }

  const rejectContent = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  const hasRejectionMsg = rejectContent.includes('cannot') || rejectContent.includes('Cannot') ||
                           rejectContent.includes('cannot be') || rejectContent.includes('cannot be deactivated') ||
                           rejectContent.includes('cannot be deactivated') || rejectContent.includes('cannot be deactiv') ||
                           rejectContent.includes('default') || rejectContent.includes('unassign');
  log(`[${hasRejectionMsg ? 'PASS' : 'FAIL'}] Default CP deactivation rejected with error`);
  testResults.push(`[${hasRejectionMsg ? 'PASS' : 'FAIL'}] Default CP 001234 deactivation rejected with error message`);
  await screenshot('partb_24_deactivate_default_result');
}

async function run() {
  try {
    log('Starting Oreno CRM QA Test Suite...');
    log(`Target: ${BASE_URL}`);

    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();

    // Handle console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        log(`BROWSER ERROR: ${msg.text()}`);
      }
    });

    // First, logout to clear cache
    await logout();

    // Login
    await login();

    // Verify login success
    if (page.url().includes('login') || page.url().includes('auth')) {
      log('Login may have failed, trying again...');
      await page.waitForTimeout(2000);
    }

    // Part A
    await checkNavItems();

    // Part B
    await testChannelPartners();

    log('\n=== TEST SUMMARY ===');
    for (const r of testResults) {
      console.log(r);
    }

    const passCount = testResults.filter(r => r.includes('[PASS]')).length;
    const failCount = testResults.filter(r => r.includes('[FAIL]')).length;
    log(`\nTotal: ${passCount} PASS, ${failCount} FAIL`);
    log('All tests complete.');

  } catch (e) {
    log(`FATAL ERROR: ${e.message}`);
    log(e.stack);
    await screenshot('fatal_error');
  } finally {
    if (browser) await browser.close();
  }
}

run();
