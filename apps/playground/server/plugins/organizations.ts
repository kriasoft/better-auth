// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { OrganizationOptions } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import type { Env } from "../env";
import { getPluginStatus } from "../env";

/**
 * Organizations Plugin Configuration
 *
 * Provides comprehensive organization management with:
 * - Team management and hierarchy
 * - Role-based access control
 * - Invitation system
 * - Member management
 * - Multi-tenant support
 */
export function getOrganizationsPlugin(
  env: Env,
): ReturnType<typeof organization> | null {
  const pluginStatus = getPluginStatus(env);

  // Check if organizations are enabled
  if (!pluginStatus.organizations) {
    return null;
  }

  const config: OrganizationOptions = {
    // User permissions
    allowUserToCreateOrganization: env.ORG_ALLOW_USER_CREATE,

    // Organization limits
    organizationLimit: env.ORG_LIMIT,
    membershipLimit: env.ORG_MEMBERSHIP_LIMIT,

    // Creator role configuration
    creatorRole: env.ORG_CREATOR_ROLE,

    // Teams configuration
    teams: {
      enabled: env.ORG_TEAMS_ENABLED,
      defaultTeam: {
        enabled: env.ORG_DEFAULT_TEAM_ENABLED,
      },
      maximumTeams: env.ORG_MAX_TEAMS,
      maximumMembersPerTeam: env.ORG_MAX_MEMBERS_PER_TEAM,
      allowRemovingAllTeams: env.ORG_ALLOW_REMOVING_ALL_TEAMS,
    },

    // Invitation configuration
    invitationExpiresIn: env.ORG_INVITATION_EXPIRES_IN, // 48 hours default
    invitationLimit: env.ORG_INVITATION_LIMIT,
    cancelPendingInvitationsOnReInvite: env.ORG_CANCEL_PENDING_ON_REINVITE,
    requireEmailVerificationOnInvitation: env.ORG_REQUIRE_EMAIL_VERIFICATION,

    // Email configuration
    sendInvitationEmail: env.ORG_SEND_INVITATION_EMAIL
      ? async (data, request) => {
          // Implement your email sending logic here
          const invitationUrl = `${env.APP_URL}/organization/accept-invitation?id=${data.id}`;

          console.log("Sending invitation email:", {
            to: data.email,
            organization: data.organization.name,
            role: data.role,
            inviter: data.inviter.user.email,
            url: invitationUrl,
          });

          // Example: integrate with your email service
          // await sendEmail({
          //   to: data.email,
          //   subject: `Invitation to join ${data.organization.name}`,
          //   html: `
          //     <p>You've been invited to join ${data.organization.name} as ${data.role} by ${data.inviter.user.email}.</p>
          //     <p><a href="${invitationUrl}">Accept Invitation</a></p>
          //   `,
          // });
        }
      : undefined,

    // Organization lifecycle hooks
    organizationCreation: {
      disabled: env.ORG_CREATION_DISABLED,
      beforeCreate: async (data, request) => {
        // Add any custom validation or preprocessing here
        console.log("Creating organization:", data.organization.name);

        // Example: validate organization name
        if (data.organization.name && data.organization.name.length < 3) {
          throw new Error("Organization name must be at least 3 characters");
        }
      },
      afterCreate: async (data, request) => {
        // Add any post-creation logic here
        console.log("Organization created:", {
          id: data.organization.id,
          name: data.organization.name,
          creatorId: data.user.id,
        });

        // Example: trigger webhooks, analytics, etc.
      },
    },

    organizationDeletion: {
      disabled: env.ORG_DELETION_DISABLED,
      beforeDelete: async (data, request) => {
        // Add any cleanup or validation before deletion
        console.log("Deleting organization:", data.organization.name);

        // Example: check for active subscriptions
        // if (await hasActiveSubscription(data.organization.id)) {
        //   throw new Error("Cannot delete organization with active subscription");
        // }
      },
      afterDelete: async (data, request) => {
        // Add any post-deletion cleanup
        console.log("Organization deleted:", data.organization.id);

        // Example: cleanup related resources
      },
    },

    // Auto-create organization on signup
    autoCreateOrganizationOnSignUp: env.ORG_AUTO_CREATE_ON_SIGNUP,

    // Note: Custom roles require creating Role objects with access control
    // For now, using the default roles: owner, admin, member
  };

  return organization(config);
}
