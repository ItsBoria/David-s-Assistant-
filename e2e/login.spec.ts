import { expect, test } from "@playwright/test";

test("public login page exposes an accessible sign-in form", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: /welcome back|sign in/i }),
  ).toBeVisible();

  const email = page.getByRole("textbox", { name: /email/i });
  const password = page.getByLabel(/password/i);
  const submit = page.getByRole("button", { name: /sign in/i });

  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute("type", "email");
  await expect(password).toBeVisible();
  await expect(password).toHaveAttribute("type", "password");
  await expect(submit).toBeEnabled();

  await submit.click();
  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();

  // Filling fields verifies that the form recovers from validation without
  // submitting credentials to a live Supabase project.
  await email.fill("person@example.com");
  await password.fill("local-smoke-test");
  await expect(email).toHaveValue("person@example.com");
  await expect(password).toHaveValue("local-smoke-test");
});
