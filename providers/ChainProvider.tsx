"use client";

import React, { createContext, useContext, useState } from "react";

type ChainType = "evm" | "tron";

interface ChainContextType {
  chainType: ChainType;
  setChainType: (type: ChainType) => void;
}

const ChainContext = createContext<ChainContextType | undefined>(undefined);

export function ChainProvider({ children }: { children: React.ReactNode }) {
  const [chainType, setChainType] = useState<ChainType>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gassaver-chain-type");
      if (saved === "evm" || saved === "tron") {
        return saved;
      }
    }
    return "evm";
  });

  const handleSetChainType = (type: ChainType) => {
    setChainType(type);
    localStorage.setItem("gassaver-chain-type", type);
  };

  return (
    <ChainContext.Provider
      value={{ chainType, setChainType: handleSetChainType }}
    >
      {children}
    </ChainContext.Provider>
  );
}

export function useChain() {
  const context = useContext(ChainContext);
  if (context === undefined) {
    throw new Error("useChain must be used within a ChainProvider");
  }
  return context;
}
