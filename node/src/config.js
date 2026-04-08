import fs from "node:fs";
import path from "node:path";

export function parseArgs(argv) {
  const res = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const s = a.slice(2);
    const i = s.indexOf("=");
    if (i < 0) continue;
    const k = s.slice(0, i);
    const v = s.slice(i + 1);
    res[k] = v;
  }
  return res;
}

export function readFileConfig(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function buildConfig({ fileCfg, env, args }) {
  // порядок приоритета, файл, окружение, аргументы
  const c = structuredClone(fileCfg ?? {});
  const app = c.app ?? {};
  c.app = app;

  if (env.APP_MODE) app.mode = env.APP_MODE;
  if (env.APP_PORT) app.port = Number(env.APP_PORT);
  if (env.APP_TRUSTED_ORIGINS) app.trustedOrigins = env.APP_TRUSTED_ORIGINS.split(",").map(x => x.trim()).filter(Boolean);
  if (env.APP_READ_PER_MINUTE) app.rateLimits = { ...(app.rateLimits ?? {}), readPerMinute: Number(env.APP_READ_PER_MINUTE) };
  if (env.APP_WRITE_PER_MINUTE) app.rateLimits = { ...(app.rateLimits ?? {}), writePerMinute: Number(env.APP_WRITE_PER_MINUTE) };

  if (args.mode) app.mode = args.mode;
  if (args.port) app.port = Number(args.port);
  if (args.trustedOrigins) app.trustedOrigins = String(args.trustedOrigins).split(",").map(x => x.trim()).filter(Boolean);
  if (args.readPerMinute) app.rateLimits = { ...(app.rateLimits ?? {}), readPerMinute: Number(args.readPerMinute) };
  if (args.writePerMinute) app.rateLimits = { ...(app.rateLimits ?? {}), writePerMinute: Number(args.writePerMinute) };

  return c;
}

export function validateConfig(cfg) {
  const errors = [];
  const app = cfg.app ?? {};

  const mode = String(app.mode ?? "").toLowerCase();
  if (mode !== "учебный" && mode !== "боевой") {
    errors.push("Режим работы задан неверно, допустимы учебный и боевой");
  }

  const port = Number(app.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    errors.push("Порт задан неверно, значение должно быть целым числом от 1 до 65535");
  }

  const origins = Array.isArray(app.trustedOrigins) ? app.trustedOrigins : [];
  if (origins.length === 0) {
    errors.push("Список доверенных источников пуст, служба не может быть открыта без ограничений");
  }
  for (const o of origins) {
    try {
      const u = new URL(o);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        errors.push(`Доверенный источник должен иметь схему http или https, значение ${o}`);
      }
    } catch {
      errors.push(`Доверенный источник задан неверно, значение ${o}`);
    }
  }

  const rl = app.rateLimits ?? {};
  const read = Number(rl.readPerMinute);
  const write = Number(rl.writePerMinute);

  if (!Number.isInteger(read) || read <= 0) errors.push("Лимит чтения должен быть больше нуля");
  if (!Number.isInteger(write) || write <= 0) errors.push("Лимит записи должен быть больше нуля");
  if (Number.isInteger(read) && Number.isInteger(write) && write > read) errors.push("Лимит записи не должен быть выше лимита чтения");

  return errors;
}

export function getMode(cfg) {
  return String(cfg.app?.mode ?? "учебный").toLowerCase();
}

export function getTrustedOrigins(cfg) {
  return (cfg.app?.trustedOrigins ?? []).map(x => String(x));
}

export function getRateLimits(cfg) {
  return cfg.app?.rateLimits ?? { readPerMinute: 60, writePerMinute: 20 };
}

export function getPort(cfg) {
  return Number(cfg.app?.port ?? 3000);
}

export function resolveConfigFromThreeSources({ configPath, env, argv }) {
  const fileCfg = readFileConfig(configPath);
  const args = parseArgs(argv);
  const cfg = buildConfig({ fileCfg, env, args });
  return cfg;
}

export function defaultConfigPath() {
  return path.resolve(process.cwd(), "config", "appsettings.json");
}
