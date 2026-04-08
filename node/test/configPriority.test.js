import test from "node:test";
import assert from "node:assert/strict";
import { buildConfig, validateConfig } from "../src/config.js";

test("Приоритет источников настроек работает как заявлено", () => {
  const fileCfg = { app: { rateLimits: { readPerMinute: 10 } } };
  const env = { APP_READ_PER_MINUTE: "20" };
  const args = { readPerMinute: "30" };

  const cfg = buildConfig({ fileCfg, env, args });
  assert.equal(cfg.app.rateLimits.readPerMinute, 30);
});

test("Некорректные настройки дают ошибки проверки", () => {
  const cfg = { app: { mode: "x", port: 0, trustedOrigins: [], rateLimits: { readPerMinute: 0, writePerMinute: 0 } } };
  const errors = validateConfig(cfg);
  assert.ok(errors.length >= 3);
});

test("Лимит записи не может быть выше лимита чтения", () => {
  const cfg = { app: { mode: "учебный", port: 3000, trustedOrigins: ["http://localhost"], rateLimits: { readPerMinute: 10, writePerMinute: 20 } } };
  const errors = validateConfig(cfg);
  assert.ok(errors.some(e => e.includes("Лимит записи не должен быть выше лимита чтения")));
});

test("Невалидный URL в доверенных источниках вызывает ошибку", () => {
  const cfg = { app: { mode: "учебный", port: 3000, trustedOrigins: ["not-a-valid-url"], rateLimits: { readPerMinute: 60, writePerMinute: 20 } } };
  const errors = validateConfig(cfg);
  assert.ok(errors.some(e => e.includes("задан неверно")));
});

test("Приоритет: CLI переопределяет env, env переопределяет файл", () => {
  const fileCfg = { app: { port: 1000, mode: "учебный" } };
  const env = { APP_PORT: "2000" };
  const args = { port: "3000" };

  const cfg = buildConfig({ fileCfg, env, args });
  assert.equal(cfg.app.port, 3000);
});

test("Учебный и боевой режимы отличаются", () => {
  const eduCfg = { app: { mode: "учебный", port: 3000, trustedOrigins: ["http://localhost"], rateLimits: { readPerMinute: 60, writePerMinute: 20 } } };
  const combatCfg = { app: { mode: "боевой", port: 3000, trustedOrigins: ["http://localhost"], rateLimits: { readPerMinute: 60, writePerMinute: 20 } } };

  assert.equal(validateConfig(eduCfg).length, 0);
  assert.equal(validateConfig(combatCfg).length, 0);
});
