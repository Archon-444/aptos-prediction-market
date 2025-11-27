// Global type declarations for wallet objects

declare global {
  interface Window {
    aptos?: {
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
      isConnected: () => boolean;
      account: () => Promise<{ address: string }>;
      signTransaction: (transaction: any) => Promise<any>;
      signMessage: (message: any) => Promise<any>;
      signAndSubmitTransaction: (transaction: any) => Promise<any>;
      onAccountChange: (callback: (account: any) => void) => void;
      onDisconnect: (callback: () => void) => void;
      network: () => Promise<{ name: string }>;
    };
    martian?: {
      aptos: {
        connect: () => Promise<void>;
        disconnect: () => Promise<void>;
        isConnected: () => boolean;
        account: () => Promise<{ address: string }>;
        signTransaction: (transaction: any) => Promise<any>;
        signMessage: (message: any) => Promise<any>;
        signAndSubmitTransaction: (transaction: any) => Promise<any>;
        onAccountChange: (callback: (account: any) => void) => void;
        onDisconnect: (callback: () => void) => void;
        network: () => Promise<{ name: string }>;
      };
      sui: {
        connect: () => Promise<void>;
        disconnect: () => Promise<void>;
        isConnected: () => boolean;
        getAccounts: () => Promise<{ address: string }[]>;
        signAndExecuteTransaction: (transaction: any) => Promise<any>;
        signMessage: (message: any) => Promise<any>;
        onAccountChange: (callback: (account: any) => void) => void;
        onDisconnect: (callback: () => void) => void;
      };
    };
    suiWallet?: {
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
      isConnected: () => boolean;
      account: () => Promise<{ address: string }>;
      signAndExecuteTransactionBlock: (transaction: any) => Promise<any>;
      signMessage: (message: any) => Promise<any>;
    };
  }
}

export {};
