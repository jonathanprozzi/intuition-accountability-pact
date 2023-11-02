import { useEffect, useRef, useState } from 'react'
import { conform, useForm, validate } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import type {
  ActionFunction,
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useSubmit,
} from '@remix-run/react'
import { custom, z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Copy } from '@/components/ui/copy'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import IntuitionLogotype from '@/assets/intuition-logotype'
import { AccountButton } from '@/components/account-button'
import {
  usePrepareSendTransaction,
  useSendTransaction,
  useTransaction,
  useWaitForTransaction,
} from 'wagmi'
import {
  sendTransaction,
  prepareSendTransaction,
  waitForTransaction,
} from '@wagmi/core'
import Header from '@/components/header'
import { login, requireAuthedUser } from '@/lib/services/auth.server'
import { User } from 'types/user'
import { Textarea } from '@/components/ui/textarea'

import { parseEther } from 'viem'
import useClientTransaction from '@/lib/utils/useClientTransaction'
import { formAction } from '@/lib/services/form.server'
import { makeDomainFunction } from 'domain-functions'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = (await requireAuthedUser(request)) as User
  const { wallet } = user
  return json({
    wallet: wallet,
  })
}

// test address: 0x04EA475026a0AB3e280F749b206fC6332E6939F1

const addressRegex = /^0x[a-fA-F0-9]{40}$/

const validationSchema = z.object({
  userAddress: z
    .string({ required_error: 'Accountability Address is required.' })
    .regex(addressRegex, { message: 'Invalid Ethereum address format.' }),
  // accountabilityAddress: z
  //   .string({ required_error: 'Accountability Address is required.' })
  //   .regex(addressRegex, { message: 'Invalid Ethereum address format.' }),
  // pactDescription: z.string({
  //   required_error: 'Pact Description is required.',
  // }),
})

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const submission = parse(formData, { schema: validationSchema })

  if (!submission.value || submission.intent !== 'submit') {
    return json(submission)
  }
  console.log('submission values', JSON.stringify(submission.payload))
  return redirect(
    `/app/create-pact?value=${JSON.stringify(submission.payload)}`,
  )
}

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
//     console.log('resp', resp)
//   }
//   return null
// }

export default function CreatePactIndexRoute() {
  const { wallet } = useLoaderData<typeof loader>()

  if (wallet) {
    console.log('Session wallet', wallet)
  }

  return (
    <main className="flex min-h-screen flex-col items-center ">
      <Header />
      <div className="flex h-full flex-col items-center pt-20">
        <p className="text-md bg-gray-50/5 cursor-default px-4 font-mono backdrop-blur-sm">
          Create an Accountability Pact
        </p>
        <span className="pb-3 text-success-500">{wallet}</span>
        <CreatePactForm />
      </div>
    </main>
  )
}

export function CreatePactForm() {
  const { wallet } = useLoaderData<typeof loader>()
  const {
    txHash,
    isTransactionLoading,
    isTransactionSuccess,
    initiateTransaction,
  } = useClientTransaction()
  const fetcher = useFetcher()

  // const { config } = usePrepareSendTransaction({
  //   to: '0x04EA475026a0AB3e280F749b206fC6332E6939F1',
  //   value: parseEther('0.000001'),
  // })
  // const { data: transactionData, sendTransaction } = useSendTransaction(config)
  // const { isLoading, isSuccess } = useWaitForTransaction({
  //   hash: transactionData?.hash,
  // })

  // useEffect(() => {
  //   if (isSuccess && transactionData?.hash) {
  //     console.log('Transaction successful:', transactionData.hash)
  //     // Create a new FormData instance and append the txHash
  //     const formData = new FormData()

  //     formData.append('txHash', transactionData.hash)
  //     // Use the fetcher to submit the formData to your action
  //     fetcher.submit(formData, {
  //       method: 'post',
  //     })
  //   }
  // }, [transactionData, isSuccess])

  const [form, { userAddress }] = useForm({
    onValidate({ formData }) {
      return parse(formData, { schema: validationSchema })
    },

    shouldValidate: 'onBlur',
    onSubmit: async (event, { submission }) => {
      event.preventDefault()
      console.log('submission', submission)
      try {
        const formElement = event.target as HTMLFormElement // Cast the event target to HTMLFormElement
        const config = await prepareSendTransaction({
          to: '0x04EA475026a0AB3e280F749b206fC6332E6939F1',
          value: parseEther('0.000001'),
        })
        const { hash } = await sendTransaction(config)

        if (hash) {
          const { transactionHash, status } = await waitForTransaction({
            hash: hash,
          })

          if (status === 'success') {
            console.log('tx hash', transactionHash)
            const formData = new FormData(formElement) // Use the form element reference here
            formData.append('txHash', transactionHash)
            for (const [key, value] of formData.entries()) {
              console.log(key, value)
            }
            // Perform the final form submission with the updated formData
            // For example:
            fetcher.submit(formData, {
              method: 'post',
            })
          }
        }
      } catch (error) {
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
        <fetcher.Form
          {...form.props}
          // onSubmit={handleSubmit}
          className="flex flex-col gap-4 p-6"
        >
          <Input
            {...conform.input(userAddress)}
            type="hidden"
            name="userAddress"
            value={wallet}
          />
          {/* <div className="flex flex-col gap-2">
            <Label className="m-x-auto text-sm text-foreground">
              Accountability Address
            </Label>
            <Input {...conform.input(accountabilityAddress)} />
            <span className="flex items-center text-xs font-medium tracking-wide text-red-500">
              {accountabilityAddress.error}
            </span>
          </div>
          <div className="w-100 flex flex-col flex-wrap gap-2">
            <Label className="m-x-auto text-sm text-foreground">
              Pact Description
            </Label>
            <Textarea {...conform.input(pactDescription)} />
            <span className="flex items-center text-xs font-medium tracking-wide text-red-500">
              {pactDescription.error}
            </span>
          </div> */}
          <Button variant="outline" size="sm" className="block w-full">
            {isTransactionLoading ? 'Creating Pact' : 'Create Pact'}
          </Button>
        </fetcher.Form>
      </div>
      {isTransactionSuccess && <p>tx hash: {txHash}</p>}
    </Card>
  )
}
