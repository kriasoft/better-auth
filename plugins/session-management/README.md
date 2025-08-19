# better-auth-session-management

Advanced session management plugin for Better Auth - Enhanced control over user sessions

## Status

⚠️ **Work in Progress** - This package is under active development and not yet ready for production use.

## Features (Planned)

- 📱 **Device Management** - Track and manage devices/browsers
- 🌐 **Concurrent Session Control** - Limit concurrent sessions per user
- 📍 **Location Tracking** - Track session locations and detect anomalies
- 🔐 **Session Security** - Detect and prevent session hijacking
- ⏰ **Idle Timeout** - Automatically expire idle sessions
- 🔄 **Session Extension** - Smart session renewal strategies
- 📊 **Session Analytics** - Track session patterns and usage
- 🚨 **Security Alerts** - Notify users of suspicious session activity
- 🎯 **Selective Revocation** - Revoke sessions by device, location, or time

## Installation

```bash
npm install better-auth-session-management
```

## Usage (Coming Soon)

```typescript
import { betterAuth } from "better-auth";
import { sessionManagement } from "better-auth-session-management";

const auth = betterAuth({
  plugins: [
    sessionManagement({
      maxConcurrentSessions: 5,
      maxSessionsPerDevice: 2,
      idleTimeout: 30 * 60, // 30 minutes
      absoluteTimeout: 24 * 60 * 60, // 24 hours
      deviceFingerprinting: true,
      locationTracking: {
        enabled: true,
        anomalyDetection: true,
      },
      security: {
        detectHijacking: true,
        requireReauthForSensitive: true,
        notifyNewDevice: true,
      },
      events: {
        onNewDevice: async (session, device) => {
          // Send email notification
        },
        onSuspiciousActivity: async (session, reason) => {
          // Handle suspicious activity
        },
      },
    }),
  ],
});
```

## License

MIT
