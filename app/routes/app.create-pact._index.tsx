import { conform, useForm } from '@conform-to/react'
import { parse, refine } from '@conform-to/zod'
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import {
  useFetcher,
  useLoaderData,
  useNavigation,
  useActionData,
  Link,
} from '@remix-run/react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { usePublicClient, useWalletClient } from 'wagmi'

import Header from '@/components/header'
import { requireAuthedUser } from '@/lib/services/auth.server'
import { User } from 'types/user'
import { Textarea } from '@/components/ui/textarea'

import { SplitsClient } from '@0xsplits/splits-sdk'
import { useState } from 'react'
import {
  TransactionAction,
  TransactionState,
  useTxState,
} from '@/lib/hooks/use-tx-state'

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const value = url.searchParams.get('value')
  const payload = url.searchParams.get('payload')

  const user = (await requireAuthedUser(request)) as User
  const { wallet } = user
  return json({
    wallet: wallet,
    value: value ? JSON.parse(value) : undefined,
    payload: payload ? JSON.parse(payload) : undefined,
  })
}

const addressRegex = /^0x[a-fA-F0-9]{40}$/

function createSchema(
  intent: string,
  constraint: {
    differentAddresses?: (pactAddress: string) => Promise<boolean>
  } = {},
) {
  return z
    .object({
      pactAddress: z
        .string({ required_error: 'Accountability Address is required.' })
        .regex(addressRegex, { message: 'Invalid tx hash address format.' })
        .pipe(
          z.string().superRefine((pactAddress, ctx) =>
            refine(ctx, {
              validate: () => constraint.differentAddresses?.(pactAddress),
              when: intent === 'submit' || intent === 'validate/pactAddress',
              message:
                'Pact Accountability Address must be different than your address.',
            }),
          ),
        ),
    })
    .and(
      z.object({
        userAddress: z
          .string({ required_error: 'Accountability Address is required.' })
          .regex(addressRegex, { message: 'Invalid Ethereum address format.' }),
        pactDescription: z.string().optional(),
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
  const userAddress = formData.get('userAddress')
  const submission = await parse(formData, {
    schema: (intent) =>
      createSchema(intent, {
        differentAddresses(pactAddress) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(pactAddress !== userAddress)
            }, 500)
          })
        },
      }),
    async: true,
  })

  if (!submission.value || submission.intent !== 'submit') {
    return json(submission)
  }
  console.log('submission payload to server', submission.payload)
  return redirect(
    `/app/create-pact?payload=${JSON.stringify(submission.payload)}`,
  )
}

const initialState: TransactionState = {
  status: 'idle',
  txHash: `0x${1234}...`,
  error: undefined,
}

