import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import fs from 'fs';

function decodeJwt(token) {
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch(e) {
        return { error: e.message };
    }
}

async function getBackendLogs() {
    try {
        return execSync('docker logs aquora-backend --tail 50').toString();
    } catch (e) {
        return `Failed to fetch backend logs: ${e.message}`;
    }
}

async function logState(stepName, page) {
    const url = page.url();
    const state = await page.evaluate(() => {
        return {
            token: localStorage.getItem('token'),
            refreshToken: localStorage.getItem('refreshToken'),
            user: localStorage.getItem('user')
        };
    });

    const decodedToken = decodeJwt(state.token);
    const backendLogs = await getBackendLogs();

    // Filter relevant backend logs
    const relevantLogs = backendLogs.split('\n').filter(line => 
        line.includes('[USER REGISTRATION]') ||
        line.includes('[TENANT CREATION]') ||
        line.includes('[ROLE SEEDING]') ||
        line.includes('[USERROLE ASSIGNMENT]') ||
        line.includes('[JWT CLAIMS GENERATED]') ||
        line.includes('[AUTHORIZATION DECISION]') ||
        line.includes('[REDIRECT DECISION]')
    ).join('\n');

    console.log(`\n==================================================`);
    console.log(`DIAGNOSTIC STEP: ${stepName}`);
    console.log(`--------------------------------------------------`);
    console.log(`Current URL: ${url}`);
    console.log(`Access Token: ${state.token ? state.token.substring(0, 30) + '...' : 'null'}`);
    console.log(`Decoded JWT Role Claims: ${decodedToken ? JSON.stringify(decodedToken.role || decodedToken['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']) : 'null'}`);
    console.log(`Zustand / Auth Store User State: ${state.user}`);
    console.log(`Backend Authorization/DB Logs:\n${relevantLogs}`);
    console.log(`==================================================\n`);

    // Check for access-denied
    if (url.includes('access-denied')) {
        console.error(`🚨 DETECTED ACCESS DENIED AT STEP: ${stepName}! Stopping E2E test execution.`);
        process.exit(1);
    }
}

async function run() {
    const email = `diagnostic_${Date.now()}@testcompany.com`;
    console.log(`Starting E2E Diagnostic flow with email: ${email}`);

    let browser = await puppeteer.launch({ headless: true });
    let page = await browser.newPage();

    let consoleLogs = [];
    page.on('console', msg => {
        const txt = msg.text();
        if (txt.includes('REDIRECT DECISION') || txt.includes('access-denied') || txt.includes('auth')) {
            consoleLogs.push(`[FRONTEND CONSOLE] ${txt}`);
            console.log(`[FRONTEND CONSOLE] ${txt}`);
        }
    });

    try {
        console.log('\n--- 1. REGISTER ---');
        await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle2' });
        await page.type('input[name="fullName"]', 'Diagnostic Tester');
        await page.type('input[name="email"]', email);
        await page.type('input[name="password"]', 'Password123!');
        await page.type('input[name="confirmPassword"]', 'Password123!');
        await page.click('input[name="agree"]');
        await page.click('button[type="submit"]');

        console.log('Waiting for verify-otp page...');
        await page.waitForSelector('input[name="code"]', { timeout: 15000 });
        await logState('After Registration Submit', page);

        console.log('\n--- 2. GET & ENTER OTP ---');
        await new Promise(r => setTimeout(r, 2000)); // wait for log sync
        const dockerLogs = execSync('docker logs aquora-backend --tail 50').toString();
        const otpMatch = dockerLogs.match(new RegExp(`Generated OTP code '(\\d+)' for email '${email}'`, 'i'));
        if (!otpMatch) {
            throw new Error("Could not find OTP in backend logs.");
        }
        const otpCode = otpMatch[1];
        console.log(`Retrieved OTP Code: ${otpCode}`);

        await page.type('input[name="code"]', otpCode);
        await page.click('button[type="submit"]');

        console.log('Waiting for login page...');
        await page.waitForSelector('input[name="password"]', { timeout: 15000 });
        await logState('After OTP Verification', page);

        console.log('\n--- 3. LOGIN ---');
        // Wait a bit for preserving state transition
        await new Promise(r => setTimeout(r, 1000));
        await page.evaluate(() => document.querySelector('input[name="email"]').value = '');
        await page.type('input[name="email"]', email);
        await page.type('input[name="password"]', 'Password123!');
        await page.click('button[type="submit"]');

        console.log('Waiting for onboarding page...');
        await page.waitForSelector('input[name="companyName"]', { timeout: 15000 });
        await logState('After Login (Prior to Onboarding)', page);

        console.log('\n--- 4. ONBOARDING ---');
        await page.type('input[name="companyName"]', 'Diagnostic LLC');
        await page.type('input[name="howDidYouHearAboutUs"]', 'E2E Script');
        await page.click('button[type="submit"]');

        console.log('Waiting for Dashboard or invite-team redirect...');
        await page.waitForFunction("window.location.pathname.includes('dashboard') || window.location.pathname.includes('invite-team')", { timeout: 60000 });
        await logState('After Onboarding Success', page);

        console.log('\n--- 5. REFRESH PAGE ---');
        await page.reload({ waitUntil: 'networkidle2' });
        await logState('After Page Refresh', page);

        console.log('\n--- 6. SIMULATE BROWSER RESTART ---');
        // Extract localStorage state to transfer
        const localStorageState = await page.evaluate(() => {
            return {
                token: localStorage.getItem('token'),
                refreshToken: localStorage.getItem('refreshToken'),
                user: localStorage.getItem('user'),
                tenantCode: localStorage.getItem('tenantCode')
            };
        });

        // Close current browser
        await browser.close();

        // Launch a new browser session (clean slate)
        browser = await puppeteer.launch({ headless: true });
        page = await browser.newPage();
        page.on('console', msg => {
            const txt = msg.text();
            if (txt.includes('REDIRECT DECISION') || txt.includes('access-denied') || txt.includes('auth')) {
                console.log(`[NEW SESSION FRONTEND CONSOLE] ${txt}`);
            }
        });

        // Navigate to base route, apply saved localStorage, and navigate to dashboard
        await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
        await page.evaluate((state) => {
            localStorage.setItem('token', state.token);
            localStorage.setItem('refreshToken', state.refreshToken);
            localStorage.setItem('user', state.user);
            localStorage.setItem('tenantCode', state.tenantCode);
        }, localStorageState);

        console.log('Navigating to dashboard with restored credentials...');
        await page.goto('http://localhost:5173/company/dashboard', { waitUntil: 'networkidle2' });
        await logState('After Browser Reopen / Restore State', page);

        console.log('\n--- 7. LOGOUT & LOGIN AGAIN ---');
        // Clear local storage and go to login page
        await page.evaluate(() => localStorage.clear());
        await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
        
        await page.type('input[name="email"]', email);
        await page.type('input[name="password"]', 'Password123!');
        await page.click('button[type="submit"]');

        console.log('Waiting for re-login dashboard redirect...');
        await page.waitForFunction("window.location.pathname.includes('dashboard')", { timeout: 30000 });
        await logState('After Re-login', page);

        console.log('🎉 E2E DIAGNOSTIC FLOW COMPLETED SUCCESSFULLY!');
    } catch(err) {
        console.error("Diagnostic execution error:", err);
    } finally {
        await browser.close();
    }
}

run();
