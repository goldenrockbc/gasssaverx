/* types/tron.d.ts */

export {};

declare global {
  interface TronTransactionRawData {
    contract: Array<{
      parameter: {
        value: unknown;
        type_url: string;
      };
      type: string;
    }>;
    ref_block_bytes: string;
    ref_block_hash: string;
    expiration: number;
    timestamp: number;
    [key: string]: unknown;
  }

  interface TronTransaction {
    visible: boolean;
    txID: string;
    raw_data: TronTransactionRawData;
    raw_data_hex: string;
    signature?: string[];
    [key: string]: unknown;
  }

  interface SmartContractParameter {
    type: string;
    value: string | number | (string | number)[];
  }

  interface TriggerSmartContractOptions {
    feeLimit?: number;
    callValue?: number | string;
    tokenId?: string;
    tokenValue?: number;
    userFeePercentage?: number;
    originEnergyLimit?: number;
    [key: string]: unknown;
  }

  interface TransactionExtension {
    result: { result: boolean } | boolean;
    transaction: TronTransaction;
    [key: string]: unknown;
  }

  interface TronWeb {
    ready?: boolean;
    defaultAddress?: {
      base58: string;
      hex: string;
    };
    fullNode?: {
      host: string;
    };
    toSun(amount: string | number): string;
    trx: {
      sign(transaction: TronTransaction): Promise<TronTransaction>;
      sendRawTransaction(signedTransaction: TronTransaction): Promise<{
        result: boolean;
        message?: string;
        transaction?: TronTransaction;
      }>;
    };
    transactionBuilder: {
      triggerSmartContract(
        contractAddress: string,
        functionSelector: string,
        options: TriggerSmartContractOptions,
        parameters: SmartContractParameter[],
        issuerAddress: string
      ): Promise<TransactionExtension>;
    };
    contract(): {
      at(address: string): Promise<unknown>;
    };
  }

  interface TronRequestArguments {
    method:
      | "tron_requestAccounts"
      | "tron_accounts"
      | "tron_signMessage"
      | string;
    params?: unknown[];
  }

  interface Tron {
    isTronLink?: boolean;
    isTrust?: boolean;
    isTrustWallet?: boolean;
    tronWeb?: TronWeb;
    request<T = unknown>(args: TronRequestArguments): Promise<T>;
    [key: string]: unknown;
  }

  interface Window {
    tron?: Tron;
    tronLink?: Tron;
    tronWeb?: TronWeb;
  }
}
