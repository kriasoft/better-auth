// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { expectTypeOf, test } from "bun:test";
import { featureFlagsClient } from "./client";
import { featureFlags } from "./index";

test("TSchema type flow: server → $Infer → client → $InferServerPlugin", () => {
  // Define a specific flag schema
  interface MyAppFlags {
    "ui.darkMode": boolean;
    "experiment.algorithm": "v1" | "v2" | "v3";
    "config.maxItems": number;
  }

  // 1. Server plugin with typed schema
  const serverPlugin = featureFlags<MyAppFlags>();

  // 2. Verify server plugin exports the schema type via $Infer.FlagSchema
  type ServerInferred = typeof serverPlugin.$Infer.FlagSchema;
  expectTypeOf<ServerInferred>().toEqualTypeOf<MyAppFlags>();

  // 3. Client plugin references server via $InferServerPlugin
  const clientPlugin = featureFlagsClient<MyAppFlags>();

  // 4. Verify client can extract server's schema type through $InferServerPlugin
  type ClientInferred =
    typeof clientPlugin.$InferServerPlugin.$Infer.FlagSchema;
  expectTypeOf<ClientInferred>().toEqualTypeOf<MyAppFlags>();

  // 5. Verify type flow preserves schema across server-client boundary
  expectTypeOf<ClientInferred>().toEqualTypeOf<ServerInferred>();
});

test("Different schemas produce different types", () => {
  interface SchemaA {
    "feature.a": boolean;
  }

  interface SchemaB {
    "feature.b": string;
  }

  const serverA = featureFlags<SchemaA>();
  const serverB = featureFlags<SchemaB>();

  const clientA = featureFlagsClient<SchemaA>();
  const clientB = featureFlagsClient<SchemaB>();

  // Verify different schemas result in different types
  type SchemaTypeA = typeof serverA.$Infer.FlagSchema;
  type SchemaTypeB = typeof serverB.$Infer.FlagSchema;

  type ClientSchemaA = typeof clientA.$InferServerPlugin.$Infer.FlagSchema;
  type ClientSchemaB = typeof clientB.$InferServerPlugin.$Infer.FlagSchema;

  expectTypeOf<SchemaTypeA>().not.toEqualTypeOf<SchemaTypeB>();
  expectTypeOf<ClientSchemaA>().not.toEqualTypeOf<ClientSchemaB>();

  // Verify each client matches its corresponding server
  expectTypeOf<ClientSchemaA>().toEqualTypeOf<SchemaTypeA>();
  expectTypeOf<ClientSchemaB>().toEqualTypeOf<SchemaTypeB>();
});
