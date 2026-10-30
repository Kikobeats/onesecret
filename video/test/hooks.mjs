import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const fontMock = new URL("./font-mock.ts", import.meta.url).href;
const remotionMock = new URL("./remotion-mock.ts", import.meta.url).href;

const FONT_SPECIFIERS = new Set([
  "@remotion/google-fonts/SpaceGrotesk",
  "@remotion/google-fonts/IBMPlexSans",
  "@remotion/google-fonts/JetBrainsMono",
]);

const extensionFor = (parentURL, specifier) => {
  if (!specifier.startsWith(".") || !parentURL) return null;
  const path = fileURLToPath(new URL(specifier, parentURL));
  for (const extension of [".ts", ".tsx", ".mjs", ".js"]) {
    if (existsSync(path + extension))
      return new URL(`${specifier}${extension}`, parentURL).href;
  }
  return null;
};

export function resolve(specifier, context, next) {
  if (FONT_SPECIFIERS.has(specifier)) {
    return { url: fontMock, shortCircuit: true };
  }
  if (specifier === "remotion" && context.parentURL?.includes("/video/src/")) {
    return { url: remotionMock, shortCircuit: true };
  }
  const typed = extensionFor(context.parentURL, specifier);
  if (typed) return { url: typed, shortCircuit: true };
  return next(specifier, context);
}

export function load(url, context, next) {
  if (!url.endsWith(".ts") && !url.endsWith(".tsx")) return next(url, context);
  const source = readFileSync(fileURLToPath(url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: url.endsWith(".tsx") ? "file.tsx" : "file.ts",
  });
  return { format: "module", source: outputText, shortCircuit: true };
}
