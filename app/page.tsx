"use client";
import Navbar from "@/components/Navbar";
import WalletDebug from "@/components/WalletDebug";
import useGassaver from "@/hooks/useGassaver";
import useTronGassaver from "@/hooks/useTronGassaver";
import { networks } from "@/providers/AppkitProvider";
import { useChain } from "@/providers/ChainProvider";
import { AppKitNetwork } from "@reown/appkit/networks";
import { useAppKitNetwork } from "@reown/appkit/react";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";

type OptimizationLevel = "standard" | "optimized" | "fast";

type EntryMode = "manual" | "upload";

type RecipientRow = {
  id: string;
  address: string;
  token: string;
  amount: string;
  error?: string | null;
  fromUpload?: boolean;
};

type TxStatus = "idle" | "estimating" | "review" | "broadcasting" | "completed";

const EVM_TOKENS = ["USDT", "USDC", "ETH", "BNB", "MATIC"];
const TRON_TOKENS = ["USDT", "USDC", "TRX"];

const EVM_TEMPLATE =
  "address,token,amount\n0xAbc...,USDT,120\n0xFF3...,ETH,0.03\n";
const TRON_TEMPLATE =
  "address,token,amount\nT9yD14Nj...,USDT,120\nTEkxiTehn...,TRX,50\n";

function createEmptyRow(defaultToken: string = "USDT"): RecipientRow {
  return {
    id: crypto.randomUUID(),
    address: "",
    token: defaultToken,
    amount: "",
  };
}