export default function CreatePactIndexRoute() {
  const { wallet, value, payload } = useLoaderData<typeof loader>()
  const { state, dispatch } = useTxState(initialState)

  if (wallet) {
    console.log('Session wallet', wallet)
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-y-12 p-4 lg:p-24">
      <Header />
      <div className="sm:min-w-md lg:min-w-md w-50 flex h-full w-6/12	 flex-col items-center ">
        {payload ? (
          <>
            <p className="text-xl leading-7 [&:not(:first-child)]:mt-6">
              👁️ Pact Created 👁️
            </p>
            {payload?.txHash && (
              <a
                href={`https://goerli.arbiscan.io/tx/${payload?.txHash}`}
                target="blank"
                className="rounded  py-1 text-success-500 transition-colors duration-300 ease-in-out  hover:text-white"
              >
                View on Explorer
              </a>
            )}
            <div className="overflow-auto">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(payload, null, 2)}
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
                <p className="text-md bg-gray-50/5 cursor-default text-center font-mono backdrop-blur-sm">
                  Create an Accountability Pact
                </p>
              )}
              {state.status === 'signing-wallet' && (
                <p className="text-md bg-gray-50/5 cursor-default text-center font-mono backdrop-blur-sm">
                  🪄 Sign the transaction in your wallet 🪄
                </p>
              )}
              {state.status === 'transaction-complete' && (
                <p className="text-md bg-gray-50/5 cursor-default text-center font-mono backdrop-blur-sm">
                  🔮 tx Complete 🔮
                </p>
              )}
              {state.status === 'sending-txHash' && (
                <p className="text-md bg-gray-50/5 cursor-default text-center font-mono backdrop-blur-sm">
                  🧙🏼 Sending txHash 🧙🏼
                </p>
              )}
              {state.status === 'transaction-error' && (
                <p className="text-md bg-gray-50/5 cursor-default text-center font-mono backdrop-blur-sm">
                  Error: {state.error}
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
  state: TransactionState
  dispatch: React.Dispatch<TransactionAction>
}
export function CreatePactForm({ state, dispatch }: CreatePactFormProps) {
  const { wallet } = useLoaderData<typeof loader>()

  const fetcher = useFetcher()
  const lastSubmission = useActionData<typeof action>()
  const [isSubmitting, setSubmitting] = useState(false) // State to manage submission status
  const [formErrors, setFormErrors] = useState<Record<
    string,
    string[]
  > | null>()

  const {
    data: walletClientData,
    isError: walletClientError,
    isLoading: walletClientLoading,
  } = useWalletClient()

  const publicClient = usePublicClient()

  const [
    form,
    { userAddress, pactAddress, pactDescription, pactAccountabilityPercentage },
  ] = useForm({
    lastSubmission,

    onValidate({ formData }) {
      return parse(formData, {
        schema: (intent) => createSchema(intent),
      })
    },
    shouldValidate: 'onBlur',
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    dispatch({ type: 'START_TRANSACTION' })
    const formData = new FormData(event.currentTarget)
    const submission = await parse(formData, {
      schema: (intent) =>
        createSchema(intent, {
          differentAddresses(pactAddress) {
            return Promise.resolve(pactAddress !== wallet)
          },
        }),
      async: true,
    })

    if (submission.error && Object.keys(submission.error).length > 0) {
      setFormErrors(submission.error)
      console.error('Validation errors:', submission.error)
    }
    if (submission.error && Object.keys(submission.error).length === 0) {
      setFormErrors(null)
      setSubmitting(true)

      try {
        const formElement = event.target as HTMLFormElement
        const pactAddressValue = formElement.pactAddress.value

        const pactAccountabilityPercentageValue = parseFloat(
          formElement.pactAccountabilityPercentage.value,
        )

        const userValueWithDecimal = parseFloat(
          pactAccountabilityPercentageValue.toFixed(1),
        )
        const calculatedValueWithDecimal = parseFloat(
          (100.0 - pactAccountabilityPercentageValue).toFixed(1), // Ensure this is also a number
        )

        if (!walletClientLoading && walletClientData) {
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
          dispatch({ type: 'SIGNING_WALLET' })
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
              console.log('txHash', txHash)
              formData.append('txHash', txHash) // append the resolved txHash to the form data
              fetcher.submit(formData, {
                method: 'post',
              })
              setSubmitting(false)
            }
          }
        }
      } catch (error: unknown) {
        console.error(`Pact Create Error: ${error}`)
        if (error instanceof Error) {
          if (
            error.message.startsWith(
              'Pact Create Error: TransactionExecutionError: User rejected the request.',
            )
          ) {
            dispatch({
              type: 'TRANSACTION_ERROR',
              error: 'User rejected transaction.',
            })
            return
          }

          if (error instanceof Error) {
            if (
              error.message.startsWith(
                'Pact Create Error: ContractFunctionExecutionError: The contract function "createSplit" reverted..',
              )
            ) {
              dispatch({
                type: 'TRANSACTION_ERROR',
                error: 'Split already exists. Try changing one of the values.',
              })
              return
            }
          }
        }
      }
    }
  }

  return (
    <Card className="md:min-w-md lg:min-w-lg w-full pb-8">
      <div className="space-y-4">
        <fetcher.Form
          {...form.props}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 p-6"
        >
          <Input
            {...conform.input(userAddress)}
            type="hidden"
            name="userAddress"
            value={wallet}
            className="border-none"
          />
          <div className="flex flex-col gap-2">
            <Label className="m-x-auto text-sm text-foreground">
              Pact Address
            </Label>
            <Input {...conform.input(pactAddress)} />

            {formErrors?.pactAddress?.map((message, index) => (
              <div
                key={index}
                className="flex items-center text-xs font-medium tracking-wide text-red-500"
              >
                {message}
              </div>
            ))}
          </div>
          <div className="w-100 flex flex-col flex-wrap gap-2">
            <Label className="m-x-auto text-sm text-foreground">
              Pact Description
            </Label>
            <Textarea {...conform.input(pactDescription)} />
            {formErrors?.pactDescription?.map((message, index) => (
              <div
                key={index}
                className="flex items-center text-xs font-medium tracking-wide text-red-500"
              >
                {message}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Label className="m-x-auto text-sm text-foreground">
              Pact Accountability Percentage
            </Label>
            <Input {...conform.input(pactAccountabilityPercentage)} />
            {formErrors?.pactAccountabilityPercentage?.map((message, index) => (
              <div
                key={index}
                className="flex items-center text-xs font-medium tracking-wide text-red-500"
              >
                {message}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="block w-full"
            disabled={isSubmitting}
          >
            {isSubmitting === true ? 'Creating' : 'Create'} Pact
          </Button>
        </fetcher.Form>
      </div>
    </Card>
  )
}
