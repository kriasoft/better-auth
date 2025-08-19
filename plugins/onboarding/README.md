# better-auth-onboarding

User onboarding plugin for Better Auth - Guide users through setup

## Status

⚠️ **Work in Progress** - This package is under active development and not yet ready for production use.

## Features (Planned)

- 🚀 **Onboarding Flows** - Create multi-step onboarding experiences
- ✅ **Progress Tracking** - Track user progress through onboarding
- 🎯 **Personalization** - Customize onboarding based on user type
- 📊 **Analytics** - Track completion rates and drop-off points
- 🎨 **UI Components** - Ready-to-use onboarding UI components
- 🔄 **Conditional Steps** - Show/hide steps based on user data
- 📧 **Email Campaigns** - Automated onboarding email sequences
- 🏆 **Gamification** - Add achievements and rewards
- 📱 **Multi-platform** - Web and mobile onboarding support

## Installation

```bash
npm install better-auth-onboarding
```

## Usage (Coming Soon)

```typescript
import { betterAuth } from "better-auth";
import { onboarding } from "better-auth-onboarding";

const auth = betterAuth({
  plugins: [
    onboarding({
      flows: {
        default: {
          steps: [
            {
              id: "welcome",
              title: "Welcome",
              required: true,
              fields: ["name", "company"],
            },
            {
              id: "profile",
              title: "Complete Profile",
              required: false,
              fields: ["avatar", "bio", "timezone"],
            },
            {
              id: "preferences",
              title: "Set Preferences",
              required: false,
              fields: ["notifications", "theme"],
            },
          ],
        },
        enterprise: {
          steps: [
            // Custom enterprise onboarding
          ],
        },
      },
      emails: {
        welcome: true,
        reminders: true,
        completion: true,
      },
      analytics: {
        trackProgress: true,
        trackTime: true,
      },
    }),
  ],
});
```

## License

MIT
