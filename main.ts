// main.ts — the entrypoint for the Meridian Midnight heist game.
// Copies the static game and its screenshots into the output directory and
// writes the dossier buildDossier builds from exactly those files, so the
// dossier the judge reads always matches the game that was handed in.
// Runs on Node 22, standard library only; no network, no build step.

import { buildDossier } from "./vendor/makefun-game.ts";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

await mkdir(outDir, { recursive: true });
await cp(join(repoRoot, "game"), join(outDir, "game"), { recursive: true });
await cp(join(repoRoot, "screenshots"), join(outDir, "screenshots"), { recursive: true });

const dossier = await buildDossier(outDir, { text_max_bytes: 163840 });
await writeFile(join(outDir, "dossier.json"), dossier);
