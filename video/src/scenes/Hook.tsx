import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLOR, FONT } from "../theme";
import { Background, Mark, enter } from "../ui";

const SECRETS = [
  { name: "DATABASE_URL", plain: "postgres://app:s3cr3t@db.prod", cipher: "ENC[AES256_GCM,data:jPk9QuaL…]" },
  { name: "STRIPE_KEY", plain: "sk_live_51H8xQ2", cipher: "ENC[AES256_GCM,data:fboHl//c…]" },
];


const SecretLine: React.FC<{ name: string; plain: string; cipher: string }> = ({ name, plain, cipher }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [1.8 * fps, 3.2 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const swept = Math.round(cipher.length * progress);
  return (
    <div>
      <span style={{ color: COLOR.ink }}>{name}: </span>
      <span style={{ color: COLOR.subtle }}>{cipher.slice(0, swept)}</span>
      <span style={{ color: COLOR.warning }}>{plain.slice(swept)}</span>
    </div>
  );
};

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Background>
      <div style={{ display: "flex", alignItems: "center", gap: 22, ...enter(frame, 0) }}>
        <Mark height={46} />
        <span style={{ fontFamily: FONT.heading, fontSize: 52, fontWeight: 700 }}>onesecret</span>
      </div>
      <h1
        style={{
          fontFamily: FONT.heading,
          fontSize: 96,
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: "-0.02em",
          margin: "90px 0 70px",
          ...enter(frame, 0.3 * fps),
        }}
      >
        Commit your secrets.
        <br />
        <span style={{ color: COLOR.accent }}>Encrypted.</span>
      </h1>
      <div
        style={{
          background: COLOR.surface,
          border: `1px solid ${COLOR.border}`,
          borderRadius: 20,
          padding: "30px 34px",
          fontFamily: FONT.mono,
          fontSize: 30,
          lineHeight: 1.7,
          ...enter(frame, 0.8 * fps),
        }}
      >
        <div style={{ color: COLOR.subtle }}># config/production.enc.yml</div>
        {SECRETS.map((secret) => (
          <SecretLine key={secret.name} {...secret} />
        ))}
      </div>
    </Background>
  );
};
