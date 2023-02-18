import { useAccount, useConnect, useDisconnect } from "wagmi";

const ConnectButtons = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, error, isLoading, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();

  const [activeConnector] = connectors;

  return (
    <div className="buttons-wrapper wallet-connection-buttons">
      {isConnected && <div>{address}</div>}
      {isConnected && (
        <button
          className="button-outline button-small"
          disabled={!activeConnector.ready}
          onClick={() => disconnect()}
        >
          Disconnect
        </button>
      )}
      {!isConnected && (
        <div>
          {connectors.map((connector) => (
            <button
              disabled={!connector.ready}
              key={connector.id}
              onClick={() => connect({ connector })}
            >
              Connect with {connector.name}
              {!connector.ready && ' (unsupported)'}
              {isLoading &&
                connector.id === pendingConnector?.id &&
                ' (connecting)'}
            </button>
          ))}
        </div>
      )}
      {error && <div className="error-message">{error.message}</div>}
    </div>
  );
};

export { ConnectButtons };
