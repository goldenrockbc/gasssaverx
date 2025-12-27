import { useCallback, useState } from "react";
import { useWallet } from "@tronweb3/tronwallet-adapter-react-hooks";
import { tronContract, tronTokens } from "@/lib/contract";
import { ethers } from "ethers";

const TRC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "success", type: "bool" }],
    type: "function",
  },
];

const GAS_SAVER_ABI = [
  {
    inputs: [
      { name: "tokens", type: "address[]" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    name: "bulkTransfer",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

export default function useTronGassaver() {
  const { address, connected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  const bulkTransfer = useCallback(
    async (tokens: string[], recipients: string[], amounts: string[]) => {
      // 0. Manual Wallet Connection & Validation
      const waitForTronWeb = async () => {
        let attempts = 0;
        while (attempts < 50) {
          // Standard check
          if (window.tronWeb && window.tronWeb.ready) return true;
          // Fallback: check if address is available (sometimes ready is false but address is there)
          if (
            window.tronWeb &&
            window.tronWeb.defaultAddress &&
            window.tronWeb.defaultAddress.base58
          )
            return true;

          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }
        return false;
      };

      // Trigger connection if needed
      if (window.tronLink && window.tronLink.request) {
        try {
          console.log("Requesting Tron accounts...");
          await window.tronLink.request({ method: "tron_requestAccounts" });
        } catch (e) {
          console.warn("Request accounts failed/rejected", e);
        }
      }

      const isReady = await waitForTronWeb();
      if (!isReady || !window.tronWeb) {
        throw new Error(
          "TronWeb not ready. Please unlock your wallet and ensure you are on the correct network."
        );
      }

      // Ensure we have a valid sender address
      const currentAddress = address || window.tronWeb.defaultAddress?.base58;

      if (!currentAddress) {
        throw new Error("No wallet address found. Please connect your wallet.");
      }

      // Hardcoded contract address to ensure validity
      const CONTRACT_ADDRESS = "TESHt6Nrd7JtdXWzJUeeA7EGJsS8oma9qK";

      // Network Check
      const fullNode = window.tronWeb.fullNode?.host || "";
      console.log("Connected Node:", fullNode);
      if (!fullNode.includes("nile.trongrid.io")) {
        alert("Please switch your TronLink node to https://nile.trongrid.io");
        // Proceeding anyway but warning user is good
      }

      setIsLoading(true);
      try {
        console.log("Tron Bulk Transfer:", {
          tokens,
          recipients,
          amounts,
          spender: CONTRACT_ADDRESS,
          from: currentAddress,
        });

        // Helper to get decimals
        const getDecimals = async (
          tokenSymbol: string,
          tokenAddress: string
        ) => {
          if (tokenSymbol === "TRX") return 6;
          try {
            if (!window.tronWeb) {
              throw new Error("TronWeb is not available");
            }
            const contract = await window.tronWeb.contract().at(tokenAddress);
            // Some contracts might not have decimals(), default to 6 if fail
            const decimals = await (contract as { decimals: () => { call: () => Promise<unknown> } }).decimals().call();
            return Number(typeof decimals === "bigint" ? decimals.toString() : decimals);
          } catch (e) {
            console.warn(
              `Failed to fetch decimals for ${tokenSymbol}, defaulting to 6`,
              e
            );
            return 6;
          }
        };

        const tokenDecimalsMap = new Map<string, number>();
        // Pre-fetch decimals
        for (let i = 0; i < tokens.length; i++) {
          const tokenSymbol = tokens[i];
          if (tokenDecimalsMap.has(tokenSymbol)) continue;

          if (tokenSymbol === "TRX") {
            tokenDecimalsMap.set(tokenSymbol, 6);
          } else {
            const tokenAddress = tronTokens[tokenSymbol];
            if (tokenAddress) {
              const decimals = await getDecimals(tokenSymbol, tokenAddress);
              tokenDecimalsMap.set(tokenSymbol, decimals);
            }
          }
        }

        // 1. Calculate totals per token
        const tokenApprovals = new Map<string, bigint>();
        let totalNativeAmount = BigInt(0);

        for (let i = 0; i < tokens.length; i++) {
          const tokenSymbol = tokens[i];
          const tokenAddress = tronTokens[tokenSymbol];

          if (!tokenAddress) {
            console.warn(`Token ${tokenSymbol} not found in config`);
            continue;
          }

          // Parse amount using fetched decimals
          const decimals = tokenDecimalsMap.get(tokenSymbol) || 6;
          const amountBig = ethers.parseUnits(amounts[i], decimals);

          if (tokenSymbol === "TRX") {
            totalNativeAmount += amountBig;
          } else {
            const currentAmount = tokenApprovals.get(tokenAddress) || BigInt(0);
            tokenApprovals.set(tokenAddress, currentAmount + amountBig);
          }
        }

        // 2. Approve tokens
        for (const [tokenAddress, totalAmount] of tokenApprovals.entries()) {
          if (totalAmount > BigInt(0)) {
            console.log(`Approving ${tokenAddress} for ${totalAmount}`);

            // Use transactionBuilder for explicit control
            const parameter = [
              { type: "address", value: CONTRACT_ADDRESS },
              { type: "uint256", value: totalAmount.toString() },
            ];
            const options = {
              feeLimit: 100_000_000,
              callValue: 0,
            };

            const transaction =
              await window.tronWeb.transactionBuilder.triggerSmartContract(
                tokenAddress,
                "approve(address,uint256)",
                options,
                parameter,
                currentAddress
              );

            if (!transaction.result || !transaction.transaction) {
              console.error("Approval transaction build failed", transaction);
              throw new Error("Failed to build approval transaction");
            }

            console.log("Signing approval transaction...");
            const signedTx = await window.tronWeb.trx.sign(
              transaction.transaction
            );

            console.log("Broadcasting approval transaction...");
            const broadcast = await window.tronWeb.trx.sendRawTransaction(
              signedTx
            );

            if (!broadcast.result) {
              console.error("Approval broadcast failed", broadcast);
              throw new Error(
                "Approval failed: " +
                  (broadcast.message || JSON.stringify(broadcast))
              );
            }

            console.log(`Approved ${tokenAddress} successfully`);
            // Wait a bit for propagation (optional but safer)
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        // 3. Call bulkTransfer
        // Prepare arrays
        const formattedTokens = tokens.map((t) => {
          if (t === "TRX") return "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb"; // Zero address equivalent
          return tronTokens[t];
        });

        const formattedAmounts = amounts.map((a, index) => {
          if (!window.tronWeb) throw new Error("TronWeb is not available");
          const tokenSymbol = tokens[index];
          const decimals = tokenDecimalsMap.get(tokenSymbol) || 6;
          return ethers.parseUnits(a, decimals).toString();
        });

        console.log("Calling bulkTransfer on contract:", CONTRACT_ADDRESS);

        const bulkParameter = [
          { type: "address[]", value: formattedTokens },
          { type: "address[]", value: recipients },
          { type: "uint256[]", value: formattedAmounts },
        ];

        const bulkOptions = {
          feeLimit: 500_000_000,
          callValue: totalNativeAmount.toString(),
        };

        const bulkTransaction =
          await window.tronWeb.transactionBuilder.triggerSmartContract(
            CONTRACT_ADDRESS,
            "bulkTransfer(address[],address[],uint256[])",
            bulkOptions,
            bulkParameter,
            currentAddress
          );

        if (!bulkTransaction.result || !bulkTransaction.transaction) {
          console.error(
            "Bulk transfer transaction build failed",
            bulkTransaction
          );
          throw new Error("Failed to build bulk transfer transaction");
        }

        console.log("Signing bulk transfer transaction...");
        const signedBulkTx = await window.tronWeb.trx.sign(
          bulkTransaction.transaction
        );

        console.log("Broadcasting bulk transfer transaction...");
        const bulkBroadcast = await window.tronWeb.trx.sendRawTransaction(
          signedBulkTx
        );

        if (!bulkBroadcast.result) {
          console.error("Bulk transfer broadcast failed", bulkBroadcast);
          throw new Error(
            "Bulk transfer failed: " +
              (bulkBroadcast.message || JSON.stringify(bulkBroadcast))
          );
        }

        console.log("Tron transfer submitted successfully");
      } catch (error) {
        console.error("Tron bulk transfer failed:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [address, connected]
  );

  return {
    bulkTransfer,
    isLoading,
  };
}
