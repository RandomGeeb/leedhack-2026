import { Hono } from "hono";
import { cors } from "hono/cors";
import { FaceRecognitionClient } from "./client";

const app = new Hono().basePath("/api");

app.use("*", cors());

// Lazy singleton — initialised once, reused across warm invocations.
// Resets on failure so the next request retries.
let clientPromise: Promise<FaceRecognitionClient> | null = null;
function getClient() {
  if (!clientPromise) {
    clientPromise = FaceRecognitionClient.create().catch((err) => {
      clientPromise = null; // allow retry on next request
      throw err;
    });
  }
  return clientPromise;
}

// Health check — no DB call, confirms routing works
app.get("/", (c) =>
  c.json({
    status: "ok",
    env: {
      hasClusterUrl: !!process.env.WEAVIATE_CLUSTER_URL,
      hasApiKey: !!process.env.WEAVIATE_API_KEY,
      hasEmbeddingUrl: !!process.env.PYTHON_EMBEDDING_URL,
    },
  })
);

// Search by base64 image
app.post("/search", async (c) => {
  try {
    const client = await getClient();
    const body = await c.req.json();
    const { image, topK, threshold } = body as {
      image: string;
      topK?: number;
      threshold?: number;
    };

    if (!image) {
      return c.json({ error: "Missing 'image' field (base64 string)" }, 400);
    }

    // Strip optional data-URI prefix (e.g. "data:image/jpeg;base64,")
    const base64 = image.includes(",") ? image.split(",")[1] : image;

    const result = await client.searchByBase64(base64, {
      topK: topK ?? 3,
      threshold: threshold ?? 0.4,
    });

    return c.json(result);
  } catch (err: any) {
    console.error("Search error:", err);
    return c.json({ error: err.message ?? "Internal server error" }, 500);
  }
});

// List registered people
app.get("/people", async (c) => {
  try {
    const client = await getClient();
    const people = await client.listPeople();
    return c.json(people);
  } catch (err: any) {
    console.error("People error:", err);
    return c.json({ error: err.message ?? "Internal server error" }, 500);
  }
});

// Database stats
app.get("/stats", async (c) => {
  try {
    const client = await getClient();
    const stats = await client.getStats();
    return c.json(stats);
  } catch (err: any) {
    console.error("Stats error:", err);
    return c.json({ error: err.message ?? "Internal server error" }, 500);
  }
});

export default app;
