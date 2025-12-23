import { ethers } from 'ethers'
import { type WalletClient } from 'viem'

/**
 * Convert wagmi WalletClient to ethers signer
 */
export async function walletClientToSigner(walletClient: WalletClient): Promise<ethers.JsonRpcSigner> {
  const { account } = walletClient
  if (!account) {
    throw new Error('Wallet account not found')
  }
  
  // Check for SSR
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet not found. Please connect your wallet.')
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  return signer
}

/**
 * Get signer directly from window.ethereum
 * Works with any wallet that wagmi supports
 */
export async function getSigner(): Promise<ethers.JsonRpcSigner> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet not found. Please connect your wallet.')
  }

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  return signer
}



