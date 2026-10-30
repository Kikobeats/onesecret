import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLOR, FONT } from "../theme";
import { Background, Caption, StepTitle, enter } from "../ui";

type Tone = "store" | "accent" | "app";

const TONES: Record<Tone, { border: string; background: string; tag: string }> = {
  store: { border: COLOR.muted, background: "rgba(235,233,226,0.04)", tag: COLOR.muted },
  accent: { border: COLOR.accent, background: "rgba(61,220,151,0.10)", tag: COLOR.accent },
  app: { border: COLOR.ink, background: COLOR.surface, tag: COLOR.ink },
};

const Node: React.FC<{ tag: string; name: string; detail: string; tone: Tone; at: number }> = ({
  tag,
  name,
  detail,
  tone,
  at,
}) => {
  const frame = useCurrentFrame();
  const { border, background, tag: tagColor } = TONES[tone];
  return (
    <div
      style={{
        border: `2px solid ${border}`,
        background,
        borderRadius: 16,
        padding: "22px 30px",
        display: "flex",
        alignItems: "center",
        gap: 28,
        ...enter(frame, at),
      }}
    >
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 20,
          letterSpacing: "0.08em",
          color: tagColor,
          border: `1px solid ${tagColor}`,
          borderRadius: 6,
          padding: "4px 10px",
          whiteSpace: "nowrap",
        }}
      >
        {tag}
      </span>
      <div>
        <div style={{ fontFamily: FONT.heading, fontSize: 40, fontWeight: 600 }}>{name}</div>
        <div style={{ fontFamily: FONT.mono, fontSize: 24, color: COLOR.muted, marginTop: 4 }}>{detail}</div>
      </div>
    </div>
  );
};

const Flow: React.FC<{ at: number; label: string }> = ({ at, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const travel = interpolate(frame, [at, at + 0.9 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const height = 64;
  return (
    <div style={{ position: "relative", height, marginLeft: 60, ...enter(frame, at, 10) }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: COLOR.border }} />
      <div
        style={{
          position: "absolute",
          left: -7,
          top: travel * (height - 16),
          width: 16,
          height: 16,
          borderRadius: 8,
          background: COLOR.accent,
          boxShadow: `0 0 18px ${COLOR.accent}`,
          opacity: travel > 0 && travel < 1 ? 1 : 0,
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 30,
          top: height / 2 - 14,
          fontFamily: FONT.mono,
          fontSize: 22,
          letterSpacing: "0.08em",
          color: COLOR.subtle,
        }}
      >
        {label}
      </span>
    </div>
  );
};

export const Deploy: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Background>
      <StepTitle step="②" title="CI decrypts in memory" />
      <div style={{ marginTop: 60, display: "flex", flexDirection: "column" }}>
        <Node tag="REPO + KEY" name="config/*.enc.yml" detail="encrypted, plus the one key" tone="store" at={0.6 * fps} />
        <Flow at={1.6 * fps} label="CIPHERTEXT" />
        <Node tag="CI" name="deploy job" detail="onesecret dotenv, in memory" tone="accent" at={2.3 * fps} />
        <Flow at={3.3 * fps} label="VALUES" />
        <Node tag="PLATFORM" name="Vercel, Fly.io, AWS…" detail="stores them as env vars" tone="app" at={4 * fps} />
      </div>
      <div style={{ marginTop: 56 }}>
        <Caption start={5.4 * fps}>No plaintext file is ever written.</Caption>
      </div>
    </Background>
  );
};
