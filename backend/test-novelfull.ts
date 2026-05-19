/**
 * Semi-automated novelfull crawler.
 * Opens browser → YOU solve Cloudflare manually → script crawls chapters.
 *
 * Run: npx ts-node test-novelfull.ts
 */
import { chromium } from 'playwright';

var CHAPTERS_TO_TEST = [2297];

async function main() {
  console.log('=== Novelfull Semi-Automated Crawler ===');
  console.log('Browser will open. YOU need to:');
  console.log('1. Wait for Cloudflare challenge page');
  console.log('2. Complete the verification (click checkbox if needed)');
  console.log('3. Once the page loads, the script will take over');
  console.log('');

  var browser = await chromium.launch({ headless: false });
  browser.contexts().forEach(function(c) { c.setDefaultTimeout(180000); });
  var context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });
  context.setDefaultTimeout(180000);
  var page = await context.newPage();

  try {
    // Step 1: Go to novelfull — user solves Cloudflare
    console.log('Opening novelfull.net...');
    await page.goto('https://novelfull.net/shadow-slave.html', {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });

    // Wait for Cloudflare to be solved (title changes from "Just a moment...")
    console.log('');
    console.log('>>> BROWSER IS OPEN. Go to the browser window and solve the Cloudflare check! <<<');
    console.log('>>> You have 3 minutes. <<<');
    console.log('');
    // Poll until Cloudflare is solved (waitForFunction timeout doesn't work reliably)
    for (var i = 0; i < 60; i++) {
      var pageTitle = await page.title();
      if (!pageTitle.includes('Just a moment')) break;
      if (i % 5 === 0) console.log('Still waiting... (' + (i * 3) + 's)');
      await page.waitForTimeout(3000);
    }
    console.log('Cloudflare passed! Title: ' + await page.title());
    await page.waitForTimeout(2000);

    // Step 2: Inspect the page structure
    console.log('\n=== Inspecting page structure ===');
    var pageInfo = await page.evaluate(function() {
      // Find chapter links
      var links = document.querySelectorAll('a[href*="/shadow-slave/chapter-"]');
      var samples = Array.from(links).slice(0, 5).map(function(l) {
        return { href: l.getAttribute('href'), text: l.textContent?.trim().substring(0, 60) };
      });

      // Find pagination
      var pagination = document.querySelectorAll('.pagination a, nav a, .page-item a');
      var pages = Array.from(pagination).map(function(l) {
        return { href: l.getAttribute('href'), text: l.textContent?.trim() };
      });

      // Check last page
      var lastPage = 1;
      pages.forEach(function(p) {
        var m = p.href?.match(/page=(\d+)/);
        if (m) lastPage = Math.max(lastPage, parseInt(m[1]));
      });

      return {
        title: document.title,
        chapterLinks: links.length,
        samples: samples,
        paginationLinks: pages.length,
        lastPage: lastPage,
        pagesSample: pages.slice(-5),
      };
    });

    console.log('Title: ' + pageInfo.title);
    console.log('Chapter links found: ' + pageInfo.chapterLinks);
    console.log('Sample links:');
    pageInfo.samples.forEach(function(l: any) { console.log('  ' + l.href + ' => ' + l.text); });
    console.log('Pagination: ' + pageInfo.paginationLinks + ' links, last page: ' + pageInfo.lastPage);
    console.log('Last pagination links:');
    pageInfo.pagesSample.forEach(function(l: any) { console.log('  ' + l.href + ' => ' + l.text); });

    // Step 3: Try to find and crawl chapter 2297
    for (var chapterNumber of CHAPTERS_TO_TEST) {
      console.log('\n=== Crawling chapter ' + chapterNumber + ' ===');

      // Find which page has this chapter
      var chaptersPerPage = pageInfo.chapterLinks || 50;
      var estimatedPage = Math.ceil(chapterNumber / chaptersPerPage);
      console.log('Estimated page: ' + estimatedPage);

      // Navigate to that page
      var listUrl = 'https://novelfull.net/shadow-slave.html?page=' + estimatedPage;
      console.log('Loading: ' + listUrl);
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      // Check if Cloudflare appeared again
      var title = await page.title();
      if (title.includes('Just a moment')) {
        console.log('Cloudflare appeared again — waiting for you...');
        await page.waitForFunction(
          function() { return !document.title.includes('Just a moment'); },
          { timeout: 120000 },
        );
        await page.waitForTimeout(2000);
      }

      // Find chapter link
      var pattern = 'chapter-' + chapterNumber + '-';
      var chapterUrl = await page.evaluate(function(pat: string) {
        var links = document.querySelectorAll('a[href*="' + pat + '"]');
        if (links.length > 0) {
          var href = links[0].getAttribute('href') || '';
          return href.startsWith('http') ? href : 'https://novelfull.net' + href;
        }

        // Show what chapters ARE on this page
        var allLinks = document.querySelectorAll('a[href*="/shadow-slave/chapter-"]');
        var nums: number[] = [];
        allLinks.forEach(function(l) {
          var m = l.getAttribute('href')?.match(/chapter-(\d+)/);
          if (m) nums.push(parseInt(m[1]));
        });
        nums.sort(function(a, b) { return a - b; });
        if (nums.length > 0) {
          console.log('Chapters on page: ' + nums[0] + '-' + nums[nums.length - 1]);
        }
        return null;
      }, pattern);

      if (!chapterUrl) {
        console.log('Chapter ' + chapterNumber + ' not found on page ' + estimatedPage);
        // Try nearby pages
        for (var tryPage = estimatedPage - 1; tryPage <= estimatedPage + 1; tryPage++) {
          if (tryPage < 1 || tryPage === estimatedPage) continue;
          console.log('Trying page ' + tryPage + '...');
          await page.goto('https://novelfull.net/shadow-slave.html?page=' + tryPage, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForTimeout(3000);
          if ((await page.title()).includes('Just a moment')) {
            console.log('Cloudflare — waiting...');
            await page.waitForFunction(function() { return !document.title.includes('Just a moment'); }, { timeout: 120000 });
            await page.waitForTimeout(2000);
          }
          chapterUrl = await page.evaluate(function(pat: string) {
            var links = document.querySelectorAll('a[href*="' + pat + '"]');
            if (links.length > 0) {
              var href = links[0].getAttribute('href') || '';
              return href.startsWith('http') ? href : 'https://novelfull.net' + href;
            }
            return null;
          }, pattern);
          if (chapterUrl) break;
        }
      }

      if (!chapterUrl) {
        console.log('FAILED: Could not find chapter ' + chapterNumber);
        continue;
      }

      console.log('Found: ' + chapterUrl);

      // Navigate to chapter
      await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);
      if ((await page.title()).includes('Just a moment')) {
        console.log('Cloudflare — waiting...');
        await page.waitForFunction(function() { return !document.title.includes('Just a moment'); }, { timeout: 120000 });
        await page.waitForTimeout(2000);
      }

      // Extract content
      var result = await page.evaluate(function() {
        var titleEl = document.querySelector('.chapter-title, h2, .chr-title, h1, a.chapter-title');
        var rawTitle = titleEl ? titleEl.textContent?.trim() : document.title;

        var contentEl = document.querySelector('#chapter-content, #chapter-c, .chapter-c') as HTMLElement;
        if (!contentEl) {
          // Debug: what elements exist?
          var all = Array.from(document.querySelectorAll('[id*="chapter"], [class*="chapter"]')).map(function(el) {
            return el.tagName + '#' + el.id + '.' + el.className?.toString().substring(0, 40) + ' len=' + (el.textContent?.length || 0);
          });
          return { title: rawTitle || '', paragraphs: [] as string[], debug: 'No content element. Found: ' + all.join('; ') };
        }

        contentEl.querySelectorAll('script, style, ins, iframe, .ads').forEach(function(s) { s.remove(); });

        var paragraphs = contentEl.innerText
          .split('\n')
          .map(function(l) { return l.trim(); })
          .filter(function(l) { return l.length > 0; })
          .filter(function(p) {
            if (/^window\.\w+/.test(p)) return false;
            if (/advertisement/i.test(p)) return false;
            if (/pubfuturetag/.test(p)) return false;
            return true;
          });

        return { title: rawTitle || '', paragraphs: paragraphs, debug: 'ok' };
      });

      // Clean title
      var cleanTitle = result.title;
      var titleMatch = result.title.match(/chapter[\s-]*\d+[\s:.\-–—]*(.*)/i);
      if (titleMatch && titleMatch[1]) cleanTitle = titleMatch[1].trim();

      console.log('Title: ' + cleanTitle);
      console.log('Paragraphs: ' + result.paragraphs.length);
      console.log('Debug: ' + result.debug);
      if (result.paragraphs.length > 0) {
        console.log('First paragraph: ' + result.paragraphs[0].substring(0, 100));
        console.log('Content length: ' + result.paragraphs.join('\n\n').length + ' chars');
        console.log('SUCCESS!');
      } else {
        console.log('FAILED: No content');
        await page.screenshot({ path: '/tmp/novelfull-ch' + chapterNumber + '.png' });
      }
    }
  } catch(e) {
    console.error('ERROR:', e);
    await page.screenshot({ path: '/tmp/novelfull-error.png' });
  } finally {
    await browser.close();
  }
}

main();
