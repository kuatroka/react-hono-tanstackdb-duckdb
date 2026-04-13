import { z } from "zod";

export const dbManifestSchema = z.object({
  active: z.enum(["a", "b"]),
  version: z.number().int().nonnegative(),
  lastUpdated: z.string().optional(),
});
