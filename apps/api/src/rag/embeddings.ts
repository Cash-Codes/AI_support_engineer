/**
 * Thin wrapper around @xenova/transformers' feature-extraction pipeline.
 *
 * The model (all-MiniLM-L6-v2) is loaded lazily on first use and cached for
 * the lifetime of the process. The library downloads weights to a local
 * cache directory on first run; subsequent boots are cold-start fast.
 */

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

export interface Embedder {
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
  modelId: string;
  dim: number;
}

type Pipeline = (
  text: string | string[],
  options?: { pooling?: "mean" | "cls"; normalize?: boolean },
) => Promise<{ data: Float32Array | number[]; dims: number[] }>;

let cached: Promise<Pipeline> | null = null;

async function loadPipeline(): Promise<Pipeline> {
  if (!cached) {
    cached = (async () => {
      const transformers = await import("@xenova/transformers");
      return (await transformers.pipeline(
        "feature-extraction",
        MODEL_ID,
      )) as unknown as Pipeline;
    })();
  }
  return cached;
}

function toArray(raw: Float32Array | number[]): number[] {
  return Array.isArray(raw) ? raw.slice() : Array.from(raw);
}

export async function createEmbedder(): Promise<Embedder> {
  const pipe = await loadPipeline();
  // Probe dimensionality with a single warm-up call
  const probe = await pipe("dim probe", { pooling: "mean", normalize: true });
  const dim = probe.dims[probe.dims.length - 1] ?? toArray(probe.data).length;

  return {
    modelId: MODEL_ID,
    dim,
    async embed(text: string): Promise<number[]> {
      const out = await pipe(text, { pooling: "mean", normalize: true });
      return toArray(out.data);
    },
    async embedMany(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];
      for (const t of texts) {
        const out = await pipe(t, { pooling: "mean", normalize: true });
        results.push(toArray(out.data));
      }
      return results;
    },
  };
}
