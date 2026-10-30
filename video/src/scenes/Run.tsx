import type React from "react";
import { useVideoConfig } from "remotion";
import { COLOR } from "../theme";
import { Background, Caption, StepTitle, Terminal } from "../ui";

export const Run: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Background>
      <StepTitle
        step="③"
        title={
          <>
            Your app reads env vars, just like <span style={{ color: COLOR.accent }}>today</span>
          </>
        }
      />
      <div style={{ marginTop: 60 }}>
        <Terminal
          title="production"
          lines={[
            { kind: "command", text: "node server.js", at: 0.8 * fps },
            { kind: "output", text: "listening on :3000", at: 1.6 * fps, tone: "accent" },
            { kind: "command", text: "unset STRIPE_KEY && node server.js", at: 3 * fps },
            {
              kind: "output",
              text: "OnesecretError: onesecret: STRIPE_KEY is not set and cannot be decrypted, no age key found",
              at: 4.6 * fps,
              tone: "warning",
            },
          ]}
        />
      </div>
      <div style={{ marginTop: 56 }}>
        <Caption start={5.8 * fps}>No key on the server. Missing a secret? It refuses to start, and names it.</Caption>
      </div>
    </Background>
  );
};
