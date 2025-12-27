"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@tronweb3/tronwallet-adapter-react-hooks";

interface DebugInfo {
  [key: string]: boolean | string | undefined | null;
}

interface TronLinkObject {
  isTronLink?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  tronWeb?: TronWebObject;
  [key: string]: unknown;
}

interface TronWebObject {
  ready?: boolean;
  [key: string]: unknown;
}

export default function WalletDebug() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});
  const { wallet, connected, connecting } = useWallet();

  useEffect(() => {
    const updateDebugInfo = () => {
      if (typeof window === "undefined") return;

      const tron = window.tron;
      const tronLink = window.tronLink;
      const tronWeb = window.tronWeb;

      setDebugInfo({
        "window.tron": !!tron,
        "window.tron.isTronLink": tron?.isTronLink,
        "window.tron.isTrust": (tron as unknown as TronLinkObject)?.isTrust,
        "window.tronLink": !!tronLink,
        "window.tronLink.isTrust": (tronLink as TronLinkObject)?.isTrust,
        "window.tronLink.isTrustWallet": tronLink?.isTrustWallet,
        "window.tronLink.tronWeb": !!tronLink?.tronWeb,
        "window.tronWeb": !!tronWeb,
        "window.tronWeb.ready": (tronWeb as unknown as TronWebObject)?.ready,
        "Adapter Connected": connected,
        "Adapter Connecting": connecting,
        "Current Wallet": wallet?.adapter.name,
        "Wallet ReadyState": wallet?.adapter.readyState,
      });
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 1000);
    return () => clearInterval(interval);
  }, [wallet, connected, connecting]);

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-black/90 p-4 text-xs text-green-400 shadow-lg border border-green-800 font-mono">
      <h3 className="mb-2 font-bold text-white">Wallet Debug Info</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {Object.entries(debugInfo).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-4">
            <span className="text-gray-400">{key}:</span>
            <span className={value ? "text-green-400" : "text-red-400"}>
              {String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
