import React from "react";
import { useMemo } from "react";
import { getProviderFromChainId, getTargetChainId } from "./App";
import { Signer } from "@ethersproject/abstract-signer";
import { Address, getL2Network, L1ToL2MessageGasEstimator, L1TransactionReceipt } from "@arbitrum/sdk";
import { Inbox__factory } from "@arbitrum/sdk/dist/lib/abi/factories/Inbox__factory";
import { getBaseFee } from "@arbitrum/sdk/dist/lib/utils/lib";
import { BigNumber, utils } from "ethers";

function RecoverFunds({
  targetChainId,
  signer,
  connectedNetworkId,
  balanceToRecover
}: {
  targetChainId: number;
  signer: Signer | null;
  connectedNetworkId?: number;
  balanceToRecover: BigNumber;
}) {
  const [message, setMessage] = React.useState<string>("");
  const redeemButton = useMemo(() => {
    if (!signer) return null;
    if (!connectedNetworkId || (getTargetChainId(connectedNetworkId) !== targetChainId)) {
      return `To recover funds, connect to chain ${targetChainId}`;
    }
    if (balanceToRecover.lte(0)) {
      return null;
    }

    return (
      <div className="recover-funds-form">
        <input
          placeholder="Enter the destination address"
          className="input-style"
          id="destination-address"
        />
        <div className="loading-block" id="loading-block">Sending transaction...</div>
        <button
          id="recover-button"
          onClick={async () => {
            setMessage("");
            const destinationAddressInput = document.getElementById("destination-address") as HTMLInputElement;
            if (
              !destinationAddressInput ||
              !destinationAddressInput.value ||
              !utils.isAddress(destinationAddressInput.value)
            ) {
              setMessage(`Please input a valid destination address`);
              return;
            }

            // Hide button and show loading effect
            (document.getElementById("loading-block") as HTMLDivElement).style.display = "block";
            (document.getElementById("recover-button") as HTMLButtonElement).style.display = "none";
            
            // Start transaction
            const signerAddress = new Address(await signer.getAddress());
            const aliasedSignerAddress = signerAddress.applyAlias();
            const destinationAddress = destinationAddressInput.value;
            console.log("Operation to perform: Move " + utils.formatEther(balanceToRecover.toString()) + " ETH from " + aliasedSignerAddress.value + " to " + destinationAddress);

            // We instantiate the Inbox factory object to make use of its methods
            const baseL2Provider = getProviderFromChainId(targetChainId);
            const l2Network = await getL2Network(baseL2Provider);
            const inbox = Inbox__factory.connect(
                l2Network.ethBridge.inbox,
                baseL2Provider
            );

            // We estimate gas usage
            const l1ToL2MessageGasEstimator = new L1ToL2MessageGasEstimator(baseL2Provider);
            
            // The estimateAll method gives us the following values for sending an L1->L2 message
            //      (1) maxSubmissionCost: The maximum cost to be paid for submitting the transaction
            //      (2) gasLimit: The L2 gas limit
            //      (3) maxFeePerGas: The price bid per gas on L2
            //      (4) deposit: The total amount to deposit on L1 to cover L2 gas and L2 call value
            const gasEstimation = await l1ToL2MessageGasEstimator.estimateAll(
                {
                  from: aliasedSignerAddress.value,
                  to: destinationAddress,
                  l2CallValue: balanceToRecover,
                  excessFeeRefundAddress: destinationAddress,
                  callValueRefundAddress: destinationAddress,
                  data: "0x",
                },
                await getBaseFee(signer.provider!),
                signer.provider!
            );

            // And we send the request through the method unsafeCreateRetryableTicket of the Inbox contract
            // We need this method because we don't want the contract to check that we are not sending the l2CallValue
            // in the "value" of the transaction, because we want to use the amount that is already on L2
            const l2CallValue = balanceToRecover.sub(gasEstimation.maxSubmissionCost).sub(gasEstimation.gasLimit.mul(gasEstimation.maxFeePerGas));
            try {
              const l1SubmissionTxRaw = await inbox.connect(signer).unsafeCreateRetryableTicket(
                destinationAddress,                // to
                l2CallValue,                       // l2CallValue
                gasEstimation.maxSubmissionCost,   // maxSubmissionCost
                destinationAddress,                // excessFeeRefundAddress
                destinationAddress,                // callValueRefundAddress
                gasEstimation.gasLimit,            // maxLimit
                gasEstimation.maxFeePerGas,        // maxFeePerGas
                "0x",                              // data
                {
                    from: signerAddress.value,
                    value: 0,
                }
              );

              // We wrap the transaction in monkeyPatchContractCallWait so we can also waitForL2 later on
              const l1SubmissionTx = L1TransactionReceipt.monkeyPatchContractCallWait(l1SubmissionTxRaw);
              const l1SubmissionTxReceipt = await l1SubmissionTx.wait();
              
              // Hide loading effect and show final message
              (document.getElementById("loading-block") as HTMLDivElement).style.display = "none";
              setMessage(`L1 submission transaction receipt is: ${l1SubmissionTxReceipt.transactionHash}. Follow the transaction in the <a target="_blank" href="https://retryable-dashboard.arbitrum.io/tx/${l1SubmissionTxReceipt.transactionHash}">Retryables Dashboard</a>.`);
            } catch (err: any) {
              console.log(err);

              // Show button and hide loading effect
              (document.getElementById("loading-block") as HTMLDivElement).style.display = "none";
              (document.getElementById("recover-button") as HTMLButtonElement).style.display = "block";
            }
          }}
        >
          Recover
        </button>
      </div>
    );
  }, [connectedNetworkId, targetChainId, signer, balanceToRecover]);

  return (
    <>
      {redeemButton}
      <div>
        {message && <div className="recoverfundstext" dangerouslySetInnerHTML={{ __html: message}} />}
      </div>
    </>
  );
}

export default RecoverFunds;
