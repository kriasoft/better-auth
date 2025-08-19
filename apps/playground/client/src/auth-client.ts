// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createAuthClient } from "better-auth/react";
import { storageClient } from "better-auth-storage/client";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || "",
  plugins: [storageClient()],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
