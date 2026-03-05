import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { AuditLogger } from '@/lib/audit';

export interface AuthenticatedUser {
    id: string;
    email: string;
    name?: string;
    role: string; // Legacy
    roles: string[];
    permissions: string[];
}

/**
 * Permission checking utilities
 */
export class PermissionChecker {
    private userId: string;
    private permissions: Set<string>;
    private roles: Set<string>;
    private legacyRole?: string;

    constructor(userId: string, permissions: string[], roles: string[], legacyRole?: string) {
        this.userId = userId;
        this.permissions = new Set(permissions);
        this.roles = new Set(roles);
        this.legacyRole = legacyRole;
    }

    /**
     * Check if user has a specific permission
     * @param permission - Permission in format "resource:action" (e.g., "songs:create")
     */
    hasPermission(permission: string): boolean {
        // Super admin has all permissions
        if (this.roles.has('super_admin')) return true;

        // Check exact permission
        if (this.permissions.has(permission)) return true;

        // Check wildcard permissions
        const [resource, action] = permission.split(':');
        if (this.permissions.has(`${resource}:*`)) return true;
        if (this.permissions.has(`*:${action}`)) return true;
        if (this.permissions.has('*:*')) return true;

        return false;
    }

    /**
     * Check if user has ANY of the provided permissions
     */
    hasAnyPermission(...permissions: string[]): boolean {
        return permissions.some(p => this.hasPermission(p));
    }

    /**
     * Check if user has ALL of the provided permissions
     */
    hasAllPermissions(...permissions: string[]): boolean {
        return permissions.every(p => this.hasPermission(p));
    }

    /**
     * Check if user has a specific role
     */
    hasRole(role: string): boolean {
        return this.roles.has(role) || this.legacyRole === role;
    }

    /**
     * Check if user has ANY of the provided roles
     */
    hasAnyRole(...roles: string[]): boolean {
        return roles.some(r => this.hasRole(r));
    }

    /**
     * Check if user has ALL of the provided roles
     */
    hasAllRoles(...roles: string[]): boolean {
        return roles.every(r => this.hasRole(r));
    }

    /**
     * Get all permissions
     */
    getAllPermissions(): string[] {
        return Array.from(this.permissions);
    }

    /**
     * Get all roles
     */
    getAllRoles(): string[] {
        return Array.from(this.roles);
    }
}

/**
 * Get authenticated user with permissions and roles
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
    const session = await auth();

    if (!session?.user?.email) {
        return null;
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            userRoles: {
                where: {
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gte: new Date() } }
                    ]
                },
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!user) return null;

    // Collect all permissions from all roles
    const permissions = new Set<string>();
    const roles: string[] = [];

    for (const userRole of user.userRoles) {
        roles.push(userRole.role.name);
        for (const rolePermission of userRole.role.permissions) {
            permissions.add(rolePermission.permission.name);
        }
    }

    return {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        role: user.role, // Legacy support
        roles,
        permissions: Array.from(permissions)
    };
}

/**
 * Create a permission checker for the current user
 */
export async function createPermissionChecker(): Promise<PermissionChecker | null> {
    const user = await getAuthenticatedUser();
    if (!user) return null;

    return new PermissionChecker(user.id, user.permissions, user.roles, user.role);
}

/**
 * Check if resource belongs to user (ownership check)
 */
export async function checkResourceOwnership(
    resource: string,
    resourceId: string,
    userId: string
): Promise<boolean> {
    try {
        let record: any = null;

        switch (resource.toLowerCase()) {
            case 'supportticket':
                record = await prisma.supportTicket.findUnique({
                    where: { id: resourceId },
                    select: { assignedTechnicianId: true }
                });
                return record?.assignedTechnicianId === userId;

            case 'servicereport':
                record = await prisma.serviceReport.findUnique({
                    where: { id: resourceId },
                    select: { technicianId: true }
                });
                return record?.technicianId === userId;

            case 'quotation':
                record = await prisma.quotation.findUnique({
                    where: { id: resourceId },
                    select: { userId: true }
                });
                return record?.userId === userId;

            case 'invoice':
                record = await prisma.invoice.findUnique({
                    where: { id: resourceId },
                    select: { userId: true }
                });
                return record?.userId === userId;

            default:
                return false;
        }
    } catch (error) {
        console.error('Error checking resource ownership:', error);
        return false;
    }
}

