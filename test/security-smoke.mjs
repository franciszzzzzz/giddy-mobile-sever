// test/security-smoke.mjs
// Functional smoke test for the per-identity rate-limit/ban/lockout logic.
// Uses the REAL middleware files, with Redis methods stubbed on the shared
// singleton (Map-backed fake). No Redis/Mongo needed.
//
// Run: node test/security-smoke.mjs

import assert from "node:assert";
import express from "express";

const redisClient = (await import("../config/redis.js")).default;

// ---------- Fake Redis (Map-backed) ----------
const store = new Map();
const capturedKeys = [];
const banned = () => [...store.keys()].filter((k) => k.startsWith("banned:"));

redisClient.exists = async (k) => (store.has(k) ? 1 : 0);
redisClient.setEx = async (k, s, v) => {
  store.set(k, v);
  return true;
};
redisClient.incr = async (k) => {
  const n = (Number(store.get(k)) || 0) + 1;
  store.set(k, String(n));
  return n;
};
redisClient.expire = async () => true;
redisClient.del = async (k) => {
  store.delete(k);
  return 1;
};
// rate-limit-redis store path: capture the identity key, then throw to
// exercise the passOnStoreError fail-open path.
redisClient.client = {
  sendCommand: async (args) => {
    if (args[0] === "EVALSHA") capturedKeys.push(args[3]);
    if (args[0] === "SCRIPT") return "fakesha";
    throw new Error("store down (test)");
  },
};

const { checkIpBan, scannerTrap } = await import("../middleware/ipBan.js");
const { loginLockout } = await import("../middleware/loginLockout.js");
const limiter = (await import("../middleware/rateLimiter.js")).default;

// ---------- Mini app with the real middleware ----------
const app = express();
app.use(express.json());
app.use(checkIpBan);
app.use(scannerTrap);
app.use(limiter);
app.get("/api/v1/ping", (req, res) => res.json({ success: true }));
app.get("/api/v1/health", (req, res) => res.json({ success: true }));
app.post("/api/v1/login", loginLockout, (req, res) =>
  res.status(401).json({ success: false, message: "Invalid email or password." }),
);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const get = (path, xff) =>
  fetch(base + path, { headers: xff ? { "x-forwarded-for": xff } : {} });
const post = (path, body, xff) =>
  fetch(base + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(xff ? { "x-forwarded-for": xff } : {}),
    },
    body: JSON.stringify(body),
  });

const results = [];
const test = async (name, fn) => {
  try {
    await fn();
    results.push(`✅ ${name}`);
  } catch (err) {
    results.push(`❌ ${name}: ${err.message}`);
    process.exitCode = 1;
  }
};

// T1: identity = LAST X-Forwarded-For entry
await test("identity uses last XFF entry (nearest proxy)", async () => {
  await get("/junk", "1.1.1.1, 2.2.2.2");
  assert.ok(store.has("trap:2.2.2.2"), "expected trap:2.2.2.2 counter");
});

// T2: scanner trap bans XFF identity at threshold
await test("10 junk paths -> XFF identity banned -> 403 everywhere", async () => {
  for (let i = 0; i < 10; i++) await get("/.env", "9.9.9.9");
  assert.ok(
    banned().includes("banned:9.9.9.9"),
    `expected ban, got: ${banned()}`,
  );
  const blocked = await get("/api/v1/ping", "9.9.9.9");
  assert.equal(blocked.status, 403, "banned identity must get 403");
  const blockedHealth = await get("/api/v1/health", "9.9.9.9");
  assert.equal(blockedHealth.status, 403, "ban applies to health too");
});

// T3: shared (no-XFF) identity is NEVER banned
await test("20 junk paths WITHOUT XFF -> no ban (shared-gateway safety)", async () => {
  for (let i = 0; i < 20; i++) await get("/.env.bak");
  assert.equal(
    banned().length,
    1,
    `only the XFF ban should exist, got: ${banned()}`,
  );
  const ok = await get("/api/v1/ping");
  assert.equal(ok.status, 200, "shared identity must never be blocked by trap");
});

// T4: per-email login lockout (spoof-proof — rotate XFF freely)
await test("8 failed logins -> email locked even with rotating XFF", async () => {
  for (let i = 0; i < 8; i++) {
    const r = await post("/api/v1/login", { email: "victim@test.com", password: "wrong" }, `10.0.0.${i}`);
    assert.equal(r.status, 401);
  }
  const locked = await post(
    "/api/v1/login",
    { email: "victim@test.com", password: "wrong" },
    "10.0.0.99", // fresh identity — lock must still apply
  );
  assert.equal(locked.status, 429, "locked email must get 429");
  const body = await locked.json();
  assert.match(body.message, /too many failed attempts/i);
});

// T5: ERL store failure -> fail-open (requests still succeed), identity key passed to store
await test("Redis store outage -> limiter fails open + per-identity store keys", async () => {
  for (let i = 0; i < 5; i++) {
    const r = await get("/api/v1/ping", "5.5.5.5");
    assert.equal(r.status, 200, "fail-open must allow requests");
  }
  assert.ok(
    capturedKeys.some((k) => k.includes("5.5.5.5")),
    "keyGenerator must pass XFF identity to the store",
  );
});

server.close();
console.log("\n===== SECURITY SMOKE TEST =====");
results.forEach((r) => console.log(r));
console.log(
  process.exitCode ? "\n❌ FAILURES" : "\n🎉 ALL PASSED",
);
process.exit(process.exitCode || 0);
