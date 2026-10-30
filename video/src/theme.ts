import { loadFont as loadHeading } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const heading = loadHeading("normal", {
  weights: ["600", "700"],
  subsets: ["latin"],
});
const sans = loadSans("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});
const mono = loadMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export const FONT = {
  heading: heading.fontFamily,
  sans: sans.fontFamily,
  mono: mono.fontFamily,
};

export const COLOR = {
  bg: "#0f110f",
  surface: "#1a1e1b",
  ink: "#ebe9e2",
  muted: "#a8a59b",
  subtle: "#7c7a72",
  border: "#2e332f",
  accent: "#3ddc97",
  accentSoft: "#183d2b",
  warning: "#f5a95c",
};

export const SAFE = { side: 80, top: 100 };
