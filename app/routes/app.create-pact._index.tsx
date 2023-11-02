import { useEffect, useState } from 'react'
import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
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
  useAccount,
  useSendTransaction,
  usePrepareSendTransaction,
} from 'wagmi'
import Header from '@/components/header'
import { requireAuthedUser } from '@/lib/services/auth.server'
import { User } from 'types/user'
import { Textarea } from '@/components/ui/textarea'

import { parseEther } from 'viem'

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
  accountabilityAddress: z
    .string({ required_error: 'Accountability Address is required.' })
    .regex(addressRegex, { message: 'Invalid Ethereum address format.' }),
  pactDescription: z.string({
    required_error: 'Pact Description is required.',
  }),
})

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

  const { config } = usePrepareSendTransaction({
    to: '0x04EA475026a0AB3e280F749b206fC6332E6939F1',
    value: parseEther('0.0001'),
  })
  const { data, status, isLoading, isSuccess, sendTransaction } =
    useSendTransaction(config)

  const [form, { accountabilityAddress, pactDescription }] = useForm({
    onSubmit(event, { submission }) {
      event.preventDefault()

      console.log('intent', submission.intent)

      console.log('payload', submission.payload)
    },
  })

  return (
    <Card className="w-full pb-8 pt-4">
      <div className="space-y-4">
        <form {...form.props} className=" flex flex-col gap-4 p-6">
          <input type="hidden" name="userAddress" value={wallet} />
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
            value="create-pact"
            // name={conform.INTENT}
          >
            Create Pact
          </Button>
        </form>
      </div>
    </Card>
  )
}
