import type React from "react";
import { useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Commit } from "./scenes/Commit";
import { Deploy } from "./scenes/Deploy";
import { Hook } from "./scenes/Hook";
import { Outro } from "./scenes/Outro";
import { Run } from "./scenes/Run";
import { SCENES, TRANSITION_FRAMES } from "./timeline";

export const Launch: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence
        name={SCENES[0].name}
        durationInFrames={SCENES[0].seconds * fps}
      >
        <Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />
      <TransitionSeries.Sequence
        name={SCENES[1].name}
        durationInFrames={SCENES[1].seconds * fps}
      >
        <Commit />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />
      <TransitionSeries.Sequence
        name={SCENES[2].name}
        durationInFrames={SCENES[2].seconds * fps}
      >
        <Deploy />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />
      <TransitionSeries.Sequence
        name={SCENES[3].name}
        durationInFrames={SCENES[3].seconds * fps}
      >
        <Run />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />
      <TransitionSeries.Sequence
        name={SCENES[4].name}
        durationInFrames={SCENES[4].seconds * fps}
      >
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
