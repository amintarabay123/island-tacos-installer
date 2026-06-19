import { useEffect, useState, useCallback } from "react";
import { X, Share, Plus } from "lucide-react";
import { useStoreSettings } from "@/lib/use-store-settings";

type Platform = "android" | "ios" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "it_install_dismissed";
const DISMISS_DAYS = 14;

function isMobileOrTablet(): boolean {
  const ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua))
    || window.innerWidth <= 1024;
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isDismissedRecently(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return "ios";
  return null;
}

export default function InstallPrompt() {
  const { storeName } = useStoreSettings();
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosExpanded, setIosExpanded] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissedRecently() || !isMobileOrTablet()) return;

    const p = detectPlatform();
    if (!p) return;
    setPlatform(p);

    if (p === "android") {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        const timer = setTimeout(() => setVisible(true), 3000);
        return () => clearTimeout(timer);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }

    if (p === "ios") {
      const timer = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setInstalling(false);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop for iOS expanded state */}
      {iosExpanded && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={() => setIosExpanded(false)}
        />
      )}

      {/* Banner */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-[#1A0C00] text-white rounded-t-2xl shadow-2xl border-t border-white/10">

          {/* iOS expanded instructions */}
          {platform === "ios" && iosExpanded && (
            <div className="px-5 pt-5 pb-2 border-b border-white/10">
              <p className="text-sm font-semibold text-white/90 mb-4">
                Add to your home screen in 2 steps:
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F5A623] flex items-center justify-center shrink-0 text-black font-bold text-sm">
                    1
                  </div>
                  <div>
                    <p className="text-sm text-white/80">
                      Tap the{" "}
                      <span className="inline-flex items-center gap-1 bg-white/10 rounded px-1.5 py-0.5">
                        <Share className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold">Share</span>
                      </span>{" "}
                      button at the bottom of your browser
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F5A623] flex items-center justify-center shrink-0 text-black font-bold text-sm">
                    2
                  </div>
                  <div>
                    <p className="text-sm text-white/80">
                      Scroll down and tap{" "}
                      <span className="inline-flex items-center gap-1 bg-white/10 rounded px-1.5 py-0.5">
                        <Plus className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold">Add to Home Screen</span>
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main row */}
          <div className="flex items-center gap-3 px-4 py-4">
            {/* Icon */}
            <img
              src="/icon.svg"
              alt={storeName}
              className="w-12 h-12 rounded-xl shrink-0"
            />

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">{storeName}</p>
              <p className="text-xs text-white/60 mt-0.5">
                Add to your home screen for quick ordering
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {platform === "android" && (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="px-4 py-2 rounded-full bg-[#F5A623] text-black text-sm font-bold hover:bg-[#FFB833] active:scale-95 transition-all disabled:opacity-60"
                >
                  {installing ? "Installing…" : "Install"}
                </button>
              )}

              {platform === "ios" && (
                <button
                  onClick={() => setIosExpanded((e) => !e)}
                  className="px-4 py-2 rounded-full bg-[#F5A623] text-black text-sm font-bold hover:bg-[#FFB833] active:scale-95 transition-all"
                >
                  {iosExpanded ? "Got it" : "How to"}
                </button>
              )}

              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Safe area spacer for iPhone home bar */}
          <div className="h-safe-area-inset-bottom pb-2" />
        </div>
      </div>
    </>
  );
}
