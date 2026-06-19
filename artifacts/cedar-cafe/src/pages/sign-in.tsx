import { SignIn } from "@clerk/react";
import { useStoreSettings } from "@/lib/use-store-settings";
import cedarLogo from "@/assets/cedar-logo.png";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const appearance = {
  options: {
    logoImageUrl: `${window.location.origin}${cedarLogo}`,
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
  },
  variables: {
    colorPrimary: "#f97316",
    colorBackground: "#1c1917",
    colorInputBackground: "#292524",
    colorText: "#fafaf9",
    colorTextSecondary: "#a8a29e",
    colorInputText: "#fafaf9",
    colorNeutral: "#78716c",
    borderRadius: "0.75rem",
    fontSize: "15px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-2xl border border-stone-700/50 rounded-2xl w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: { color: "#fafaf9", fontWeight: "800" },
    headerSubtitle: { color: "#a8a29e" },
    socialButtonsBlockButtonText: { color: "#fafaf9" },
    formFieldLabel: { color: "#d6d3d1" },
    footerActionText: { color: "#a8a29e" },
    footerActionLink: { color: "#f97316" },
    dividerText: { color: "#78716c" },
    alertText: { color: "#fef2f2" },
    formFieldSuccessText: { color: "#86efac" },
    identityPreviewEditButton: { color: "#f97316" },
    socialButtonsBlockButton: "border border-stone-600 hover:bg-stone-700/60 transition-colors",
    formButtonPrimary: "bg-orange-500 hover:bg-orange-400 font-bold transition-colors",
    formFieldInput: "bg-stone-800 border-stone-600 text-stone-100 focus:border-orange-500",
    dividerLine: "bg-stone-700",
    logoBox: "flex justify-center pt-2",
    logoImage: "w-16 h-16 rounded-2xl",
    socialButtonsRoot: "!hidden",
    dividerRow: "!hidden",
  },
};

export default function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(135deg, #0c0a09 0%, #1c1917 50%, #0c0a09 100%)" }}
    >
      <div className="mb-6 text-center">
        <p className="text-stone-500 text-sm uppercase tracking-widest font-medium">{useStoreSettings().storeName} · Road Town, BVI</p>
      </div>
      <div className="w-full max-w-sm">
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          fallbackRedirectUrl={`${basePath}/checkout`}
          appearance={appearance}
        />
      </div>
    </div>
  );
}
