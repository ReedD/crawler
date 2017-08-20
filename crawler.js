const _ = require('lodash');
const db = require('./db');
const puppeteer = require('puppeteer');
const url = require('url');

const debug = {
  crawl: require('debug')('crawler:crawl'),
  page: require('debug')('crawler:page'),
};

const crawl = async (entry, options = {}) => {
  debug.crawl('Crawler started');
  let target = (await db.popUrl()) || { url: entry, radius: 0 };
  const { maxRadius = Infinity } = options;
  if (!target.url) {
    debug.crawl('Nothing to crawl');
    return;
  }

  const entryUrl = url.parse(target.url);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  debug.crawl('Puppeteer started');

  let count = 0;
  while (target) {
    if (target.radius >= maxRadius) {
      debug.page(`Max radius reached ${target.url} not scraped`);
    } else {
      count++;
      debug.page(`Crawling: ${target.url}`);
      await page.goto(target.url);
      debug.page(`Page loaded`);
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(
          link => link.href
        );
      });
      const outboundUrls = _.chain(links)
        .filter(link => {
          return url.parse(link).host === entryUrl.host;
        })
        .value();
      debug.page(`Scraped ${outboundUrls.length} urls`);
      await db.store({
        outboundUrls,
        radius: ++target.radius,
        url: target.url,
      });
    }
    target = await db.popUrl();
  }
  debug.crawl(`Crawler finished after crawling ${count} pages`);

  await db.getNodes();

  browser.close();
};

module.exports = crawl;
