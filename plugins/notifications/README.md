# Better Auth Notifications

Multi-channel notification system plugin for Better Auth. Send authentication-related notifications via email, SMS, push notifications, and in-app messages.

## 🚧 Work in Progress

This package is currently under development. The notifications plugin will enable:

- **Multi-Channel Delivery** - Email, SMS, Push, In-App, Slack, Discord
- **Template Management** - Customizable templates with i18n support
- **Provider Integration** - SendGrid, Twilio, Firebase, OneSignal, AWS SNS
- **Smart Routing** - Channel preference management and fallback strategies
- **Delivery Tracking** - Monitor delivery status and engagement metrics
- **Rate Limiting** - Prevent notification spam with configurable limits

## Installation

```bash
bun add better-auth-notifications
# or
npm install better-auth-notifications
```

## Setup

```typescript
import { betterAuth } from "better-auth";
import { notificationsPlugin } from "better-auth-notifications";

export const auth = betterAuth({
  plugins: [
    notificationsPlugin({
      channels: {
        email: {
          provider: "sendgrid",
          apiKey: process.env.SENDGRID_API_KEY,
          from: "noreply@example.com",
        },
        sms: {
          provider: "twilio",
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN,
          from: process.env.TWILIO_PHONE_NUMBER,
        },
        push: {
          provider: "firebase",
          serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
        },
      },
      templates: {
        welcome: {
          email: {
            subject: "Welcome to {{appName}}!",
            html: "<h1>Welcome {{user.name}}!</h1>",
          },
          sms: {
            body: "Welcome to {{appName}}, {{user.name}}!",
          },
        },
        passwordReset: {
          email: {
            subject: "Reset your password",
            html: "Click here to reset: {{resetLink}}",
          },
        },
      },
      events: {
        // Auto-send notifications for auth events
        "user.created": ["welcome"],
        "password.reset.requested": ["passwordReset"],
        "suspicious.login": ["securityAlert"],
      },
    }),
  ],
});
```

## Features (Planned)

### Notification Types

- Welcome emails
- Email verification
- Password reset
- Two-factor authentication codes
- Security alerts (suspicious login, password changed)
- Account updates
- Session expiry warnings
- Custom notifications

### Channel Providers

- **Email**: SendGrid, Mailgun, AWS SES, Postmark, Resend
- **SMS**: Twilio, Vonage, AWS SNS, MessageBird
- **Push**: Firebase, OneSignal, Expo, Apple Push
- **In-App**: WebSocket, Server-Sent Events
- **Chat**: Slack, Discord, Microsoft Teams

### Advanced Features

- Template variables and localization
- User notification preferences
- Unsubscribe management
- Bounce and complaint handling
- A/B testing for templates
- Scheduled notifications
- Batch sending
- Priority queues

## Client Usage

```typescript
import { createAuthClient } from "better-auth/client";
import { notificationsClient } from "better-auth-notifications/client";

const authClient = createAuthClient({
  plugins: [notificationsClient()],
});

// Manage notification preferences
await authClient.notifications.updatePreferences({
  email: true,
  sms: false,
  push: true,
});

// Send custom notification
await authClient.notifications.send({
  template: "custom",
  channels: ["email", "push"],
  data: {
    message: "Custom message",
  },
});

// Get notification history
const history = await authClient.notifications.getHistory();
```

## License

MIT
