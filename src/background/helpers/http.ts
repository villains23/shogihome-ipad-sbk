import https from "node:https";
import http from "node:http";
import { getAppLogger } from "@/background/log.js";
import ejpn from "encoding-japanese";
import { RateLimiter, WindowRule } from "./limiter.js";
import { isTest } from "@/background/proc/env.js";
import { getAppVersion } from "@/background/helpers/electron.js";
const convert = ejpn.convert;

const domainLimiter = new Map<string, RateLimiter>();
domainLimiter.set(
  "live4.computer-shogi.org",
  new RateLimiter([
    { limit: 1, windowMs: 1 * 1000 },
    { limit: 2, windowMs: 2 * 1000 },
    { limit: 3, windowMs: 4 * 1000 },
    { limit: 4, windowMs: 8 * 1000 },
    { limit: 5, windowMs: 12 * 1000 },
    { limit: 6, windowMs: 18 * 1000 },
  ]),
);
const commonRules: WindowRule[] = isTest()
  ? [{ limit: 100, windowMs: 1 * 1000 }]
  : [
      { limit: 2, windowMs: 1 * 1000 },
      { limit: 3, windowMs: 2 * 1000 },
      { limit: 4, windowMs: 4 * 1000 },
      { limit: 5, windowMs: 8 * 1000 },
      { limit: 6, windowMs: 12 * 1000 },
      { limit: 8, windowMs: 16 * 1000 },
    ];

export async function postJson(url: string, body: string): Promise<string> {
  const parsedUrl = new URL(url);
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || undefined,
    path: parsedUrl.pathname + parsedUrl.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "User-Agent": `ShogiHome/${getAppVersion()}`,
    },
  };
  return new Promise((resolve, reject) => {
    const request = url.startsWith("http://") ? http.request : https.request;
    const req = request(options, (res) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.setTimeout(5000, () => {
      reject(new Error(`request timeout: ${url}`));
      req.destroy();
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function fetch(url: string): Promise<string> {
  const hostName = new URL(url).hostname;
  let limiter = domainLimiter.get(hostName);
  if (!limiter) {
    limiter = new RateLimiter(commonRules);
    domainLimiter.set(hostName, limiter);
  }

  await limiter.waitUntilAllowed();

  return new Promise((resolve, reject) => {
    const get = url.startsWith("http://") ? http.get : https.get;
    getAppLogger().debug(`fetch remote file: ${url}`);
    const req = get(url, { headers: { "User-Agent": `ShogiHome/${getAppVersion()}` } });
    req.setTimeout(5000, () => {
      reject(new Error(`request timeout: ${url}`));
      req.destroy();
    });
    req.on("error", (e) => {
      reject(new Error(`request failed: ${url}: ${e}`));
    });
    req.on("response", (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`request failed: ${url}: ${res.statusCode}`));
        return;
      }
      const data: Buffer[] = [];
      res
        .on("readable", () => {
          for (let chunk = res.read(); chunk; chunk = res.read()) {
            data.push(chunk);
          }
        })
        .on("end", () => {
          const concat = Buffer.concat(data);
          const decoded = convert(concat, { type: "string", to: "UNICODE" });
          resolve(decoded);
        })
        .on("error", (e) => {
          reject(new Error(`request failed: ${url}: ${e}`));
        });
    });
  });
}
