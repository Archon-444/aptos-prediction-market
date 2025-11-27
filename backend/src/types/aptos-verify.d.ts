declare module '@aptos-labs/ts-sdk/dist/transactions/verify-message.js' {
  export function verifyMessage(params: {
    address: string;
    message: string;
    signature: string;
  }): Promise<boolean>;
}
