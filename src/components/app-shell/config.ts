import {
  CalendarDays,
  Inbox,
  Settings2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { DEFAULT_LOCALE, t } from "@/lib/i18n";

export type AppNavigationItem = {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  href: string;
  icon: LucideIcon;
  label: string;
  shortLabel: string;
};

export const appNavigation: readonly AppNavigationItem[] = [
  {
    description: t(DEFAULT_LOCALE, "navigation.myWeek.description"),
    emptyDescription: t(DEFAULT_LOCALE, "navigation.myWeek.emptyDescription"),
    emptyTitle: t(DEFAULT_LOCALE, "navigation.myWeek.emptyTitle"),
    href: "/app",
    icon: CalendarDays,
    label: t(DEFAULT_LOCALE, "navigation.myWeek"),
    shortLabel: t(DEFAULT_LOCALE, "navigation.myWeek.short"),
  },
  {
    description: t(DEFAULT_LOCALE, "navigation.missionInbox.description"),
    emptyDescription: t(
      DEFAULT_LOCALE,
      "navigation.missionInbox.emptyDescription",
    ),
    emptyTitle: t(DEFAULT_LOCALE, "navigation.missionInbox.emptyTitle"),
    href: "/app/inbox",
    icon: Inbox,
    label: t(DEFAULT_LOCALE, "navigation.missionInbox"),
    shortLabel: t(DEFAULT_LOCALE, "navigation.missionInbox.short"),
  },
  {
    description: t(
      DEFAULT_LOCALE,
      "navigation.peopleAndMeetings.description",
    ),
    emptyDescription: t(
      DEFAULT_LOCALE,
      "navigation.peopleAndMeetings.emptyDescription",
    ),
    emptyTitle: t(
      DEFAULT_LOCALE,
      "navigation.peopleAndMeetings.emptyTitle",
    ),
    href: "/app/people",
    icon: UsersRound,
    label: t(DEFAULT_LOCALE, "navigation.peopleAndMeetings"),
    shortLabel: t(DEFAULT_LOCALE, "navigation.peopleAndMeetings.short"),
  },
  {
    description: t(DEFAULT_LOCALE, "navigation.settings.description"),
    emptyDescription: t(
      DEFAULT_LOCALE,
      "navigation.settings.emptyDescription",
    ),
    emptyTitle: t(DEFAULT_LOCALE, "navigation.settings.emptyTitle"),
    href: "/app/settings",
    icon: Settings2,
    label: t(DEFAULT_LOCALE, "navigation.settings"),
    shortLabel: t(DEFAULT_LOCALE, "navigation.settings.short"),
  },
] as const;

export const shellCopy = {
  account: t(DEFAULT_LOCALE, "shell.accountFallback"),
  brandName: t(DEFAULT_LOCALE, "shell.brandName"),
  brandQualifier: t(DEFAULT_LOCALE, "shell.brandQualifier"),
  foundationBadge: t(DEFAULT_LOCALE, "shell.foundationBadge"),
  foundationNote: t(DEFAULT_LOCALE, "shell.foundationNote"),
  navigationLabel: t(DEFAULT_LOCALE, "shell.navigationLabel"),
  signOut: t(DEFAULT_LOCALE, "auth.signOut"),
  skipToContent: t(DEFAULT_LOCALE, "shell.skipToContent"),
} as const;

export function getActiveNavigationItem(pathname: string) {
  return (
    [...appNavigation]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) =>
        item.href === "/app"
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) ?? appNavigation[0]
  );
}
