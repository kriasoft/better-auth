# Better Auth Fraud Detection

Real-time fraud detection plugin for Better Auth. Protect your application from account takeovers, bot attacks, and suspicious authentication activities using advanced detection techniques.

## 🚧 Work in Progress

This package is currently under development. The fraud detection plugin will enable:

- **Device Fingerprinting** - Track and verify device signatures
- **IP Reputation** - Check IP addresses against threat databases
- **Behavioral Analysis** - Detect unusual login patterns and anomalies
- **Bot Detection** - Identify and block automated attacks
- **Risk Scoring** - Calculate real-time risk scores for auth attempts
- **Adaptive Authentication** - Require additional verification for risky logins

## Installation

```bash
bun add better-auth-fraud-detection
# or
npm install better-auth-fraud-detection
```

## Setup

```typescript
import { betterAuth } from "better-auth";
import { fraudDetectionPlugin } from "better-auth-fraud-detection";

export const auth = betterAuth({
  plugins: [
    fraudDetectionPlugin({
      providers: {
        ipReputation: {
          service: "maxmind",
          apiKey: process.env.MAXMIND_API_KEY,
        },
        deviceFingerprint: {
          service: "fingerprintjs",
          apiKey: process.env.FINGERPRINTJS_API_KEY,
        },
        mlScoring: {
          service: "sift",
          apiKey: process.env.SIFT_API_KEY,
        },
      },
      rules: {
        // Block login if risk score > 80
        blockThreshold: 80,
        // Require MFA if risk score > 50
        mfaThreshold: 50,
        // Challenge with CAPTCHA if risk score > 30
        challengeThreshold: 30,
      },
      signals: {
        // Configure which signals to track
        newDevice: true,
        newLocation: true,
        impossibleTravel: true,
        bruteForce: true,
        credentialStuffing: true,
        suspiciousUserAgent: true,
      },
      actions: {
        block: {
          message: "Access denied due to suspicious activity",
        },
        challenge: {
          type: "recaptcha", // or "hcaptcha", "turnstile"
          siteKey: process.env.RECAPTCHA_SITE_KEY,
        },
      },
    }),
  ],
});
```

## Features (Planned)

### Detection Methods

- **Device Intelligence**: Browser fingerprinting, hardware detection
- **Network Analysis**: IP reputation, VPN/proxy detection, geolocation
- **Behavioral Patterns**: Login velocity, time-based patterns, session anomalies
- **Credential Analysis**: Leaked password detection, common password checks
- **Bot Detection**: Headless browser detection, automation tools detection
- **Social Engineering**: Phishing attempt detection, account takeover patterns

### Risk Signals

- New device or browser
- Unusual login location
- Impossible travel (geography/time)
- Multiple failed attempts
- Rapid-fire login attempts
- Known bad IP addresses
- Suspicious user agents
- Account enumeration attempts

### Response Actions

- Block authentication
- Require additional verification (MFA)
- Present CAPTCHA challenge
- Rate limiting
- Account lockout
- Email/SMS alerts to user
- Honeypot accounts
- Shadow banning

### Integration Providers

- **IP Intelligence**: MaxMind, IPQualityScore, AbuseIPDB
- **Device Fingerprinting**: FingerprintJS, DeviceAtlas
- **ML/AI Scoring**: Sift, Arkose Labs, DataDome
- **CAPTCHA**: reCAPTCHA, hCaptcha, Cloudflare Turnstile

## Client Usage

```typescript
import { createAuthClient } from "better-auth/client";
import { fraudDetectionClient } from "better-auth-fraud-detection/client";

const authClient = createAuthClient({
  plugins: [fraudDetectionClient()],
});

// Get risk assessment for current session
const risk = await authClient.fraud.getRiskScore();

// Report suspicious activity
await authClient.fraud.reportSuspicious({
  reason: "unusual_behavior",
  details: "User attempted to access admin panel repeatedly",
});

// Get fraud analytics (admin only)
const analytics = await authClient.fraud.getAnalytics({
  timeRange: "last_30_days",
});
```

## License

MIT
