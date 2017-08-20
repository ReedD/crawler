# Chromium / [Puppeteer](https://github.com/GoogleChrome/puppeteer) site crawler

[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

This crawler does a BFS starting from a given site entry point. It will not leave the entry point domain and it will not crawl a page more than once. Given a shared redis host/cluster this crawler can be distributed across multiple machines or processes. Discovered pages will be stored in mongo collection, each with a url, outbound urls, and a radius from the origin.

## Installation
```
yarn
```

## Usage
### Basic
```bash
./crawl -u https://www.dadoune.com
```
### Distributed
```bash
# Terminal 1
./crawl -u https://www.dadoune.com
```

```bash
# Terminal 2
./crawl -r
```
### Debug
```bash
DEBUG=crawler:* ./crawl -u https://www.dadoune.com
```

### Options
- `--maxRadius` or `-m` the maximum link depth the crawler will explore from the entry url.
- `--resume` or `-r` to resume crawling after prematurely exiting a process or to add additional crawlers to an existing crawl.
- `--url` or `-u` the entry point URL to kick the crawler off.
