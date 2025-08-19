# better-auth-backup-codes

Backup codes plugin for Better Auth - Recovery codes for two-factor authentication

## Status

⚠️ **Work in Progress** - This package is under active development and not yet ready for production use.

## Features (Planned)

- 🔑 **Recovery Codes** - Generate secure backup codes for account recovery
- 🔐 **Cryptographically Secure** - Use CSPRNG for code generation
- 📊 **Usage Tracking** - Track which codes have been used
- 🔄 **Regeneration** - Allow users to regenerate codes when needed
- 📥 **Download Options** - Let users download codes as PDF or text
- 🖨️ **Print-friendly** - Formatted for easy printing and storage
- ⚠️ **Low Code Warnings** - Alert users when running low on codes
- 🔒 **Secure Storage** - Hashed storage with proper salting
- 📱 **2FA Integration** - Seamless integration with two-factor auth

## Installation

```bash
npm install better-auth-backup-codes
```

## Usage (Coming Soon)

```typescript
import { betterAuth } from "better-auth";
import { backupCodes } from "better-auth-backup-codes";

const auth = betterAuth({
  plugins: [
    backupCodes({
      // Code generation settings
      codes: {
        count: 10, // Number of codes to generate
        length: 8, // Length of each code
        format: "XXXX-XXXX", // Code format (X = alphanumeric)
        charset: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      },
      // Security settings
      security: {
        hashCodes: true, // Store hashed instead of plain text
        oneTimeUse: true, // Each code can only be used once
        requireCurrentPassword: true, // Require password to view codes
        notifyOnUse: true, // Notify user when backup code is used
      },
      // Warnings and limits
      warnings: {
        lowCodeThreshold: 3, // Warn when only 3 codes remain
        forceRegenerate: 0, // Force regeneration when 0 codes remain
      },
      // Events
      onCodeUsed: async (user, code) => {
        // Send notification email
        console.log(`Backup code used for user ${user.id}`);
      },
      onCodesRegenerated: async (user) => {
        // Log regeneration event
      },
      onLowCodes: async (user, remaining) => {
        // Alert user about low codes
      },
    }),
  ],
});
```

## Security Best Practices

- Store backup codes securely (hashed with salt)
- Require current authentication to view/regenerate codes
- Notify users immediately when a backup code is used
- Encourage users to store codes in a safe place
- Consider requiring backup codes for high-privilege accounts
- Implement rate limiting on backup code attempts

## License

MIT
