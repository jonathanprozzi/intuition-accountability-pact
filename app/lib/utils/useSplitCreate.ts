import { useCreateSplit } from '@0xsplits/splits-sdk-react'

const useSplitCreate = ({
  userAddress,
}: {
  userAddress?: string | undefined
}) => {
  const { createSplit, status, txHash, error } = useCreateSplit()
  let splitResponse

  const userSplit = async () => {
    console.log('creating a split')
    if (userAddress === undefined) {
      console.error('User address is undefined')
      return
    }

    const splitArgs = {
      recipients: [
        {
          address: '0x25709998B542f1Be27D19Fa0B3A9A67302bc1b94',
          percentAllocation: 50.0,
        },
        {
          address: '0x04EA475026a0AB3e280F749b206fC6332E6939F1',
          percentAllocation: 50.0,
        },
      ],
      distributorFeePercent: 0.0,
    }
    try {
      splitResponse = await createSplit(splitArgs)
    } catch (err) {
      console.error(`Something went wrong. ${err}`)
    }
  }
  return { userSplit, status, txHash, error, splitResponse }
}

export default useSplitCreate
