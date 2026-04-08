import http from "node:http";
import { resolveConfigFromThreeSources, defaultConfigPath, validateConfig, getMode, getPort, getTrustedOrigins, getRateLimits } from "./config.js";
import { applySecurityHeaders, applyCors, createRateLimiter } from "./security.js";
import { createItemsRepo } from "./items.js";

const cfg = resolveConfigFromThreeSources({
  configPath: defaultConfigPath(),
  env: process.env,
  argv: process.argv.slice(2)
});

const errors = validateConfig(cfg);
if (errors.length > 0) {
  console.error("Запуск остановлен из за некорректных настроек");
  for (const e of errors) console.error("- " + e);
  process.exit(1);
}

const mode = getMode(cfg);
const port = getPort(cfg);
const trustedOrigins = getTrustedOrigins(cfg);
const limits = getRateLimits(cfg);
const limiter = createRateLimiter({ readPerMinute: limits.readPerMinute, writePerMinute: limits.writePerMinute });

const repo = createItemsRepo();

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(res);
  applyCors(req, res, trustedOrigins);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!limiter.allow(req)) {
    res.statusCode = 429;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Слишком много запросов");
    return;
  }

  try {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/api/items") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(repo.list()));
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/items/by-id/")) {
      const id = url.pathname.split("/").pop();
      const item = repo.get(id);
      if (!item) throw new Error("Элемент не найден");
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(item));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/items") {
      const body = await readJson(req);
      const name = String(body.name ?? "").trim();
      const price = Number(body.price);

      if (!name) throw new Error("Поле name не должно быть пустым");
      if (!Number.isFinite(price) || price < 0) throw new Error("Поле price задано неверно");

      const created = repo.create(name, price);
      res.statusCode = 201;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Location", `/api/items/by-id/${created.id}`);
      res.end(JSON.stringify(created));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/mode") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ mode }));
      return;
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Маршрут не найден");
  } catch (e) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    const msg = mode === "учебный" ? String(e?.message ?? "Ошибка") : "Ошибка обработки запроса";
    res.end(msg);
  }
});

server.listen(port, () => {
  console.log(`Служба запущена на порту ${port}`);
});

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(new Error("Тело запроса не является корректным JSON"));
      }
    });
    req.on("error", reject);
  });
}
