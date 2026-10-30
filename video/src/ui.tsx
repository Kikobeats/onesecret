import type React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, FONT, SAFE } from "./theme";

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const TYPING_CHARS_PER_SECOND = 28;

export const enter = (frame: number, start: number, length = 18) => ({
  opacity: interpolate(frame, [start, start + length], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  }),
  translate: interpolate(
    frame,
    [start, start + length],
    ["0px 24px", "0px 0px"],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT,
    },
  ),
});

export const Background: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <AbsoluteFill
    style={{
      backgroundColor: COLOR.bg,
      backgroundImage:
        "radial-gradient(circle at 0% 0%, rgba(61,220,151,0.22), rgba(61,220,151,0) 55%)",
      fontFamily: FONT.sans,
      color: COLOR.ink,
      padding: `${SAFE.top}px ${SAFE.side}px`,
    }}
  >
    {children}
  </AbsoluteFill>
);

export const Mark: React.FC<{ height: number }> = ({ height }) => (
  <Img
    src={staticFile("mark.svg")}
    style={{ height, width: (height * 85) / 48 }}
  />
);

export const StepTitle: React.FC<{
  step: string;
  title: React.ReactNode;
  start?: number;
}> = ({ step, title, start = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 28,
        ...enter(frame, start),
      }}
    >
      <span
        style={{
          fontFamily: FONT.heading,
          fontSize: 84,
          fontWeight: 700,
          color: COLOR.accent,
        }}
      >
        {step}
      </span>
      <span
        style={{
          fontFamily: FONT.heading,
          fontSize: 64,
          fontWeight: 600,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </span>
    </div>
  );
};

export const Caption: React.FC<{
  children: React.ReactNode;
  start: number;
}> = ({ children, start }) => {
  const frame = useCurrentFrame();
  return (
    <p
      style={{
        fontSize: 44,
        lineHeight: 1.3,
        color: COLOR.muted,
        margin: 0,
        ...enter(frame, start),
      }}
    >
      {children}
    </p>
  );
};

export const typedPrefix = (text: string, count: number) =>
  text.slice(0, Math.max(0, count));

export const useTyped = (text: string, start: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const count = Math.floor(((frame - start) / fps) * TYPING_CHARS_PER_SECOND);
  return typedPrefix(text, count);
};

type Line =
  | { kind: "command"; text: string; at: number }
  | {
      kind: "output";
      text: string;
      at: number;
      tone?: "accent" | "warning" | "muted";
    };

const TONE = {
  accent: COLOR.accent,
  warning: COLOR.warning,
  muted: COLOR.muted,
};

const CommandLine: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const frame = useCurrentFrame();
  const typed = useTyped(text, at);
  const cursorOn = Math.floor(frame / 15) % 2 === 0;
  const typing = typed.length < text.length;
  if (frame < at) return null;
  return (
    <div>
      <span style={{ color: COLOR.accent }}>$ </span>
      {typed}
      {typing && cursorOn ? (
        <span style={{ color: COLOR.accent }}>▍</span>
      ) : null}
    </div>
  );
};

const OutputLine: React.FC<{
  text: string;
  at: number;
  tone?: keyof typeof TONE;
}> = ({ text, at, tone = "muted" }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div style={{ color: TONE[tone], ...enter(frame, at, 8) }}>{text}</div>
  );
};

export const Terminal: React.FC<{
  title: string;
  lines: Line[];
  fontSize?: number;
}> = ({ title, lines, fontSize = 30 }) => (
  <div
    style={{
      background: COLOR.surface,
      border: `1px solid ${COLOR.border}`,
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "20px 28px",
        borderBottom: `1px solid ${COLOR.border}`,
        fontFamily: FONT.mono,
        fontSize: 22,
        color: COLOR.subtle,
        letterSpacing: "0.08em",
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          background: COLOR.border,
        }}
      />
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          background: COLOR.border,
        }}
      />
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          background: COLOR.border,
        }}
      />
      <span style={{ marginLeft: 12 }}>{title}</span>
    </div>
    <div
      style={{
        padding: "28px 32px 34px",
        fontFamily: FONT.mono,
        fontSize,
        lineHeight: 1.6,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
      }}
    >
      {lines.map((line, index) =>
        line.kind === "command" ? (
          <CommandLine key={index} text={line.text} at={line.at} />
        ) : (
          <OutputLine
            key={index}
            text={line.text}
            at={line.at}
            tone={line.tone}
          />
        ),
      )}
    </div>
  </div>
);
