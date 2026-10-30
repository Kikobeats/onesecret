import type React from "react";
import { Composition } from "remotion";
import { Launch } from "./Launch";
import { FPS, launchDurationInFrames } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Launch"
    component={Launch}
    durationInFrames={launchDurationInFrames(FPS)}
    fps={FPS}
    width={1080}
    height={1080}
  />
);
