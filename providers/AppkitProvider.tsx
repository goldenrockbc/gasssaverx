"use client";
import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import {
  AppKitNetwork,
  bsc,
  celoSepolia,
  mainnet,
  polygon,
  sepolia,
} from "@reown/appkit/networks";

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID as string;

const metadata = {
  name: "Gassaverx",
  description: "Gassaverx",
  url: "https://gassaverx.com",
  icons: ["https://avatars.mywebsite.com/"],
};

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  sepolia,
  bsc,
  mainnet,
  polygon,
  celoSepolia
];

createAppKit({
  adapters: [new EthersAdapter()],
  metadata,
  networks,
  projectId,
  features: {
    analytics: true,
  },
});

export default function AppkitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
