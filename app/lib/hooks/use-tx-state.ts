import { useReducer } from 'react'

export type TransactionAction =
  | { type: 'START_TRANSACTION' }
  | { type: 'SIGNING_WALLET' }
  | { type: 'SPLIT_CREATING' }
  | { type: 'TRANSACTION_COMPLETE'; txHash: `0x${string}` }
  | { type: 'SENDING_TX_HASH'; txHash: `0x${string}` }
  | { type: 'TRANSACTION_ERROR'; error: string }

export type TransactionState = {
  status: TxState
  txHash: `0x${string}`
  error?: string
}

export type TxState =
  | 'idle'
  | 'signing-wallet'
  | 'creating-split'
  | 'sending-txHash'
  | 'transaction-complete'
  | 'transaction-error'

const transactionReducer = (
  state: TransactionState,
  action: TransactionAction,
): TransactionState => {
  switch (action.type) {
    case 'START_TRANSACTION':
      return { ...state, status: 'idle' }
    case 'SIGNING_WALLET':
      return { ...state, status: 'signing-wallet' }
    case 'SPLIT_CREATING':
      return { ...state, status: 'creating-split' }
    case 'TRANSACTION_COMPLETE':
      return { ...state, status: 'transaction-complete', txHash: action.txHash }
    case 'SENDING_TX_HASH':
      return { ...state, status: 'sending-txHash', txHash: action.txHash }
    case 'TRANSACTION_ERROR':
      return { ...state, status: 'transaction-error', error: action.error }
    default:
      return state
  }
}

const initialState: TransactionState = {
  status: 'idle',
  txHash: `0x${1234}...`,
  error: undefined,
}

export function useTxState(initialState: TransactionState) {
  const [state, dispatch] = useReducer(transactionReducer, initialState)

  return { state, dispatch }
}
