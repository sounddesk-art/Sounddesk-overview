import { readFile } from "node:fs/promises";

const path = new URL("../public/portfolio-snapshot.json", import.meta.url);
const snapshot = JSON.parse(await readFile(path, "utf8"));

const forbiddenKeyPattern =
  /(token|secret|password|credential|oauth|api[_-]?key|email|recovery|cookie|authorization|private[_-]?key|session)/i;

const allowedTopLevel = new Set(["mode", "updatedAt", "portfolio", "experiments", "providers", "signals"]);
const allowedPortfolio = new Set(["activeExperiments", "totalViews", "followers"]);
const allowedExperiment = new Set(["id", "name", "status", "views", "followers", "retention", "trend"]);
const allowedProvider = new Set(["name", "state", "accounts", "views"]);
const allowedSignals = new Set(["rising", "flat", "falling", "note"]);

assertObject(snapshot, "snapshot");
assertOnlyKeys(snapshot, allowedTopLevel, "snapshot");

if (!["demo", "live"].includes(snapshot.mode)) fail("mode must be demo or live");
if (typeof snapshot.updatedAt !== "string" || Number.isNaN(Date.parse(snapshot.updatedAt))) {
  fail("updatedAt must be a valid ISO date");
}

assertObject(snapshot.portfolio, "portfolio");
assertOnlyKeys(snapshot.portfolio, allowedPortfolio, "portfolio");
assertNonNegative(snapshot.portfolio.activeExperiments, "portfolio.activeExperiments");
assertNonNegative(snapshot.portfolio.totalViews, "portfolio.totalViews");
assertNonNegative(snapshot.portfolio.followers, "portfolio.followers");

if (!Array.isArray(snapshot.experiments)) fail("experiments must be an array");
if (!Array.isArray(snapshot.providers)) fail("providers must be an array");

const experimentIds = new Set();
for (const [index, experiment] of snapshot.experiments.entries()) {
  const label = "experiments[" + index + "]";
  assertObject(experiment, label);
  assertOnlyKeys(experiment, allowedExperiment, label);
  assertShortString(experiment.id, label + ".id", 80);
  assertShortString(experiment.name, label + ".name", 120);
  if (experimentIds.has(experiment.id)) fail("experiment ids must be unique");
  experimentIds.add(experiment.id);

  if (!["draft", "scale", "continue", "testing", "paused"].includes(experiment.status)) {
    fail(label + ".status is invalid");
  }

  assertNonNegative(experiment.views, label + ".views");
  assertNonNegative(experiment.followers, label + ".followers");

  if (
    typeof experiment.retention !== "number" ||
    !Number.isFinite(experiment.retention) ||
    experiment.retention < 0 ||
    experiment.retention > 1
  ) {
    fail(label + ".retention must be between 0 and 1");
  }

  if (
    !Array.isArray(experiment.trend) ||
    experiment.trend.length < 2 ||
    experiment.trend.length > 30 ||
    experiment.trend.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0)
  ) {
    fail(label + ".trend must contain 2-30 finite non-negative numbers");
  }
}

const providerNames = new Set();
for (const [index, provider] of snapshot.providers.entries()) {
  const label = "providers[" + index + "]";
  assertObject(provider, label);
  assertOnlyKeys(provider, allowedProvider, label);
  assertShortString(provider.name, label + ".name", 80);
  if (providerNames.has(provider.name)) fail("provider names must be unique");
  providerNames.add(provider.name);
  if (!["connected", "not_connected", "planned"].includes(provider.state)) {
    fail(label + ".state is invalid");
  }
  if (!Number.isInteger(provider.accounts) || provider.accounts < 0) {
    fail(label + ".accounts must be a non-negative integer");
  }
  assertNonNegative(provider.views, label + ".views");
}

assertObject(snapshot.signals, "signals");
assertOnlyKeys(snapshot.signals, allowedSignals, "signals");
for (const key of ["rising", "flat", "falling"]) {
  if (!Number.isInteger(snapshot.signals[key]) || snapshot.signals[key] < 0) {
    fail("signals." + key + " must be a non-negative integer");
  }
}
assertShortString(snapshot.signals.note, "signals.note", 300);

scanForSensitiveKeys(snapshot, "snapshot");
scanStringValues(snapshot, "snapshot");

const totals = snapshot.experiments.reduce(
  (acc, item) => ({
    views: acc.views + item.views,
    followers: acc.followers + item.followers,
  }),
  { views: 0, followers: 0 },
);

if (totals.views !== snapshot.portfolio.totalViews) {
  fail("portfolio.totalViews must equal experiment totals");
}
if (totals.followers !== snapshot.portfolio.followers) {
  fail("portfolio.followers must equal experiment totals");
}

const activeCount = snapshot.experiments.filter((item) =>
  ["testing", "continue", "scale"].includes(item.status),
).length;
if (activeCount !== snapshot.portfolio.activeExperiments) {
  fail("portfolio.activeExperiments must equal active experiment count");
}

const signalCount =
  snapshot.signals.rising + snapshot.signals.flat + snapshot.signals.falling;
if (signalCount > snapshot.experiments.length) {
  fail("signal counts cannot exceed experiment count");
}

process.stdout.write("Sanitized public snapshot validated.\n");

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(label + " must be an object");
  }
}

function assertOnlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(label + " contains unexpected field: " + key);
  }
}

function assertNonNegative(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(label + " must be a finite non-negative number");
  }
}

function assertShortString(value, label, maxLength) {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) {
    fail(label + " must be a non-empty string no longer than " + maxLength);
  }
}

function scanForSensitiveKeys(value, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForSensitiveKeys(item, label + "[" + index + "]"));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeyPattern.test(key)) {
      fail(label + " contains forbidden sensitive-looking key: " + key);
    }
    scanForSensitiveKeys(child, label + "." + key);
  }
}

function scanStringValues(value, label) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanStringValues(item, label + "[" + index + "]"));
    return;
  }

  if (typeof value === "string") {
    if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(value)) fail(label + " contains an email-like value");
    if (/https?:\/\//i.test(value)) fail(label + " contains a URL");
    if (/-----BEGIN [A-Z ]+-----/.test(value)) fail(label + " contains key-like material");
    if (/\b(?:Bearer\s+|ghp_|github_pat_|sk-)/i.test(value)) fail(label + " contains credential-like material");
    if (/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(value)) {
      fail(label + " contains token-like material");
    }
    return;
  }

  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    scanStringValues(child, label + "." + key);
  }
}

function fail(message) {
  throw new Error("Snapshot validation failed: " + message);
}
