import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import {
  FetcherWithComponents,
  useFetcher,
  useLoaderData,
  useNavigation,
} from '@remix-run/react'
import { custom, isValid, z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Copy } from '@/components/ui/copy'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  sendTransaction,
  prepareSendTransaction,
  waitForTransaction,
} from '@wagmi/core'
import { usePublicClient, useWalletClient } from 'wagmi'
import { getWalletClient, getPublicClient } from '@wagmi/core'
import Header from '@/components/header'
import { requireAuthedUser } from '@/lib/services/auth.server'
import { User } from 'types/user'
import { Textarea } from '@/components/ui/textarea'

import { SplitsClient } from '@0xsplits/splits-sdk'
import { useReducer } from 'react'

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const txHash = url.searchParams.get('txHash')

  console.log('txHash', txHash)

  const user = (await requireAuthedUser(request)) as User
  const { wallet } = user
  return json({
    wallet: wallet,
    txHash: txHash,
  })
}

const addressRegex = /^0x[a-fA-F0-9]{40}$/

// function createSchema(constraint?: {
//   isTxHash?: (txHash: `0x${string}`) => Promise<boolean>
// }) {
//   return z.object({
//     txHash: z
//       .string({ required_error: 'txHash is required' })
//       .regex(addressRegex, { message: 'Invalid Ethereum address format.' }),
//       // Pipe another schema so it runs only if the email is valid
//       .pipe(
//         z.string().superRefine((email, ctx) =>
//           // Using the `refine` helper from Conform
//           refine(ctx, {
//             validate: () => constraint.isEmailUnique?.(email),
//             message: 'Username is already used',
//           }),
//         ),
//       ),
//     // ...
//   })
// }

const validationSchema = z.object({
  userAddress: z
    .string({ required_error: 'Accountability Address is required.' })
    .regex(addressRegex, { message: 'Invalid Ethereum address format.' }),
  // txHash: z
  //   .string({ required_error: 'Accountability Address is required.' })
  //   .regex(addressRegex, { message: 'Invalid tx hash address format.' }),
  pactAddress: z
    .string({ required_error: 'Pact Address is required.' })
    .regex(addressRegex, { message: 'Invalid Ethereum address format.' }),
  // pactDescription: z.string({
  //   required_error: 'Pact Description is required.',
  // }),
  pactAccountabilityPercentage: z
    .number({
      required_error: 'Pact Accountability Percentage is required.',
    })
    .min(10, { message: 'Percentage should be greater than or equal to 10' })
    .max(50, { message: 'Percentage should be less than or equal to 50' }),
})

// const mutation = makeDomainFunction(validationSchema)(async (values) => {
//   return values
// })

// export const action = async ({ request }: ActionFunctionArgs) => {
//   const resp = await formAction({
//     request,
//     schema: validationSchema,
//     mutation,
//   })
//   if (resp.ok) {
//     // await login(request)
//   }
//   return null
// }
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const submission = parse(formData, { schema: validationSchema })

  if (!submission.value || submission.intent !== 'submit') {
    return json(submission)
  }
  console.log('submission values', JSON.stringify(submission.payload)) // server side log, includes the txHash
  return redirect(
    `/app/create-pact?value=${JSON.stringify(submission.payload)}`,
  )
}

type TransactionAction =
  | { type: 'START_TRANSACTION' }
  | { type: 'WALLET_SIGNING' }
  | { type: 'SPLIT_CREATING' }
  | { type: 'TRANSACTION_COMPLETE'; txHash: `0x${string}` }
  | { type: 'SENDING_TX_HASH'; txHash: `0x${string}` }
  | { type: 'TRANSACTION_ERROR'; error: string }

type TransactionState = {
  status: TxState
  txHash: `0x${string}`
  error?: string
}

type TxState =
  | 'idle'
  | 'signing-wallet'
  | 'creating-split'
  | 'sending-txHash'
  | 'transaction-complete'
  | 'transaction-error'

