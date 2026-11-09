"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, PlusSquare, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsInstalled(standalone);

    const userAgent = navigator.userAgent;
    const apple =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    setIsIOS(apple);
    setIsAndroid(/Android/i.test(userAgent));

    if (standalone) return;

    setDismissed(sessionStorage.getItem("ibuy-install-dismissed") === "true");

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowInstructions(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const result = await installPrompt.userChoice;

    if (result.outcome === "accepted") {
      setIsInstalled(true);
    }

    setInstallPrompt(null);
  };

  const dismiss = () => {
    setDismissed(true);
    setShowInstructions(false);
    sessionStorage.setItem("ibuy-install-dismissed", "true");
  };

  if (
    isInstalled ||
    dismissed ||
    (!installPrompt && !isIOS && !isAndroid)
  ) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pt-3 sm:px-4">
      <div className="relative overflow-hidden rounded-xl border border-orange-200 bg-orange-50 p-3 sm:p-4">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss installation prompt"
          className="absolute right-2 top-2 rounded-full p-1.5 text-gray-500 hover:bg-orange-100"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 pr-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm">
            <Smartphone className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-gray-900">
              Get the iBUY app
            </h3>
            <p className="mt-0.5 text-xs text-gray-600">
              Add iBUY to your home screen for a convenient shopping experience.
            </p>
          </div>

          {installPrompt ? (
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
            >
              <Download className="h-4 w-4" />
              Install
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowInstructions((value) => !value)}
              className="shrink-0 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
            >
              How to install
            </button>
          )}
        </div>

        {showInstructions && (
          <div className="mt-4 rounded-lg border border-orange-200 bg-white p-3 text-sm text-gray-700">
            {isIOS ? (
              <>
                <h4 className="mb-3 font-semibold text-gray-900">
                  Install iBUY on your iPhone or iPad
                </h4>
                <ol className="space-y-3">
                  <li className="flex items-center gap-3">
                    <Share className="h-5 w-5 shrink-0 text-orange-600" />
                    <span>
                      <strong>1.</strong> Open iBUY in Safari and tap Share.
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <PlusSquare className="h-5 w-5 shrink-0 text-orange-600" />
                    <span>
                      <strong>2.</strong> Select Add to Home Screen.
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 shrink-0 text-orange-600" />
                    <span>
                      <strong>3.</strong> Tap Add to finish.
                    </span>
                  </li>
                </ol>
              </>
            ) : (
              <>
                <h4 className="mb-2 font-semibold text-gray-900">
                  Install iBUY on your Android device
                </h4>
                <p>
                  Open your browser menu (usually the three dots ) and look
                  for Install app, Add to Home screen, or a similarly named
                  option. The wording and availability depend on your browser.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
