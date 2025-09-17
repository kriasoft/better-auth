// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { createAuthClient } from "better-auth/client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import type { EvaluationContext, FeatureFlagsClient } from "./client";

type BetterAuthClient = ReturnType<typeof createAuthClient>;

// ============================================================================
// Types & Interfaces
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
  /** Pre-populated flags for SSR, prevents content flash */
  initialFlags?: Record<string, any>;
  /** Fetch flags on mount (disable for SSR) */
  fetchOnMount?: boolean;
  /** Evaluation context, changes trigger cache invalidation */
  context?: Partial<EvaluationContext>;
}

interface FeatureProps {
  /** Flag key to evaluate */
  flag: string;
  /** Fallback content when flag disabled/missing */
  fallback?: ReactNode;
  /** Secondary validation (e.g., subscription tier) */
  validateAccess?: (flags: Record<string, any>) => boolean;
  /** Content when flag enabled and validation passes */
  children: ReactNode;
}

interface VariantProps {
  /** Flag key for variant evaluation */
  flag: string;
  /** Variant.Case and Variant.Default components */
  children: ReactNode;
}

interface VariantCaseProps {
  /** Variant key to match */
  variant: string;
  /** Content for this variant */
  children: ReactNode;
}

interface VariantDefaultProps {
  /** Default content when no variant matches */
  children: ReactNode;
}

interface FeatureFlagErrorBoundaryProps {
  /** Fallback component or element for errors */
  fallback: ReactNode | ComponentType<{ error: Error }>;
  /** Error callback for monitoring/logging */
  onError?: (error: Error) => void;
  /** Protected children components */
  children: ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(
  null,
);

/** Enforces provider boundary, throws if used outside provider */
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

  // Context changes trigger cache invalidation for correct evaluation
  useEffect(() => {
    if (additionalContext) {
      client.featureFlags.setContext(additionalContext);
    }
  }, [client, additionalContext]);

  // Subscribe to flag updates and cache invalidation events
  useEffect(() => {
    const unsubscribe = client.featureFlags.subscribe(
      (newFlags: Record<string, any>) => {
        // Empty object = cache cleared (session change), non-empty = flag update
        if (
          Object.keys(newFlags).length === 0 &&
          Object.keys(flags).length > 0
        ) {
          setNeedsRefresh(true); // Defer fetch to avoid race conditions
        } else {
          setFlags(newFlags);
        }
      },
    );

    return unsubscribe;
  }, [client, flags]);

