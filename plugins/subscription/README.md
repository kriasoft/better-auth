# better-auth-subscription

Subscription management plugin for Better Auth - Handle billing and subscriptions

## Status

⚠️ **Work in Progress** - This package is under active development and not yet ready for production use.

## Features (Planned)

- 💳 **Payment Integration** - Stripe, Paddle, and other payment providers
- 📅 **Subscription Plans** - Manage multiple subscription tiers
- 🔄 **Billing Cycles** - Monthly, yearly, and custom billing periods
- 💰 **Usage-based Billing** - Track and bill based on usage metrics
- 🎁 **Trial Periods** - Free trials with automatic conversion
- 🏷️ **Discount Codes** - Coupon and promotional code support
- 📊 **Revenue Analytics** - Track MRR, churn, and other metrics
- 🔔 **Payment Notifications** - Failed payment alerts and reminders
- 📝 **Invoice Management** - Generate and manage invoices

## Installation

```bash
npm install better-auth-subscription
```

## Usage (Coming Soon)

```typescript
import { betterAuth } from "better-auth";
import { subscription } from "better-auth-subscription";

const auth = betterAuth({
  plugins: [
    subscription({
      provider: "stripe", // or "paddle", "lemonsqueezy"
      plans: [
        {
          id: "basic",
          name: "Basic Plan",
          price: 9.99,
          interval: "month",
          features: ["feature1", "feature2"],
        },
        {
          id: "pro",
          name: "Pro Plan",
          price: 29.99,
          interval: "month",
          features: ["feature1", "feature2", "feature3"],
        },
      ],
      trial: {
        enabled: true,
        days: 14,
        requirePaymentMethod: false,
      },
      webhooks: {
        paymentFailed: async (subscription) => {
          // Handle failed payment
        },
        subscriptionUpdated: async (subscription) => {
          // Handle subscription changes
        },
      },
    }),
  ],
});
```

## License

MIT
