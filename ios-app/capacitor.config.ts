import type { CapacitorConfig } from "@capacitor/cli";

// The app is a native shell around the live site: it loads petespostings.com, so anything
// pushed to the site shows up in the app without an App Store update.
//   npm run sync        -> app loads dev.petespostings.com (for testing on your phone)
//   npm run sync:prod   -> app loads petespostings.com (what goes to the App Store)
const prod = process.env.CAP_ENV === "prod";

const config: CapacitorConfig = {
  appId: "com.petespostings.app",
  appName: "Pete's Postings",
  // Only used if the site can't be reached (www/index.html is a small offline screen).
  webDir: "www",
  backgroundColor: "#14213D",
  server: {
    url: prod ? "https://petespostings.com" : "https://dev.petespostings.com",
    // Pages that stay inside the app. Any other link opens in Safari.
    allowNavigation: [
      "petespostings.com",
      "*.petespostings.com",
      "*.clerk.accounts.dev",
      "checkout.stripe.com",
      "billing.stripe.com",
    ],
  },
  plugins: {
    // Show job alerts as banners (with sound) even while the app is open.
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
  ios: {
    contentInset: "never",
    // Lets the site tell it's running in the app (navigator.userAgent includes this).
    appendUserAgent: "PetesPostingsApp/1.0",
    scrollEnabled: true,
  },
};

export default config;
