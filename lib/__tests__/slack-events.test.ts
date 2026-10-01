import { describe, expect, it } from '@jest/globals';
import {
  SLACK_PERSONAL_EVENTS,
  SLACK_WORKSPACE_EVENTS,
  isSlackWebhookUrl,
  slackEventsForScope,
} from '@/lib/integrations/slack-events';

describe('isSlackWebhookUrl', () => {
  it('accepts Slack incoming webhook URLs', () => {
    expect(isSlackWebhookUrl('https://hooks.slack.com/services/T000/B000/abcDEF123')).toBe(true);
    expect(isSlackWebhookUrl('  https://hooks.slack.com/triggers/T000/123/abc  ')).toBe(true);
  });

  it('rejects anything that is not a Slack webhook endpoint', () => {
    expect(isSlackWebhookUrl('http://hooks.slack.com/services/T000/B000/abc')).toBe(false);
    expect(isSlackWebhookUrl('https://hooks.slack.com.evil.test/services/T/B/x')).toBe(false);
    expect(isSlackWebhookUrl('https://evil.test/hooks.slack.com/services/T/B/x')).toBe(false);
    expect(isSlackWebhookUrl('https://hooks.slack.com/services/T/B/x?redirect=http://169.254.169.254')).toBe(false);
    expect(isSlackWebhookUrl('https://localhost/services/T/B/x')).toBe(false);
    expect(isSlackWebhookUrl('')).toBe(false);
  });
});

describe('slack event catalog', () => {
  it('has unique keys per scope', () => {
    for (const list of [SLACK_WORKSPACE_EVENTS, SLACK_PERSONAL_EVENTS]) {
      const keys = list.map((e) => e.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('returns the catalog for each scope', () => {
    expect(slackEventsForScope('workspace')).toBe(SLACK_WORKSPACE_EVENTS);
    expect(slackEventsForScope('personal')).toBe(SLACK_PERSONAL_EVENTS);
  });
});
