# Better Auth Compliance

Regional compliance and privacy automation plugin for Better Auth. Handle GDPR, CCPA, and other data protection regulations with automated consent management and privacy controls.

## 🚧 Work in Progress

This package is currently under development. The compliance plugin will enable:

- **Consent Management** - Cookie consent, data processing agreements
- **Data Rights** - Right to access, deletion, portability, rectification
- **Regional Compliance** - GDPR (EU), CCPA (California), LGPD (Brazil), PIPEDA (Canada)
- **Age Verification** - COPPA compliance and parental consent
- **Data Residency** - Store user data in specific regions
- **Privacy Controls** - Automated PII handling and data minimization

## Installation

```bash
bun add better-auth-compliance
# or
npm install better-auth-compliance
```

## Setup

```typescript
import { betterAuth } from "better-auth";
import { compliancePlugin } from "better-auth-compliance";

export const auth = betterAuth({
  plugins: [
    compliancePlugin({
      regulations: {
        gdpr: {
          enabled: true,
          consentRequired: true,
          dataRetention: 365, // days
          rightToDeletion: true,
          dataPortability: true,
        },
        ccpa: {
          enabled: true,
          optOutRequired: true,
          doNotSell: true,
        },
        coppa: {
          enabled: true,
          minimumAge: 13,
          parentalConsent: true,
        },
      },
      consent: {
        cookie: {
          required: true,
          categories: ["necessary", "analytics", "marketing"],
          expiry: 365, // days
        },
        dataProcessing: {
          required: true,
          version: "1.0",
          updateNotification: true,
        },
      },
      dataResidency: {
        enabled: true,
        defaultRegion: "us",
        userRegions: {
          eu: ["DE", "FR", "IT", "ES"],
          us: ["US", "CA", "MX"],
          apac: ["JP", "AU", "SG"],
        },
      },
      privacy: {
        anonymizeAfter: 730, // days
        encryptPII: true,
        minimizeData: true,
        auditAccess: true,
      },
    }),
  ],
});
```

## Features (Planned)

### Consent Management

- Cookie consent banners with customization
- Granular consent categories
- Consent versioning and updates
- Proof of consent storage
- Withdrawal mechanisms
- Cross-device consent sync

### Data Rights Automation

- **Right to Access**: Generate data export on request
- **Right to Deletion**: Automated data purging
- **Right to Rectification**: User data correction
- **Right to Portability**: Export in machine-readable format
- **Right to Object**: Opt-out of processing
- **Right to Restriction**: Limit data processing

### Regional Compliance

- **GDPR** (European Union)
  - Lawful basis tracking
  - Data processing agreements
  - Cross-border transfer controls
- **CCPA/CPRA** (California)
  - Do Not Sell mechanisms
  - Opt-out preferences
  - Financial incentive disclosures

- **Other Regulations**
  - LGPD (Brazil)
  - PIPEDA (Canada)
  - POPIA (South Africa)
  - APP (Australia)

### Age Verification

- Age gate implementation
- Parental consent flows
- COPPA compliance
- School consent (FERPA)
- Mixed audience handling

### Privacy Features

- Automatic PII detection
- Data minimization rules
- Encryption at rest
- Pseudonymization
- Retention policies
- Audit trails

## Client Usage

```typescript
import { createAuthClient } from "better-auth/client";
import { complianceClient } from "better-auth-compliance/client";

const authClient = createAuthClient({
  plugins: [complianceClient()],
});

// Manage consent
await authClient.compliance.updateConsent({
  cookies: {
    necessary: true,
    analytics: false,
    marketing: false,
  },
  dataProcessing: true,
});

// Exercise data rights
const myData = await authClient.compliance.requestDataExport();
await authClient.compliance.requestDeletion();

// Check compliance status
const status = await authClient.compliance.getComplianceStatus();

// Age verification
await authClient.compliance.verifyAge({
  birthDate: "2010-01-01",
  parentEmail: "parent@example.com",
});
```

## License

MIT
