# Platform Roles (Draft) — Typical “Big App” RBAC

This document captures **common role patterns** used in large production apps and how they map to this platform.

The goal is to keep the role model **simple** early, while leaving room to grow (org/team features, billing, compliance, etc.).

---

## MVP scope (current)

For the **MVP**, we only support two roles:

- **`user`**
- **`admin`**

All other roles in this document are **future-looking** references (useful for Phase 3+ / enterprise hardening).

---

## Role categories (typical)

Most mature apps separate roles into these categories:

- **End-user roles** (day-to-day usage)
- **Administrative roles** (manage other users and configuration)
- **Operational roles** (support, incident response)
- **Financial roles** (billing/usage access, invoices)
- **Compliance roles** (auditors, read-only)

---

## Recommended baseline roles for this platform

### User (default)

- **Who**: Everyone using the product normally.
- **Access**:
  - Can see **their own** resources and usage only.
  - Examples:
    - Create/manage their agents
    - View their own usage/cost status + history (`/api/usage/*`, `/api/alerts`)

### Admin (platform admin / super-admin)

- **Who**: Engineering / ops / trusted internal users.
- **Access**:
  - Full access across all users/agents/data (with audit logs recommended).
  - Can view platform-wide usage/cost and top spenders (planned `/api/admin/costs/*`).

### Support (customer support / ops)

- **Who**: Support staff helping users troubleshoot.
- **Access** (typical pattern):
  - Read-only access to user accounts and diagnostics.
  - Ability to impersonate users **only with explicit audit trail** (optional).
  - No access to billing configuration changes unless explicitly granted.

### Billing Admin (finance / billing operator)

- **Who**: People who need to manage tiers, limits, invoices.
- **Access** (typical pattern):
  - View usage and costs for users/orgs.
  - Manage subscriptions, caps, and overage settings.
  - Does **not** necessarily have access to moderation tools or content deletion.

### Moderator (content / community)

- **Who**: People handling policy enforcement and safety.
- **Access** (typical pattern):
  - Manage content reports, mute/suspend users/agents, remove abusive content.
  - Usually does **not** have access to financial admin screens.

### Auditor (read-only)

- **Who**: Compliance/security reviewers.
- **Access**:
  - Read-only access to logs, configuration history, billing events.
  - No write permissions.

---

## Notes on implementation strategy

### Phase 1–2 (current)

- Authentication is JWT-based (`JWT_DEV`) and many services only enforce “logged in”.
- Cost/usage endpoints currently enforce **self-access** by taking `ownerUserId` from the JWT.

### Next steps (recommended)

- Introduce explicit RBAC claims in JWT (e.g. `roles: ['admin']`).
- Add middleware helpers:
  - `requireRole('admin')`
  - `requireAnyRole(['admin','support'])`
- Add admin-only endpoints for platform-wide costs and user rankings.


