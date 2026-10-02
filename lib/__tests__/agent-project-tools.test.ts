import { canRoleUseTool } from '@/lib/agent/tool-access';

describe('OPS agent project tool access', () => {
  it('lets admins and sales manage the whole project', () => {
    for (const role of ['ADMIN', 'SALES']) {
      for (const tool of [
        'list_projects',
        'get_project',
        'create_project',
        'update_project',
        'add_project_member',
        'add_project_milestone',
        'create_project_task',
        'update_project_task',
        'delete_project_task',
        'add_task_comment',
        'log_task_hours',
      ]) {
        expect(canRoleUseTool(tool, role)).toBe(true);
      }
    }
  });

  it('lets technicians work tasks but not change project settings', () => {
    expect(canRoleUseTool('update_project_task', 'TECHNICIAN')).toBe(true);
    expect(canRoleUseTool('add_task_comment', 'TECHNICIAN')).toBe(true);
    expect(canRoleUseTool('log_task_hours', 'TECHNICIAN')).toBe(true);
    expect(canRoleUseTool('create_project', 'TECHNICIAN')).toBe(false);
    expect(canRoleUseTool('update_project', 'TECHNICIAN')).toBe(false);
    expect(canRoleUseTool('add_project_milestone', 'TECHNICIAN')).toBe(false);
  });

  it('gives support managers read-only project access, and customers nothing', () => {
    expect(canRoleUseTool('get_project', 'SUPPORT_MANAGER')).toBe(true);
    expect(canRoleUseTool('create_project_task', 'SUPPORT_MANAGER')).toBe(false);
    expect(canRoleUseTool('get_project', 'CUSTOMER')).toBe(false);
  });
});
