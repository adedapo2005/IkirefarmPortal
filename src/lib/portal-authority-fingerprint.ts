/** Single source of truth for the account authority snapshot. SQLite computes it
 * both when the session is resolved and again inside the atomic D1 write, so a
 * role, permission, scope, status or stamp change in between makes them differ.
 * Expects the portal_accounts row aliased as `a`. */
export const PORTAL_AUTHORITY_FINGERPRINT_SQL =
  "json_array(a.status,a.access_state,a.is_owner,a.provisional_role,a.provisional_expired," +
  "a.roles_json,a.permissions_json,a.permission_scopes_json,a.organization_scope_json," +
  "a.lifecycle_status,a.security_stamp)";
