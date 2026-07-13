import { describe, expect, it } from "vitest";

import {
  getDirection,
  getLanguageTag,
  isRtl,
  normalizeLocale,
  t,
} from "../../src/lib/i18n";

describe("internationalization helpers", () => {
  it("normalizes regional locales and falls back safely", () => {
    expect(normalizeLocale("he-IL")).toBe("he");
    expect(normalizeLocale("EN_us")).toBe("en");
    expect(normalizeLocale("fr-FR")).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
  });

  it("returns matching direction and language metadata", () => {
    expect(getDirection("he")).toBe("rtl");
    expect(isRtl("he-IL")).toBe(true);
    expect(getDirection("en")).toBe("ltr");
    expect(getLanguageTag("he")).toBe("he-IL");
  });

  it("reads centralized strings in both languages", () => {
    expect(t("en", "navigation.myWeek")).toBe("My Week");
    expect(t("he", "navigation.myWeek")).toBe("השבוע שלי");
    expect(t("he-IL", "mission.status.partiallyCompleted")).toBe(
      "הושלמה חלקית",
    );
    expect(t("he", "shell.skipToContent")).toBe("דילוג לתוכן הראשי");
    expect(t("he", "navigation.settings.emptyTitle")).toBe(
      "ההגדרות עדיין לא הוגדרו",
    );
  });
});
