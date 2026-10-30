import assert from "node:assert/strict";
import test from "node:test";
import {
  FPS,
  SCENES,
  TRANSITION_FRAMES,
  flowDotOpacity,
  launchDurationInFrames,
  sceneStart,
} from "../src/timeline.ts";

test("the composition is one clock for five scenes and four fades", () => {
  assert.equal(FPS, 30);
  assert.equal(TRANSITION_FRAMES, 15);
  assert.deepEqual(
    SCENES.map((scene) => scene.name),
    ["Hook", "① Commit", "② Deploy", "③ Run", "Outro"],
  );
  assert.deepEqual(
    SCENES.map((scene) => scene.seconds),
    [5, 9, 9, 10, 5],
  );
  assert.deepEqual(
    SCENES.map((_, index) => sceneStart(index, FPS)),
    [0, 135, 390, 645, 930],
  );
  assert.equal(launchDurationInFrames(FPS), 1080);
  assert.equal(
    sceneStart(SCENES.length - 1, FPS) + SCENES.at(-1).seconds * FPS,
    1080,
  );
});

test("the deploy dot is visible only while it is between the nodes", () => {
  assert.equal(flowDotOpacity(0), 0);
  assert.equal(flowDotOpacity(-0.01), 0);
  assert.equal(flowDotOpacity(0.5), 1);
  assert.equal(flowDotOpacity(1), 0);
  assert.equal(flowDotOpacity(1.01), 0);
});
