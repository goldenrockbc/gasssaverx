import GassaverABI from "@/lib/GassaverABI";
import {
  Provider,
  useAppKitNetwork,
  useAppKitProvider,
} from "@reown/appkit/react";
import { ethers } from "ethers";
import { useEffect, useState, useCallback } from "react";
import { contracts, tokens as tokenContracts } from "@/lib/contract";

interface EthersError extends Error {
  code?: string | number;
  info?: {
    error?: {
      code?: number;
    };
  };
}

export default function useGassaver() {
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const { walletProvider } = useAppKitProvider<Provider>("eip155");
  const [isLoading, setIsLoading] = useState(false);
  const { chainId } = useAppKitNetwork();

  const approveTokens = useCallback(
    async (tokenAddress: string, amount: bigint) => {
      if (!walletProvider || !chainId) throw new Error("No wallet provider");

      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();

      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function approve(address spender, uint256 amount) external returns (bool)",
        ],
        signer
      );

      try {
        const tx = await tokenContract.approve(
          contracts[chainId as keyof typeof contracts],
          amount
        );
        await tx.wait();
      } catch (e: unknown) {
        const error = e as EthersError;
        if (
          error.code === "ACTION_REJECTED" ||
          error.info?.error?.code === 4001
        ) {
          throw new Error("Approval rejected by user");
        }
        throw error;
      }
    },
    [walletProvider, chainId]
  );

  const bulkTransfer = useCallback(
    async (tokens: string[], recipients: string[], amounts: string[]) => {
      setIsLoading(true);
      try {
        if (!contract || !walletProvider || !chainId) {
          throw new Error("Contract or wallet provider not initialized");
        }
        // Validate input arrays
        if (
          tokens.length !== recipients.length ||
          recipients.length !== amounts.length
        ) {
          throw new Error("Input arrays must have the same length");
        }

        // console.log({ tokens, recipients, amounts });

        const provider = new ethers.BrowserProvider(walletProvider);

        // Helper to get decimals
        const getDecimals = async (
          tokenSymbol: string,
          tokenAddress: string
        ) => {
          // Native tokens (ETH, BNB, MATIC depending on chain) are always 18
          if (tokenAddress === ethers.ZeroAddress) return 18;

          try {
            const tokenContract = new ethers.Contract(
              tokenAddress,
              ["function decimals() view returns (uint8)"],
              provider
            );
            return Number(await tokenContract.decimals());
          } catch (e) {
            console.warn(
              `Failed to fetch decimals for ${tokenSymbol}, using fallback`,
              e
            );

            // Chain-specific fallbacks
            const chainIdNum = Number(chainId);
            const symbol = tokenSymbol.toUpperCase();

            // ETH (1)
            if (chainIdNum === 1) {
              if (["USDT", "USDC"].includes(symbol)) return 6;
            }
            // BSC (56)
            else if (chainIdNum === 56) {
              // USDT and USDC on BSC are 18 decimals
              if (["USDT", "USDC"].includes(symbol)) return 18;
            }
            // Polygon (137)
            else if (chainIdNum === 137) {
              // USDT and USDC (Native) on Polygon are 6 decimals
              if (["USDT", "USDC"].includes(symbol)) return 6;
            }

            // Default fallback
            return ["USDT", "USDC"].includes(symbol) ? 6 : 18;
          }
        };
        // console.log(getDecimals());

        // Create a map to track total amount per token
        const tokenApprovals = new Map<string, bigint>();
        const tokenDecimalsMap = new Map<string, number>();
        let totalNativeAmount = BigInt(0);

        // Pre-fetch decimals for all unique tokens
        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          if (tokenDecimalsMap.has(token)) continue;

          const tokenAddress =
            chainId in tokenContracts
              ? tokenContracts[Number(chainId)][token]
              : undefined;

          if (tokenAddress) {
            const decimals = await getDecimals(token, tokenAddress);
            tokenDecimalsMap.set(token, decimals);
          }
        }

        // Calculate total amount to approve for each token and total native amount
        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          const tokenAddress =
            chainId in tokenContracts
              ? tokenContracts[Number(chainId)][token]
              : undefined;

          if (!tokenAddress) continue;

          // Handle native token (Address is ZeroAddress)
          if (tokenAddress === ethers.ZeroAddress) {
            totalNativeAmount += BigInt(
              ethers.parseUnits(amounts[i], 18).toString()
            );
            continue;
          }

          const decimals = tokenDecimalsMap.get(token) || 18;
          const amount = ethers.parseUnits(amounts[i], decimals);
          const currentAmount = tokenApprovals.get(tokenAddress) || BigInt(0);
          tokenApprovals.set(tokenAddress, currentAmount + BigInt(amount));
        }

        // Execute approvals for each unique token
        for (const [tokenAddress, totalAmount] of tokenApprovals.entries()) {
          // Native tokens (ZeroAddress) don't need approval
          if (tokenAddress === ethers.ZeroAddress) continue;

          if (totalAmount > BigInt(0)) {
            await approveTokens(tokenAddress, totalAmount);
          }
        }

        // Prepare token addresses (use ZeroAddress for native token)
        const formattedTokens = tokens.map((token) => {
          const addr = tokenContracts[Number(chainId)]?.[token];
          return addr || ethers.ZeroAddress;
        });

        const formattedAmounts = amounts.map((amount, index) => {
          const tokenSymbol = tokens[index];
          const decimals = tokenDecimalsMap.get(tokenSymbol) || 18;
          return ethers.parseUnits(amount, decimals);
        });

        // console.log({
        //   formattedTokens,
        //   recipients,
        //   formattedAmounts,
        //   value: totalNativeAmount,
        // });

        // Execute the bulk transfer with the native token value if needed
        const tx = await contract.bulkTransfer(
          formattedTokens,
          recipients,
          formattedAmounts,
          { value: totalNativeAmount > 0 ? totalNativeAmount : undefined }
        );

        await tx.wait();

        return { success: true };
      } catch (error: unknown) {
        // console.error("Bulk transfer failed:", error);

        let errorMessage = "Unknown error occurred";
        const err = error as EthersError;

        if (err.code === "ACTION_REJECTED" || err.info?.error?.code === 4001) {
          errorMessage = "Transaction rejected by user";
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [chainId, contract, walletProvider, approveTokens]
  );

  useEffect(() => {
    const initContract = async () => {
      if (!walletProvider || !contracts[chainId as keyof typeof contracts]) {
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(walletProvider);
        const signer = await provider.getSigner();
        const contractInstance = new ethers.Contract(
          contracts[chainId as keyof typeof contracts],
          GassaverABI,
          signer
        );

        setContract(contractInstance);
      } catch (error) {
        // console.log({ error });
      }
    };

    initContract();
  }, [walletProvider, chainId]);

  return {
    contract,
    bulkTransfer,
    isLoading,
  };
}
