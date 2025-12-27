"use client";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
} from "@reown/appkit/react";
import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { useChain } from "@/providers/ChainProvider";
import { useWallet } from "@tronweb3/tronwallet-adapter-react-hooks";
import { useWalletModal } from "@tronweb3/tronwallet-adapter-react-ui";
import { Icon } from "@iconify/react";
import { useTokenBalance } from "@/hooks/useTokenBalance";

interface NavbarProps {
  selectedToken?: string;
}

export default function Navbar({ selectedToken = "USDT" }: NavbarProps) {
  const { open } = useAppKit();
  const { isConnected: isEvmConnected, address: evmAddress } =
    useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();
  const [mounted, setMounted] = useState(false);

  const { chainType, setChainType } = useChain();
  const {
    address: tronAddress,
    connected: isTronConnected,
    disconnect,
  } = useWallet();
  const { setVisible: setTronModalVisible } = useWalletModal();

  const { balance } = useTokenBalance(selectedToken);

  useSyncExternalStore(
    (onStoreChange) => {
      setMounted(true);
      return () => {};
    },
    () => mounted
  );

  const handleConnect = () => {
    if (chainType === "evm") {
      open();
    } else {
      if (isTronConnected) {
        disconnect();
      } else {
        setTronModalVisible(true);
      }
    }
  };

  const isConnected = chainType === "evm" ? isEvmConnected : isTronConnected;
  const address = chainType === "evm" ? evmAddress : tronAddress;

  return (
    <header className="flex items-center justify-between rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        {/* <div className="flex flex-col">
          <span className="text-base font-semibold text-white md:text-lg">
            Multi-Send Studio
          </span>
          <span className="text-xs text-zinc-400">
            Batch transfers, optimized gas
          </span>
        </div> */}
        <Image
          src={"/Logo-main.png"}
          alt="Logo"
          className="w-42"
          width={500}
          height={100}
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Chain Selector */}
        <div className="flex items-center rounded-lg bg-zinc-800 p-1">
          <button
            onClick={() => setChainType("evm")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              chainType === "evm"
                ? "bg-zinc-700 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            EVM
          </button>
          <button
            onClick={() => setChainType("tron")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              chainType === "tron"
                ? "bg-red-600/90 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            TRON
          </button>
        </div>

        {chainType === "evm" && (
          <div className="hidden items-center gap-2 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 md:flex">
            <span className="font-medium text-emerald-400">
              {mounted ? caipNetwork?.name || "Select Network" : null}
            </span>
          </div>
        )}

        {/* Balance Display */}
        {mounted && isConnected && (
          <div className="hidden md:flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
            <span className="text-zinc-400">Balance:</span>
            <span className="font-medium text-white">
              {balance} {selectedToken}
            </span>
          </div>
        )}

        <button
          onClick={handleConnect}
          className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors ${
            chainType === "tron"
              ? "bg-red-600 hover:bg-red-500"
              : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {/* <span className="h-2 w-2 rounded-full bg-emerald-300"></span> */}
          <span>
            {mounted && isConnected
              ? address?.slice(0, 5) + "..." + address?.slice(-5)
              : "Connect Wallet"}
          </span>
        </button>
      </div>
    </header>
  );
}
