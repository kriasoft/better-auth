import { featureFlags } from "better-auth-feature-flags";

type PluginType = ReturnType<typeof featureFlags>;

type HasInfer = PluginType extends { $Infer: infer _ } ? true : false;

const assert: HasInfer = true;

export {};
