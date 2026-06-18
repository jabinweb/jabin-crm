'use client';

import { GoogleCalendarSettings } from '@/components/crm/google-calendar-settings';

export default function CalendarSettingsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Calendar Settings</h1>
        <p className="text-gray-500">Manage your calendar integrations and sync settings</p>
      </div>

      <GoogleCalendarSettings />
    </div>
  );
}
