declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      publicKey?: { toString(): string };
      connect(): Promise<{ publicKey: { toString(): string } }>;
    };
  }
}

export async function connectPhantom() {
  if (!window.solana?.isPhantom) {
    throw new Error('Phantom wallet is not installed');
  }

  const response = await window.solana.connect();
  return response.publicKey.toString();
}

export async function getWalletAddress() {
  if (!window.solana?.publicKey) return '';
  return window.solana.publicKey.toString();
}
