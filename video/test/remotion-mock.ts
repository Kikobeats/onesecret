import { createElement, type CSSProperties, type ReactNode } from "react";

export { Easing, interpolate } from "remotion";

export const setFrame = (frame: number) => {
  Reflect.set(globalThis, "__frame", frame);
};

export const useCurrentFrame = () => {
  const frame = Reflect.get(globalThis, "__frame");
  return typeof frame === "number" ? frame : 0;
};

export const useVideoConfig = () => ({
  fps: 30,
  width: 1080,
  height: 1080,
  durationInFrames: 1080,
  id: "Launch",
});

export const staticFile = (path: string) => path;

export const Img = () => null;

export const AbsoluteFill = ({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) => createElement("div", { style }, children);
