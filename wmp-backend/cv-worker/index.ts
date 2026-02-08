import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./app";

// Prevent Weaviate client's internal background connections from crashing the process
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (kept alive):", err);
});

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, () => {
  console.log(`cv-worker API running on http://localhost:${port}`);
});
