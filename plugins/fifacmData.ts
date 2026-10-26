import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const filenames = [
  "players.json",
  "clubs.json",
  "leagues.json",
  "nations.json",
  "national-teams.json",
  "formations.json",
  "pitch-positions.json",
  "playstyles.json",
  "manifest.json",
];

/** Serve/copy the canonical source files; no manually synchronized public-data copy. */
export function fifacmData(): Plugin {
  let directory: string;
  return {
    name: "fifacm-data",
    configResolved(config) {
      directory = resolve(config.root, "data/fifacm");
    },
    configureServer(server) {
      server.watcher.add(filenames.map((filename) => resolve(directory, filename)));
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        // JSON imports must go through Vite's module transform; fetch requests get raw JSON.
        if (url.searchParams.has("import")) return next();
        const pathname = url.pathname;
        const filename = filenames.find((file) => pathname.endsWith(`/data/fifacm/${file}`));
        if (!filename || !["GET", "HEAD"].includes(request.method ?? "GET")) return next();
        void readFile(resolve(directory, filename))
          .then((contents) => {
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(request.method === "HEAD" ? undefined : contents);
          })
          .catch(next);
      });
    },
    handleHotUpdate(context) {
      if (filenames.some((filename) => context.file === resolve(directory, filename))) {
        context.server.ws.send({ type: "full-reload" });
        return [];
      }
    },
    generateBundle() {
      filenames.forEach((filename) =>
        this.emitFile({
          type: "asset",
          fileName: `data/fifacm/${filename}`,
          source: readFileSync(resolve(directory, filename)),
        }),
      );
    },
  };
}
