/**
 * Sentence-case, wrapping tabs for settings pages. The shared TabsTrigger is a tiny
 * uppercase pill in a horizontally scrolling strip, which hides tabs off-screen on phones;
 * settings pages have enough tabs that they need to wrap instead.
 */
export const SETTINGS_TAB_LIST_CLASS =
  'flex h-auto w-full flex-wrap justify-start gap-1 overflow-visible sm:justify-start';

export const SETTINGS_TAB_TRIGGER_CLASS =
  'min-h-9 shrink-0 gap-2 rounded-md px-3 py-1.5 text-sm font-medium normal-case tracking-normal text-muted-foreground data-[state=active]:text-background';
