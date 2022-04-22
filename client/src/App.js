import React, { useEffect, useState, useCallback } from "react";
import { getWeb3, getWeb3Socket } from "./getWeb3";
import PrimetimeModule from "./contracts/PrimetimeModule.json";
import { BallTriangle } from "react-loader-spinner";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Web3 from "web3";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "./theme.js";
import InputAdornment from "@mui/material/InputAdornment";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import { CssBaseline } from "@mui/material";
import Typography from "@mui/material/Typography";
import Confetti from "react-confetti";

function App() {
    const [web3state, setWeb3state] = useState({
        web3: null,
        web3Socket: null,
        accounts: null,
        contract: null,
    });

    useEffect(() => {
        async function initializeWeb3() {
            try {
                // Get network provider and web3 instance.
                const web3 = await getWeb3();
                const web3Socket = await getWeb3Socket(web3);

                // Use web3 to get the user's accounts.
                const accounts = await web3.eth.getAccounts();

                // Get the contract instance.
                const networkId = await web3.eth.net.getId();
                const deployedNetwork = PrimetimeModule.networks[networkId];
                console.log("deployedNetwork" + JSON.stringify(deployedNetwork));
                const instance = new web3.eth.Contract(PrimetimeModule.abi, deployedNetwork && deployedNetwork.address);

                // Set web3, accounts, and contract to the state, and then proceed with an
                // example of interacting with the contract's methods.
                setWeb3state({
                    web3,
                    web3Socket,
                    accounts,
                    contract: instance,
                });
            } catch (error) {
                // Catch any errors for any of the above operations.
                alert(`Failed to load web3, accounts, or contract. Check console for details.`);
                console.error(error);
            }
        }

        initializeWeb3();

        //await contract.methods.getPrimetimes(profileID).call();
    }, [setWeb3state]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Grid container direction={"column"} xs={12} spacing={1} style={{ padding: "16px" }}>
                <Grid item container direction={"row"} spacing={4} justifyContent="space-between">
                    <Grid item xs={4}>
                        <Typography variant="h3">Primetime</Typography>
                    </Grid>
                </Grid>
            </Grid>
        </ThemeProvider>
    );
}

export default App;
