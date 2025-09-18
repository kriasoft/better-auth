import { featureFlags } from "./plugins/feature-flags/src/index";

const plugin = featureFlags({
  flags: {
    "feature.test": { default: false },
  },
});

type Schema = typeof plugin.$Infer.FlagSchema;

const assertion: Schema = {
  "feature.test": true,
};

export {};