function transactionReducer(
  state: TransactionState,
  action: TransactionAction,
): TransactionState {
  switch (action.type) {
    case 'START_TRANSACTION':
      return { ...state, status: 'idle' }
    case 'WALLET_SIGNING':
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

export default function CreatePactIndexRoute() {
  const { wallet, txHash } = useLoaderData<typeof loader>()
  const [state, dispatch] = useReducer(transactionReducer, initialState)
  // const [state, dispatch] = useReducer(moveTriplesReducer, {
  //   reviewState: initialState,
  //   error: null,
  // })

  if (wallet) {
    console.log('Session wallet', wallet)
  }

  if (txHash) {
    console.log('txHash', txHash)
  }

  const fetcher = useFetcher<{
    txHash?: string
    pactAddress?: string
    userAddress?: string
  } | null>()

  return (
    <main className="flex min-h-screen flex-col items-center ">
      <Header />
      <div className="flex h-full flex-col items-center pt-20">
        <p className="text-md bg-gray-50/5 cursor-default px-4 font-mono backdrop-blur-sm">
          Create an Accountability Pact
        </p>
        <span className="pb-3 text-success-500">{wallet}</span>
        <p>State: {state.status}</p>
        {state.status === 'idle' && (
          <p>Enter the information to create accountability pact!</p>
        )}
        {state.status === 'signing-wallet' && (
          <p>Sign the transaction in your wallet!</p>
        )}
        {state.status === 'transaction-complete' && (
          <p>tx Complete! {state.txHash}</p>
        )}
        {state.status === 'sending-txHash' && (
          <p>Sending txHash! {state.txHash}</p>
        )}
        <CreatePactForm fetcher={fetcher} state={state} dispatch={dispatch} />
      </div>
    </main>
  )
}

interface CreatePactFormProps {
  fetcher: FetcherWithComponents<any>
  state: TransactionState
  dispatch: React.Dispatch<TransactionAction>
}
export function CreatePactForm({
  fetcher,
  state,
  dispatch,
}: CreatePactFormProps) {
  const { wallet, txHash } = useLoaderData<typeof loader>()
  const navigation = useNavigation()

  const {
    data: walletClientData,
    isError: walletClientError,
    isLoading: walletClientLoading,
  } = useWalletClient()

  const publicClient = usePublicClient()

  const [form, { userAddress, pactAddress, pactAccountabilityPercentage }] =
    useForm({
      onValidate({ formData }) {
        return parse(formData, { schema: validationSchema })
      },

      shouldValidate: 'onBlur',
      onSubmit: async (event, { submission }) => {
        event.preventDefault()
        dispatch({ type: 'START_TRANSACTION' })

        try {
          const formElement = event.target as HTMLFormElement
          const pactAddressValue = formElement.pactAddress.value

          const pactAccountabilityPercentageValue = parseFloat(
            formElement.pactAccountabilityPercentage.value,
          )

          // Check if the values are numbers
          if (isNaN(pactAccountabilityPercentageValue)) {
            throw new Error('Invalid input: Please enter numeric values.')
          }

          const userValueWithDecimal = parseFloat(
            pactAccountabilityPercentageValue.toFixed(1),
          )
          const calculatedValueWithDecimal = parseFloat(
            (100.0 - pactAccountabilityPercentageValue).toFixed(1), // Ensure this is also a number
          )

          if (!walletClientLoading && walletClientData) {
            dispatch({ type: 'WALLET_SIGNING' })

            const splitsClient = new SplitsClient({
              chainId: 421613,
              publicClient: publicClient,
              walletClient: walletClientData,
            })

            const splitArgs = {
              recipients: [
                {
                  address: wallet,
                  percentAllocation: userValueWithDecimal,
                },
                {
                  address: pactAddressValue,
                  percentAllocation: calculatedValueWithDecimal,
                },
              ],
              distributorFeePercent: 0.0,
            }
            const response = await splitsClient.createSplit(splitArgs)
            dispatch({ type: 'SPLIT_CREATING' })

            if (response && response.event.transactionHash) {
              dispatch({
                type: 'TRANSACTION_COMPLETE',
                txHash: response.event.transactionHash,
              })
              const txHash = response.event.transactionHash
              const formData = new FormData(formElement) // get the form data from the form elemnt
              if (txHash !== null) {
                dispatch({
                  type: 'SENDING_TX_HASH',
                  txHash: txHash,
                })
                formData.append('txHash', txHash) // append the resolved txHash to the form data
                fetcher.load(
                  `/app/create-pact?index&txHash=${txHash}&userAddress=${wallet}`,
                )
                // fetcher.submit(formData, {
                //   method: 'post',
                // })
              }
            }
          }
        } catch (error) {
          dispatch({ type: 'TRANSACTION_ERROR', error: 'An error occurred' }) // Handle errors
          console.error(
            'An error occurred during transaction or form handling:',
            error,
          )

          // Handle the error appropriately
        }
      },
    })

  return (
    <Card className="w-full pb-8 pt-4">
      <div className="space-y-4">
        <fetcher.Form {...form.props} className="flex flex-col gap-4 p-6">
          <Input
            {...conform.input(userAddress)}
            type="hidden"
            name="userAddress"
            value={wallet}
          />
          <div className="flex flex-col gap-2">
            <Label className="m-x-auto text-sm text-foreground">
              Pact Address
            </Label>
            <Input {...conform.input(pactAddress)} />
            <span className="flex items-center text-xs font-medium tracking-wide text-red-500">
              {pactAddress.error}
            </span>
          </div>
          {/* <div className="w-100 flex flex-col flex-wrap gap-2">
            <Label className="m-x-auto text-sm text-foreground">
              Pact Description
            </Label>
            <Textarea {...conform.input(pactDescription)} />
            <span className="flex items-center text-xs font-medium tracking-wide text-red-500">
              {pactDescription.error}
            </span>
          </div> */}
          <div className="flex flex-col gap-2">
            <Label className="m-x-auto text-sm text-foreground">
              Pact Accountability Percentage
            </Label>
            <Input {...conform.input(pactAccountabilityPercentage)} />
            <span className="flex items-center text-xs font-medium tracking-wide text-red-500">
              {pactAccountabilityPercentage.error}
            </span>
          </div>
          <Button variant="outline" size="sm" className="block w-full">
            {navigation.state === 'idle' ? 'Create' : ' Creating'} Pact
          </Button>
        </fetcher.Form>
      </div>
    </Card>
  )
}
