import { ethers } from "ethers";

const tokens: Record<number, Record<string, string>> = {
  1: {
    USDT: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
    USDC: "0xBDeD8Ec7EFc7C3bE1Bf086d3832285c12B6CB2f4",
    ETH: ethers.ZeroAddress,
    BNB: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
    MATIC: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
  },
  56: {
    USDT: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
    USDC: "0xBDeD8Ec7EFc7C3bE1Bf086d3832285c12B6CB2f4",
    ETH: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
    BNB: ethers.ZeroAddress,
    MATIC: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
  },
  137: {
    USDT: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
    USDC: "0xBDeD8Ec7EFc7C3bE1Bf086d3832285c12B6CB2f4",
    ETH: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
    BNB: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
    MATIC: ethers.ZeroAddress,
  },
  11155111: {
    USDT: "0xAFcEeeC3708C9760E70DE04E954Acf409c001A59",
    USDC: "0x3fefD5B9F2a3EfA43976964f73CE6cafdfD3eE83",
    ETH: ethers.ZeroAddress,
    BNB: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
    MATIC: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
  },
  11142220: {
    USDT: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
    USDC: "0xBDeD8Ec7EFc7C3bE1Bf086d3832285c12B6CB2f4",
    ETH: ethers.ZeroAddress,
    BNB: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
    MATIC: "0xC8673dE666Ac880C4f220176588C6d368D574aaF",
  },
};

const contracts = {
  11155111: "0xE0636c80c18931cf5BFd24c8A3679aa85e8e7d8D",
  11142220: "0x46c0752624339B3A3e3ACbcB75faa173a5d25928",
};

const tronTokens: Record<string, string> = {
  USDT: "TLCuviLXZtgF7JgXxwrUzrHpt4mmbMRTfW", // Nile Mock USDT
  USDC: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", // Mainnet USDC (Update if needed for Nile)
  TRX: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb", // Using zero address equivalent
};

const tronContract = "TESHt6Nrd7JtdXWzJUeeA7EGJsS8oma9qK"; // Nile Testnet GasSaver Contract

export { tokens, contracts, tronTokens, tronContract };
