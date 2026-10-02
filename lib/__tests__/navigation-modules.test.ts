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
    expect(resolveModuleId('/acme/dashboard/projects/backlog')).toBe('projects');
  });

  it('puts workflows under projects for web_agency', () => {
    expect(
      resolveModuleId('/acme/dashboard/workflows', { vertical: 'web_agency' })
    ).toBe('projects');
    expect(resolveModuleId('/acme/dashboard/workflows', { vertical: 'general' })).toBe(
      'workspace'
    );
  });

  it('puts calendar under workspace and follow-ups under sales', () => {
    expect(resolveModuleId('/acme/dashboard/calendar')).toBe('workspace');
    expect(resolveModuleId('/acme/dashboard/tasks')).toBe('sales');
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
    expect(hub.filter((m) => m.id !== 'workspace')[0]?.id).toBe('projects');
  });

  it('puts the workspace module first after Home for every staff role', () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER', 'TECHNICIAN']) {
      for (const vertical of ['general', 'web_agency']) {
        const mods = getAvailableModules({ role, vertical });
        expect(mods[0]?.id).toBe('workspace');
        expect(mods[0]?.icon).not.toBe('Settings');
      }
    }
    expect(getAvailableModules({ role: 'CUSTOMER' }).find((m) => m.id === 'workspace')).toBeUndefined();
  });

  it('lands each role on a workspace page it can use', () => {
    const landing = (role: string) =>
      getAvailableModules({ role, vertical: 'general' }).find((m) => m.id === 'workspace')?.href;
    expect(landing('ADMIN')).toBe('/admin');
    expect(landing('SUPER_ADMIN')).toBe('/admin');
    expect(landing('SALES')).toBe('/dashboard/messages');
    expect(landing('SUPPORT_MANAGER')).toBe('/dashboard/messages');
    expect(landing('TECHNICIAN')).toBe('/dashboard/messages');
    expect(resolveModuleId('/acme/admin')).toBe('workspace');
    expect(resolveModuleId('/acme/dashboard/messages')).toBe('workspace');
  });

  it('offers Messages and Calendar from Home (the phone More sheet opens there)', () => {
    const home = navItemsForModule('home', { vertical: 'general', userRole: 'SALES' });
    expect(home.map((i) => i.href)).toEqual(
      expect.arrayContaining(['/dashboard/messages', '/dashboard/calendar'])
    );
  });

  it('getAvailableModules filters by role', () => {
    const tech = getAvailableModules({ role: 'TECHNICIAN', vertical: 'general' });
    // Projects matches PROJECTS_NAV and the delivery APIs, which include technicians
    expect(tech.map((m) => m.id).sort()).toEqual(['people', 'projects', 'support', 'workspace'].sort());
    // Landings are pages the role can use: Messages, not the Reports hub
    expect(tech.find((m) => m.id === 'workspace')?.href).toBe('/dashboard/messages');
    expect(tech.find((m) => m.id === 'people')?.href).toBe('/employee/attendance');

    // Non-admins without an employee profile have nothing in People
    const sales = getAvailableModules({ role: 'SALES', vertical: 'general', hasEmployeeProfile: false });
    expect(sales.find((m) => m.id === 'people')).toBeUndefined();

    // Plan modules steer landings and hide modules with nothing usable
    const noLeads = getAvailableModules({
      role: 'ADMIN',
      vertical: 'general',
      modules: { LEADS: false, DEALS: true, EMAIL_OUTREACH: false, TICKETS: true },
    });
    expect(noLeads.find((m) => m.id === 'sales')?.href).toBe('/dashboard/deals');
    expect(noLeads.find((m) => m.id === 'outreach')).toBeUndefined();
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

  it('keeps CRM follow-ups under sales, not home/workspace', () => {
    const sales = navItemsForModule('sales', { vertical: 'general', userRole: 'ADMIN' });
    expect(sales.find((i) => i.href === '/dashboard/tasks')?.name).toBe('Follow-ups');
    const home = navItemsForModule('home', { vertical: 'web_agency', userRole: 'ADMIN' });
    expect(home.find((i) => i.href === '/dashboard/tasks')).toBeUndefined();
    const workspace = navItemsForModule('workspace', {
      vertical: 'general',
      userRole: 'ADMIN',
    });
    expect(workspace.find((i) => i.href === '/dashboard/tasks')).toBeUndefined();
  });

  it('exposes backlog under projects', () => {
    const projects = navItemsForModule('projects', {
      vertical: 'web_agency',
      userRole: 'ADMIN',
    });
    expect(projects.find((i) => i.href === '/dashboard/projects/backlog')).toBeTruthy();
  });
});
