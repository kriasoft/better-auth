// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { createAuthClient } from "better-auth/client";

type BetterAuthClient = ReturnType<typeof createAuthClient>;
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
  type ComponentType,
} from "react";
import type {
  FeatureFlagsClient,
  FeatureFlagResult,
  FeatureFlagVariant,
  EvaluationContext,
} from "./client";

// ============================================================================
// Types
// ============================================================================

interface FeatureFlagsContextValue {
  client: BetterAuthClient & FeatureFlagsClient;
  flags: Record<string, any>;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface FeatureFlagsProviderProps {
  client: BetterAuthClient & FeatureFlagsClient;
  children: ReactNode;
  /**
   * Pre-populated flags for SSR/initial render.
   * Prevents flash of default content.
   */
  initialFlags?: Record<string, any>;
  /**
   * Fetch fresh flags on mount. Set false for SSR with initialFlags.
   */
  fetchOnMount?: boolean;
  /**
   * Evaluation context merged with session data.
   * Changes trigger cache invalidation.
   */
  context?: Partial<EvaluationContext>;
}

interface FeatureProps {
  /**
   * Flag key to evaluate.
   */
  flag: string;
  /**
   * Renders when flag is false/missing. Defaults to null.
   */
  fallback?: ReactNode;
  /**
   * Secondary check after flag passes (e.g., subscription tier).
   * Return false to show fallback despite flag=true.
   */
  validateAccess?: (flags: Record<string, any>) => boolean;
  /**
   * Renders when flag is true AND validateAccess passes.
   */
  children: ReactNode;
}

interface VariantProps {
  /**
   * The feature flag key to check for variants
   */
  flag: string;
  /**
   * Children components (Variant.Case and Variant.Default)
   */
  children: ReactNode;
}

interface VariantCaseProps {
  /**
   * The variant key to match
   */
  variant: string;
  /**
   * Content to render for this variant
   */
  children: ReactNode;
}

interface VariantDefaultProps {
  /**
   * Content to render when no variant matches
   */
  children: ReactNode;
}

interface FeatureFlagErrorBoundaryProps {
  /**
   * Fallback component to render on error
   */
  fallback: ReactNode | ComponentType<{ error: Error }>;
  /**
   * Error callback
   */
  onError?: (error: Error) => void;
  /**
   * Children components
   */
  children: ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(
  null,
);

/**
 * Enforces provider boundary. Throws if hooks used outside provider.
 */
const useFeatureFlagsContext = () => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error(
      "Feature flags hooks must be used within FeatureFlagsProvider",
    );
  }
  return context;
};

// ============================================================================
// Provider
// ============================================================================

