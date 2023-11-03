import { requireAuthedUser } from '@/lib/services/auth.server'

import { User } from 'types/user'

import { LoaderFunctionArgs, json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = (await requireAuthedUser(request)) as User
  const { wallet } = user
  return json({
    wallet: wallet,
  })
}

export default function AppIndex() {
  const { wallet } = useLoaderData<typeof loader>()
  if (wallet) {
    console.log('Session wallet', wallet)
  }
  return (
    <main className="flex min-h-screen flex-col items-center gap-y-12 p-4 lg:p-24">
      <Header />
      <div className="flex h-full flex-col items-center">
        <div className="[>*p]:text-md bg-gray-50/5 mx-w-lg flex flex-col items-center gap-2 px-4 py-3 font-mono backdrop-blur-sm lg:max-w-lg lg:gap-4">
          <p>
            An Accountability Pact is a commitment to a goal you want to
            achieve. You can create a Pact with another person (or multisig, or
            DAO).
          </p>
          <p>
            Set the terms of the Pact, and in the future your peers can evaluate
            your Pact progress and change your Split percentage.
          </p>
        </div>
        <div className="text-md bg-gray-50/5 flex cursor-default flex-col items-center gap-2 rounded-md border border-stone-800/50 px-4 py-3 font-mono backdrop-blur-sm lg:flex-row lg:gap-8">
          Create an Accountability Pact{' '}
          <Button variant="secondary" className="text-success-500" asChild>
            <Link to="create-pact">Cast a Pact 🪄</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
