"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const TronWalletProvider = dynamic(
  () => import("./TronWalletProvider"),
  { ssr: false }
);

export default function TronProviderWrapper({ children }: { children: ReactNode }) {
  return <TronWalletProvider>{children}</TronWalletProvider>;
}
