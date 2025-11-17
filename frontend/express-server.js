import express from 'express'
import morgan from 'morgan'
import chalk from 'chalk';
import { handler as astroSsrHandler } from './dist/server/entry.mjs';
import cookieParser from 'cookie-parser';

morgan.token('abtest', function (req, res) { return chalk.black.bgYellow(req.headers['x-abtesthash'] ?? "-") })
morgan.token('user-agent', function (req, res) { return chalk.gray(req.headers['user-agent']) })
morgan.token('remote-addr', function (req, res) { return chalk.black.bgWhite(req.headers['cf-connecting-ip'] ?? req.ip)  })
morgan.token('astro-url', function (req, res) { return !!req.matchedAstro ? chalk.bold.magenta(` ${req.matchedAstro} `) : '' })
morgan.token('status', function (req, res) {
  if (!res._startAt) {
    return chalk.bgRed.white.bold(`RESPONSE-NOT-SENT :: ${res.statusCode}`)
  }

  return res.statusCode < 300 ?
    chalk.green(res.statusCode)
    : res.statusCode < 400 ?
      chalk.yellow(res.statusCode)
      : res.statusCode < 500 ?
        chalk.red(res.statusCode)
          :chalk.white.bgRed(res.statusCode)
})
morgan.token('response-time', function getResponseTimeToken (req, res, digits) {
  if (!req._startAt) {
    return chalk.bgRed.white.bold(`NO-REQ`)
  }
  if (!res._startAt) {
    res._startAt = process.hrtime()
  }

  const t = ((res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6).toFixed(digits === undefined ? 3 : digits)

  return t < 200 ?
    chalk.green(`${t}ms`)
    : t < 600 ?
      chalk.yellow(`${t}ms`)
        : chalk.red(`${t}ms`)

})


const app = express();
const MOUNT_PATH = process.env.MOUNT_PATH || '/';

process.on('unhandledRejection', function(err, promise) {
  console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
});

process.on('uncaughtException', function(error) {
  console.error(`Caught exception: ${error}\n` + `Exception origin: ${error.stack}`);
});

app.use(morgan('[:date[iso]] (:status) :method :abtest :url :astro-url - :response-time - :remote-addr | :user-agent | :referrer'))

let healthy = true;
let pendingRequests = 0;

app.use(function (req, res, next) {
  pendingRequests += 1;
  res.on('finish', function () {
    pendingRequests -= 1;
  });
  next();
});

app.get('/health', function (_req, res) {
  if (healthy) {
    res.status(200).send('ok');
  } else {
    res.status(503).send('shutting down');
  }
});


app.use(MOUNT_PATH, express.static('dist/client/', {
  maxAge: 1296000,
  setHeaders: function(res, _path) {
    res.setHeader('Cache-Control', `public, max-age=${process.env?.STATIC_FILES_CACHE ?? 0}`);
    // res.setHeader('X-ProjectVersion', process.env?.VERSION ?? 'x');
    // res.setHeader('X-TTL', process.env?.STATIC_FILES_CACHE ?? '0');
    // res.setHeader('X-Grace', process.env?.STATIC_FILES_CACHE ?? '0');
  }
}))


app.use(MOUNT_PATH, cookieParser());

// API requests are routed by nginx directly to the backend server


app.use(MOUNT_PATH, function (req, res, next) {
  console.log('[astro] request received', req.url);
  const locals = { user: req.user }; // set by jwtCookie() to match what Astro expects
  return astroSsrHandler(req, res, next, locals);
});

let server;

const gracefulShutdown = async function (signal) {
  console.log(`Received ${signal}, starting graceful shutdown...`);
  
  healthy = false;
  console.log('Healthcheck set to unhealthy, waiting for reverse proxy to detect...');
  
  const healthcheckInterval = 10000;
  const healthcheckTimeout = 3000;
  const healthcheckRetries = 3;
  const drainTime = healthcheckInterval + (healthcheckTimeout * healthcheckRetries) + 2000;
  
  await new Promise(function (r) { setTimeout(r, drainTime); });
  console.log('Reverse proxy should have detected unhealthy status, closing server...');
  
  if (server) {
    server.close(function () {
      console.log('HTTP server closed, no longer accepting new connections');
    });
  }
  
  const timeoutMs = Number(process.env.GRACEFUL_TIMEOUT_MS || 10000);
  const checkIntervalMs = 200;
  const started = Date.now();
  while (pendingRequests > 0 && Date.now() - started < timeoutMs) {
    await new Promise(function (r) { setTimeout(r, checkIntervalMs); });
  }
  if (pendingRequests === 0) {
    console.log('All requests completed, exiting');
  } else {
    console.log('Graceful shutdown timeout reached, forcing exit');
  }
  process.exit(0);
};

process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => gracefulShutdown('SIGINT'));



server = app.listen( process.env.SERVER_HTTP_PORT || 4321 , '0.0.0.0', async () => {
  console.log(`v${process.env?.VERSION || 0} server started: docker=${process.env?.DOCKER_HOST} port=${process.env.SERVER_HTTP_PORT || 4321}`)
});



