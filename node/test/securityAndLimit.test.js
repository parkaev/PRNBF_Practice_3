import test from "node:test";
import assert from "node:assert/strict";
import { applyCors, createRateLimiter } from "../src/security.js";

test("Недоверенный источник не получает разрешающий заголовок", () => {
  const req = { headers: { origin: "http://evil.local" } };
  const headers = new Map();
  const res = { setHeader(k, v) { headers.set(k, v); } };

  applyCors(req, res, ["http://localhost:5173"]);
  assert.equal(headers.has("Access-Control-Allow-Origin"), false);
});

test("Ограничитель частоты блокирует лишние запросы", () => {
  const limiter = createRateLimiter({ readPerMinute: 2, writePerMinute: 1 });

  const req = { method: "GET", url: "/api/items", socket: { remoteAddress: "1.2.3.4" }, headers: {} };

  assert.equal(limiter.allow(req), true);
  assert.equal(limiter.allow(req), true);
  assert.equal(limiter.allow(req), false);
});
