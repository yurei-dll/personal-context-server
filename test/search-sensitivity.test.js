import assert from "node:assert/strict";
import test from "node:test";

import { similarityThresholdForSensitivity } from "../dist/mcp/tools.js";

test("search sensitivity maps to progressively broader similarity thresholds", () => {
    const low = similarityThresholdForSensitivity("low");
    const medium = similarityThresholdForSensitivity("medium");
    const high = similarityThresholdForSensitivity("high");

    assert.equal(low, 0.75);
    assert.equal(medium, 0.5);
    assert.equal(high, -1);
    assert.ok(low > medium);
    assert.ok(medium > high);
});

test("search sensitivity defaults to backward-compatible broad retrieval", () => {
    assert.equal(similarityThresholdForSensitivity(), -1);
});
