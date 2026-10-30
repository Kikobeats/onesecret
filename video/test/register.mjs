import { registerHooks } from "node:module";
import { load, resolve } from "./hooks.mjs";

registerHooks({ load, resolve });
