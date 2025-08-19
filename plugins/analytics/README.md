# Better Auth Analytics

Analytics and event tracking plugin for Better Auth. Track authentication events, user behavior, and generate security insights.

## 🚧 Work in Progress

This package is currently under development. The analytics plugin will enable:

- **Event Tracking** - Track all authentication events (login, logout, signup, password reset, etc.)
- **User Behavior Analytics** - Monitor login patterns, device usage, location tracking
- **Security Metrics** - Failed login attempts, suspicious activities, account takeover attempts
- **Custom Events** - Define and track custom authentication-related events
- **Multiple Providers** - Integrate with Google Analytics, Mixpanel, Segment, PostHog, Plausible
- **Privacy-First** - GDPR compliant with configurable data retention and anonymization

## Installation

```bash
bun add better-auth-analytics
# or
npm install better-auth-analytics
```

## Setup

```typescript
import { betterAuth } from "better-auth";
import { analyticsPlugin } from "better-auth-analytics";

export const auth = betterAuth({
  plugins: [
    analyticsPlugin({
      providers: [
        // Configure your analytics providers
        {
          type: "google-analytics",
          measurementId: process.env.GA_MEASUREMENT_ID,
        },
        {
          type: "mixpanel",
          token: process.env.MIXPANEL_TOKEN,
        },
      ],
      events: {
        // Configure which events to track
        login: true,
        logout: true,
        signup: true,
        passwordReset: true,
        emailVerification: true,
        twoFactorAuth: true,
      },
      privacy: {
        // Privacy settings
        anonymizeIp: true,
        cookieConsent: true,
        dataRetention: 90, // days
      },
    }),
  ],
});
```

## Features (Planned)

### Event Types

- Authentication events (login, logout, signup)
- Security events (failed attempts, password changes)
- User journey events (verification, profile updates)
- Session events (create, refresh, expire)
- Admin events (impersonation, role changes)

### Analytics Providers

- Google Analytics 4
- Mixpanel
- Segment
- PostHog
- Plausible Analytics
- Custom webhook endpoints

### Reports & Insights

- Daily/Weekly/Monthly active users
- Authentication success rates
- Popular authentication methods
- Geographic distribution
- Device and browser analytics
- Security threat detection

### Privacy & Compliance

- GDPR compliant data handling
- Configurable PII redaction
- Data retention policies
- User consent management
- Export and deletion capabilities

## Client Usage

```typescript
import { createAuthClient } from "better-auth/client";
import { analyticsClient } from "better-auth-analytics/client";

const authClient = createAuthClient({
  plugins: [analyticsClient()],
});

// Track custom events
await authClient.analytics.track("custom_event", {
  category: "user_action",
  label: "profile_complete",
});

// Get analytics data (if permitted)
const insights = await authClient.analytics.getInsights();
```

## License

MIT
