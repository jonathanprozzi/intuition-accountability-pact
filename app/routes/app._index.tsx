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
    <main className="flex min-h-screen flex-col items-center gap-y-12 p-24">
      <Header />
      <div className="flex h-full flex-col items-center pt-40">
        <p className="text-md bg-gray-50/5 cursor-default rounded-md border border-stone-800/50 px-4 py-3 font-mono backdrop-blur-sm">
          Greetings Adventurer. Create an Accountability Pact{' '}
          <Button variant="secondary" className="text-success-500" asChild>
            <Link to="create-pact">Cast a Pact 🪄</Link>
          </Button>
        </p>
      </div>
    </main>
  )
}
