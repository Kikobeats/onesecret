import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLOR, FONT } from "../theme";
import { Background, Mark, enter } from "../ui";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Background>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 34, ...enter(frame, 0) }}>
          <Mark height={104} />
          <span style={{ fontFamily: FONT.heading, fontSize: 124, fontWeight: 700, letterSpacing: "-0.02em" }}>
            onesecret
          </span>
        </div>
        <p style={{ fontSize: 50, margin: 0, color: COLOR.ink, ...enter(frame, 0.4 * fps) }}>
          Keep just one secret to decrypt the rest.
        </p>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 44,
            background: COLOR.surface,
            border: `1px solid ${COLOR.border}`,
            borderRadius: 18,
            padding: "22px 40px",
            ...enter(frame, 0.8 * fps),
          }}
        >
          <span style={{ color: COLOR.accent }}>$ </span>npm install onesecret
        </div>
        <p style={{ fontFamily: FONT.mono, fontSize: 38, margin: 0, color: COLOR.muted, ...enter(frame, 1.2 * fps) }}>
          onesecret.js.org
        </p>
      </AbsoluteFill>
    </Background>
  );
};
