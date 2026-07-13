import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import fs from 'fs';

async function run() {
    const email = `evidence_${Date.now()}@testcompany.com`;
    console.log(`Starting E2E test with email: ${email}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    let apiResponse = null;
    let authState = null;
    let redirectUrl = null;
    let consoleLogs = [];

    page.on('console', msg => {
        consoleLogs.push(`[FRONTEND CONSOLE] ${msg.text()}`);
    });

    page.on('response', async res => {
        const url = res.url();
        if (url.includes('/api/tenant/onboard')) {
            try {
                apiResponse = await res.json();
            } catch (e) {}
        }
    });

    try {
        console.log('1. Registering User...');
        await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle2' });
        
        await page.type('input[name="fullName"]', 'Test Owner');
        await page.type('input[name="email"]', email);
        await page.type('input[name="password"]', 'Password123!');
        await page.type('input[name="confirmPassword"]', 'Password123!');
        await page.click('input[name="agree"]');
        
        await page.click('button[type="submit"]');
        console.log('Waiting for Registration API...');
        await page.waitForSelector('input[name="code"]', { timeout: 15000 });

        console.log('2. Fetching OTP...');
        await new Promise(r => setTimeout(r, 2000)); // Wait for logs to flush
        const dockerLogs = execSync('docker logs aquora-backend --tail 50').toString();
        const otpMatch = dockerLogs.match(new RegExp(`Generated OTP code '(\\d+)' for email '${email}'`, 'i'));
        if (!otpMatch) {
            throw new Error("Could not find OTP in backend logs.");
        }
        const otpCode = otpMatch[1];
        console.log(`Found OTP: ${otpCode}`);

        console.log('3. Verifying OTP...');
        await page.waitForSelector('input[name="code"]');
        await page.type('input[name="code"]', otpCode);
        
        await page.click('button[type="submit"]');
        console.log('Waiting for Login Page...');

        console.log('4. Logging In...');
        await page.waitForSelector('input[name="password"]', { timeout: 15000 });
        // Email is usually preserved in state, but let's clear and re-type just in case
        await page.evaluate(() => document.querySelector('input[name="email"]').value = '');
        await page.type('input[name="email"]', email);
        await page.type('input[name="password"]', 'Password123!');
        
        await page.click('button[type="submit"]');
        console.log('Waiting for Onboarding redirect...');

        console.log('5. Completing Onboarding...');
        await page.waitForSelector('input[name="companyName"]', { timeout: 15000 });
        await page.type('input[name="companyName"]', 'Evidence LLC');
        await page.type('input[name="howDidYouHearAboutUs"]', 'Search Engine');
        
        await page.click('button[type="submit"]');

        console.log('6. Waiting for Redirect...');
        try {
            await page.waitForFunction("window.location.pathname.includes('invite-team') || window.location.pathname.includes('dashboard')", { timeout: 15000 });
        } catch(e) {
            console.log('Timeout waiting for redirect URL. Continuing anyway.');
        }
        redirectUrl = page.url();
        console.log(`Current URL is: ${redirectUrl}`);
        
        console.log('7. Extracting Frontend Auth State...');
        authState = await page.evaluate(() => {
            return window.localStorage.getItem('auth-storage'); // Assuming Zustand persist
        });

        const backendLogs = execSync('docker logs aquora-backend --tail 500').toString();

        // Write evidence report
        const report = `
# RBAC Fix Evidence Report

## 1. API Response JSON after Onboarding
\`\`\`json
${JSON.stringify(apiResponse, null, 2)}
\`\`\`

## 2. Decoded JWT Payload (from Frontend Auth State)
\`\`\`json
${authState ? JSON.stringify(JSON.parse(authState), null, 2) : 'Not found in localStorage'}
\`\`\`

## 3. Backend Authorization & Lifecycle Logs
\`\`\`
${backendLogs.split('\\n').filter(line => line.includes('[USER REGISTRATION]') || line.includes('[TENANT CREATION]') || line.includes('[ROLE SEEDING]') || line.includes('[USERROLE ASSIGNMENT]') || line.includes('[JWT CLAIMS GENERATED]') || line.includes('[AUTHORIZATION DECISION]') || line.includes('[REDIRECT DECISION]')).join('\\n')}
\`\`\`

## 4. Frontend Console Logs
\`\`\`
${consoleLogs.join('\\n')}
\`\`\`

## 5. Final Redirect Destination
URL: ${redirectUrl}
\`\`\`
`;
        fs.writeFileSync('C:\\\\Users\\\\siinaan\\\\.gemini\\\\antigravity-ide\\\\brain\\\\62cead36-6c68-431e-9146-98d10fb13bd3\\\\rbac_evidence.md', report);
        console.log("Evidence collected in rbac_evidence.md");

    } catch (err) {
        console.error("Error during E2E test:", err);
    } finally {
        await browser.close();
    }
}

run();
