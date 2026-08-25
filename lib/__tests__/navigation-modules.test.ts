import {
  normalizeDashboardPath,
  resolveModuleId,
  hubModulesForVertical,
  getAvailableModules,
  navItemsForModule,
} from '@/lib/navigation/modules';

describe('navigation modules', () => {
  it('normalizes company-scoped dashboard paths', () => {
    expect(normalizeDashboardPath('/jabin/dashboard/projects')).toBe('/dashboard/projects');
    expect(normalizeDashboardPath('/jabin/dashboard/projects/abc')).toBe(
      '/dashboard/projects/abc'
    );
    expect(normalizeDashboardPath('/jabin/employee/leave')).toBe('/employee/leave');
    expect(normalizeDashboardPath('/dashboard')).toBe('/dashboard');
  });

  it('resolves home for dashboard root', () => {
    expect(resolveModuleId('/acme/dashboard')).toBe('home');
  });

  it('resolves projects and retainers', () => {
    expect(resolveModuleId('/acme/dashboard/projects')).toBe('projects');
    expect(resolveModuleId('/acme/dashboard/retainers')).toBe('projects');
  });

  it('puts workflows under projects for web_agency', () => {
    expect(
      resolveModuleId('/acme/dashboard/workflows', { vertical: 'web_agency' })
    ).toBe('projects');
    expect(resolveModuleId('/acme/dashboard/workflows', { vertical: 'general' })).toBe(
      'workspace'
    );
  });

  it('puts calendar and tasks under workspace', () => {
    expect(resolveModuleId('/acme/dashboard/calendar')).toBe('workspace');
    expect(resolveModuleId('/acme/dashboard/tasks')).toBe('workspace');
  });

  it('puts timesheets under projects for agency', () => {
    expect(
      resolveModuleId('/acme/dashboard/timesheets', { vertical: 'web_agency' })
    ).toBe('projects');
    expect(
      resolveModuleId('/acme/dashboard/timesheets', { vertical: 'general' })
    ).toBe('people');
  });

  it('resolves sales and support', () => {
    expect(resolveModuleId('/acme/dashboard/leads')).toBe('sales');
    expect(resolveModuleId('/acme/dashboard/tickets/xyz')).toBe('support');
    expect(resolveModuleId('/acme/dashboard/support/inbox')).toBe('support');
  });

  it('de-emphasizes ops on agency hub', () => {
    const hub = hubModulesForVertical('web_agency');
    expect(hub.find((m) => m.id === 'ops')).toBeUndefined();
    expect(hub[0]?.id).toBe('projects');
  });

  it('getAvailableModules filters by role', () => {
    const tech = getAvailableModules({ role: 'TECHNICIAN', vertical: 'general' });
    expect(tech.map((m) => m.id).sort()).toEqual(['people', 'support', 'workspace'].sort());
    const admin = getAvailableModules({
      role: 'ADMIN',
      vertical: 'web_agency',
      features: { inventory: false, equipment: false },
    });
    expect(admin.find((m) => m.id === 'ops')).toBeUndefined();
    expect(admin.find((m) => m.id === 'platform')).toBeUndefined();
  });

  it('hides field tools for agency support nav', () => {
    const support = navItemsForModule('support', {
      vertical: 'web_agency',
      userRole: 'ADMIN',
    });
    expect(support.find((i) => i.name === 'Field tools')).toBeUndefined();
    expect(support.find((i) => i.href === '/dashboard/contracts')).toBeUndefined();
  });

  it('keeps sales free of calendar/tasks', () => {
    const sales = navItemsForModule('sales', { vertical: 'general', userRole: 'ADMIN' });
    expect(sales.find((i) => i.href === '/dashboard/calendar')).toBeUndefined();
    expect(sales.find((i) => i.href === '/dashboard/tasks')).toBeUndefined();
  });
});
