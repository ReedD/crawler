const bluebird = require('bluebird');
const redis = require('redis');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const debug = {
  redis: require('debug')('crawler:redis'),
};

const client = redis.createClient(
  process.env.REDIS_PORT || 6379,
  process.env.REDIS_HOST || 'localhost'
);

module.exports = {
  addCrawlUrls: async (urls, radius) => {
    debug.redis('Add scraped urls to redis');
    const multi = client.multi();
    urls.forEach(url => {
      multi.sadd('discoveredPages', url);
    });
    const result = await multi.execAsync();
    debug.redis('Added urls to discovered set');

    let count = 0;
    result.forEach((notDiscovered, i) => {
      if (notDiscovered) {
        count++;
        const url = urls[i];
        multi.rpush('pageQueue', `${url} ${radius}`);
      }
    });
    await multi.execAsync();
    debug.redis(`Added ${count} new urls to queue`);
    debug.redis(`${urls.length - count} duplicates found`);
  },

  addCrawlUrl: async (url, radius) => {
    const notDiscovered = await client.saddAsync('discoveredPages', url);
    if (!notDiscovered) {
      await client.rpushAsync('pageQueue', `${url} ${radius}`);
    }
  },

  getCrawlUrl: async () => {
    debug.redis('Pop url from queue');
    const reply = await client.lpopAsync('pageQueue');
    if (reply) {
      debug.redis('Url popped');
      if (debug.redis.enabled) {
        const length = await client.llenAsync('pageQueue');
        debug.redis(`${length} urls in queue`);
      }
      const parts = reply.match(/(.+) ([0-9]+)$/);
      return {
        url: parts[1],
        radius: parseInt(parts[2]),
      };
    }
    debug.redis('Queue empty');
    return null;
  },

  flush: async () => {
    debug.redis('Flush db');
    await client.del('discoveredPages', 'pageQueue');
    debug.redis('Redis flushed');
  },

  close: () => {
    client.end(true);
  },
};
