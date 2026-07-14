import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function run() {
    const email = `test_inv_${Date.now()}@testcompany.com`;
    console.log(`Starting E2E Verification with email: ${email}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const screenshotDir = 'C:\\Users\\siinaan\\.gemini\\antigravity-ide\\brain\\eaef9a08-5230-480e-b216-b7f88de4a778\\scratch\\screenshots';
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const logs = [];
    page.on('console', msg => {
        const txt = msg.text();
        logs.push(`[CONSOLE] ${txt}`);
        console.log(`[FRONTEND CONSOLE] ${txt}`);
    });

    try {
        console.log('1. Registering User...');
        await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle2' });
        
        await page.type('input[name="fullName"]', 'E2E Finished Product Tester');
        await page.type('input[name="email"]', email);
        await page.type('input[name="password"]', 'Password123!');
        await page.type('input[name="confirmPassword"]', 'Password123!');
        await page.click('input[name="agree"]');
        await page.click('button[type="submit"]');

        console.log('Waiting for Registration API response and OTP page...');
        await page.waitForSelector('input[name="code"]', { timeout: 15000 });
        await page.screenshot({ path: path.join(screenshotDir, '1_otp_page.png') });

        console.log('2. Fetching OTP from backend watch log...');
        let otpCode = null;
        const logPath = 'C:\\Users\\siinaan\\.gemini\\antigravity-ide\\brain\\eaef9a08-5230-480e-b216-b7f88de4a778\\.system_generated\\tasks\\task-405.log';
        
        for (let attempt = 1; attempt <= 10; attempt++) {
            await new Promise(r => setTimeout(r, 2000));
            if (fs.existsSync(logPath)) {
                const content = fs.readFileSync(logPath, 'utf8');
                const regex = new RegExp(`Generated OTP code '(\\d+)' for email '${email}'`, 'i');
                const match = content.match(regex);
                if (match) {
                    otpCode = match[1];
                    break;
                }
            }
            console.log(`Attempt ${attempt}: OTP not found yet, retrying...`);
        }

        if (!otpCode) {
            throw new Error("Could not retrieve OTP code from watch log.");
        }
        console.log(`Found OTP Code: ${otpCode}`);

        console.log('3. Submitting OTP...');
        await page.type('input[name="code"]', otpCode);
        await page.click('button[type="submit"]');

        console.log('5. Completing Onboarding...');
        await page.waitForSelector('input[name="companyName"]', { timeout: 15000 });
        await page.type('input[name="companyName"]', 'Finished Goods Corp');
        await page.type('input[name="howDidYouHearAboutUs"]', 'Search Engine');
        await page.click('button[type="submit"]');

        console.log('6. Waiting for inventory redirect and background migration to complete (30 seconds)...');
        await new Promise(r => setTimeout(r, 30000));
        await page.goto('http://localhost:5173/company/inventory', { waitUntil: 'networkidle2' });
        console.log('Reloading page to refresh session state...');
        await page.reload({ waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: path.join(screenshotDir, '2_inventory_page.png') });

        console.log('7. Opening Add Product Modal...');
        const clickedAdd = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.includes('Product') || b.textContent.includes('Add Product'));
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        if (!clickedAdd) {
            throw new Error("Add Product button not found or clicked on page.");
        }

        console.log('8. Adding new product with opening stock...');
        await page.waitForSelector('input[placeholder*="Aquora Premium"]', { timeout: 5000 });
        await page.type('input[placeholder*="Aquora Premium"]', 'E2E Mineral Water 500ml');
        
        await page.evaluate(() => {
            const selects = document.querySelectorAll('select');
            const brandSelect = selects[0];
            if (brandSelect && brandSelect.options.length > 1) {
                brandSelect.selectedIndex = 1;
                brandSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await page.type('input[placeholder="E.g., AQ-500ML"]', 'MW-500ML');
        
        const openingStockInput = await page.evaluateHandle(() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            return inputs.find(i => i.previousElementSibling && i.previousElementSibling.textContent.includes('Opening Stock'));
        });
        if (openingStockInput) {
            await openingStockInput.type('150');
        } else {
            throw new Error("Opening stock input field not found.");
        }

        await page.screenshot({ path: path.join(screenshotDir, '3_filled_add_product_modal.png') });

        const clickedSave = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.includes('Add Product') && b.type === 'submit');
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        if (!clickedSave) {
            throw new Error("Save Product button not found or clicked.");
        }

        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: path.join(screenshotDir, '4_after_adding_product.png') });

        console.log('9. Checking current stock value...');
        const currentStockVal = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tbody tr'));
            const testRow = rows.find(r => r.textContent.includes('E2E Mineral Water 500ml'));
            return testRow ? testRow.textContent : null;
        });
        console.log(`Main Table Row: ${currentStockVal}`);
        if (!currentStockVal || !currentStockVal.includes('150') || !currentStockVal.includes('Cases')) {
            throw new Error("Current stock was not updated to 150 Cases or is missing Cases unit!");
        }
        console.log("Success: Current stock is 150 Cases.");

        console.log('10. Expanding Movement History...');
        const clickedExpand = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tbody tr'));
            const testRow = rows.find(r => r.textContent.includes('E2E Mineral Water 500ml'));
            const btn = testRow ? testRow.querySelector('button') : null;
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        if (!clickedExpand) {
            throw new Error("Movements toggle button not found or clicked.");
        }

        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: path.join(screenshotDir, '5_movements_expanded.png') });

        console.log('11. Verifying Opening Stock Movement...');
        const movementHtml = await page.evaluate(() => {
            return document.querySelector('tbody')?.parentElement?.outerHTML;
        });
        
        if (!movementHtml.includes('Opening Stock') || !movementHtml.includes('+150 Cases')) {
            throw new Error("Opening stock movement is missing in movements history!");
        }
        console.log("Success: Opening Stock movement is audited with +150 Cases!");

        console.log('12. Editing product stock correction...');
        const clickedEdit = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tbody tr'));
            const testRow = rows.find(r => r.textContent.includes('E2E Mineral Water 500ml'));
            const btn = testRow ? testRow.querySelector('button[title="Edit"]') : null;
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        if (!clickedEdit) {
            throw new Error("Edit product button not found or clicked.");
        }

        await page.waitForSelector('input[value="E2E Mineral Water 500ml"]', { timeout: 5000 });
        
        const currentStockInput = await page.evaluateHandle(() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            return inputs.find(i => i.previousElementSibling && i.previousElementSibling.textContent.includes('Current Stock'));
        });
        if (currentStockInput) {
            await currentStockInput.click({ clickCount: 3 });
            await currentStockInput.press('Backspace');
            await currentStockInput.type('180');
        } else {
            throw new Error("Current stock input in edit modal not found.");
        }

        await page.screenshot({ path: path.join(screenshotDir, '6_filled_edit_product_modal.png') });

        const clickedSaveChanges = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.includes('Save Changes') && b.type === 'submit');
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        if (!clickedSaveChanges) {
            throw new Error("Save Changes button not found or clicked.");
        }

        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: path.join(screenshotDir, '7_after_edit_product.png') });

        console.log('13. Verifying updated stock and Stock Corrected Movement...');
        // Toggle view
        const clickedToggle = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tbody tr'));
            const testRow = rows.find(r => r.textContent.includes('E2E Mineral Water 500ml'));
            const btn = testRow ? testRow.querySelector('button') : null;
            if (btn) {
                btn.click(); // Hide
                return true;
            }
            return false;
        });
        if (!clickedToggle) {
            throw new Error("Toggle view button to hide not found.");
        }
        await new Promise(r => setTimeout(r, 500));
        
        const clickedToggleShow = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tbody tr'));
            const testRow = rows.find(r => r.textContent.includes('E2E Mineral Water 500ml'));
            const btn = testRow ? testRow.querySelector('button') : null;
            if (btn) {
                btn.click(); // Show
                return true;
            }
            return false;
        });
        if (!clickedToggleShow) {
            throw new Error("Toggle view button to show not found.");
        }

        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: path.join(screenshotDir, '8_movements_after_correction.png') });

        const updatedMovementHtml = await page.evaluate(() => {
            return document.querySelector('tbody')?.parentElement?.outerHTML;
        });

        if (!updatedMovementHtml.includes('Stock Corrected') || !updatedMovementHtml.includes('+30 Cases') || !updatedMovementHtml.includes('180 Cases')) {
            throw new Error("Manual Stock Corrected movement (diff +30, balance 180 Cases) not found in movements history!");
        }
        console.log("Success: Manual Stock Correction is successfully logged and verified!");

        console.log('=== END-TO-END VERIFICATION PASSED ===');
        fs.writeFileSync('C:\\Users\\siinaan\\.gemini\\antigravity-ide\\brain\\eaef9a08-5230-480e-b216-b7f88de4a778\\verification_status.txt', 'PASSED');

    } catch (err) {
        console.error("Verification failed:", err);
        fs.writeFileSync('C:\\Users\\siinaan\\.gemini\\antigravity-ide\\brain\\eaef9a08-5230-480e-b216-b7f88de4a778\\verification_status.txt', `FAILED: ${err.message}`);
    } finally {
        await browser.close();
    }
}

run();
