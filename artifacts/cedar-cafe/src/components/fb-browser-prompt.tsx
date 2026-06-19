import { useEffect, useState } from "react";
import { ExternalLink, Share, MoreHorizontal, Chrome } from "lucide-react";

const FB_STORAGE_KEY = "it_fb_skip";

function isFacebookBrowser(): boolean {
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|FB_IAB|FBIOS|FBDV|FBMD|FBSN|FBSV|FBSS|FBCR|FBID|FBLC|FBOP|FBRV/.test(ua)
    || ua.includes("Instagram")
    || ua.includes("[FB");
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua)
    || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
}

function getTargetUrl(): string {
  return window.location.href;
}

export default function FbBrowserPrompt() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isFacebookBrowser()) return;
    if (sessionStorage.getItem(FB_STORAGE_KEY)) return;
    setIos(isIOS());
    setShow(true);
  }, []);

  const skip = () => {
    sessionStorage.setItem(FB_STORAGE_KEY, "1");
    setShow(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getTargetUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: select input
    }
  };

  const openInChrome = () => {
    const url = getTargetUrl().replace(/^https?:\/\//, "");
    window.location.href = `googlechrome://${url}`;
    setTimeout(() => {
      window.location.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
    }, 300);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ backgroundColor: "#1A0C00" }}>
      {/* Top section — logo + message */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {/* TODO(store-settings): alt should be useStoreSettings().storeName */}
        <img
          src="/logo-wordmark.png"
          alt="Island Tacos"
          className="h-16 w-auto mb-8 invert"
        />

        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-5">
          <ExternalLink className="w-7 h-7 text-amber-400" />
        </div>

        <h1 className="text-white text-2xl font-bold mb-3">
          Open in your browser
        </h1>
        <p className="text-white/60 text-sm leading-relaxed max-w-xs">
          Facebook's built-in browser limits features. Open in Safari or Chrome
          for the full ordering experience — and to add us to your home screen.
        </p>
      </div>

      {/* Instructions */}
      <div className="px-6 pb-4">
        {ios ? (
          <div className="bg-white/8 rounded-2xl p-5 mb-4 border border-white/10">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">
              How to open in Safari
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                  <span className="text-black font-bold text-sm">1</span>
                </div>
                <p className="text-white/80 text-sm pt-1">
                  Tap the{" "}
                  <span className="inline-flex items-center gap-1 bg-white/10 rounded px-1.5 py-0.5 mx-0.5">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">···</span>
                  </span>{" "}
                  button at the bottom right of this screen
                </p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                  <span className="text-black font-bold text-sm">2</span>
                </div>
                <p className="text-white/80 text-sm pt-1">
                  Tap{" "}
                  <span className="bg-white/10 rounded px-1.5 py-0.5 font-semibold text-xs mx-0.5">
                    Open in Safari
                  </span>{" "}
                  or{" "}
                  <span className="bg-white/10 rounded px-1.5 py-0.5 font-semibold text-xs mx-0.5">
                    Open in Browser
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                  <span className="text-black font-bold text-sm">3</span>
                </div>
                <p className="text-white/80 text-sm pt-1">
                  Once in Safari, tap{" "}
                  <span className="inline-flex items-center gap-1 bg-white/10 rounded px-1.5 py-0.5 mx-0.5">
                    <Share className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">Share</span>
                  </span>{" "}
                  → <span className="font-semibold text-amber-400">Add to Home Screen</span> for one-tap ordering
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            <button
              onClick={openInChrome}
              className="w-full flex items-center gap-3 bg-white/10 hover:bg-white/15 active:scale-[0.98] transition-all rounded-2xl px-5 py-4 border border-white/10"
            >
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                <Chrome className="w-5 h-5 text-black" />
              </div>
              <div className="text-left">
                <p className="text-white font-semibold text-sm">Open in Chrome</p>
                <p className="text-white/50 text-xs">Tap here to launch Chrome</p>
              </div>
            </button>

            <div className="bg-white/8 rounded-2xl p-4 border border-white/10">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3">
                Or copy the link and open in any browser
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-white/40 text-xs truncate border border-white/10">
                  {getTargetUrl()}
                </div>
                <button
                  onClick={copyLink}
                  className="shrink-0 px-3 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold active:scale-95 transition-all"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CTA row */}
        <div className="flex flex-col gap-3">
          {ios && (
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 active:scale-[0.98] transition-all rounded-2xl px-5 py-3.5 border border-white/10"
            >
              <span className="text-white/70 text-sm font-medium">
                {copied ? "✓ Link copied — paste in Safari" : "Or copy link to open manually"}
              </span>
            </button>
          )}

          <button
            onClick={skip}
            className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold text-base rounded-2xl px-5 py-4 active:scale-[0.98] transition-all shadow-lg"
          >
            Continue in Facebook browser
          </button>
          <p className="text-center text-white/40 text-xs pb-1">
            Some features may not work in the Facebook browser
          </p>
        </div>

        {/* Safe area spacer */}
        <div className="h-6" />
      </div>
    </div>
  );
}
