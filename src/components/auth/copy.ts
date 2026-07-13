import { DEFAULT_LOCALE, t } from "@/lib/i18n";

export const authCopy = {
  brand: {
    name: t(DEFAULT_LOCALE, "app.name"),
    promise: t(DEFAULT_LOCALE, "auth.brand.promise"),
    eyebrow: t(DEFAULT_LOCALE, "auth.brand.eyebrow"),
    benefits: [
      t(DEFAULT_LOCALE, "auth.brand.protectedWorkspace"),
      t(DEFAULT_LOCALE, "auth.brand.focusedFoundation"),
      t(DEFAULT_LOCALE, "auth.brand.responsiveHome"),
    ],
    securityFootnote: t(DEFAULT_LOCALE, "auth.brand.securityFootnote"),
  },
  login: {
    createAccount: t(DEFAULT_LOCALE, "auth.login.createAccount"),
    description: t(DEFAULT_LOCALE, "auth.login.description"),
    eyebrow: t(DEFAULT_LOCALE, "auth.login.title"),
    noAccount: t(DEFAULT_LOCALE, "auth.login.noAccount"),
    submit: t(DEFAULT_LOCALE, "auth.login.submit"),
    submitting: t(DEFAULT_LOCALE, "auth.login.submitting"),
    title: t(DEFAULT_LOCALE, "auth.login.title"),
  },
  signUp: {
    description: t(DEFAULT_LOCALE, "auth.signup.description"),
    eyebrow: t(DEFAULT_LOCALE, "auth.signup.eyebrow"),
    hasAccount: t(DEFAULT_LOCALE, "auth.signup.hasAccount"),
    signIn: t(DEFAULT_LOCALE, "auth.signup.signIn"),
    submit: t(DEFAULT_LOCALE, "auth.signup.submit"),
    submitting: t(DEFAULT_LOCALE, "auth.signup.submitting"),
    title: t(DEFAULT_LOCALE, "auth.signup.title"),
    fullNamePlaceholder: t(
      DEFAULT_LOCALE,
      "auth.signup.fullNamePlaceholder",
    ),
    confirmationTitle: t(DEFAULT_LOCALE, "auth.signup.confirmationTitle"),
    confirmationDescription: t(
      DEFAULT_LOCALE,
      "auth.signup.confirmationDescription",
    ),
    returnToSignIn: t(DEFAULT_LOCALE, "auth.signup.returnToSignIn"),
  },
} as const;
