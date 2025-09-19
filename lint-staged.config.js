export default {
  // Run prettier with --check flag (verify mode) on supported file types
  "*.{js,jsx,ts,tsx,json,md,yml,yaml}": ["prettier --check --ignore-unknown"],

  // Run typecheck only once when TypeScript files are changed
  "*.{ts,tsx}": () => "bun run typecheck",

  // Run schema generation only once when TypeScript files are changed
  "*.ts": () => "bun run generate:schema",
};
