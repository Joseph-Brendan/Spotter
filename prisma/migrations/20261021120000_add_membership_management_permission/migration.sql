-- Owner-only permission for member and membership plan management.
INSERT INTO "Permission" ("id", "key", "description", "createdAt") VALUES
    ('perm_membership_manage', 'membership.manage', 'Create and edit members and membership plans.', CURRENT_TIMESTAMP);

INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
    ('role_owner', 'perm_membership_manage');
