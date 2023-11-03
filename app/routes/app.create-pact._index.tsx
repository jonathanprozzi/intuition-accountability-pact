import { conform, useForm } from '@conform-to/react'
import { parse, refine } from '@conform-to/zod'
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import {
  FetcherWithComponents,
  useFetcher,
  useLoaderData,
  useNavigation,
  Form,
  useActionData,
  Link,
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
import { pact, requireAuthedUser } from '@/lib/services/auth.server'
import { User } from 'types/user'
import { Textarea } from '@/components/ui/textarea'

import { SplitsClient } from '@0xsplits/splits-sdk'
import { useEffect, useReducer, useState } from 'react'

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const value = url.searchParams.get('value')

  const user = (await requireAuthedUser(request)) as User
  const { wallet } = user
  return json({
    wallet: wallet,

    value: value ? JSON.parse(value) : undefined,
  })
}

const addressRegex = /^0x[a-fA-F0-9]{40}$/
const txHashRegex = /^0x[a-fA-F0-9]{64}$/

function createSchema(
  intent: string,
  constraint: {
    isTxHash?: (txHash: string) => Promise<boolean>
  } = {},
) {
  return z
    .object({
      txHash: z
        .string({ required_error: 'Accountability Address is required.' })
        .regex(txHashRegex, { message: 'Invalid tx hash address format.' })
        .pipe(
          z.string().superRefine((txHash, ctx) =>
            refine(ctx, {
              validate: () => constraint.isTxHash?.(txHash),
              when: intent === 'submit' || intent === 'validate/txHash',
              message: 'txHash not provided',
            }),
          ),
        ),
    })
    .and(
      z.object({
        userAddress: z
          .string({ required_error: 'Accountability Address is required.' })
          .regex(addressRegex, { message: 'Invalid Ethereum address format.' }),
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
          .min(10, {
            message: 'Percentage should be greater than or equal to 10',
          })
          .max(80, {
            message: 'Percentage should be less than or equal to 80',
          }),
      }),
    )
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const submission = await parse(formData, {
    schema: (intent) =>
      createSchema(intent, {
        isTxHash(txHash) {
          console.log('txHash', txHash)
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(txHash !== null)
            }, Math.random() * 300)
          })
        },
      }),
    async: true,
  })

  if (!submission.value || submission.intent !== 'submit') {
    return json(submission)
  }
  console.log('submission values to server', submission)
  return redirect(`/app/create-pact?value=${JSON.stringify(submission.value)}`)
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
  const { wallet, value } = useLoaderData<typeof loader>()
  const [state, dispatch] = useReducer(transactionReducer, initialState)

  if (wallet) {
    console.log('Session wallet', wallet)
  }

  return (
    <main className="flex min-h-screen flex-col items-center">
      <Header />
      <div className="sm:min-w-md lg:min-w-lg w-50 flex h-full w-6/12	 flex-col items-center pt-20 ">
        {value ? (
          <>
            <p className="leading-7 [&:not(:first-child)]:mt-6">
              Pact Created:
            </p>
            <div className="overflow-auto">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
            <Button variant="secondary" className="text-success-500" asChild>
              <Link to="/app/create-pact">Cast a new Pact 🪄</Link>
            </Button>
          </>
        ) : (
          <div className="w-full">
            <div className="pb-4">
              {state.status === 'idle' && (
                <p className="text-md bg-gray-50/5 cursor-default px-4 font-mono backdrop-blur-sm">
                  Create an Accountability Pact
                </p>
              )}
              {state.status === 'signing-wallet' && (
                <p className="text-md bg-gray-50/5 cursor-default px-4 font-mono backdrop-blur-sm">
                  Sign the transaction in your wallet!
                </p>
              )}
              {state.status === 'transaction-complete' && (
                <p className="text-md bg-gray-50/5 cursor-default px-4 font-mono backdrop-blur-sm">
                  tx Complete! {state.txHash}
                </p>
              )}
              {state.status === 'sending-txHash' && (
                <p className="text-md bg-gray-50/5 cursor-default px-4 font-mono backdrop-blur-sm">
                  Sending txHash! {state.txHash}
                </p>
              )}
            </div>
            <CreatePactForm state={state} dispatch={dispatch} />
          </div>
        )}
      </div>
    </main>
  )
}

interface CreatePactFormProps {
  // fetcher: FetcherWithComponents<any>
  state: TransactionState
  dispatch: React.Dispatch<TransactionAction>
}
export function CreatePactForm({
  // fetcher,
  state,
  dispatch,
}: CreatePactFormProps) {
  const { wallet } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const fetcher = useFetcher()
  const lastSubmission = useActionData<typeof action>()
  const [isSubmitting, setSubmitting] = useState(false) // State to manage submission status
  const [formErrors, setFormErrors] = useState<
    Record<string, string[]> | undefined
  >()

  const {
    data: walletClientData,
    isError: walletClientError,
    isLoading: walletClientLoading,
  } = useWalletClient()

  const publicClient = usePublicClient()

  const [form, { userAddress, pactAddress, pactAccountabilityPercentage }] =
    useForm({
      lastSubmission,
      onValidate({ formData }) {
        return parse(formData, {
          // Create the schema without any constraint defined
          schema: (intent) => createSchema(intent),
        })
      },
      shouldValidate: 'onBlur',
    })
  // onSubmit: async (event, { submission }) => {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    console.log('submitting')
    event.preventDefault() // Prevent default form submission
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
            const submission = await parse(formData, {
              schema: (intent) =>
                createSchema(intent, {
                  isTxHash(txHash) {
                    return Promise.resolve(txHash !== null)
                  },
                }),
              async: true,
            })
            if (submission.error && Object.keys(submission.error).length > 0) {
              // Handle validation errors
              // For example, show the errors in the UI
              setFormErrors(submission.error)
              console.error('Validation errors:', submission.error)
              console.log('errors', submission.error)
            } else {
              setSubmitting(true) // Set the submitting state to true
              console.log('continuing to submit data')
              fetcher.submit(formData, {
                method: 'post',
              })
              setSubmitting(false)
            }
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
    // },
  }

  return (
    <Card className="md:min-w-lg lg:min-w-xl w-full  pb-8">
      <div className="space-y-4">
        <fetcher.Form
          method="post"
          {...form.props}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 p-6"
        >
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
            {/* <span className="flex items-center text-xs font-medium tracking-wide text-red-500">
              {pactAddress.error}
            </span> */}
            {formErrors?.pactAddress?.map((message, index) => (
              <div key={index} className="error">
                {message}
              </div>
            ))}
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
            {/* <span className="flex items-center text-xs font-medium tracking-wide text-red-500">
              {pactAccountabilityPercentage.error}
            </span> */}
            {formErrors?.pactAccountabilityPercentage?.map((message, index) => (
              <div key={index} className="error">
                {message}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="block w-full"
            // type="submit"
            disabled={isSubmitting}
            // disabled={
            //   state.status !== 'idle' && state.status !== 'transaction-complete'
            // }
          >
            {/* {navigation.state === 'idle' ? 'Create' : ' Creating'} Pact */}
            {isSubmitting ? 'Create' : ' Creating'} Pact
          </Button>
        </fetcher.Form>
      </div>
    </Card>
  )
}
