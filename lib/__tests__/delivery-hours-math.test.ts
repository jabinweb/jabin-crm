import {
  burnPercent,
  combineBurnHours,
  sumHours,
} from '@/lib/projects/delivery-hours-math';

describe('delivery-hours-math', () => {
  it('sums hours', () => {
    expect(sumHours(2, 3)).toBe(5);
    expect(sumHours(null, 3)).toBe(3);
  });

  it('prefers worklogs over task-linked timesheets', () => {
    expect(
      combineBurnHours({
        projectLevelTimesheetHours: 4,
        taskLinkedTimesheetHours: 10,
        worklogHours: 6,
      })
    ).toBe(10);
  });

  it('uses task-linked timesheets when no worklogs', () => {
    expect(
      combineBurnHours({
        projectLevelTimesheetHours: 4,
        taskLinkedTimesheetHours: 10,
        worklogHours: 0,
      })
    ).toBe(14);
  });

  it('computes burn percent', () => {
    expect(burnPercent(40, 80)).toBe(50);
    expect(burnPercent(10, null)).toBeNull();
  });
});