  // Deferred refresh prevents double-fetching on cache invalidation
  useEffect(() => {
    if (needsRefresh) {
      setNeedsRefresh(false);
      setLoading(true);
      client.featureFlags
        .bootstrap()
        .then((fetchedFlags: Record<string, any>) => {
          setFlags(fetchedFlags);
          setError(null);
        })
        .catch((err: unknown) => {
          setError(err as Error);
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
        .bootstrap()
        .then((fetchedFlags: Record<string, any>) => {
          setFlags(fetchedFlags);
          setError(null);
        })
        .catch((err: unknown) => {
          setError(err as Error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [client, fetchOnMount]);

  // Session changes trigger flag refresh for user-specific flags
  useEffect(() => {
    // Better Auth v1.0+ reactive session via $sessionSignal
    if ("$sessionSignal" in client && (client as any).$sessionSignal) {
      const unsubscribe = (client as any).$sessionSignal.subscribe(() => {
        const currentSession = (client as any).session;
        const currentSessionId = currentSession?.session?.id || null;

        // Session change = different user context = refresh flags
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
 * Hook for boolean flag evaluation.
 * @param flag Flag key to evaluate
 * @param defaultValue Fallback for missing/errored flags
 */
export function useFeatureFlag(flag: string, defaultValue = false): boolean {
  const { client, flags } = useFeatureFlagsContext();
  const [value, setValue] = useState<boolean>(
    flags[flag] !== undefined ? Boolean(flags[flag]) : defaultValue,
  );

  useEffect(() => {
    if (flags[flag] !== undefined) {
      setValue(Boolean(flags[flag])); // Use cached value from provider
    } else {
      // Cache miss: individual fetch to avoid blocking
      client.featureFlags
        .isEnabled(flag, defaultValue)
        .then(setValue)
        .catch(() => setValue(defaultValue));
    }
  }, [client, flag, flags, defaultValue]);

  return value;
}

/**
 * Hook for typed flag values (string, number, object).
 * @param flag Flag key to evaluate
 * @param defaultValue Type-safe fallback value
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

/** Hook returning all cached feature flags */
export function useFeatureFlags(): Record<string, any> {
  const { flags } = useFeatureFlagsContext();
  return flags;
}

/** Hook for A/B test variant evaluation */
export function useVariant(flag: string): string | null {
  const { client, flags } = useFeatureFlagsContext();
  const [variant, setVariant] = useState<string | null>(null);

  useEffect(() => {
    client.featureFlags
      .getVariant(flag)
      .then(setVariant)
      .catch(() => setVariant(null));
  }, [client, flag, flags]);

  return variant;
}

/** Hook for flag event tracking */
export function useTrackEvent() {
  const { client } = useFeatureFlagsContext();

  return useCallback(
    (flag: string, event: string, value?: number | Record<string, any>) => {
      return client.featureFlags.track(flag, event, value);
    },
    [client],
  );
}

/** Hook for flag loading state and error handling */
export function useFeatureFlagsState() {
  const { loading, error, refresh } = useFeatureFlagsContext();
  return { loading, error, refresh };
}

/** Debug hook for cache monitoring, not for production UI */
export function useFeatureFlagsCacheInfo() {
  const { client } = useFeatureFlagsContext();
  const [cacheInfo, setCacheInfo] = useState<{
    cacheEnabled: boolean;
    sessionId?: string;
    flagCount: number;
  }>({ cacheEnabled: false, flagCount: 0 });

  useEffect(() => {
    const updateCacheInfo = () => {
      client.featureFlags.bootstrap().then((flags: any) => {
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
// Suspense-Compatible Hooks (React 18+)
// ============================================================================

/** Suspense-compatible flag evaluation - throws promise during loading */
export function useFeatureFlagSuspense(
  flag: string,
  defaultValue = false,
): boolean {
  const { client, flags } = useFeatureFlagsContext();

  if (flags[flag] !== undefined) {
    return Boolean(flags[flag]);
  }

  // Throw promise for Suspense to catch during loading
  throw client.featureFlags.isEnabled(flag, defaultValue).then(() => {
    // This will trigger a re-render when resolved
    return Boolean(flags[flag] ?? defaultValue);
  });
}

/** Suspense-compatible typed flag values */
export function useFeatureFlagValueSuspense<T = any>(
  flag: string,
  defaultValue?: T,
): T {
  const { client, flags } = useFeatureFlagsContext();

  if (flags[flag] !== undefined) {
    return flags[flag];
  }

  // Throw promise for Suspense to catch during loading
  throw client.featureFlags.getValue(flag, defaultValue).then(() => {
    return flags[flag] ?? defaultValue;
  });
}

/** Suspense-compatible all flags hook */
export function useFeatureFlagsSuspense(): Record<string, any> {
  const { client, flags, loading } = useFeatureFlagsContext();

  if (!loading && Object.keys(flags).length > 0) {
    return flags;
  }

  // Throw promise for Suspense to catch during initial load
  throw client.featureFlags
    .bootstrap()
    .then((loadedFlags: Record<string, any>) => {
      return loadedFlags;
    });
}

/**
 * Enhanced hook for flag event tracking with idempotency support
 * @example
 * const trackEvent = useTrackEventWithIdempotency();
 * await trackEvent('feature', 'purchase', { amount: 99.99 }, { idempotencyKey: 'order-123' });
 */
export function useTrackEventWithIdempotency() {
  const { client } = useFeatureFlagsContext();

  return useCallback(
    (
      flag: string,
      event: string,
      value?: number | Record<string, any>,
      options?: { idempotencyKey?: string },
    ) => {
      return client.featureFlags.track(flag, event, value, options);
    },
    [client],
  );
}

/**
 * Hook for batch event tracking - more efficient for multiple events
 * @example
 * const trackBatch = useTrackEventBatch();
 * await trackBatch([
 *   { flag: 'feature1', event: 'view', idempotencyKey: 'session-123-1' },
 *   { flag: 'feature2', event: 'click', data: { button: 'cta' } }
 * ]);
 */
export function useTrackEventBatch() {
  const { client } = useFeatureFlagsContext();

  return useCallback(
    (
      events: Array<{
        flag: string;
        event: string;
        data?: number | Record<string, any>;
        timestamp?: Date;
        idempotencyKey?: string;
      }>,
      batchId?: string,
    ) => {
      return client.featureFlags.trackBatch(events, {
        idempotencyKey: batchId,
      });
    },
    [client],
  );
}

// ============================================================================
// Components
// ============================================================================

/**
 * Declarative feature gating component.
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
    if (validateAccess) return validateAccess(flags); // Secondary validation
    return true;
  }, [isEnabled, validateAccess, flags]);

  return <>{hasAccess ? children : fallback}</>;
}

/**
 * A/B test variant component.
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
        if (variant && caseProps.variant === variant) {
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

/** Variant case component for specific variants */
function VariantCase({ children }: VariantCaseProps) {
  return <>{children}</>;
}

/** Default variant component when no match */
function VariantDefault({ children }: VariantDefaultProps) {
  return <>{children}</>;
}

// Attach sub-components for dot notation access
(Variant as any).Case = VariantCase;
(Variant as any).Default = VariantDefault;

/**
 * Suspense-compatible feature gating component.
 * Requires <Suspense> boundary to handle loading states.
 * @example
 * <Suspense fallback={<Loading />}>
 *   <FeatureSuspense flag="new-dashboard" fallback={<OldDashboard />}>
 *     <NewDashboard />
 *   </FeatureSuspense>
 * </Suspense>
 */
export function FeatureSuspense({
  flag,
  fallback = null,
  validateAccess,
  children,
}: FeatureProps) {
  const isEnabled = useFeatureFlagSuspense(flag);
  const flags = useFeatureFlagsSuspense();

  const hasAccess = useMemo(() => {
    if (!isEnabled) return false;
    if (validateAccess) return validateAccess(flags);
    return true;
  }, [isEnabled, validateAccess, flags]);

  return <>{hasAccess ? children : fallback}</>;
}

/**
 * Suspense-compatible variant component.
 * Requires <Suspense> boundary to handle loading states.
 * @example
 * <Suspense fallback={<Loading />}>
 *   <VariantSuspense flag="checkout-flow">
 *     <Variant.Case variant="v1"><CheckoutV1 /></Variant.Case>
 *     <Variant.Case variant="v2"><CheckoutV2 /></Variant.Case>
 *     <Variant.Default><CheckoutOriginal /></Variant.Default>
 *   </VariantSuspense>
 * </Suspense>
 */
export const VariantSuspense = React.memo(function VariantSuspense({
  flag,
  children,
}: VariantProps) {
  const variant = useVariant(flag); // Use regular hook since getVariant is fast

  const selectedChild = useMemo(() => {
    let defaultChild: ReactNode = null;
    let matchedChild: ReactNode = null;

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;

      if (child.type === VariantCase) {
        const caseProps = child.props as any;
        if (variant && caseProps.variant === variant) {
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

// Attach sub-components for dot notation access
(VariantSuspense as any).Case = VariantCase;
(VariantSuspense as any).Default = VariantDefault;

// ============================================================================
// Error Boundary
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/** Error boundary for flag evaluation, prevents app crashes */
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
    this.props.onError?.(error); // Report to monitoring service
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

/** HOC for class components, prefer hooks for new code */
export function withFeatureFlags<P extends object>(
  Component: ComponentType<P & { featureFlags: Record<string, any> }>,
): ComponentType<P> {
  return function WithFeatureFlagsComponent(props: P) {
    const flags = useFeatureFlags();
    return <Component {...props} featureFlags={flags} />;
  };
}

/**
 * HOC for component-level feature gating.
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
  FeatureFlagErrorBoundaryProps,
  FeatureFlagsProviderProps,
  FeatureProps,
  VariantCaseProps,
  VariantDefaultProps,
  VariantProps,
};
