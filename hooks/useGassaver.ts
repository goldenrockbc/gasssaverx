import GassaverABI from "@/lib/GassaverABI";
import { Provider, useAppKitNetwork, useAppKitProvider } from "@reown/appkit/react";
import { ethers } from "ethers";
import { useEffect, useState, useCallback } from "react";
import { contracts, tokens as tokenContracts } from "@/lib/contract"

export default function useGassaver() {
    const [contract, setContract] = useState<ethers.Contract | null>(null);
    const { walletProvider } = useAppKitProvider<Provider>("eip155");
    const [error, setError] = useState<string | null>(null);
    const { chainId } = useAppKitNetwork();


    const approveTokens = useCallback(async (tokenAddress: string, amount: bigint) => {
        if (!walletProvider || !chainId) throw new Error("No wallet provider");

        const provider = new ethers.BrowserProvider(walletProvider);
        const signer = await provider.getSigner();

        const tokenContract = new ethers.Contract(tokenAddress,
            [
                "function approve(address spender, uint256 amount) external returns (bool)",
            ], signer);

        const tx = await tokenContract.approve(
            contracts[chainId as keyof typeof contracts],
            amount
        );

        await tx.wait();

    }, [walletProvider, chainId]);


    const bulkTransfer = useCallback(async (tokens: string[], recipients: string[], amounts: string[]) => {
        try {
            if (!contract || !walletProvider || !chainId) {
                throw new Error("Contract or wallet provider not initialized");
            }
            // Validate input arrays
            if (tokens.length !== recipients.length || recipients.length !== amounts.length) {
                throw new Error("Input arrays must have the same length");
            }

            console.log({ tokens, recipients, amounts });

            // Create a map to track total amount per token
            const tokenApprovals = new Map<string, bigint>();
            let totalNativeAmount = BigInt(0);

            // Calculate total amount to approve for each token and total native amount
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                const tokenAddress = chainId in tokenContracts ? tokenContracts[Number(chainId)][token] : undefined;

                // Handle native token (ETH)
                if (token.toLowerCase() === 'eth' || token === ethers.ZeroAddress) {
                    totalNativeAmount += BigInt(ethers.parseUnits(amounts[i], 18).toString());
                    continue;
                }

                if (!tokenAddress) continue;

                const amount = ethers.parseUnits(amounts[i], 18);
                const currentAmount = tokenApprovals.get(tokenAddress) || BigInt(0);
                tokenApprovals.set(tokenAddress, currentAmount + BigInt(amount));
            }

            // Execute approvals for each unique token
            for (const [tokenAddress, totalAmount] of tokenApprovals.entries()) {
                if (totalAmount > BigInt(0)) {
                    await approveTokens(tokenAddress, totalAmount);
                }
            }

            // Prepare token addresses (use ZeroAddress for native token)
            const formattedTokens = tokens.map((token) =>
                token.toLowerCase() === 'eth' || token === ethers.ZeroAddress
                    ? ethers.ZeroAddress
                    : tokenContracts[Number(chainId)]?.[token]
            );

            const formattedAmounts = amounts.map((amount) => ethers.parseUnits(amount, 18));

            console.log({
                formattedTokens,
                recipients,
                formattedAmounts,
                value: totalNativeAmount
            });

            // Execute the bulk transfer with the native token value if needed
            const tx = await contract.bulkTransfer(
                formattedTokens,
                recipients,
                formattedAmounts,
                { value: totalNativeAmount > 0 ? totalNativeAmount : undefined }
            );

            await tx.wait();


            return { success: true };
        } catch (error) {
            console.error("Bulk transfer failed:", error);
            setError(error instanceof Error ? error.message : "Unknown error occurred");
            throw error;
        }
    }, [chainId, contract, walletProvider, approveTokens]);


    useEffect(() => {
        const initContract = async () => {
            if (!walletProvider || !contracts[chainId as keyof typeof contracts]) {
                setError("Wallet provider or contract is not available");
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
                console.log({ error });
            }
        };

        initContract();
    }, [walletProvider, chainId]);


    return {
        contract,
        error,
        bulkTransfer
    };
}