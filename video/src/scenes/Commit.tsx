import type React from "react";
import { useVideoConfig } from "remotion";
import { Background, Caption, StepTitle, Terminal } from "../ui";

export const Commit: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Background>
      <StepTitle step="①" title="Commit secrets, encrypted" />
      <div style={{ marginTop: 70 }}>
        <Terminal
          title="your laptop"
          lines={[
            { kind: "command", text: "npx onesecret set --env production STRIPE_KEY", at: 1 * fps },
            { kind: "output", text: "config/production.enc.yml encrypted", at: 3.1 * fps, tone: "accent" },
            { kind: "command", text: 'git commit -am "Add STRIPE_KEY"', at: 4 * fps },
          ]}
        />
      </div>
      <div style={{ marginTop: 70 }}>
        <Caption start={6 * fps}>
          A new secret ships in the same PR as the code that needs it, reviewed, with history.
        </Caption>
      </div>
    </Background>
  );
};
