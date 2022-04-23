import React, { useEffect, useState, useCallback } from 'react';
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
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import { CssBaseline } from '@mui/material';
import Typography from '@mui/material/Typography';
import Confetti from 'react-confetti';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { pushTextToIpfs } from './textileFunctions';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

function App() {
    const [web3state, setWeb3state] = useState({
        web3: null,
        signer: null,
        userAddress: null,
        contract: null,
        primetimeContract: null,
        currency: null,
    });
    const [isLoadingCheckIn, setIsLoadingCheckin] = useState(true);
    const [value, setValue] = React.useState(new Date());

    const urlSearchParams = new URLSearchParams(window.location.search);
    const urlParams = Object.fromEntries(urlSearchParams.entries());
    const isMeetingCheckIn = urlParams.publicationId && urlParams.profileId;

    useEffect(() => {
        async function checkIn() {
            setIsLoadingCheckin(true);
            console.log('run checkin');
            const { primetimeContract } = web3state;

            const x = await (
                await primetimeContract.checkin(urlParams.profileId, urlParams.publicationId)
            ).wait();
            console.log(x);
            setIsLoadingCheckin(false);
        }

        const { contract } = web3state;
        if (isMeetingCheckIn && contract !== null) {
            checkIn();
        }
    }, [isMeetingCheckIn, web3state]);

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
            const primetimeContract = new ethers.Contract(
                Addresses['primetime collect module'],
                PrimetimeModule.abi,
                signer
            );
            const message = await contract.getProfile(1);
            console.log(message);

            const currency = new ethers.Contract(Addresses['currency'], CurrencyModule.abi, signer);

            console.log(Addresses['lensHub proxy']);
            setWeb3state({
                web3: null,
                signer,
                userAddress,
                contract,
                primetimeContract,
                currency,
            });
        }

        initializeWeb3();
    }, [setWeb3state]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Grid container direction={'column'} xs={12} spacing={1} style={{ padding: '16px' }}>
                {isMeetingCheckIn ? (
                    isLoadingCheckIn ? (
                        <Typography variant="h5">Checking into meeting...</Typography>
                    ) : (
                        <Typography variant="h5">Check in done</Typography>
                    )
                ) : (
                    <>
                        <Grid
                            item
                            container
                            direction={'row'}
                            spacing={4}
                            justifyContent="space-between"
                        >
                            <Grid item xs={4}>
                                <Typography variant="h3">Primetime</Typography>
                            </Grid>
                            <Grid item xs={4}>
                                <Button
                                    onClick={async () => {
                                        const { contract, userAddress } = web3state;

                                        const ZERO_ADDRESS =
                                            '0x0000000000000000000000000000000000000000';

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
                                        const x = await (
                                            await contract.createProfile(inputStruct)
                                        ).wait();
                                        console.log(x);

                                        const profileId = (
                                            await contract.getProfileIdByHandle(handle)
                                        ).toNumber();
                                        console.log(profileId);

                                        const inputStructPub = {
                                            profileId: profileId,
                                            contentURI:
                                                'https://ipfs.fleek.co/ipfs/plantghostplantghostplantghostplantghostplantghostplantghos',
                                            collectModule: Addresses['primetime collect module'],
                                            collectModuleInitData: defaultAbiCoder.encode(
                                                ['uint256', 'address', 'address', 'uint16', 'bool'],
                                                [1, Addresses['currency'], userAddress, 0, false]
                                            ),
                                            referenceModule: ZERO_ADDRESS,
                                            referenceModuleInitData: [],
                                        };

                                        let pub = await (
                                            await contract.post(inputStructPub)
                                        ).wait();
                                        console.log(await contract.getPub(profileId, 1));
                                        const linkurl = `http://localhost:3000/?publicationId=1&profileId=${profileId}`;
                                        console.log(linkurl);
                                    }}
                                >
                                    post
                                </Button>
                                <Button
                                    onClick={async () => {
                                        const { contract, userAddress, signer, currency } =
                                            web3state;
                                        console.log('Approve');

                                        await (
                                            await currency.mint(userAddress, 100000000000)
                                        ).wait();
                                        await (
                                            await currency.approve(
                                                Addresses['primetime collect module'],
                                                1000000000
                                            )
                                        ).wait();
                                        console.log('Balance');
                                        console.log(
                                            (await currency.balanceOf(userAddress)).toNumber()
                                        );

                                        console.log(
                                            'prime balance: ',
                                            (
                                                await currency.balanceOf(
                                                    Addresses['primetime collect module']
                                                )
                                            ).toNumber()
                                        );
                                        console.log('Collect');
                                        const x = await (await contract.collect(2, 1, [])).wait();
                                        console.log(x);
                                        console.log(
                                            'prime balance: ',
                                            (
                                                await currency.balanceOf(
                                                    Addresses['primetime collect module']
                                                )
                                            ).toNumber()
                                        );

                                        console.log('Pub:');
                                        console.log(await contract.getPub(2, 1));
                                    }}
                                >
                                    Collect
                                </Button>
                                <Button
                                    onClick={async () => {
                                        const { primetimeContract, currency } = web3state;

                                        const participants =
                                            await primetimeContract.getParticipants(2, 1);
                                        console.log('participants');
                                        console.log(participants);
                                        for (const p in participants) {
                                            console.log(
                                                'balance ',
                                                p,
                                                ' ',
                                                (
                                                    await currency.balanceOf(participants[0])
                                                ).toNumber()
                                            );
                                        }
                                        console.log('Distribute stake');
                                        console.log(
                                            'prime balance: ',
                                            (
                                                await currency.balanceOf(
                                                    Addresses['primetime collect module']
                                                )
                                            ).toNumber()
                                        );
                                        console.log(await primetimeContract.distributeStake(2, 1));
                                        for (const p in participants) {
                                            console.log(
                                                'balance ',
                                                p,
                                                ' ',
                                                (
                                                    await currency.balanceOf(participants[0])
                                                ).toNumber()
                                            );
                                        }
                                    }}
                                >
                                    Distribute
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
                                            const { contract, userAddress } = web3state;
                                            // create meeting information and publish to filecoin
                                            console.log('upload meeting information');
                                            const meetingInformation =
                                                event.target.meetingInformation.value;
                                            const ipfsurl = await pushTextToIpfs(
                                                meetingInformation
                                                    ? meetingInformation
                                                    : 'no information'
                                            );
                                            console.log(ipfsurl);

                                            // create profile
                                            const ZERO_ADDRESS =
                                                '0x0000000000000000000000000000000000000000';
                                            let handle =
                                                'p' + Math.floor(Math.random() * 100000000);
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
                                            console.log('create profile (test)');
                                            const x = await (
                                                await contract.createProfile(inputStruct)
                                            ).wait();
                                            console.log(x);
                                            console.log('get profileID');
                                            const profileId = (
                                                await contract.getProfileIdByHandle(handle)
                                            ).toNumber();
                                            console.log(profileId);

                                            // create publication
                                            const meetingTime =
                                                new Date(event.target.meetingTime.value).getTime() /
                                                1000;
                                            const inputStructPub = {
                                                profileId: profileId,
                                                contentURI: `https://hub.textile.io${ipfsurl}`,
                                                collectModule:
                                                    Addresses['primetime collect module'],
                                                collectModuleInitData: defaultAbiCoder.encode(
                                                    ['uint256', 'address', 'uint256', 'uint256'],
                                                    [
                                                        event.target.stakingAmount.value,
                                                        Addresses['currency'],
                                                        meetingTime,
                                                        event.target.maxLateTime.value * 60,
                                                    ]
                                                ),
                                                referenceModule: ZERO_ADDRESS,
                                                referenceModuleInitData: [],
                                            };

                                            console.log('create publication');
                                            let pub = await (
                                                await contract.post(inputStructPub)
                                            ).wait();
                                            console.log(await contract.getPub(profileId, 1));
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
                                                    defaultValue={10}
                                                    placeholder="Staking amount"
                                                />
                                            </Grid>
                                            <Grid item>
                                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                                    <DateTimePicker
                                                        renderInput={(props) => (
                                                            <TextField
                                                                {...props}
                                                                name="meetingTime"
                                                            />
                                                        )}
                                                        label="DateTimePicker"
                                                        value={value}
                                                        onChange={(newValue) => {
                                                            setValue(newValue);
                                                        }}
                                                    />
                                                </LocalizationProvider>
                                            </Grid>
                                            <Grid item>
                                                <TextField
                                                    variant="outlined"
                                                    name="maxLateTime"
                                                    defaultValue={600}
                                                    placeholder="Max tolerance in minutes"
                                                />
                                            </Grid>
                                            <Grid item>
                                                <TextField
                                                    variant="outlined"
                                                    name="meetingInformation"
                                                    defaultValue={'somelink'}
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
                    </>
                )}
            </Grid>
        </ThemeProvider>
    );
}

export default App;
