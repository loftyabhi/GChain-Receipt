// fetch is global in Node 18+
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL || 'https://chainreceipt.vercel.app'; // Default to prod, override for localhost
const COLORS = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

let passCount = 0;
let failCount = 0;

function log(status, message) {
    if (status === 'PASS') {
        console.log(`${COLORS.green}[PASS]${COLORS.reset} ${message}`);
        passCount++;
    } else if (status === 'FAIL') {
        console.error(`${COLORS.red}[FAIL]${COLORS.reset} ${message}`);
        failCount++;
    } else {
        console.log(`${COLORS.blue}[INFO]${COLORS.reset} ${message}`);
    }
}

async function verifyUrl(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    try {
        const res = await fetch(url, { redirect: 'manual', headers: options.headers });
        return res;
    } catch (error) {
        log('FAIL', `Network error for ${path}: ${error.message}`);
        return null;
    }
}

async function verifyRedirect(name, path, expectedTarget, expectedStatus = 308) {
    console.log(`\nTesting Redirect: ${name}`);
    const res = await verifyUrl(path);
    if (!res) return;

    if (res.status === expectedStatus || res.status === 301 || res.status === 307 || res.status === 302) { // Accept various redirect codes
        const location = res.headers.get('location');
        // Normalize locations for comparison (handle absolute vs relative if needed, usually absolute)
        const targetUrl = expectedTarget.startsWith('http') ? expectedTarget : `${BASE_URL}${expectedTarget}`;

        // Check if location matches expected target
        // We allow location to be full URL
        if (location === targetUrl || location === expectedTarget) {
            log('PASS', `${path} redirected to ${location}`);
        } else {
            log('FAIL', `${path} redirected to ${location}, expected ${targetUrl}`);
        }
    } else {
        log('FAIL', `${path} returned ${res.status}, expected redirect`);
    }
}

async function verifyPageCore(path, checks = {}) {
    console.log(`\nVerifying Page: ${path}`);
    const res = await verifyUrl(path, { headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' } }); // Mimic Googlebot
    if (!res) return;

    // 1. HTTP Status
    if (res.status === 200) {
        log('PASS', `HTTP 200 OK`);
    } else {
        log('FAIL', `HTTP Status ${res.status}`);
        return; // Stop content checks if failed
    }

    // 2. Canonical
    const html = await res.text();
    const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/);
    if (canonicalMatch) {
        const canonical = canonicalMatch[1];
        // Check for query params
        if (canonical.includes('?')) {
            log('FAIL', `Canonical contains query params: ${canonical}`);
        } else if (canonical.match(/[A-Z]/)) {
            // Technically canonical should be lowercase if we enforce it, but sometimes domain is mixed? 
            // Our middleware enforces lowercase path, constructCanonical enforces lowercase.
            // Let's strict check path part.
            const urlObj = new URL(canonical);
            if (urlObj.pathname !== urlObj.pathname.toLowerCase()) {
                log('FAIL', `Canonical path is not lowercase: ${canonical}`);
            } else {
                log('PASS', `Canonical Valid: ${canonical}`);
            }
        } else {
            log('PASS', `Canonical Valid: ${canonical}`);
        }
    } else if (checks.requireCanonical !== false) {
        log('FAIL', `Canonical tag missing`);
    }

    // 3. Schema
    if (checks.schemas) {
        checks.schemas.forEach(schemaType => {
            // Regex to find JSON-LD blocks and check for @type
            // Simple check: look for "@type": "SchemaType" or "@type":"SchemaType" inside script tags
            // This is approximate but robust enough for verification without DOM parsing
            const mapping = {
                'Organization': /"context":\s*"https?:\/\/schema\.org",\s*"type":\s*"Organization"/, // Simplified regex
                'WebSite': /"type":\s*"WebSite"/,
                'BreadcrumbList': /"type":\s*"BreadcrumbList"/,
                'FAQPage': /"type":\s*"FAQPage"|{"@type":"Question"/,
            };
            // Better regex strategy: Capture all ld+json blocks and string search
            const ldBlocks = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
            let found = false;
            for (const block of ldBlocks) {
                if (block[1].includes(`"Organization"`) && schemaType === 'Organization') found = true;
                if (block[1].includes(`"WebSite"`) && schemaType === 'WebSite') found = true;
                if (block[1].includes(`"BreadcrumbList"`) && schemaType === 'BreadcrumbList') found = true; // Approx
                if (block[1].includes(`"FAQPage"`) && schemaType === 'FAQPage') found = true;

                // Also validate JSON validity
                try {
                    JSON.parse(block[1]);
                } catch (e) {
                    log('FAIL', `Invalid JSON-LD block found`);
                }
                if (found) break;
            }

            if (found) {
                log('PASS', `Schema found: ${schemaType}`);
            } else {
                log('FAIL', `Schema missing: ${schemaType}`);
            }
        });
    }

    // 4. Noindex check
    if (checks.expectNoindex) {
        const metaRobots = html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i);
        const headerRobots = res.headers.get('x-robots-tag');

        const hasMetaNoindex = metaRobots && metaRobots[1].toLowerCase().includes('noindex');
        const hasHeaderNoindex = headerRobots && headerRobots.toLowerCase().includes('noindex');

        if (hasMetaNoindex || hasHeaderNoindex) {
            log('PASS', `Noindex directive found`);
        } else {
            log('FAIL', `Noindex missing for ${path}`);
        }
    }

    // 5. Title duplication check (sanity)
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
        const title = titleMatch[1];
        const count = (title.match(/\| Chain Receipt/g) || []).length;
        if (count > 1) {
            log('FAIL', `Title duplication detected: ${title}`);
        } else {
            log('PASS', `Title Clean: ${title}`);
        }
    }
}

