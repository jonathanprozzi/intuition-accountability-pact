import { useNonce } from '@/lib/utils/nonce-provider'
import intuitionTheme from '@/lib/utils/rainbow-theme'
import styles from '@/styles/global.css'

import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit'
import rainbowStylesUrl from '@rainbow-me/rainbowkit/styles.css'
import { cssBundleHref } from '@remix-run/css-bundle'
import {
  MetaFunction,
  json,
  type DataFunctionArgs,
  type LinksFunction,
} from '@remix-run/node'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from '@remix-run/react'
import React, { useState } from 'react'
import {
  WagmiConfig,
  configureChains,
  createConfig,
  mainnet,
  usePublicClient,
} from 'wagmi'
import { arbitrumGoerli } from 'wagmi/chains'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import { createPublicClient, http } from 'viem'

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: styles },
  { rel: 'stylesheet', href: rainbowStylesUrl },
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
]

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    {
      title: data
        ? 'Intuition Accountability Pact'
        : 'Error | Intuition Accountability Pact',
    },
    { name: 'description', content: `Craft an Intuition Accountability Pact.` },
  ]
}

export async function loader({ request }: DataFunctionArgs) {
  return json({
    ENV: {
      ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
      WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID,
    },
  })
}

function Document({
  children,
  nonce,
  env = {},
}: {
  children: React.ReactNode
  nonce: string
  theme?: string
  env?: Record<string, string>
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(env)}`,
          }}
        />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
}

export default function App() {
  const { ENV } = useLoaderData<typeof loader>()
  const nonce = useNonce()

  const [{ config, chains, splitConfig }] = useState(() => {
    const { chains, publicClient, webSocketPublicClient } = configureChains(
      [arbitrumGoerli],
      [alchemyProvider({ apiKey: ENV.ALCHEMY_API_KEY! })],
    )

    const publicClientSplit = createPublicClient({
      chain: arbitrumGoerli,
      transport: http(),
    })

    const { connectors } = getDefaultWallets({
      appName: 'Intuition Accountability Pact',
      chains,
      projectId: ENV.WALLETCONNECT_PROJECT_ID!,
    })

    const config = createConfig({
      autoConnect: true,
      connectors,
      publicClient,
      webSocketPublicClient,
    })

    const splitConfig = {
      chainId: 421613,
      publicClientSplit,
    }

    return {
      config,
      splitConfig,
      chains,
    }
  })

  return (
    <Document nonce={nonce} env={ENV}>
      {config && chains && splitConfig ? (
        <>
          <WagmiConfig config={config}>
            <RainbowKitProvider
              chains={chains}
              theme={intuitionTheme}
              modalSize="compact"
            >
              <div className="relative flex h-screen w-full flex-col justify-between">
                <div className="flex-1">
                  <Outlet />
                </div>
              </div>
            </RainbowKitProvider>
          </WagmiConfig>
        </>
      ) : null}
    </Document>
  )
}
