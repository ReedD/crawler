const bluebird = require('bluebird');
const redis = require('redis');
const MongoClient = require('mongodb').MongoClient;

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const debug = {
  db: require('debug')('crawler:db'),
  redis: require('debug')('crawler:redis'),
  mongo: require('debug')('crawler:mongo'),
};

module.exports = {
  connect: async () => {
    this.db = await MongoClient.connect('mongodb://localhost:27017/crawler');
    this.client = redis.createClient(
      process.env.REDIS_PORT || 6379,
      process.env.REDIS_HOST || 'localhost'
    );
  },
  store: async page => {
    debug.db(`Store page ${page.url}`);

    debug.mongo('Add page to mongo');
    await this.db.collection('pages').insertOne(page);
    debug.mongo('Mongo save complete');

    debug.redis('Add scraped urls to redis');
    const multi = this.client.multi();
    page.outboundUrls.forEach(url => {
      multi.sadd('discoveredPages', url);
    });
    const result = await multi.execAsync();
    debug.redis('Added urls to discovered set');

    let count = 0;
    result.forEach((notDiscovered, i) => {
      if (notDiscovered) {
        count++;
        const url = page.outboundUrls[i];
        multi.rpush('pageQueue', `${url} ${page.radius}`);
      }
    });
    await multi.execAsync();
    debug.redis(`Added ${count} new urls to queue`);
    debug.redis(`${page.outboundUrls.length - count} duplicates found`);
    debug.db('Page stored');
  },

  popUrl: async () => {
    debug.redis('Pop url from queue');
    const reply = await this.client.lpopAsync('pageQueue');
    if (reply) {
      debug.redis('Url popped');
      if (debug.redis.enabled) {
        const length = await this.client.llenAsync('pageQueue');
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

  getNodes: async () => {
    const pages = await this.db.collection('pages').find().toArray();

    const nodes = [];
    pages.forEach(page => {
      page.outboundUrls.forEach(url => {
        nodes.push({ source: page.url, target: url });
      });
    });

    console.log(JSON.stringify(nodes));
  },

  flush: async () => {
    debug.mongo('Drop page collection');
    const pages = await this.db.collection('pages');
    if (pages) {
      await pages.drop();
    }
    debug.mongo('Page collection dropped');
    debug.redis('Flush db');
    await this.client.del('discoveredPages', 'pageQueue');
    debug.redis('Redis flushed');
  },

  close: () => {
    this.client.end(true);
    this.db.close();
  },
};
