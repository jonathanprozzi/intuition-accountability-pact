import { useState, useEffect } from 'react'
import { parseEther } from 'viem'
import {
  usePrepareSendTransaction,
  useSendTransaction,
  useWaitForTransaction,
} from 'wagmi'
import {
  prepareSendTransaction,
  sendTransaction,
  waitForTransaction,
} from 'wagmi/actions'

export default function useClientTransaction() {
  const [txHash, setTxHash] = useState<string | null>(null)
  const { config } = usePrepareSendTransaction({
    to: '0x04EA475026a0AB3e280F749b206fC6332E6939F1',
    value: parseEther('0.000001'),
  })
  const { data: transactionData, sendTransaction } = useSendTransaction(config)
  const { isLoading, isSuccess } = useWaitForTransaction({
    hash: transactionData?.hash,
  })

  useEffect(() => {
    if (isSuccess && transactionData?.hash) {
      setTxHash(transactionData.hash)
    }
  }, [transactionData, isSuccess])

  // function to initiate the transaction
  const initiateTransaction = async (/* transaction parameters */) => {
    sendTransaction?.()
  }

  return {
    txHash,
    initiateTransaction,
    isTransactionLoading: isLoading,
    isTransactionSuccess: isSuccess,
  }
}
