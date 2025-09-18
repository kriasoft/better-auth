import { featureFlags } from "better-auth-feature-flags";

const plugin = featureFlags({
  flags: {
    "feature.test": { default: "A" as "A" | "B" },
    "feature.bool": { default: false },
  },
});

type Schema = typeof plugin.$Infer.FlagSchema;

// Expect evaluated schema types
const boolFlag: Schema["feature.bool"] = true;
const variantFlag: Schema["feature.test"] = "A";

export {};
