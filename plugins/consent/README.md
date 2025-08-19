# better-auth-consent

Lightweight consent management plugin for Better Auth - Simple cookie and privacy consent without the complexity of full compliance

## Status

⚠️ **Work in Progress** - This package is under active development and not yet ready for production use.

## When to Use This Package

- ✅ **Use better-auth-consent** if you need:
  - Simple cookie consent banners
  - Basic privacy preferences
  - Lightweight consent tracking
  - Quick setup without compliance overhead
- ❌ **Use better-auth-compliance instead** if you need:
  - Full GDPR/CCPA compliance
  - Data rights management (deletion, portability)
  - Age verification (COPPA)
  - Regional data residency
  - Audit trails and legal documentation

## Features (Planned)

- 🍪 **Cookie Consent** - Simple, customizable cookie consent banners
- 📊 **Consent Categories** - Necessary, Analytics, Marketing, Functional
- 🎨 **UI Components** - Ready-to-use consent banner components
- 💾 **Preference Center** - User-friendly privacy preference management
- 🔄 **Consent Sync** - Sync preferences across devices
- 📝 **Consent Records** - Track when and what users consented to
- 🌍 **Multi-language** - Internationalization support
- ⚡ **Performance** - Lightweight with minimal overhead
- 🎯 **Granular Control** - Service-level consent (Google Analytics, Facebook, etc.)
- 🔔 **Update Notifications** - Notify users of privacy policy changes

## Installation

```bash
npm install better-auth-consent
```

## Usage

```typescript
import { betterAuth } from "better-auth";
import { consent } from "better-auth-consent";

const auth = betterAuth({
  plugins: [
    consent({
      // Cookie categories
      categories: {
        necessary: {
          label: "Necessary",
          description: "Essential for the website to function",
          required: true, // Cannot be disabled
        },
        analytics: {
          label: "Analytics",
          description: "Help us understand how you use our site",
          default: false,
          services: ["google-analytics", "mixpanel"],
        },
        marketing: {
          label: "Marketing",
          description: "Personalized ads and content",
          default: false,
          services: ["google-ads", "facebook-pixel"],
        },
        functional: {
          label: "Functional",
          description: "Enhanced functionality and personalization",
          default: true,
          services: ["intercom", "youtube"],
        },
      },

      // Banner configuration
      banner: {
        position: "bottom", // bottom, top, center
        theme: "light", // light, dark, auto
        logo: "/logo.png",
        privacyPolicy: "/privacy",
        cookiePolicy: "/cookies",
        rejectButton: true,
        customizeButton: true,
      },

      // Behavior
      behavior: {
        acceptOnScroll: false,
        acceptOnNavigate: false,
        reloadOnChange: false,
        cookieExpiry: 365, // days
        regionDetection: true, // Auto-detect EU/California
      },

      // Callbacks
      onAccept: async (categories) => {
        // Initialize accepted services
        if (categories.analytics) {
          // Initialize Google Analytics
        }
      },
      onReject: async () => {
        // Clean up any already set cookies
      },
      onChange: async (categories) => {
        // Handle preference changes
      },
    }),
  ],
});
```

## Client Usage

```typescript
import { createAuthClient } from "better-auth/client";
import { consentClient } from "better-auth-consent/client";

const authClient = createAuthClient({
  plugins: [consentClient()],
});

// Check consent status
const status = await authClient.consent.getStatus();
console.log(status.categories); // { necessary: true, analytics: false, ... }

// Update preferences
await authClient.consent.updatePreferences({
  analytics: true,
  marketing: false,
  functional: true,
});

// Show preference center
authClient.consent.showPreferences();

// Revoke all consent
await authClient.consent.revokeAll();

// Check if specific service is allowed
const canUseGA = authClient.consent.isServiceAllowed("google-analytics");
```

## UI Components (React Example)

```tsx
import { ConsentBanner, PreferenceCenter } from "better-auth-consent/react";

function App() {
  return (
    <>
      {/* Automatic consent banner */}
      <ConsentBanner />

      {/* Preference center for settings page */}
      <PreferenceCenter />
    </>
  );
}
```

## Simple Integration

```javascript
// Conditional script loading based on consent
if (authClient.consent.isServiceAllowed("google-analytics")) {
  // Load Google Analytics
  gtag("config", "GA_MEASUREMENT_ID");
}

// Listen for consent changes
authClient.consent.on("change", (categories) => {
  if (categories.marketing) {
    // Enable marketing tools
  } else {
    // Disable marketing tools
  }
});
```

## Comparison with better-auth-compliance

| Feature               | better-auth-consent | better-auth-compliance |
| --------------------- | ------------------- | ---------------------- |
| Cookie consent        | ✅ Simple           | ✅ Advanced            |
| Preference management | ✅                  | ✅                     |
| GDPR compliance       | ⚠️ Basic            | ✅ Full                |
| CCPA compliance       | ⚠️ Basic            | ✅ Full                |
| Data rights           | ❌                  | ✅                     |
| Age verification      | ❌                  | ✅                     |
| Audit trails          | ⚠️ Basic            | ✅ Advanced            |
| Bundle size           | ~10KB               | ~50KB                  |
| Setup complexity      | Simple              | Moderate               |

## License

MIT