async function main() {
    console.log(`Starting SEO Verification against: ${COLORS.blue}${BASE_URL}${COLORS.reset}\n`);

    // --- 1. Bot Files ---
    console.log(`--- Bot Files ---`);

    // Robots.txt
    const robotsRes = await verifyUrl('/robots.txt');
    if (robotsRes && robotsRes.status === 200) {
        log('PASS', '/robots.txt 200 OK');
        // Headers
        if (robotsRes.headers.get('content-type').includes('text/plain')) {
            log('PASS', 'robots.txt content-type is text/plain');
        } else {
            log('FAIL', `robots.txt content-type: ${robotsRes.headers.get('content-type')}`);
        }
        // Content
        const text = await robotsRes.text();
        if (text.includes('sitemap.xml')) {
            log('PASS', 'robots.txt contains sitemap link');
        } else {
            log('FAIL', 'robots.txt missing sitemap link');
        }
    } else {
        log('FAIL', `/robots.txt returned ${robotsRes ? robotsRes.status : 'Error'}`);
    }

    // Sitemap.xml (managed by Next.js metadata route usually)
    // Note: App Router /sitemap.ts outputs to /sitemap.xml
    const sitemapRes = await verifyUrl('/sitemap.xml');
    if (sitemapRes && sitemapRes.status === 200) {
        log('PASS', '/sitemap.xml 200 OK');
        if (sitemapRes.headers.get('content-type').includes('application/xml') || sitemapRes.headers.get('content-type').includes('text/xml')) {
            log('PASS', 'sitemap.xml content-type is xml');
        } else {
            log('FAIL', `sitemap.xml content-type: ${sitemapRes.headers.get('content-type')}`);
        }
        if (sitemapRes.headers.get('x-robots-tag')?.includes('noindex')) {
            log('FAIL', 'sitemap.xml blocked by x-robots-tag');
        } else {
            log('PASS', 'sitemap.xml indexable');
        }
    } else {
        log('FAIL', `/sitemap.xml returned ${sitemapRes ? sitemapRes.status : 'Error'}`);
    }

    // --- 2. Middleware Behavior ---
    console.log(`\n--- Middleware ---`);

    await verifyRedirect('Uppercase Force Lower', '/Features', '/features');
    await verifyRedirect('Trailing Slash Removal', '/features/', '/features');

    // UTM Stripping
    // Note: if logic strips params, it redirects to clean URL
    await verifyRedirect('UTM Param Stripping', '/features?utm_source=twitter', '/features');
    await verifyRedirect('Ref Param Stripping', '/features?ref=producthunt', '/features');


    // --- 3. Core Pages SEO ---
    const pages = [
        { path: '/', schemas: ['Organization', 'WebSite'] },
        { path: '/features', schemas: ['BreadcrumbList', 'FAQPage'] },
        { path: '/learn', schemas: ['BreadcrumbList'] },
        { path: '/transaction-intelligence', schemas: ['BreadcrumbList', 'FAQPage'] },
        { path: '/how-to-read-blockchain-transaction', schemas: ['BreadcrumbList', 'FAQPage'] },
        { path: '/privacy-policy', schemas: ['BreadcrumbList'] },
        { path: '/terms-of-service', schemas: ['BreadcrumbList'] },
        { path: '/disclaimer', schemas: ['BreadcrumbList'] },
    ];

    for (const p of pages) {
        await verifyPageCore(p.path, { schemas: p.schemas });
    }

    // --- 4. Transaction Noindex ---
    console.log(`\n--- Indexing Control ---`);
    // Dummy TX
    await verifyPageCore('/tx/base/0x1111111111111111111111111111111111111111111111111111111111111111', { expectNoindex: true, requireCanonical: false });


    // --- Summary ---
    console.log(`\n--- Summary ---`);
    console.log(`${COLORS.green}PASS: ${passCount}${COLORS.reset}`);
    console.log(`${COLORS.red}FAIL: ${failCount}${COLORS.reset}`);

    if (failCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
