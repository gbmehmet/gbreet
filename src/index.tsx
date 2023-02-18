import React from "react";
import ReactDOM from "react-dom";
import {
  RouteObject,
  RouterProvider,
  createBrowserRouter,
  matchRoutes,
  redirect
} from "react-router-dom";

import App from "./App";
import { WagmiProvider } from "./WagmiProvider";
import logo from "./logo.svg";
import { isValidTxHash } from "./isValidTxHash";

import "react-tooltip/dist/react-tooltip.css";
import "./index.css";

const routes: RouteObject[] = [
  {
    path: "tx",
    element: null,
    loader: ({ params }) => {
      if (!isValidTxHash(params.txHash)) {
        return redirect("/");
      }
    },
    children: [
      {
        path: "/tx/:txHash",
        element: null
      }
    ]
  }
];

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      ...routes,
      {
        path: "*",
        element: null,
        loader: () => {
          // 404 route, redirect to base route
          if (!matchRoutes([...routes, { path: "/" }], window.location)) {
            return redirect("/");
          }
        }
      }
    ]
  }
]);

ReactDOM.render(
  <React.StrictMode>
    <header>
      <h1>
        Funds recovery tool
      </h1>
      <h3>
        Tool to recover funds that are locked in an aliased L2 address.<br />
        Connect to either Ethereum mainnet or Goerli to start the recovery process.
      </h3>
      <div className="header-logo">
        <img src={logo} alt="logo" />
      </div>
      <WagmiProvider>
        <RouterProvider router={router} />
      </WagmiProvider>
    </header>
  </React.StrictMode>,
  document.getElementById("root")
);
