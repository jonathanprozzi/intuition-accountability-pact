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

const addressRegex = /^0x[a-fA-F0-9]{64}$/

const validationSchema = z.object({
  accountabilityAddress: z
    .string({ required_error: 'Accountability Address is required.' })
    .regex(addressRegex, { message: 'Invalid Ethereum address format.' }),
  pactDescription: z.string(),
})

export async function loader({ request }: LoaderFunctionArgs) {
  const user = (await requireAuthedUser(request)) as User
  const { wallet } = user
  return json({
    wallet: wallet,
  })
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const submission = parse(formData, { schema: validationSchema })

  /**
   * Send form submission  only when the user click on the submit button and no error found
   */
  if (!submission.value || submission.intent !== 'submit') {
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
    <main className="flex min-h-screen flex-col items-center gap-y-12 p-24">
      <Header />
      <div className="flex h-full flex-col items-center pt-40">
        <p className="text-md bg-gray-50/5 cursor-default px-4 py-3 font-mono backdrop-blur-sm">
          Creating an Accountability Pact for:
        </p>
        <span className="text-success-500">{wallet}</span>
      </div>
    </main>
  )
}
