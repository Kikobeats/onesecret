export const FPS = 30;
export const TRANSITION_FRAMES = 15;

export const SCENES = [
  { name: "Hook", seconds: 5 },
  { name: "① Commit", seconds: 9 },
  { name: "② Deploy", seconds: 9 },
  { name: "③ Run", seconds: 10 },
  { name: "Outro", seconds: 5 },
] as const;

export const launchDurationInFrames = (fps: number) =>
  SCENES.reduce((total, scene) => total + scene.seconds * fps, 0) -
  (SCENES.length - 1) * TRANSITION_FRAMES;

export const sceneStart = (index: number, fps: number) => {
  let start = 0;
  for (let i = 0; i < index; i++) {
    start += SCENES[i].seconds * fps - TRANSITION_FRAMES;
  }
  return start;
};

export const flowDotOpacity = (travel: number) =>
  travel > 0 && travel < 1 ? 1 : 0;
