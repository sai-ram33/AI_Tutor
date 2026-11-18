import { query, isPostgresAvailable } from '../config/db.js';
import { config } from '../config/env.js';

export const healthController = {
  /**
   * Lightweight health check endpoint optimized for cron jobs and uptime monitors.
   * Supports GET and HEAD requests, disables caching, avoids external LLM quota usage,
   * and safely probes PostgreSQL without crashing in resilient mode.
   */
  async checkHealth(req, res) {
    const startTime = Date.now();

    // Prevent proxies/CDNs from caching cron keep-alive pings
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    // Fast path for HEAD requests used by lightweight uptime monitors
    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    let databaseStatus = isPostgresAvailable ? 'connected' : 'disconnected';
    let dbLatencyMs = null;

    if (isPostgresAvailable) {
      const dbStart = Date.now();
      try {
        const dbCheck = await Promise.race([
          query('SELECT 1'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DB health check timeout')), 2000)
          ),
        ]);
        dbLatencyMs = Date.now() - dbStart;
        databaseStatus = dbCheck && dbCheck.rowCount > 0 ? 'connected' : 'error';
      } catch {
        dbLatencyMs = Date.now() - dbStart;
        databaseStatus = 'error';
      }
    }

    const memUsage = process.memoryUsage();
    const toMB = (bytes) => Number((bytes / (1024 * 1024)).toFixed(2));

    return res.status(200).json({
      status: 'ok',
      service: 'AI Teacher API',
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      responseTimeMs: Date.now() - startTime,
      database: {
        status: databaseStatus,
        latencyMs: dbLatencyMs,
      },
      services: {
        mistralConfigured: Boolean(config.mistralApiKey),
        groqTtsConfigured: Boolean(config.groqApiKey),
        qwenVisionConfigured: Boolean(config.qwenServiceUrl),
      },
      memory: {
        rssMB: toMB(memUsage.rss),
        heapUsedMB: toMB(memUsage.heapUsed),
        heapTotalMB: toMB(memUsage.heapTotal),
      },
    });
  },
};
