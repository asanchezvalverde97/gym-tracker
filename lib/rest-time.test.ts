import assert from "node:assert/strict";

import {
  fromRestParts,
  getRestSecondsOptions,
  toRestParts,
} from "./rest-time";

function test(name: string, run: () => void) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("toRestParts snaps total seconds to the nearest wheel value", () => {
  assert.deepEqual(toRestParts(92), { minutes: 1, seconds: 32 });
  assert.deepEqual(toRestParts(118), { minutes: 1, seconds: 58 });
});

test("getRestSecondsOptions only exposes supported editable values", () => {
  assert.deepEqual(getRestSecondsOptions(), [0, 30]);
});

test("fromRestParts preserves exact minute and second inputs without carry", () => {
  assert.equal(fromRestParts(1, 30), 90);
  assert.equal(fromRestParts(2, 0), 120);
});

test("fromRestParts clamps unsupported second values to zero and allows five thirty", () => {
  assert.equal(fromRestParts(1, 15), 60);
  assert.equal(fromRestParts(5, 30), 330);
});
