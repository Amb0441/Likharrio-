import { readFileSync, writeFileSync } from "node:fs";

const lines = readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split(/\r?\n/)
  .filter((line) => line.startsWith("EXPO_PUBLIC_"));

if (lines.length === 0) {
  console.error("No EXPO_PUBLIC_ values found in .env");
  process.exit(1);
}

writeFileSync(new URL("../docker/public.env", import.meta.url), `${lines.join("\n")}\n`);
console.log(`Wrote ${lines.length} public settings for the Docker build.`);
