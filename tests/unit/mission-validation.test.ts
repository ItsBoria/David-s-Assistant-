import { describe, expect, it } from "vitest";

import { MissionPriority } from "../../src/lib/domain/mission";
import {
  createMissionSchema,
  MissionValidationMessage,
  localizeMissionValidationMessage,
  zodErrorToFieldErrors,
} from "../../src/lib/validation";

describe("mission validation", () => {
  it("normalizes optional text and coerces duration for selected-date missions", () => {
    const result = createMissionSchema.parse({
      category: "  Client work  ",
      description: "  Draft scope and risks  ",
      estimatedDurationMinutes: "90",
      priority: MissionPriority.HIGH,
      selectedDate: "2026-07-14",
      title: "  Write project proposal  ",
    });

    expect(result).toEqual({
      category: "Client work",
      description: "Draft scope and risks",
      estimatedDurationMinutes: 90,
      priority: MissionPriority.HIGH,
      selectedDate: "2026-07-14",
      title: "Write project proposal",
    });
  });

  it("turns blank optional text into null", () => {
    const result = createMissionSchema.parse({
      category: "",
      description: "   ",
      estimatedDurationMinutes: 30,
      priority: MissionPriority.MEDIUM,
      selectedDate: "2026-07-15",
      title: "Follow up",
    });

    expect(result.category).toBeNull();
    expect(result.description).toBeNull();
  });

  it("accepts already-normalized optional text from the client resolver", () => {
    const result = createMissionSchema.parse({
      category: null,
      description: null,
      estimatedDurationMinutes: 45,
      priority: MissionPriority.LOW,
      selectedDate: "2026-07-16",
      title: "Review inbox",
    });

    expect(result.category).toBeNull();
    expect(result.description).toBeNull();
  });

  it("rejects missing essentials with field-level messages", () => {
    const result = createMissionSchema.safeParse({
      category: "",
      description: "",
      estimatedDurationMinutes: 0,
      priority: "not-real",
      selectedDate: "",
      title: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(zodErrorToFieldErrors(result.error)).toMatchObject({
        estimatedDurationMinutes: [
          MissionValidationMessage.DURATION_TOO_SMALL,
        ],
        priority: [MissionValidationMessage.PRIORITY_INVALID],
        selectedDate: [MissionValidationMessage.TARGET_DATE_REQUIRED],
        title: [MissionValidationMessage.TITLE_REQUIRED],
      });
    }
  });

  it("localizes mission validation messages without rewriting server messages", () => {
    expect(
      localizeMissionValidationMessage(
        "en",
        MissionValidationMessage.TITLE_REQUIRED,
      ),
    ).toBe("Enter a mission title.");
    expect(localizeMissionValidationMessage("en", "Database is busy")).toBe(
      "Database is busy",
    );
  });
});
