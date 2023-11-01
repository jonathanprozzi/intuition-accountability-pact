import react from 'react'
import { conform, useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { Button as BaseButton, Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Copy } from '@/components/ui/copy'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Form as RemixForm } from '@/components/ui/remix-form'
import IntuitionLogotype from '@/assets/intuition-logotype'
import { AccountButton } from '@/components/account-button'
import { useAccount } from 'wagmi'
import Header from '@/components/header'
import { requireAuthedUser } from '@/lib/services/auth.server'
import { User } from 'types/user'
import { Textarea } from '@/components/ui/textarea'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = (await requireAuthedUser(request)) as User
  const { wallet } = user
  return json({
    wallet: wallet,
  })
}

// test address: 0x04EA475026a0AB3e280F749b206fC6332E6939F1

const addressRegex = /^0x[a-fA-F0-9]{40}$/
const createDyamicValidationSchema = ({ wallet }: { wallet: string }) => {
  return z.object({
    userAddress: z
      .string()
      .regex(addressRegex, { message: 'Invalid Ethereum address format.' }),
    accountabilityAddress: z
      .string({ required_error: 'Accountability Address is required.' })
      .regex(addressRegex, { message: 'Invalid Ethereum address format.' })
      .refine((walletAddress) => walletAddress !== wallet, {
        message: `Accountability Address can't be the same as your wallet address.`,
      }),
    pactDescription: z.string({
      required_error: 'Pact Description is required.',
    }),
  })
}

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
          Create an Accountability Pact for:
        </p>
        <span className="pb-3 text-success-500">{wallet}</span>
        <CreatePactForm />
      </div>
    </main>
  )
}

// @TODO: pass in the address in a hidden field instead of loading it in via the loader
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  console.log('formdata', formData)
  const dynamicValidationSchema = createDyamicValidationSchema({
    wallet: '0x25709998B542f1Be27D19Fa0B3A9A67302bc1b94',
  })

  console.log('submit action', formData)
  const submission = parse(formData, { schema: dynamicValidationSchema })

  if (!submission.value || submission.intent !== 'submit') {
    return json(submission)
  }

  return redirect(`/app?value=${JSON.stringify(submission.value)}`)
}

export function CreatePactForm() {
  const lastSubmission = useActionData<typeof action>()
  const dynamicValidationSchema = createDyamicValidationSchema({
    wallet: '0x25709998B542f1Be27D19Fa0B3A9A67302bc1b94',
  })
  const [form, { userAddress, accountabilityAddress, pactDescription }] =
    useForm({
      lastSubmission,
      onValidate({ formData }) {
        return parse(formData, { schema: dynamicValidationSchema })
      },
      shouldValidate: 'onBlur',
    })
  return (
    <Card className="w-full pb-8 pt-4">
      <div className="space-y-4">
        <Form
          method="post"
          {...form.props}
          className=" flex flex-col gap-4 p-6"
        >
          {/* <div className="flex flex-col gap-2">
            <Label />
            <Input
              data-hidden={true}
              {...conform.input(userAddress)}
              className="data-[hidden=true]:hidden"
            />
          </div> */}
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
          <Button variant="outline" size="sm" className="block w-full">
            Create Pact
          </Button>
        </Form>
      </div>
    </Card>
  )
}
