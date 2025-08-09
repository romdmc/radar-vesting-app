const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

/*
 * Simple HTTP server that serves a fake API endpoint and static files.
 *
 * This server exposes two main routes:
 *  - `/api/unlocks` returns a JSON array with sample token unlock events.
 *  - `/` and other paths serve files from the `public` directory.
 *
 * Note: this example does not implement any real blockchain logic. It is designed
 * as a skeleton for future development. You can extend it by calling real APIs
 * or reading from a database instead of returning hard-coded values.
 */

// Load unlock events and price series from JSON files. In a real application,
// these would come from a database or external API. The data used here is
// synthetic and intended for demonstration purposes only.
const unlocks = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'unlocks.json'), 'utf-8')
);
const priceSeries = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'price_series.json'), 'utf-8')
);

// Optionally fetch real unlock data from the DropsTab API if the
// environment variable DROPSTAB_API_KEY is provided. The API key can be
// obtained via the DropsTab Builders Program. See README.md for details.
const DROPSTAB_API_KEY = process.env.DROPSTAB_API_KEY;

/**
 * Fetch unlock data from DropsTab API. Returns null on error or if no API key.
 * Data items are mapped to the same structure as our local unlocks. A
 * default `shortable` value of false is used, as the API does not
 * provide that information directly.
 */
function fetchRealUnlocks() {
  return new Promise((resolve) => {
    if (!DROPSTAB_API_KEY) {
      resolve(null);
      return;
    }
    const options = {
      hostname: 'public-api.dropstab.com',
      path: '/api/v1/tokenUnlocks',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${DROPSTAB_API_KEY}`,
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const data = parsed.data || [];
          const mapped = data.map((ev) => ({
            token: ev.coin,
            timestamp: `${ev.date}T00:00:00Z`,
            amountUsd: ev.amount || 0,
            shortable: false,
          }));
          resolve(mapped);
        } catch (e) {
          console.error('Error parsing DropsTab response', e);
          resolve(null);
        }
      });
    });
    req.on('error', (err) => {
      console.error('Error calling DropsTab API', err);
      resolve(null);
    });
    req.end();
  });
}

/**
 * Retrieve the price of a token at a given timestamp.
 * The function returns the last known price before or at the specified
 * timestamp. If no price is found, undefined is returned.
 * @param {string} token
 * @param {number} ts - timestamp in milliseconds since epoch
 * @returns {number|undefined}
 */
function getPrice(token, ts) {
  const series = priceSeries[token];
  if (!series) return undefined;
  // Find the latest price point not after ts
  let price;
  for (let i = 0; i < series.length; i++) {
    const pTs = Date.parse(series[i].timestamp);
    if (pTs <= ts) {
      price = series[i].price;
    } else {
      break;
    }
  }
  return price;
}

/**
 * Perform a simple backtest: for each unlock of the token, buy hoursBefore
 * hours before the unlock and sell hoursAfter hours after the unlock.
 * Returns statistics on the performance.
 * @param {string} token
 * @param {number} hoursBefore
 * @param {number} hoursAfter
 */
function backtest(token, hoursBefore, hoursAfter) {
  const events = unlocks.filter((u) => u.token === token);
  let trades = 0;
  let wins = 0;
  let totalRoi = 0;
  events.forEach((ev) => {
    const unlockTime = Date.parse(ev.timestamp);
    const buyTs = unlockTime - hoursBefore * 3600 * 1000;
    const sellTs = unlockTime + hoursAfter * 3600 * 1000;
    const buyPrice = getPrice(token, buyTs);
    const sellPrice = getPrice(token, sellTs);
    if (buyPrice !== undefined && sellPrice !== undefined) {
      const roi = (sellPrice - buyPrice) / buyPrice;
      totalRoi += roi;
      trades += 1;
      if (roi > 0) wins += 1;
    }
  });
  const avgRoi = trades > 0 ? totalRoi / trades : 0;
  const winRate = trades > 0 ? wins / trades : 0;
  return {
    trades,
    winRate,
    avgRoi,
  };
}

const server = http.createServer((req, res) => {
  // Set CORS headers to allow cross-origin requests from the front-end
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight CORS requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // API: get all unlock events
  if (req.url === '/api/unlocks' && req.method === 'GET') {
    // Try to fetch real unlock data; fallback to local data on failure
    fetchRealUnlocks().then((realData) => {
      const result = realData && realData.length > 0 ? realData : unlocks;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    });
    return;
  }

  // API: get tokens that are shortable
  if (req.url === '/api/shortable' && req.method === 'GET') {
    const tokens = Array.from(
      new Set(unlocks.filter((u) => u.shortable).map((u) => u.token))
    );
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(tokens));
    return;
  }

  // API: get details for a specific token
  const tokenMatch = req.url.match(/^\/api\/token\/([A-Za-z0-9_-]+)$/);
  if (tokenMatch && req.method === 'GET') {
    const tok = tokenMatch[1];
    const tokenEvents = unlocks.filter((u) => u.token === tok);
    const isShortable = tokenEvents.some((u) => u.shortable);
    const series = priceSeries[tok] || [];
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({ token: tok, shortable: isShortable, unlocks: tokenEvents, priceSeries: series })
    );
    return;
  }

  // API: backtest
  if (req.url === '/api/backtest' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const params = JSON.parse(body);
        const token = params.token;
        const hoursBefore = Number(params.hoursBefore) || 0;
        const hoursAfter = Number(params.hoursAfter) || 0;
        if (!token) {
          throw new Error('Token is required');
        }
        const result = backtest(token, hoursBefore, hoursAfter);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (e) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Serve static files from the 'public' folder
  const filePath = path.join(
    __dirname,
    'public',
    req.url === '/' ? 'index.html' : req.url
  );
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    // Determine MIME type based on extension
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.json') contentType = 'application/json';
    if (ext === '.ico') contentType = 'image/x-icon';
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.end(content);
  });
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
