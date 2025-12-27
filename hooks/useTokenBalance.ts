import { useState, useEffect } from "react";
import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { useWallet } from "@tronweb3/tronwallet-adapter-react-hooks";
import { useChain } from "@/providers/ChainProvider";
import { tokens as evmTokens, tronTokens } from "@/lib/contract";
import { ethers } from "ethers";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

export function useTokenBalance(tokenSymbol: string) {
  const { chainType } = useChain();
  const { address: evmAddress, isConnected: isEvmConnected } =
    useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();
  const { address: tronAddress, connected: isTronConnected } = useWallet();

  const [balance, setBalance] = useState<string>("0");
  const [loading, setLoading] = useState(false);

  const fetchBalance = async () => {
    try {
      setLoading(true);

      if (chainType === "evm") {
        if (!isEvmConnected || !evmAddress || !caipNetwork?.id) {
          setBalance("0");
          return;
        }

        // Handle CAIP network ID format (e.g., "eip155:1" -> 1)
        const networkId = Number(
          caipNetwork.id.toString().replace("eip155:", "")
        );

        console.log("Fetching EVM Balance:", {
          tokenSymbol,
          networkId,
          evmAddress,
        });

        // Check if token is native for the current chain
        const chainTokens = evmTokens[networkId];

        if (!chainTokens) {
          console.warn(`No token config found for network ${networkId}`);
          setBalance("0");
          return;
        }

        const tokenAddr = chainTokens[tokenSymbol];

        // If tokenAddr is ZeroAddress, treat as Native
        if (tokenAddr === ethers.ZeroAddress) {
          if (window.ethereum) {
            const provider = new ethers.BrowserProvider(
              window.ethereum as unknown as ethers.Eip1193Provider
            );
            const bal = await provider.getBalance(evmAddress);
            setBalance(parseFloat(ethers.formatEther(bal)).toFixed(4));
          }
          return;
        }

        // If not found in config, assume 0 or handle error
        if (!tokenAddr) {
          console.warn(
            `Token ${tokenSymbol} not found on network ${networkId}`
          );
          setBalance("0");
          return;
        }

        // ERC20 Balance
        if (window.ethereum) {
          try {
            const provider = new ethers.BrowserProvider(
              window.ethereum as unknown as ethers.Eip1193Provider
            );

            // Verify contract exists before calling
            const code = await provider.getCode(tokenAddr);
            if (code === "0x") {
              console.warn(
                `Contract at ${tokenAddr} has no code. Skipping balance fetch for ${tokenSymbol}.`
              );
              setBalance("0");
              setLoading(false);
              return;
            }

            const contract = new ethers.Contract(
              tokenAddr,
              ERC20_ABI,
              provider
            );
            const bal = await contract.balanceOf(evmAddress);
            // Decimals? usually 18, but USDT/USDC is 6.
            // We can fetch decimals if we want to be robust
            let decimals = 18;
            try {
              decimals = await contract.decimals();
            } catch (e) {
              // Fallback based on symbol
              if (["USDT", "USDC"].includes(tokenSymbol)) decimals = 6;
            }

            setBalance(
              parseFloat(ethers.formatUnits(bal, decimals)).toFixed(2)
            );
          } catch (error: unknown) {
            console.error("Failed to fetch token balance:", error);
            if ((error as { code?: string }).code === "BAD_DATA") {
              console.warn(
                `Could not decode result data for ${tokenSymbol}. The contract might not be deployed on this network or the address is incorrect.`
              );
            }
            setBalance("0");
          }
        }
      } else {
        // TRON
        if (
          !isTronConnected ||
          !tronAddress ||
          !window.tronWeb ||
          !window.tronWeb.ready
        ) {
          // Check if address exists even if ready is false (sometimes happens)
          if (!tronAddress && !window.tronWeb?.defaultAddress?.base58) {
            setBalance("0");
            return;
          }
        }

        const currentTronAddress =
          tronAddress || window.tronWeb?.defaultAddress?.base58;
        if (!currentTronAddress) {
          setBalance("0");
          return;
        }

        console.log("Fetching Tron Balance:", {
          tokenSymbol,
          currentTronAddress,
        });

        if (tokenSymbol === "TRX") {
          if (!window.tronWeb) {
            setBalance("0");
            return;
          }
          const bal = await (
            window.tronWeb as unknown as {
              trx: { getBalance: (address: string) => Promise<number> };
            }
          ).trx.getBalance(currentTronAddress);
          setBalance((bal / 1e6).toFixed(2));
        } else {
          const tokenAddr = tronTokens[tokenSymbol];
          if (tokenAddr) {
            // TRC20
            try {
              // Use explicit contract call to avoid ABI issues
              if (!window.tronWeb) {
                console.warn("TronWeb not available");
                setBalance("0");
                return;
              }
              const contract = await window.tronWeb.contract().at(tokenAddr);
              const bal = await (
                contract as unknown as {
                  balanceOf: (addr: string) => { call: () => Promise<bigint> };
                }
              )
                .balanceOf(currentTronAddress)
                .call();

              // Assuming 6 decimals for common stablecoins on Tron
              // Ideally fetch decimals
              const decimals = 6; // Most stablecoins on Tron are 6

              const formatted = (
                parseInt(bal.toString()) / Math.pow(10, decimals)
              ).toFixed(2);
              setBalance(formatted);
            } catch (e) {
              console.error("Error fetching TRC20 balance", e);
              setBalance("0");
            }
          } else {
            console.warn(`Token ${tokenSymbol} not found in Tron config`);
            setBalance("0");
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch balance", e);
      setBalance("0");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [
    chainType,
    tokenSymbol,
    evmAddress,
    isEvmConnected,
    tronAddress,
    isTronConnected,
    caipNetwork?.id,
  ]);

  return { balance, loading };
}
