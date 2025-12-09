"use client"
import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
} from "@reown/appkit/react";
import Image from "next/image";

export default function Navbar() {
  const { open } = useAppKit();
  const { isConnected, address } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();

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
        <Image src={"/Logo-main.png"} alt="Logo" className="w-42" width={500} height={100} />
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 md:flex">
          <span className="font-medium text-emerald-400">{caipNetwork?.name}</span>
        </div>

        <button
          onClick={() => open()}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          {/* <span className="h-2 w-2 rounded-full bg-emerald-300"></span> */}
          <span>
            {isConnected
              ? address?.slice(0, 5) + "..." + address?.slice(-5)
              : "Connect Wallet"}
          </span>
        </button>
      </div>
    </header>
  );
}
