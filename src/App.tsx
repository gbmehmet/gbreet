import "./App.css";
import React from "react";
import {
  L1TransactionReceipt,
  L1Network,
  L2Network,
  L1ToL2MessageReader,
  Address
} from "@arbitrum/sdk";

import { useAccount, useNetwork, useSigner } from "wagmi";
import { BigNumber, utils } from "ethers";
import {
  JsonRpcProvider,
  StaticJsonRpcProvider
} from "@ethersproject/providers";

import RecoverFunds from "./RecoverFunds";
import {
  EthDepositMessage
} from "@arbitrum/sdk/dist/lib/message/L1ToL2Message";
import { ConnectButtons } from "./ConnectButtons";

// Hack to make WalletConnect work: 
// https://github.com/WalletConnect/walletconnect-monorepo/issues/748#issuecomment-1326425422
window.Buffer = window.Buffer || require("buffer").Buffer;

export enum ReceiptState {
  EMPTY,
  LOADING,
  INVALID_INPUT_LENGTH,
  NOT_FOUND,
  L1_FAILED,
  L2_FAILED,
  NO_L1_L2_MESSAGES,
  MESSAGES_FOUND,
  NO_L2_L1_MESSAGES
}

export enum AlertLevel {
  RED,
  YELLOW,
  GREEN,
  NONE
}

interface MessageStatusDisplayBase {
  text: string;
  alertLevel: AlertLevel;
  showRedeemButton: boolean;
  explorerUrl: string;
  l2Network: L2Network;
  l2TxHash: string;
}
interface MessageStatusDisplayRetryable extends MessageStatusDisplayBase {
  l1ToL2Message: L1ToL2MessageReader;
  ethDepositMessage: undefined;
}
interface MessageStatusDisplayDeposit extends MessageStatusDisplayBase {
  l1ToL2Message: undefined;
  ethDepositMessage: EthDepositMessage;
}

interface OperationInfo {
  balanceToRecover: BigNumber;
  balanceChecked: boolean;
  aliasedAddress: string;
}

export type MessageStatusDisplay =
  | MessageStatusDisplayRetryable
  | MessageStatusDisplayDeposit;

export enum Status {
  CREATION_FAILURE,
  NOT_FOUND,
  REEXECUTABLE,
  SUCCEEDED
}

export interface Result {
  status: Status;
  text: string;
}

export interface RetryableTxs {
  l1BlockExplorerUrl: string;
  l2BlockExplorerUrl: string;
  l1Tx?: string;
  l2Tx?: string;
  autoRedeem?: string;
  ticket?: string;
  result: Result;
  l2ChainId: number;
}

export interface ReceiptRes {
  l1TxnReceipt: L1TransactionReceipt;
  l1Network: L1Network;
  l1Provider: JsonRpcProvider;
}

if (!process.env.REACT_APP_INFURA_KEY)
  throw new Error("No REACT_APP_INFURA_KEY set");

export const supportedL1Networks = {
  1: `https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
  5: `https://goerli.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`
};

export const getTargetChainId = (chainId: number) => {
  let targetChainId = 0;
  switch (chainId) {
    case 1:
      targetChainId = 42161;
      break;
    case 5:
      targetChainId = 421613;
      break;
    default:
      throw new Error(
        "Unknown L1 chain id. This chain is not supported by this tool"
      );
  }
  return targetChainId;
}

export const getProviderFromChainId = (chainId: number) => {
  let l2RpcURL;
  switch (chainId) {
    case 42161:
      l2RpcURL = "https://arb1.arbitrum.io/rpc";
      break;
      /*
    case 42170:
      l2RpcURL = "https://nova.arbitrum.io/rpc";
      break; */
    case 421613:
      l2RpcURL = "https://goerli-rollup.arbitrum.io/rpc";
      break;
    default:
      throw new Error(
        "Unknown L2 chain id. This chain is not supported by this tool"
      );
  }
  return new StaticJsonRpcProvider(l2RpcURL);
}

function App() {
  const { data: signer = null } = useSigner();
  const { chain } = useNetwork();
  const { address, isConnected } = useAccount();
  const [operationInfo, setOperationInfo] = React.useState<OperationInfo>({
    balanceToRecover: BigNumber.from(0),
    balanceChecked: false,
    aliasedAddress: ""
  });
  
  const getBalanceOnL2 = async (chainId: number, address: string) => {
    // First, obtain the aliased address of the signer
    const signerAddress = new Address(address);
    const aliasedSignerAddress = signerAddress.applyAlias();

    // And get its balance to find out the amount we are transferring
    const l2Provider = getProviderFromChainId(chainId);
    const aliasedSignerBalance = await l2Provider.getBalance(aliasedSignerAddress.value);
    if (aliasedSignerBalance.lte(0)) {
        console.warn(`Address ${signerAddress.value} (Alias: ${aliasedSignerAddress.value}) does not have funds on L2`);
    }

    setOperationInfo({
      balanceToRecover: aliasedSignerBalance,
      balanceChecked: true,
      aliasedAddress: aliasedSignerAddress.value
    })
  }
  
  if (
    chain && chain.id && (chain.id in supportedL1Networks) &&
    isConnected &&
    address &&
    !operationInfo.balanceChecked
  ) {
    getBalanceOnL2(getTargetChainId(chain.id), address);
  }

  return (
    <div>
      <ConnectButtons />
      {
        chain && chain.id && !(chain.id in supportedL1Networks) &&
        <div className="funds-message">
          You are connected to an unsupported network. Please connect to Ethereum mainnet or Goerli.
        </div>
      }
      {
        chain && chain.id && (chain.id in supportedL1Networks) &&
        operationInfo.balanceChecked &&
        operationInfo.balanceToRecover.lte(0) &&
        <div className="funds-message">
          There are no funds stuck on {operationInfo.aliasedAddress} (Alias of {address}) on this network ({getTargetChainId(chain.id)}).
        </div>
      }
      {
        chain && chain.id && (chain.id in supportedL1Networks) &&
        operationInfo.balanceChecked &&
        operationInfo.balanceToRecover.gt(0) &&
        <div className="funds-message">
          There are {utils.formatEther(operationInfo.balanceToRecover)} ETH on {operationInfo.aliasedAddress} (Alias of {address}).<br />
          Set the destination address and click the Recover button to start the recovery process.<br />
          <RecoverFunds
            targetChainId={getTargetChainId(chain.id)}
            signer={signer}
            connectedNetworkId={chain.id}
            balanceToRecover={BigNumber.from(operationInfo.balanceToRecover)}
          />
        </div>
      }
    </div>
  );
}

export default App;