export function FeatureFlagsProvider({
  client,
  children,
  initialFlags = {},
  fetchOnMount = true,
  context: additionalContext,
}: FeatureFlagsProviderProps) {
  const [flags, setFlags] = useState<Record<string, any>>(initialFlags);
  const [loading, setLoading] = useState(fetchOnMount);
  const [error, setError] = useState<Error | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  // Context changes invalidate cache to ensure correct evaluation.
  useEffect(() => {
    if (additionalContext) {
      client.featureFlags.setContext(additionalContext);
    }
  }, [client, additionalContext]);

  // Subscribe to flag changes and cache invalidation.
  useEffect(() => {
    const unsubscribe = client.featureFlags.subscribe((newFlags) => {
      // Empty object = cache cleared (session change). Non-empty = flag update.
      if (Object.keys(newFlags).length === 0 && Object.keys(flags).length > 0) {
        setNeedsRefresh(true); // Defer fetch to avoid race conditions.
      } else {
        setFlags(newFlags);
      }
    });

    return unsubscribe;
  }, [client, flags]);

  // Deferred refresh after cache invalidation prevents double-fetching.
  useEffect(() => {
    if (needsRefresh) {
      setNeedsRefresh(false);
      setLoading(true);
      client.featureFlags
        .getAllFlags()
        .then((fetchedFlags) => {
          setFlags(fetchedFlags);
          setError(null);
        })
        .catch((err) => {
          setError(err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [needsRefresh, client]);

  // Fetch flags on mount if enabled
  useEffect(() => {
    if (fetchOnMount) {
      setLoading(true);
      client.featureFlags
        .getAllFlags()
        .then((fetchedFlags) => {
          setFlags(fetchedFlags);
          setError(null);
        })
        .catch((err) => {
          setError(err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [client, fetchOnMount]);

  // Session changes trigger flag refresh (user-specific flags).
  useEffect(() => {
    // Better Auth v1.0+ exposes reactive session via $sessionSignal.
    if ("$sessionSignal" in client && (client as any).$sessionSignal) {
      const unsubscribe = (client as any).$sessionSignal.subscribe(() => {
        const currentSession = (client as any).session;
        const currentSessionId = currentSession?.session?.id || null;

        // Session change = different user context = different flags.
        if (currentSessionId !== lastSessionId) {
          setLastSessionId(currentSessionId);
          setLoading(true);
          client.featureFlags
            .refresh()
            .then(() => {
              setError(null);
            })
            .catch((err) => {
              setError(err as Error);
            })
            .finally(() => {
              setLoading(false);
            });
        }
      });

      return unsubscribe;
    }
  }, [client, lastSessionId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await client.featureFlags.refresh();
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client]);

  const value = useMemo(
    () => ({
      client,
      flags,
      loading,
      error,
      refresh,
    }),
    [client, flags, loading, error, refresh],
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Returns boolean flag value. Fetches from server if not cached.
 * @param flag - Flag key to evaluate
 * @param defaultValue - Fallback if flag missing/errored
 */
export function useFeatureFlag(flag: string, defaultValue = false): boolean {
  const { client, flags } = useFeatureFlagsContext();
  const [value, setValue] = useState<boolean>(
    flags[flag] !== undefined ? Boolean(flags[flag]) : defaultValue,
  );

  useEffect(() => {
    if (flags[flag] !== undefined) {
      setValue(Boolean(flags[flag])); // Sync with provider's cached state.
    } else {
      // Cache miss: fetch individually (avoids blocking on getAllFlags).
      client.featureFlags
        .isEnabled(flag, defaultValue)
        .then(setValue)
        .catch(() => setValue(defaultValue));
    }
  }, [client, flag, flags, defaultValue]);

  return value;
}

/**
 * Returns typed flag value (string, number, object, etc).
 * @param flag - Flag key to evaluate
 * @param defaultValue - Type-safe fallback
 */
export function useFeatureFlagValue<T = any>(
  flag: string,
  defaultValue?: T,
): T {
  const { client, flags } = useFeatureFlagsContext();
  const [value, setValue] = useState<T>(
    flags[flag] !== undefined ? flags[flag] : defaultValue,
  );

  useEffect(() => {
    if (flags[flag] !== undefined) {
      setValue(flags[flag]);
    } else {
      client.featureFlags
        .getValue(flag, defaultValue)
        .then(setValue)
        .catch(() => setValue(defaultValue as T));
    }
  }, [client, flag, flags, defaultValue]);

  return value;
}

/**
 * Get all feature flags
 */
export function useFeatureFlags(): Record<string, any> {
  const { flags } = useFeatureFlagsContext();
  return flags;
}

/**
 * Get the variant of a feature flag
 */
export function useVariant(flag: string): FeatureFlagVariant | null {
  const { client, flags } = useFeatureFlagsContext();
  const [variant, setVariant] = useState<FeatureFlagVariant | null>(null);

  useEffect(() => {
    client.featureFlags
      .getVariant(flag)
      .then(setVariant)
      .catch(() => setVariant(null));
  }, [client, flag, flags]);

  return variant;
}

/**
 * Track an event for a feature flag
 */
export function useTrackEvent() {
  const { client } = useFeatureFlagsContext();

  return useCallback(
    (flag: string, event: string, value?: number | Record<string, any>) => {
      return client.featureFlags.track(flag, event, value);
    },
    [client],
  );
}

/**
 * Get feature flags loading and error state
 */
export function useFeatureFlagsState() {
  const { loading, error, refresh } = useFeatureFlagsContext();
  return { loading, error, refresh };
}

/**
 * Debug hook: Exposes cache state for monitoring.
 * Not for production UI - use for troubleshooting.
 */
export function useFeatureFlagsCacheInfo() {
  const { client } = useFeatureFlagsContext();
  const [cacheInfo, setCacheInfo] = useState<{
    cacheEnabled: boolean;
    sessionId?: string;
    flagCount: number;
  }>({ cacheEnabled: false, flagCount: 0 });

  useEffect(() => {
    const updateCacheInfo = () => {
      client.featureFlags.getAllFlags().then((flags) => {
        setCacheInfo({
          cacheEnabled: true,
          flagCount: Object.keys(flags).length,
        });
      });
    };

    updateCacheInfo();
    const unsubscribe = client.featureFlags.subscribe(updateCacheInfo);
    return unsubscribe;
  }, [client]);

  return cacheInfo;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Declarative flag gating. Prevents render of protected content.
 *
 * @example
 * <Feature flag="new-dashboard" fallback={<OldDashboard />}>
 *   <NewDashboard />
 * </Feature>
 */
export function Feature({
  flag,
  fallback = null,
  validateAccess,
  children,
}: FeatureProps) {
  const isEnabled = useFeatureFlag(flag);
  const flags = useFeatureFlags();

  const hasAccess = useMemo(() => {
    if (!isEnabled) return false;
    if (validateAccess) return validateAccess(flags); // Secondary gate.
    return true;
  }, [isEnabled, validateAccess, flags]);

  return <>{hasAccess ? children : fallback}</>;
}

/**
 * A/B testing component. Renders child matching current variant.
 *
 * @example
 * <Variant flag="checkout-flow">
 *   <Variant.Case variant="v1"><CheckoutV1 /></Variant.Case>
 *   <Variant.Case variant="v2"><CheckoutV2 /></Variant.Case>
 *   <Variant.Default><CheckoutOriginal /></Variant.Default>
 * </Variant>
 */
export const Variant = React.memo(function Variant({
  flag,
  children,
}: VariantProps) {
  const variant = useVariant(flag);

  const selectedChild = useMemo(() => {
    let defaultChild: ReactNode = null;
    let matchedChild: ReactNode = null;

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;

      if (child.type === VariantCase) {
        const caseProps = child.props as any;
        if (variant && caseProps.variant === variant.key) {
          matchedChild = caseProps.children;
        }
      } else if (child.type === VariantDefault) {
        defaultChild = (child.props as any).children;
      }
    });

    return matchedChild || defaultChild;
  }, [children, variant]);

  return <>{selectedChild}</>;
});

/**
 * Variant case component (used with Variant)
 */
function VariantCase({ children }: VariantCaseProps) {
  return <>{children}</>;
}

/**
 * Default variant component (used with Variant)
 */
function VariantDefault({ children }: VariantDefaultProps) {
  return <>{children}</>;
}

// Attach sub-components to Variant
(Variant as any).Case = VariantCase;
(Variant as any).Default = VariantDefault;

// ============================================================================
// Error Boundary
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches errors in flag evaluation/rendering.
 * Prevents entire app crash from flag service issues.
 */
export class FeatureFlagErrorBoundary extends React.Component<
  FeatureFlagErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: FeatureFlagErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error) {
    this.props.onError?.(error); // Log to monitoring service.
  }

  override render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === "function") {
        const FallbackComponent = fallback;
        return <FallbackComponent error={this.state.error!} />;
      }
      return fallback;
    }

    return this.props.children;
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * HOC for class components or prop drilling.
 * Prefer hooks (useFeatureFlags) for new code.
 */
export function withFeatureFlags<P extends object>(
  Component: ComponentType<P & { featureFlags: Record<string, any> }>,
): ComponentType<P> {
  return function WithFeatureFlagsComponent(props: P) {
    const flags = useFeatureFlags();
    return <Component {...props} featureFlags={flags} />;
  };
}

/**
 * HOC for feature gating at component definition.
 *
 * @example
 * export default withFeatureFlag('beta-ui', LegacyComponent)(BetaComponent);
 */
export function withFeatureFlag<P extends object>(
  flag: string,
  fallback?: ComponentType<P>,
): (Component: ComponentType<P>) => ComponentType<P> {
  return function (Component: ComponentType<P>) {
    return function WithFeatureFlagComponent(props: P) {
      const isEnabled = useFeatureFlag(flag);

      if (!isEnabled && fallback) {
        const FallbackComponent = fallback;
        return <FallbackComponent {...props} />;
      }

      return isEnabled ? <Component {...props} /> : null;
    };
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  FeatureFlagsProviderProps,
  FeatureProps,
  VariantProps,
  VariantCaseProps,
  VariantDefaultProps,
  FeatureFlagErrorBoundaryProps,
};
