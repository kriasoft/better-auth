# better-auth-rate-limit

Advanced rate limiting plugin for Better Auth - Protect against abuse and DDoS attacks

## Status

⚠️ **Work in Progress** - This package is under active development and not yet ready for production use.

## Features (Planned)

- 🛡️ **Advanced Rate Limiting** - Beyond basic rate limiting with multiple strategies
- 🎯 **Granular Control** - Different limits for different endpoints/users
- 👤 **User-based Limits** - Different limits for authenticated vs anonymous users
- 🌍 **IP-based Limiting** - Track and limit by IP address with proxy support
- 📊 **Sliding Window** - More accurate rate limiting with sliding window algorithm
- 🔐 **Adaptive Limits** - Automatically adjust limits based on user behavior
- 📈 **Analytics** - Track rate limit hits and patterns
- 🏪 **Multiple Stores** - Support for Redis, Memory, Database storage

## Installation

```bash
npm install better-auth-rate-limit
```

## Usage (Coming Soon)

```typescript
import { betterAuth } from "better-auth";
import { rateLimit } from "better-auth-rate-limit";

const auth = betterAuth({
  plugins: [
    rateLimit({
      strategy: "sliding-window",
      store: "redis", // or "memory", "database"
      limits: {
        global: {
          window: 60, // 1 minute
          max: 100,
        },
        perUser: {
          window: 60,
          max: 1000,
        },
        endpoints: {
          "/sign-in": {
            window: 300, // 5 minutes
            max: 5,
            skipSuccessfulAttempts: false,
          },
          "/sign-up": {
            window: 3600, // 1 hour
            max: 3,
          },
          "/password-reset": {
            window: 3600,
            max: 3,
          },
        },
      },
      bypass: {
        // Bypass rate limiting for certain conditions
        ips: ["127.0.0.1"],
        userRoles: ["admin"],
      },
      onLimitReached: async (req, info) => {
        // Custom handling when limit is reached
        console.log(`Rate limit reached: ${info.identifier}`);
      },
    }),
  ],
});
```

## License

MIT
