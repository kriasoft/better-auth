# better-auth-impersonation

User impersonation plugin for Better Auth - Securely impersonate users for support and debugging

## Status

⚠️ **Work in Progress** - This package is under active development and not yet ready for production use.

## Features (Planned)

- 👤 **Secure Impersonation** - Admin/support staff can safely impersonate users
- 🔐 **Permission Control** - Fine-grained permissions for who can impersonate
- 📝 **Audit Trail** - Complete audit log of all impersonation sessions
- ⏰ **Time Limits** - Automatic session expiration for impersonation
- 🚫 **Restrictions** - Prevent sensitive actions during impersonation
- 🔔 **Notifications** - Notify users when their account is accessed
- 🎯 **Reason Tracking** - Require and log reasons for impersonation
- 🔄 **Easy Exit** - Quick return to original admin session
- 🛡️ **Security Headers** - Special headers to identify impersonation mode

## Installation

```bash
npm install better-auth-impersonation
```

## Usage (Coming Soon)

```typescript
import { betterAuth } from "better-auth";
import { impersonation } from "better-auth-impersonation";

const auth = betterAuth({
  plugins: [
    impersonation({
      // Who can impersonate
      permissions: {
        roles: ["admin", "support"],
        userIds: ["admin-123"],
        customCheck: async (impersonator, target) => {
          // Custom permission logic
          return impersonator.role === "admin";
        },
      },
      // Security settings
      security: {
        requireReason: true,
        maxDuration: 60 * 30, // 30 minutes
        notifyUser: true,
        allowedActions: ["read"], // Restrict to read-only
        blockedPaths: ["/settings", "/billing"],
      },
      // Audit settings
      audit: {
        logAll: true,
        includeActions: true,
        retention: 90, // days
      },
      // UI customization
      ui: {
        showBanner: true,
        bannerText: "Impersonating {{userName}}",
      },
      // Events
      onImpersonationStart: async (session) => {
        // Log to external service
        console.log(
          `Admin ${session.impersonatorId} started impersonating ${session.targetId}`,
        );
      },
      onImpersonationEnd: async (session) => {
        // Cleanup or notifications
      },
    }),
  ],
});
```

## Security Considerations

- Always require strong authentication for impersonators
- Log all impersonation activities
- Implement time limits on impersonation sessions
- Notify users when their account is accessed
- Consider legal and privacy implications
- Restrict sensitive operations during impersonation

## License

MIT