export default function Home() {
  const { chainType } = useChain();
  const tokens = chainType === "evm" ? EVM_TOKENS : TRON_TOKENS;

  const [selectedNetwork, setSelectedNetwork] = useState<AppKitNetwork>(
    networks[0]
  );
  const [optimization, setOptimization] =
    useState<OptimizationLevel>("standard");
  const [entries, setEntries] = useState<RecipientRow[]>([
    createEmptyRow(tokens[0]),
  ]);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>("manual");
  const { switchNetwork } = useAppKitNetwork();
  const { bulkTransfer: evmBulkTransfer } = useGassaver();
  const { bulkTransfer: tronBulkTransfer } = useTronGassaver();
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Clear global error after 5 seconds
  useEffect(() => {
    if (globalError) {
      const timer = setTimeout(() => setGlobalError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [globalError]);

  // Reset entries when chain changes
  useEffect(() => {
    // Move state update into a micro-task to avoid synchronous setState inside the effect
    queueMicrotask(() => setEntries([createEmptyRow(tokens[0])]));
  }, [chainType]);

  const validEntries = useMemo(
    () => entries.filter((e) => !e.error && e.address && e.token && e.amount),
    [entries]
  );

  const totalTokensOut = useMemo(() => {
    const totalsByToken: Record<string, number> = {};
    for (const row of validEntries) {
      const amt = Number(row.amount);
      if (!isFinite(amt)) continue;
      totalsByToken[row.token] = (totalsByToken[row.token] ?? 0) + amt;
    }
    return totalsByToken;
  }, [validEntries]);

  const estimatedGasFeeUsd = 0;

  function setRow(id: string, patch: Partial<RecipientRow>) {
    setEntries((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              ...patch,
              error: patch.error ?? validateRow({ ...row, ...patch }),
            }
          : row
      )
    );
  }

  function addRow() {
    setEntries((prev) => [...prev, createEmptyRow(tokens[0])]);
  }

  function removeRow(id: string) {
    setEntries((prev) =>
      prev.length === 1 ? prev : prev.filter((r) => r.id !== id)
    );
  }

  function validateRow(row: RecipientRow): string | null {
    if (!row.address && !row.amount && !row.token) return null;
    if (!row.address) return "Missing address";
    if (!row.token) return "Missing token";
    if (!row.amount) return "Missing amount";

    if (chainType === "evm") {
      if (!/^0x[a-fA-F0-9]{4,}$/.test(row.address.trim()))
        return "Invalid EVM address format";
    } else {
      // Basic Tron address validation (starts with T, 34 chars)
      if (!/^T[a-zA-Z0-9]{33}$/.test(row.address.trim()))
        return "Invalid Tron address format";
    }

    if (Number(row.amount) <= 0 || Number.isNaN(Number(row.amount)))
      return "Amount must be > 0";
    return null;
  }

  function handleDownloadTemplate() {
    const content = chainType === "evm" ? EVM_TEMPLATE : TRON_TEMPLATE;
    const blob = new Blob([content], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "multi-send-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length <= 1) {
        setGlobalError("File is empty or contains only header");
        return;
      }
      const [, ...rows] = lines;

      const parsed: RecipientRow[] = rows.map((line) => {
        const [address, token, amount] = line
          .split(/[,;\t]/)
          .map((v) => v.trim());
        const row: RecipientRow = {
          id: crypto.randomUUID(),
          address: address ?? "",
          token: token || tokens[0],
          amount: amount ?? "",
          fromUpload: true,
        };
        row.error = validateRow(row);
        return row;
      });

      setEntries((prev) => {
        const filteredPrev = prev.filter(
          (r) => !r.fromUpload || (!!r.address && !!r.amount)
        );
        return [...filteredPrev, ...parsed];
      });
    } catch (error) {
      console.error("File upload failed:", error);
      setGlobalError(
        "Failed to process file. Please ensure valid CSV/Excel format."
      );
    }
  }

  function clearErroredRows() {
    setEntries((prev) => prev.filter((r) => !r.error));
  }

  function handleEstimateAndReview() {
    try {
      setTxStatus("estimating");
      // Simulate estimation delay or actually calculate gas
      setTimeout(() => {
        setTxStatus("review");
        setShowReview(true);
      }, 400);
    } catch (error) {
      console.error("Estimation failed:", error);
      setGlobalError("Failed to estimate gas. Please try again.");
      setTxStatus("idle");
    }
  }

  async function handleConfirmSend() {
    setTxStatus("broadcasting");
    try {
      const tokens = validEntries.map((entry) => entry.token);
      const recipients = validEntries.map((entry) => entry.address);
      const amounts = validEntries.map((entry) => entry.amount);

      console.log("Sending bulk transfer:", { tokens, recipients, amounts });

      if (chainType === "evm") {
        await evmBulkTransfer(tokens, recipients, amounts);
      } else {
        await tronBulkTransfer(tokens, recipients, amounts);
      }

      // Only set to completed if no errors
      setTxStatus("completed");
      setShowReview(false);
    } catch (error: unknown) {
      console.error("Bulk transfer failed:", error);
      setTxStatus("idle"); // Reset or set to error state
      setGlobalError(
        (error as Error).message ||
          "Transaction failed. Please check your wallet and try again."
      );
    }
  }
  useEffect(() => {
    const getGees = async () => {
      const network = await selectedNetwork;
      console.log({ network });
    };
    getGees();
  }, [selectedNetwork]);

  const confirmationEta =
    optimization === "fast"
      ? "~15 sec"
      : optimization === "optimized"
      ? "~45 sec"
      : "~2 min";

  return (
    <div className="min-h-screen bg-linear-to-b from-zinc-950 via-zinc-900 to-black text-zinc-50">
      {/* <WalletDebug /> */}
      <div className="flex min-h-screen w-full flex-col gap-6 px-4 py-6 md:px-8 md:py-5">
        {/* Header */}
        <Navbar selectedToken={entries[0]?.token} />

        {/* Global Error Notification */}
        {globalError && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-900/90 px-4 py-3 text-red-100 shadow-xl backdrop-blur-md">
            <Icon icon="mdi:alert-circle" className="text-xl text-red-400" />
            <span className="text-sm font-medium">{globalError}</span>
            <button
              onClick={() => setGlobalError(null)}
              className="ml-2 rounded-full p-1 hover:bg-red-800/50"
            >
              <Icon icon="mdi:close" className="text-lg" />
            </button>
          </div>
        )}

        {/* Main content */}
        <main className="grid flex-1 gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* Left column: Multi-send panel */}
          <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  Multi-Send & Save Gas Fees
                </h1>
                <p className="mt-1 text-xs text-zinc-400">
                  Upload Excel or add recipients manually. We{" "}
                  <span className="font-medium text-emerald-400">
                    batch optimize
                  </span>{" "}
                  your transaction to reduce gas costs.
                </p>
              </div>
            </div>

            {/* Network selector */}
            {chainType === "evm" ? (
              <div className="mt-1 rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-zinc-400">
                      Select Network
                    </span>
                    <p className="mt-1 text-xs text-zinc-300">
                      Choose where to broadcast your batch transaction.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 rounded-lg border border-zinc-700 bg-zinc-900/90 px-2.5 text-sm outline-none ring-0 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                      value={selectedNetwork.name}
                      onChange={async (e) => {
                        const net: AppKitNetwork | undefined = networks.find(
                          (n) => n.name === e.target.value
                        );
                        console.log(net);
                        await switchNetwork(net || networks[0]);
                        setSelectedNetwork(net as AppKitNetwork);
                      }}
                    >
                      <option disabled value="">
                        Select Network
                      </option>
                      {networks.map((n) => (
                        <option key={n.id} value={n.name}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-1 rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-zinc-400">Network</span>
                    <p className="mt-1 text-xs text-zinc-300">
                      Tron Nile Testnet Selected
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-9 flex items-center rounded-lg border border-red-900/50 bg-red-950/30 px-3 text-sm text-red-400">
                      TRON
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recipient options: toggle between Manual / Excel */}
            <div className="mt-1 flex flex-col gap-4">
              {/* Toggle Buttons */}
              <div className="inline-flex self-start gap-5 rounded-lg bg-zinc-800 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setEntryMode("manual")}
                  className={`flex items-center gap-2 rounded-lg px-6 py-2 font-medium transition-colors ${
                    entryMode === "manual"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200"
                  }`}
                >
                  <Icon icon="mdi:account-edit" className="text-lg" />
                  <span>Manual Entry</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode("upload")}
                  className={`flex items-center gap-2 rounded-lg px-6 py-2 font-medium transition-colors ${
                    entryMode === "upload"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200"
                  }`}
                >
                  <Icon icon="mdi:file-upload" className="text-lg" />
                  <span>Upload File</span>
                </button>
              </div>

              {entryMode === "manual" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Manual Entry
                      </h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        Add recipient addresses and amounts
                      </p>
                    </div>
                    <button
                      onClick={addRow}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
                    >
                      <Icon icon="mdi:plus" className="text-lg" />
                      <span>Add Recipient</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {entries.map((row) => (
                      <div
                        key={row.id}
                        className={`rounded-xl border p-4 transition-colors ${
                          row.error
                            ? "border-red-500/30 bg-red-900/20"
                            : "border-zinc-700 bg-zinc-800/50"
                        }`}
                      >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                          <div className="sm:col-span-5">
                            <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                              Recipient Address
                            </label>
                            <input
                              value={row.address}
                              onChange={(e) =>
                                setRow(row.id, { address: e.target.value })
                              }
                              placeholder={
                                chainType === "evm" ? "0x..." : "T..."
                              }
                              className="w-full rounded-lg border border-zinc-600 bg-zinc-900/50 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:col-span-6">
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                                Token
                              </label>
                              <select
                                value={row.token}
                                onChange={(e) =>
                                  setRow(row.id, { token: e.target.value })
                                }
                                className="w-full rounded-lg border border-zinc-600 bg-zinc-900/50 px-4 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                              >
                                {tokens.map((t) => (
                                  <option
                                    key={t}
                                    value={t}
                                    className="bg-zinc-800"
                                  >
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                                Amount
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={row.amount}
                                onChange={(e) =>
                                  setRow(row.id, { amount: e.target.value })
                                }
                                placeholder="0.0"
                                className="w-full rounded-lg border border-zinc-600 bg-zinc-900/50 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                              />
                            </div>
                          </div>

                          <div className="flex items-end justify-end sm:col-span-1">
                            <button
                              onClick={() => removeRow(row.id)}
                              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-700/50 hover:text-red-400"
                              aria-label="Remove recipient"
                            >
                              <Icon
                                icon="mdi:trash-can-outline"
                                className="text-lg"
                              />
                            </button>
                          </div>
                        </div>

                        {row.error && (
                          <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
                            <Icon icon="mdi:alert-circle" className="text-lg" />
                            <span>{row.error}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-emerald-500/30 bg-emerald-900/10 p-6 text-center">
                  <div className="mx-auto max-w-md">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                      <Icon
                        icon="mdi:file-upload"
                        className="text-3xl text-emerald-400"
                      />
                    </div>
                    <h3 className="mt-4 text-lg font-medium text-white">
                      Upload File
                    </h3>
                    <p className="mt-1 text-sm text-emerald-100/80">
                      Upload a CSV or Excel file with recipient data
                    </p>
                    <div className="mt-6">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500">
                        <Icon icon="mdi:file-import" className="text-lg" />
                        <span>Select File</span>
                        <input
                          type="file"
                          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </label>
                      <button
                        onClick={handleDownloadTemplate}
                        className="ml-3 text-sm font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        Download Template
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right column: Fees + tracking */}
          <section className="flex flex-col gap-5 rounded-2xl h-fit sticky top-10">
            {/* Fee & optimization panel */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Fee & Optimization
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Simulated estimates for UX — plug in your backend later.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
                  <div className="text-[14px] text-zinc-500">
                    Network Gas Fee
                  </div>
                  <div className="mt-1 text-base font-semibold text-zinc-50">
                    ${(estimatedGasFeeUsd || 0).toFixed(2)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    {selectedNetwork.name}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
                  <div className="text-[14px] text-zinc-500">
                    Total Tokens Out
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-100">
                    {Object.keys(totalTokensOut).length === 0
                      ? "—"
                      : Object.entries(totalTokensOut)
                          .map(
                            ([token, amt]) =>
                              `${amt.toLocaleString(undefined, {
                                maximumFractionDigits: 6,
                              })} ${token}`
                          )
                          .join(" · ")}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    {validEntries.length} recipients
                  </div>
                </div>
              </div>

              <button
                onClick={handleEstimateAndReview}
                disabled={!validEntries.length}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 !py-4 text-sm font-semibold text-black transition hover:brightness-105 disabled:!cursor-not-allowed disabled:opacity-50"
              >
                {/* <span className="text-lg">➡</span> */}
                <span>
                  {validEntries.length
                    ? `Review & confirm ${validEntries.length} transfers`
                    : "Add at least one valid row"}
                </span>
              </button>
            </div>

            {/* Transaction tracking panel */}
            <div className="flex flex-1 flex-col rounded-2xl p-4 md:p-5 border border-zinc-800 bg-zinc-900/80 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Transaction Tracking
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Visualize status per recipient after broadcasting.
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-3 text-xs">
                {/* Progress bar */}
                <div>
                  <div className="mb-1 flex items-center justify-between text-[14px] text-zinc-400">
                    <span>Status</span>
                    <span className="font-medium text-zinc-200">
                      {txStatus === "idle" && "Awaiting review"}
                      {txStatus === "estimating" && "Estimating fees…"}
                      {txStatus === "review" && "Ready to confirm"}
                      {txStatus === "broadcasting" && "Broadcasting…"}
                      {txStatus === "completed" && "Completed"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full bg-emerald-400 transition-all`}
                      style={{
                        width:
                          txStatus === "idle"
                            ? "6%"
                            : txStatus === "estimating"
                            ? "35%"
                            : txStatus === "review"
                            ? "55%"
                            : txStatus === "broadcasting"
                            ? "80%"
                            : "100%",
                      }}
                    />
                  </div>
                </div>

                {/* Hash + explorer */}
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2">
                  <div className="flex flex-col">
                    <span className="text-[14px] text-zinc-500">Tx Hash</span>
                    <span className="mt-1 text-[11px] text-zinc-300">
                      {txHash ?? "— not broadcast yet —"}
                    </span>
                  </div>
                  <button
                    className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
                    disabled={!txHash}
                  >
                    Open Explorer
                  </button>
                </div>

                {/* Per-address delivery status mock */}
                <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
                  <div className="mb-1 flex items-center justify-between text-[14px] text-zinc-500">
                    <span>Per-address Status</span>
                    <span className="text-zinc-400">
                      {validEntries.length} recipients
                    </span>
                  </div>
                  <div className="max-h-32 space-y-1 overflow-auto pr-1">
                    {validEntries.length === 0 && (
                      <p className="text-[11px] text-zinc-500">
                        Add recipients to preview individual delivery states.
                      </p>
                    )}
                    {validEntries.slice(0, 4).map((row, idx) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between rounded-md bg-zinc-900/80 px-2 py-1.5 text-[11px]"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-100">
                            {row.address.slice(0, 6)}…{row.address.slice(-4)}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {row.amount} {row.token}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            txStatus === "completed"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : txStatus === "broadcasting"
                              ? "bg-sky-500/15 text-sky-300"
                              : "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {txStatus === "completed"
                            ? "Delivered"
                            : txStatus === "broadcasting"
                            ? "Pending"
                            : idx === 0
                            ? "Next in batch"
                            : "Queued"}
                        </span>
                      </div>
                    ))}
                    {validEntries.length > 4 && (
                      <p className="text-[10px] text-zinc-500">
                        + {validEntries.length - 4} more…
                      </p>
                    )}
                  </div>
                </div>

                {/* Downloadable report */}
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-[11px] font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={txStatus !== "completed"}
                  onClick={() => {
                    // Create CSV content
                    const headers = ["Address", "Token", "Amount"];
                    const csvContent = [
                      headers.join(","),
                      ...validEntries.map((entry) =>
                        [
                          `"${entry.address}"`,
                          `"${entry.token}"`,
                          `"${entry.amount}"`,
                        ].join(",")
                      ),
                    ].join("\n");

                    // Create download link
                    const blob = new Blob([csvContent], {
                      type: "text/csv;charset=utf-8;",
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute(
                      "download",
                      `gassaverx-report-${
                        new Date().toISOString().split("T")[0]
                      }.csv`
                    );
                    link.style.visibility = "hidden";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  <span className="text-sm">
                    <Icon icon="basil:download-outline" />
                  </span>
                  <span>Download report (.csv)</span>
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* Review & Confirm Modal */}
        {showReview && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.9)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">
                    Review & Confirm
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Double-check recipients, totals and fees before sending.
                  </p>
                </div>
                <button
                  onClick={() => setShowReview(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                >
                  ×
                </button>
              </div>

              <div className="mt-3 max-h-64 space-y-2 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/70 p-2">
                {validEntries.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-lg bg-zinc-900/80 px-2 py-1.5 text-[11px]"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-100">
                        {row.address}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        Recipient
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-zinc-100">
                        {row.amount} {row.token}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Network: {selectedNetwork.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    Total Cost
                  </div>
                  <div className="mt-1 text-sm font-semibold text-zinc-50">
                    {Object.keys(totalTokensOut).length === 0
                      ? "—"
                      : Object.entries(totalTokensOut)
                          .map(
                            ([token, amt]) =>
                              `${amt.toLocaleString(undefined, {
                                maximumFractionDigits: 6,
                              })} ${token}`
                          )
                          .join(" · ")}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    Gas Fee
                  </div>
                  <div className="mt-1 text-sm font-semibold text-zinc-50">
                    ${estimatedGasFeeUsd.toFixed(2)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-500">
                    ETA: {confirmationEta}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2 text-sm">
                <button
                  onClick={() => setShowReview(false)}
                  disabled={txStatus === "broadcasting"}
                  className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSend}
                  disabled={txStatus === "broadcasting"}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-semibold text-black transition hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {txStatus === "broadcasting" && (
                    <Icon
                      icon="eos-icons:loading"
                      className="text-lg animate-spin"
                    />
                  )}
                  <span>
                    {txStatus === "broadcasting"
                      ? "Sending..."
                      : "Confirm & Send"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
