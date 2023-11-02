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
  useWaitForTransaction,
} from 'wagmi'
import Header from '@/components/header'
import { requireAuthedUser } from '@/lib/services/auth.server'
import { User } from 'types/user'
import { Textarea } from '@/components/ui/textarea'

import { parseEther } from 'viem'
import { sendTransaction } from 'viem/actions'

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
  accountabilityAddress: z
    .string({ required_error: 'Accountability Address is required.' })
    .regex(addressRegex, { message: 'Invalid Ethereum address format.' }),
  pactDescription: z.string({
    required_error: 'Pact Description is required.',
  }),
})

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const submission = parse(formData, { schema: validationSchema })

  /**
   * Signup only when the user click on the submit button and no error found
   */
  if (!submission.value || submission.intent !== 'submit') {
    // Always sends the submission state back to client until the user is signed up
    return json(submission)
  }

  return redirect(`/?value=${JSON.stringify(submission.value)}`)
}

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
  const fetcher = useFetcher<typeof action>()

  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [isTxLoading, setIsTxLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { config } = usePrepareSendTransaction({
    to: '0x04EA475026a0AB3e280F749b206fC6332E6939F1',
    value: parseEther('0.00001'),
  })
  const { data, sendTransaction } = useSendTransaction(config)

  const { isLoading, isSuccess } = useWaitForTransaction({ hash: data?.hash })

  useEffect(() => {
    if (!isLoading && isSuccess && data?.hash) {
      setTxHash(data.hash)
      setIsSubmitting(false) // Reset submitting state
    }
  }, [isLoading, isSuccess, data?.hash])

  const [form, { accountabilityAddress, pactDescription, userAddress }] =
    useForm({
      onValidate({ formData }) {
        return parse(formData, { schema: validationSchema })
      },

      shouldValidate: 'onBlur',
      onSubmit(event, { submission }) {
        event.preventDefault()
        if (isSubmitting) {
          console.log('Already submitting')
          return
        }
        if (submission.intent && txHash === null) {
          // add in the client side tx, and get the txHash
          setIsSubmitting(true)
          console.log('Creating pact:', submission.payload)
          sendTransaction?.()
        }
      },
    })

  useEffect(() => {
    if (txHash && !isSubmitting) {
      const formData = new FormData()
      formData.append('userAddress', wallet)
      formData.append('txHash', txHash)

      for (const value of formData.values()) {
        console.log(value)
      }
      // Submit the form data along with the transaction hash
      // You can use fetcher or a traditional form submission here
      fetcher.submit(formData, { method: 'post' })
    }
  }, [txHash, isSubmitting])

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
          </div>
          <Button
            variant="outline"
            size="sm"
            className="block w-full"
            type="submit"
            value="create-pact-with-transaction"
          >
            {isLoading ? 'Creating Pact' : 'Create Pact'}
          </Button>
        </fetcher.Form>
        <p>txHash: {data?.hash}</p>
      </div>
    </Card>
  )
}
