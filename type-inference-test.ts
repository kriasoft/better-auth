import { featureFlags } from "better-auth-feature-flags";

const plugin = featureFlags({
  flags: {
    "feature.test": { default: false },
  },
});

type Schema = typeof plugin.$Infer.FlagSchema;

// Should be { "feature.test": boolean }
const assertion: Schema = {
  "feature.test": true,
};

export {};
