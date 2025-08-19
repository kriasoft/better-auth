# better-auth-abuse-detection

AI-powered abuse detection plugin for Better Auth - Detect and prevent account takeover attempts

## Status

⚠️ **Work in Progress** - This package is under active development and not yet ready for production use.

## Features (Planned)

- 🤖 **AI-Powered Detection** - Machine learning models to detect suspicious patterns
- 🔐 **Credential Stuffing Protection** - Detect and block credential stuffing attacks
- 🎯 **Account Takeover Prevention** - Identify and prevent account takeover attempts
- 📊 **Behavioral Analysis** - Track user behavior patterns and detect anomalies
- 🌍 **Geolocation Anomaly Detection** - Flag suspicious location changes
- 📱 **Device Fingerprinting** - Track and verify user devices
- 🔄 **Pattern Recognition** - Identify bot behavior and automated attacks
- ⚡ **Real-time Scoring** - Risk scoring for every authentication attempt
- 🚨 **Alert System** - Immediate notifications for high-risk activities
- 📈 **Analytics Dashboard** - Visualize attack patterns and trends

## Installation

```bash
npm install better-auth-abuse-detection
```

## Usage (Coming Soon)

```typescript
import { betterAuth } from "better-auth";
import { abuseDetection } from "better-auth-abuse-detection";

const auth = betterAuth({
  plugins: [
    abuseDetection({
      // Detection strategies
      strategies: {
        credentialStuffing: {
          enabled: true,
          threshold: 5, // Failed attempts before flagging
          windowMinutes: 10,
        },
        velocityCheck: {
          enabled: true,
          maxSignIns: 10,
          windowMinutes: 5,
        },
        impossibleTravel: {
          enabled: true,
          speedKmh: 1000, // Max travel speed
        },
        deviceAnomaly: {
          enabled: true,
          requireKnownDevice: false,
        },
        behavioralAnalysis: {
          enabled: true,
          factors: ["typing_pattern", "mouse_movement", "time_patterns"],
        },
      },

      // Risk scoring
      riskScoring: {
        enabled: true,
        blockThreshold: 0.9, // Block if risk score > 0.9
        challengeThreshold: 0.7, // Additional verification if > 0.7
        factors: {
          newDevice: 0.2,
          newLocation: 0.3,
          vpnUsage: 0.1,
          failedAttempts: 0.4,
        },
      },

      // Actions
      actions: {
        block: {
          duration: 3600, // 1 hour
          message: "Suspicious activity detected",
        },
        challenge: {
          types: ["captcha", "email", "sms"],
        },
        notify: {
          user: true,
          admin: true,
        },
      },

      // Machine learning
      ml: {
        enabled: true,
        modelUrl: process.env.ML_MODEL_URL,
        features: ["ip_reputation", "email_age", "device_trust"],
      },

      // Events
      onThreatDetected: async (threat) => {
        console.log(
          `Threat detected: ${threat.type} for user ${threat.userId}`,
        );
        // Send to SIEM or security monitoring
      },
      onAccountCompromised: async (user) => {
        // Lock account and notify user
      },
    }),
  ],
});
```

## Detection Strategies

### Credential Stuffing Detection

- Track failed login attempts across multiple accounts
- Identify patterns consistent with automated attacks
- Rate limit based on IP, user agent, and other factors

### Impossible Travel Detection

- Calculate distance between consecutive login locations
- Flag physically impossible travel speeds
- Account for VPN and proxy usage

### Behavioral Analysis

- Mouse movement patterns
- Typing cadence and rhythm
- Time-of-day usage patterns
- Navigation patterns

### Device Trust

- Device fingerprinting
- Known device verification
- New device challenges

## Security Best Practices

- Always implement rate limiting alongside abuse detection
- Use CAPTCHA or other challenges for suspicious activities
- Monitor and adjust thresholds based on your application's patterns
- Implement gradual response escalation (warn → challenge → block)
- Keep audit logs of all detected threats
- Regular review of false positives and negatives

## License

MIT
