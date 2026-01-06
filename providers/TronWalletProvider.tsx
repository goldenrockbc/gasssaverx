"use client";

import React, { useMemo, useEffect, useState } from "react";
import { WalletProvider } from "@tronweb3/tronwallet-adapter-react-hooks";
import { WalletModalProvider } from "@tronweb3/tronwallet-adapter-react-ui";
import { TronLinkAdapter, TrustAdapter } from "@tronweb3/tronwallet-adapters";
import type { Adapter } from "@tronweb3/tronwallet-abstract-adapter";
import "@/app/tron-adapter.css";

export default function TronWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [adapters, setAdapters] = useState<Adapter[]>([]);

  useEffect(() => {
    // Initial adapter setup
    const initAdapters = () => {
      const tronLinkAdapter = new TronLinkAdapter({
        checkTimeout: 3000,
      });
      const trustAdapter = new TrustAdapter();
      setAdapters([tronLinkAdapter, trustAdapter]);
    };

    initAdapters();

    // Conflict resolution: Trust Wallet often hijacks window.tronLink
    // We try to detect if window.tronLink is actually Trust Wallet, and if so,
    // we attempt to restore the real TronLink from window.tron (if available).
    const interval = setInterval(() => {
      if (typeof window === "undefined") return;

      const tronLink = (window as unknown as Record<string, unknown>).tronLink;
      const tron = (window as unknown as Record<string, unknown>).tron;

      // Check if current tronLink is Trust Wallet (often has isTrust or isTrustWallet)
      const isTrustHijack =
        tronLink &&
        ((tronLink as { isTrust?: boolean; isTrustWallet?: boolean }).isTrust ||
          (tronLink as { isTrust?: boolean; isTrustWallet?: boolean })
            .isTrustWallet);

      const isTronHijack =
        tron &&
        ((tron as { isTrust?: boolean; isTrustWallet?: boolean }).isTrust ||
          (tron as { isTrust?: boolean; isTrustWallet?: boolean })
            .isTrustWallet);

      if (isTrustHijack || isTronHijack) {
        console.warn(
          "[TronWalletProvider] Trust Wallet has hijacked window.tronLink or window.tron"
        );

        let fixed = false;

        // Try to find the real TronLink
        if (
          isTronHijack &&
          tronLink &&
          !(tronLink as { isTrust?: boolean; isTrustWallet?: boolean })
            .isTrust &&
          !(tronLink as { isTrust?: boolean; isTrustWallet?: boolean })
            .isTrustWallet &&
          (tronLink as { isTronLink?: boolean }).isTronLink
        ) {
          // console.log(
          //   "[TronWalletProvider] Found real TronLink in window.tronLink, restoring to window.tron"
          // );
          (window as unknown as Record<string, unknown>).tron = tronLink;
          fixed = true;
        } else if (
          isTrustHijack &&
          tron &&
          !(tron as { isTrust?: boolean }).isTrust &&
          !(tron as { isTrustWallet?: boolean }).isTrustWallet &&
          (tron as { isTronLink?: boolean }).isTronLink
        ) {
          // console.log(
          //   "[TronWalletProvider] Found real TronLink in window.tron, restoring to window.tronLink"
          // );
          (window as unknown as Record<string, unknown>).tronLink = tron;
          fixed = true;
        }

        if (fixed) {
          // console.log(
          //   "[TronWalletProvider] Re-initializing adapters after fix"
          // );
          // Re-create adapters to pick up the correct window object
          initAdapters();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  function onConnect(address: string) {
    // console.log("[TronWalletProvider] onConnect:", address);
  }

  function onAccountsChanged(address: string) {
    // console.log("[TronWalletProvider] onAccountsChanged:", address);
  }

  function onAdapterChanged(adapter: Adapter | null) {
    // console.log("[TronWalletProvider] onAdapterChanged:", adapter?.name);
  }

  function onError(e: Error) {
    // console.error("[TronWalletProvider] onError:", e);
  }

  return (
    <WalletProvider
      adapters={adapters}
      disableAutoConnectOnLoad={true}
      onConnect={onConnect}
      onAccountsChanged={onAccountsChanged}
      onAdapterChanged={onAdapterChanged}
      onError={onError}
    >
      <WalletModalProvider>{children}</WalletModalProvider>
    </WalletProvider>
  );
}
