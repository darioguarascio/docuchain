import http from "http";
import env from "@utils/env.ts";
import express from "@utils/express.ts";
import { setHealthy, getPendingRequests } from "@utils/health-state.ts";
import { testConnection } from "@utils/database.ts";

const startServer = async () => {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error("Failed to connect to database. Server will not start.");
    process.exit(1);
  }

  const server = http.createServer(express).listen(env.LISTENING_PORT, () => {
    console.log(`http listening on ${env.LISTENING_PORT}`);
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, starting graceful shutdown...`);

    setHealthy(false);
    console.log(
      "Healthcheck set to unhealthy, waiting for reverse proxy to detect...",
    );

    const healthcheckInterval = 10000;
    const healthcheckTimeout = 3000;
    const healthcheckRetries = 3;
    const drainTime =
      healthcheckInterval + healthcheckTimeout * healthcheckRetries + 2000;

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, drainTime);
    });
    console.log(
      "Reverse proxy should have detected unhealthy status, closing server...",
    );

    server.close(() => {
      console.log("HTTP server closed, no longer accepting new connections");
    });

    const timeoutMs = env.GRACEFUL_TIMEOUT_MS;
    const checkIntervalMs = 200;
    const started = Date.now();

    const checkPendingRequests = async (): Promise<void> => {
      while (Date.now() - started < timeoutMs) {
        const pending = getPendingRequests();
        if (pending === 0) {
          console.log("All requests completed, exiting");
          process.exit(0);
        }
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, checkIntervalMs);
        });
      }
    };

    await checkPendingRequests();

    console.log("Graceful shutdown timeout reached, forcing exit");
    process.exit(0);
  };

  process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => gracefulShutdown("SIGINT"));
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
