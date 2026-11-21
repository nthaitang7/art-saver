import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import { fetchPreview, type PreviewFetcher } from "./preview";
import { libraryRouter } from "./routes/library";
import type { Store } from "./store";

const here = dirname(fileURLToPath(import.meta.url));
const clientDist = resolve(here, "../../client/dist");

export interface AppOptions {
  /** Override the preview fetcher. Tests use this so they never touch the network. */
  preview?: PreviewFetcher;
}

export function createApp(store: Store, options: AppOptions = {}): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.use("/api", libraryRouter(store, options.preview ?? fetchPreview));

  // In production the built client is served from the same origin. In dev, vite proxies /api here.
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("*", (req: Request, res: Response, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(resolve(clientDist, "index.html"));
    });
  }

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  };
  app.use(errorHandler);

  return app;
}