import assert from "node:assert/strict";
import test from "node:test";
import { checkRateLimit } from "../lib/rate-limit";

test("rate limit mengizinkan lima request dan menolak request keenam", () => {
  const key = `test-${Date.now()}-${Math.random()}`;
  const start = 1_700_000_000_000;

  for (let index = 0; index < 5; index += 1) {
    assert.equal(checkRateLimit(key, start).allowed, true);
  }

  assert.equal(checkRateLimit(key, start).allowed, false);
  assert.equal(checkRateLimit(key, start + 60_001).allowed, true);
});
