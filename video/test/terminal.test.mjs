import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setFrame } from "./remotion-mock.ts";
import { Terminal } from "../src/ui.tsx";

const html = (frame, lines) => {
  setFrame(frame);
  return renderToStaticMarkup(
    createElement(Terminal, { title: "shell", lines }),
  );
};

test("terminal lines follow kind, tone, typing, and the blink", () => {
  const hidden = html(9, [{ kind: "command", text: "abcdefghij", at: 10 }]);
  assert.equal(hidden.includes("abcdefghij"), false);
  assert.equal(hidden.includes("$"), false);

  const started = html(10, [{ kind: "command", text: "abcdefghij", at: 10 }]);
  assert.match(started, /\$ <\/span><span style="color:#3ddc97">▍/);

  const oddBlink = html(15, [{ kind: "command", text: "abcdefghij", at: 10 }]);
  assert.match(oddBlink, /\$ <\/span>abcd/);
  assert.equal(oddBlink.includes("▍"), false);

  const finished = html(103, [{ kind: "command", text: "hi", at: 100 }]);
  assert.match(finished, /\$ <\/span>hi/);
  assert.equal(finished.includes("▍"), false);

  const beforeOutput = html(49, [
    { kind: "output", text: "SECRET_OUTPUT", at: 50, tone: "accent" },
  ]);
  assert.equal(beforeOutput.includes("SECRET_OUTPUT"), false);

  const accent = html(50, [
    { kind: "output", text: "ACCENT_LINE", at: 50, tone: "accent" },
  ]);
  assert.match(accent, /color:#3ddc97[^>]*>ACCENT_LINE/);
  assert.equal(accent.includes("$"), false);

  const warning = html(50, [
    { kind: "output", text: "WARNING_LINE", at: 50, tone: "warning" },
  ]);
  assert.match(warning, /color:#f5a95c[^>]*>WARNING_LINE/);

  const muted = html(50, [
    { kind: "output", text: "MUTED_LINE", at: 50, tone: "muted" },
  ]);
  assert.match(muted, /color:#a8a59b[^>]*>MUTED_LINE/);

  const omitted = html(50, [{ kind: "output", text: "OMITTED_LINE", at: 50 }]);
  assert.match(omitted, /color:#a8a59b[^>]*>OMITTED_LINE/);

  const both = html(80, [
    { kind: "command", text: "echo hi", at: 0 },
    { kind: "output", text: "listening", at: 0, tone: "accent" },
  ]);
  assert.match(both, /\$ <\/span>echo hi/);
  assert.match(both, /color:#3ddc97[^>]*>listening/);
  assert.equal(both.includes("$ listening"), false);
});