/**
 * Authorization middleware wrapper
 */
interface AuthorizationOptions {
    permissions?: string[];
    roles?: string[];
    requireAll?: boolean; // If true, requires ALL permissions/roles. Default: false (requires ANY)
    allowResourceOwner?: boolean; // If true, allows if user owns the resource
    resource?: string; // Resource type for ownership check
    resourceIdParam?: string; // URL param name containing resource ID (default: 'id')
}

export function withAuthorization(
    handler: (req: NextRequest, context: { user: AuthenticatedUser; checker: PermissionChecker }, routeContext?: { params: Promise<Record<string, string>> }) => Promise<NextResponse>,
    options: AuthorizationOptions = {}
) {
    return async (req: NextRequest, routeContext?: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
        const auditLogger = new AuditLogger();

        try {
            // Get authenticated user
            const user = await getAuthenticatedUser();

            if (!user) {
                await auditLogger.log({
                    action: 'auth:unauthorized',
                    resource: 'API',
                    status: 'failure',
                    errorMessage: 'User not authenticated',
                    metadata: { path: req.nextUrl.pathname }
                });

                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                );
            }

            const checker = new PermissionChecker(user.id, user.permissions, user.roles, user.role);

            // Check permissions
            if (options.permissions && options.permissions.length > 0) {
                const hasPermission = options.requireAll
                    ? checker.hasAllPermissions(...options.permissions)
                    : checker.hasAnyPermission(...options.permissions);

                if (!hasPermission) {
                    // Check resource ownership if allowed
                    if (options.allowResourceOwner && options.resource && options.resourceIdParam) {
                        const params = routeContext?.params ? await routeContext.params : {};
                        const resourceId = params[options.resourceIdParam];

                        if (resourceId) {
                            const isOwner = await checkResourceOwnership(options.resource, resourceId, user.id);
                            if (isOwner) {
                                // Allow access - user owns the resource
                                return await handler(req, { user, checker }, routeContext);
                            }
                        }
                    }

                    await auditLogger.log({
                        userId: user.id,
                        action: 'auth:forbidden',
                        resource: 'API',
                        status: 'failure',
                        errorMessage: `Missing required permissions: ${options.permissions.join(', ')}`,
                        metadata: {
                            path: req.nextUrl.pathname,
                            requiredPermissions: options.permissions,
                            userPermissions: user.permissions
                        }
                    });

                    return NextResponse.json(
                        { error: 'Forbidden - Insufficient permissions' },
                        { status: 403 }
                    );
                }
            }

            // Check roles
            if (options.roles && options.roles.length > 0) {
                const hasRole = options.requireAll
                    ? checker.hasAllRoles(...options.roles)
                    : checker.hasAnyRole(...options.roles);

                if (!hasRole) {
                    await auditLogger.log({
                        userId: user.id,
                        action: 'auth:forbidden',
                        resource: 'API',
                        status: 'failure',
                        errorMessage: `Missing required roles: ${options.roles.join(', ')}`,
                        metadata: {
                            path: req.nextUrl.pathname,
                            requiredRoles: options.roles,
                            userRoles: user.roles
                        }
                    });

                    return NextResponse.json(
                        { error: 'Forbidden - Insufficient role' },
                        { status: 403 }
                    );
                }
            }

            // Execute the handler
            return await handler(req, { user, checker }, routeContext);
        } catch (error) {
            console.error('Authorization error:', error);

            await auditLogger.log({
                action: 'auth:error',
                resource: 'API',
                status: 'failure',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                metadata: { path: req.nextUrl.pathname }
            });

            return NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            );
        }
    };
}