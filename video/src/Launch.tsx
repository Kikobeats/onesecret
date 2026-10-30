import type React from "react";
import { useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Commit } from "./scenes/Commit";
import { Deploy } from "./scenes/Deploy";
import { Hook } from "./scenes/Hook";
import { Outro } from "./scenes/Outro";
import { Run } from "./scenes/Run";

export const TRANSITION_FRAMES = 15;

export const Launch: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Hook" durationInFrames={5 * fps}>
        <Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />
      <TransitionSeries.Sequence name="① Commit" durationInFrames={9 * fps}>
        <Commit />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />
      <TransitionSeries.Sequence name="② Deploy" durationInFrames={9 * fps}>
        <Deploy />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />
      <TransitionSeries.Sequence name="③ Run" durationInFrames={10 * fps}>
        <Run />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />
      <TransitionSeries.Sequence name="Outro" durationInFrames={5 * fps}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
