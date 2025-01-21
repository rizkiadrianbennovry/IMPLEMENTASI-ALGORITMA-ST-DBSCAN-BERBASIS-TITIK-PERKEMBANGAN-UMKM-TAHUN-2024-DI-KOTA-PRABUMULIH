const puppeteer = require("puppeteer");
const fs = require('fs');

const defaultDelay = 1000;
const debugBool = true;
const debug = {
    log: (...strings) => debugBool && console.log(strings.join(" ")),
};

async function getPageData(url, page, category) {
    try {
        await page.goto(url, { waitUntil: 'networkidle0' });
    } catch (e) {
        console.error(`Error navigating to ${url}: ${e}`);
        return null;
    }

    try {
        await page.waitForSelector('[role="main"]', { timeout: 10000 });
    } catch (e) {
        console.error(`Error waiting for main element on ${url}: ${e}`);
        return null;
    }

    let scrapedData = {};

    switch (category.toLowerCase()) {
        case "cafe":
            scrapedData = {
                name: (await page.$eval('[role="main"]', (element) => element.getAttribute("aria-label"))) || "No cafe name provided",
                address: (await page.$eval('button[data-item-id="address"]', (element) => element.innerText)) || "No address provided",
                website: (await page.$eval('[data-tooltip="Open website"]', (element) => element.innerText)) || "No website provided",
            };
            break;
        case "hotel":
            scrapedData = {
                name: (await page.$eval('[role="main"]', (element) => element.getAttribute("aria-label"))) || "No hotel name provided",
                address: (await page.$eval('button[data-item-id="address"]', (element) => element.innerText)) || "No address provided",
                website: (await page.$eval('[data-tooltip="Open website"]', (element) => element.innerText)) || "No website provided",
            };
            break;
        case "school":
            scrapedData = {
                name: (await page.$eval('[role="main"]', (element) => element.getAttribute("aria-label"))) || "No school name provided",
                address: (await page.$eval('button[data-item-id="address"]', (element) => element.innerText)) || "No address provided",
                website: (await page.$eval('[data-tooltip="Open website"]', (element) => element.innerText)) || "No website provided",
            };
            break;
        default:
            scrapedData = {
                name: "Category not supported",
                address: "",
                website: "",
            };
    }

    return scrapedData;
}

async function scrapeCategory(searchQuery, page, category) {
    try {
        await page.goto(`https://www.google.com/maps/?q=${searchQuery}`, { waitUntil: 'networkidle0' });
    } catch (e) {
        console.error(`Error navigating to search page: ${e}`);
        return [];
    }

    await page.waitForTimeout(defaultDelay * 10); // Menggunakan waitForTimeout dari Puppeteer

    let allLinks = [];
    let isDisabled;

    try {
        isDisabled = await isNextButtonDisabled(page);
    } catch (e) {
        console.error(`Error checking next button state: ${e}`);
        return [];
    }

    while (!isDisabled) {
        try {
            const links = await getLinks(page);
            allLinks.push(...links);
            await page.$eval('button[aria-label=" Next page "]', (element) => element.click());
            debug.log("Moving to the next page");
        } catch (e) {
            console.error(`Error getting links or navigating to next page: ${e}`);
        }

        try {
            isDisabled = await isNextButtonDisabled(page);
        } catch (e) {
            console.error(`Error checking next button state: ${e}`);
            break;
        }

        if (isDisabled) break;

        try {
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
        } catch (e) {
            console.error(`Error waiting for navigation: ${e}`);
        }
    }

    allLinks = Array.from(new Set(allLinks));

    console.log(`Found ${allLinks.length} links for ${category} search`);

    let scrapedData = [];

    for (const link of allLinks) {
        try {
            const data = await getPageData(link, page, category);
            if (data) scrapedData.push(data);
        } catch (e) {
            console.error(`Error scraping data from ${link}: ${e}`);
        }
    }

    console.log(`Scraped data for ${scrapedData.length} ${category.toLowerCase()} listings`);

    return scrapedData;
}

async function getLinks(page) {
    try {
        await page.waitForSelector('[role="main"] > div:nth-child(2) > div', { timeout: 10000 });
    } catch (e) {
        console.error("Error waiting for search results: ", e);
        return [];
    }

    await autoScroll(page);

    const searchResults = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a"))
            .map((el) => el.href)
            .filter((link) => link.match(/https:\/\/www.google.com\/maps\//g, link) && !link.match(/\=https:\/\/www.google.com\/maps\//g, link))
    );

    console.log(searchResults);
    debug.log("I got", searchResults.length, "results");
    return searchResults;
}

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

async function isNextButtonDisabled(page) {
    try {
        await page.waitForSelector('button[aria-label=" Next page "]', { timeout: 5000 });
    } catch (e) {
        return true;
    }

    const state = await page.$eval('button[aria-label=" Next page "]', (button) => button.getAttribute("disabled") !== null);
    debug.log("We are", state ? " at the end of the pages" : "not at the end of the pages");
    return state;
}

async function main() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    const cafes = await scrapeCategory("cafe in Prabumulih", page, "Cafe");
    const hotels = await scrapeCategory("hotel in Prabumulih", page, "Hotel");
    const schools = await scrapeCategory("school in Prabumulih", page, "School");

    const allResults = [...cafes, ...hotels, ...schools];

    console.log("All scraped results:", allResults);
    debug.log("Scrape complete!");

    const jsonData = JSON.stringify(allResults, null, 2);
    fs.writeFileSync('prabumulih_locations.json', jsonData);

    await browser.close();
}

console.clear();
main();