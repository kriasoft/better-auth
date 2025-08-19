# better-auth-webhooks

Webhooks plugin for Better Auth - Send real-time event notifications to external services

## Status

⚠️ **Work in Progress** - This package is under active development and not yet ready for production use.

## Features (Planned)

- 🔔 **Event Subscriptions** - Subscribe to auth events (sign-up, sign-in, password reset, etc.)
- 🎯 **Selective Webhooks** - Choose specific events to listen to
- 🔒 **Webhook Security** - HMAC signatures for webhook verification
- 🔄 **Retry Logic** - Automatic retry with exponential backoff
- 📊 **Delivery Status** - Track webhook delivery success/failure
- 🎛️ **Event Filtering** - Filter events based on custom criteria
- 🏗️ **Webhook Management UI** - Admin interface for managing webhooks
- 📝 **Event Logs** - Comprehensive webhook event logging

## Installation

```bash
npm install better-auth-webhooks
```

## Usage (Coming Soon)

```typescript
import { betterAuth } from "better-auth";
import { webhooks } from "better-auth-webhooks";

const auth = betterAuth({
  plugins: [
    webhooks({
      events: {
        "user.created": true,
        "user.signin": true,
        "user.updated": true,
        "session.created": true,
        "password.reset": true,
      },
      signing: {
        secret: process.env.WEBHOOK_SECRET,
        algorithm: "sha256",
      },
      retry: {
        attempts: 3,
        backoff: "exponential",
      },
      timeout: 5000,
    }),
  ],
});
```

## License

MIT
