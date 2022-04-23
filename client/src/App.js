import React, { useEffect, useState, useCallback } from 'react';
import { getWeb3, getWeb3Socket } from './getWeb3';
import { ContractTransaction, ethers } from 'ethers';
import PrimetimeModule from './artifacts/contracts/core/modules/collect/PrimetimeModule.sol/PrimetimeCollectModule.json';
import LensHub from './artifacts/contracts/core/LensHub.sol/LensHub.json';
import Addresses from './artifacts/addresses.json';
import CurrencyModule from './artifacts/contracts/mocks/Currency.sol/Currency.json';
import { BallTriangle } from 'react-loader-spinner';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Web3 from 'web3';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from './theme.js';
import InputAdornment from '@mui/material/InputAdornment';
import { useLocation } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import { CssBaseline } from '@mui/material';
import Typography from '@mui/material/Typography';
import Confetti from 'react-confetti';
import { defaultAbiCoder } from 'ethers/lib/utils';

function App() {
    const [web3state, setWeb3state] = useState({
        web3: null,
        signer: null,
        userAddress: null,
        contract: null,
    });

    const urlSearchParams = new URLSearchParams(window.location.searcsh);
    const urlParams = Object.fromEntries(urlSearchParams.entries());

    useEffect(() => {
        async function initializeWeb3() {
            const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
            await provider.send('eth_requestAccounts', []);
            const signer = provider.getSigner();

            let userAddress = 0;
            await (async function () {
                userAddress = await signer.getAddress();
                console.log('Your wallet is ' + userAddress);
            })();

            console.log('currency address: ', Addresses['currency']);

            const contract = new ethers.Contract(Addresses['lensHub proxy'], LensHub.abi, signer);
            const message = await contract.getProfile(1);
            console.log(message);

            console.log(Addresses['lensHub proxy']);
            setWeb3state({
                web3: null,
                signer,
                userAddress,
                contract,
            });
        }

        initializeWeb3();
    }, [setWeb3state]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Grid container direction={'column'} xs={12} spacing={1} style={{ padding: '16px' }}>
                <Grid item container direction={'row'} spacing={4} justifyContent="space-between">
                    <Grid item xs={4}>
                        <Typography variant="h3">Primetime</Typography>
                    </Grid>
                    <Grid item xs={4}>
                        <Button
                            onClick={async () => {
                                const { contract, userAddress } = web3state;

                                const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

                                let handle = 'p' + Math.floor(Math.random() * 100000000);
                                const inputStruct = {
                                    to: userAddress,
                                    handle: handle,
                                    imageURI:
                                        'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
                                    followModule: ZERO_ADDRESS,
                                    followModuleInitData: [],
                                    followNFTURI:
                                        'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
                                };
                                const x = await (await contract.createProfile(inputStruct)).wait();
                                console.log(x);

                                const profileId = (
                                    await contract.getProfileIdByHandle(handle)
                                ).toNumber();
                                console.log(profileId);

                                const inputStructPub = {
                                    profileId: profileId,
                                    contentURI:
                                        'https://ipfs.fleek.co/ipfs/plantghostplantghostplantghostplantghostplantghostplantghos',
                                    collectModule: Addresses['fee collect module'],
                                    collectModuleInitData: defaultAbiCoder.encode(
                                        ['uint256', 'address', 'address', 'uint16', 'bool'],
                                        [1, Addresses['currency'], userAddress, 0, false]
                                    ),
                                    referenceModule: ZERO_ADDRESS,
                                    referenceModuleInitData: [],
                                };

                                let pub = await (await contract.post(inputStructPub)).wait();
                                console.log(await contract.getPub(profileId, 1));
                            }}
                        >
                            post
                        </Button>
                        <Button
                            onClick={async () => {
                                console.log('Collecting..');
                                const { contract, userAddress, signer } = web3state;
                                const currency = new ethers.Contract(
                                    Addresses['currency'],
                                    CurrencyModule.abi,
                                    signer
                                );
                                console.log('start approving');

                                await (await currency.mint(userAddress, 100000000000)).wait();
                                await (
                                    await currency.approve(
                                        Addresses['fee collect module'],
                                        1000000000
                                    )
                                ).wait();
                                console.log('Approved');
                                console.log((await currency.balanceOf(userAddress)).toNumber());

                                const x = await (await contract.collect(1, 1, [])).wait();
                                console.log(x);
                            }}
                        >
                            Collect
                        </Button>
                    </Grid>
                </Grid>
                <Grid item container direction={'row'} spacing={4}>
                    <Grid
                        item
                        container
                        direction={'column'}
                        spacing={1}
                        xs={4}
                        style={{ marginTop: '42px' }}
                    >
                        <Grid item>
                            <form
                                onSubmit={async (event) => {
                                    event.preventDefault();
                                    const { contract } = web3state;
                                    const _handle = event.target.handle.value;
                                }}
                            >
                                <Grid
                                    item
                                    container
                                    spacing={1}
                                    direction={'row'}
                                    xs={12}
                                    alignItems="center"
                                >
                                    <Grid item>
                                        <TextField
                                            variant="outlined"
                                            name="stakingAmount"
                                            type="number"
                                            placeholder="Staking amount"
                                        />
                                    </Grid>
                                    <Grid item>
                                        <TextField
                                            variant="outlined"
                                            name="meetingTime"
                                            placeholder="Meeting time"
                                        />
                                    </Grid>
                                    <Grid item>
                                        <TextField
                                            variant="outlined"
                                            name="maxLateTime"
                                            placeholder="Max late time"
                                        />
                                    </Grid>
                                    <Grid item>
                                        <TextField
                                            variant="outlined"
                                            name="meetingInformation"
                                            placeholder="Meeting information"
                                        />
                                    </Grid>
                                    <Grid item>
                                        <Button
                                            variant="contained"
                                            type="submit"
                                            className="cta-button submit-gif-button"
                                        >
                                            Create meeting
                                        </Button>
                                    </Grid>
                                </Grid>
                            </form>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
        </ThemeProvider>
    );
}

export default App;
