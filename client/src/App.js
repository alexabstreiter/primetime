import React, {useEffect, useState, useCallback} from 'react';
import {ContractTransaction, ethers} from 'ethers';
import PrimetimeModule
    from './artifacts/contracts/core/modules/collect/PrimetimeModule.sol/PrimetimeCollectModule.json';
import LensHub from './artifacts/contracts/core/LensHub.sol/LensHub.json';
import Addresses from './artifacts/addresses.json';
import CurrencyModule from './artifacts/contracts/mocks/Currency.sol/Currency.json';
import {BallTriangle} from 'react-loader-spinner';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Web3 from 'web3';
import {ThemeProvider} from '@mui/material/styles';
import {theme} from './theme.js';
import InputAdornment from '@mui/material/InputAdornment';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import {CssBaseline} from '@mui/material';
import Typography from '@mui/material/Typography';
import Confetti from 'react-confetti';
import {defaultAbiCoder} from 'ethers/lib/utils';
import {pushTextToIpfs} from './textileFunctions';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {DateTimePicker} from '@mui/x-date-pickers/DateTimePicker';

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
    const [meetingLink, setMeetingLink] = React.useState(undefined);
    const [joinMeetingPub, setJoinMeetingPub] = React.useState({});

    const urlSearchParams = new URLSearchParams(window.location.search);
    const urlParams = Object.fromEntries(urlSearchParams.entries());
    const isMeetingCheckIn = urlParams.action === 'checkin';//urlParams.publicationId && urlParams.profileId;
    const isJoinMeeting = urlParams.action === 'join';

    useEffect(() => {
        async function checkIn() {
            setIsLoadingCheckin(true);
            console.log('run checkin');
            const {primetimeContract} = web3state;

            const x = await (
                await primetimeContract.checkin(urlParams.profileId, urlParams.publicationId)
            ).wait();
            console.log(x);
            setIsLoadingCheckin(false);
        }

        const {contract} = web3state;
        if (isMeetingCheckIn && contract !== null) {
            checkIn();
        }
    }, [isMeetingCheckIn, web3state]);

    useEffect(() => {
        async function showJoinMeeting() {
            console.log('run join meeting');
            const {primetimeContract, contract} = web3state;

            //const x = await (
            //                await primetimeContract.checkin(urlParams.profileId, urlParams.publicationId)
            //).wait();
            //console.log(x);
            let pub = await contract.getPub(urlParams.profileId, urlParams.publicationId);
            console.log('pub');
            console.log(pub);
            let pubData = await primetimeContract.getPublicationData(urlParams.profileId, urlParams.publicationId);
            console.log('pubData');
            console.log(pubData);
            setJoinMeetingPub(pub);
        }

        const {contract} = web3state;
        if (isJoinMeeting && contract !== null) {
            showJoinMeeting();
        }
    }, [isJoinMeeting, web3state]);

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

            const currency = new ethers.Contract(Addresses['currency'], CurrencyModule.abi, signer);
            setWeb3state({
                web3: null,
                signer,
                userAddress,
                contract,
                primetimeContract,
                currency,
            });

            const prof = (await contract.defaultProfile(userAddress)).toNumber();
            console.log('prof', prof);


            console.log(
                'prime balance: ',
                (
                    await currency.balanceOf(
                        Addresses['primetime collect module']
                    )
                ).toNumber()
            );

            const participants = await primetimeContract.getParticipants(1, 1);
            console.log('participants');
            console.log(participants);
            for (let i = 0; i < participants.length; i++) {
                const p = participants[i];
                console.log(p);
                console.log(
                    'balance ',
                    p,
                    ' ',
                    (
                        await currency.balanceOf(p)
                    ).toNumber()
                );
            }

            //const ipfsurl = await pushTextToIpfs('some meeting information');
            //console.log(ipfsurl);
            /*const url = 'https://ipfs.io/ipfs/bafkreicodlwqj6pxdpemsuhx53zneu4hsm234uq63vi6jl4rl5nr4siovy';
            console.log('fetch');
            const fetchUrl = url;//"http://api.scraperapi.com?api_key=" + process.env.REACT_APP_KEY_SCRAPERAPI + "&url=" + url;
            console.log(fetchUrl);
            await fetch(fetchUrl)
                .then(response => response.text())
                .then(async meetingInformation => {
                    console.log(meetingInformation);
                });*/

        }

        initializeWeb3();
    }, [setWeb3state]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <Grid container direction={'column'} xs={12} spacing={1} style={{padding: '16px'}}>
                {isJoinMeeting ? (
                        <Typography variant="h5">Join Meeting</Typography>
                    ) :
                    isMeetingCheckIn ? (
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
                                            const {
                                                contract,
                                                userAddress,
                                                signer,
                                                currency,
                                                primetimeContract,
                                            } = web3state;
                                            console.log('Approve');

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
                                            const x = await (await contract.collect(1, 1, [])).wait();
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
                                            console.log(await contract.getPub(1, 1));

                                            const participants =
                                                await primetimeContract.getParticipants(1, 1);
                                            console.log('participants');
                                            console.log(participants);
                                            for (let i = 0; i < participants.length; i++) {
                                                const p = participants[i];
                                                console.log(p);
                                                console.log(
                                                    'balance ',
                                                    p,
                                                    ' ',
                                                    (await currency.balanceOf(p)).toNumber()
                                                );
                                            }
                                        }}
                                    >
                                        Collect
                                    </Button>
                                    <Button
                                        onClick={async () => {
                                            const {primetimeContract, currency} = web3state;

                                            const participants =
                                                await primetimeContract.getParticipants(1, 1);
                                            console.log('participants');
                                            console.log(participants);
                                            for (let i = 0; i < participants.length; i++) {
                                                const p = participants[i];
                                                console.log(p);
                                                console.log(
                                                    'balance ',
                                                    p,
                                                    ' ',
                                                    (await currency.balanceOf(p)).toNumber()
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
                                            //console.log(await (await primetimeContract.distributeStake(2, 1)).wait());
                                            console.log(
                                                await (await primetimeContract.maybeDistribute()).wait()
                                            );
                                            for (let i = 0; i < participants.length; i++) {
                                                const p = participants[i];
                                                console.log(p);
                                                console.log(
                                                    'balance ',
                                                    p,
                                                    ' ',
                                                    (await currency.balanceOf(p)).toNumber()
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
                                    style={{marginTop: '42px'}}
                                >
                                    <Grid item>
                                        {meetingLink === undefined ? (
                                            <form
                                                onSubmit={async (event) => {
                                                    event.preventDefault();
                                                    const {contract, userAddress, currency} =
                                                        web3state;
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

                                                    const ZERO_ADDRESS =
                                                        '0x0000000000000000000000000000000000000000';
                                                    let defaultProfile = (
                                                        await contract.defaultProfile(userAddress)
                                                    ).toNumber();
                                                    console.log('defaultProfile', defaultProfile);
                                                    if (defaultProfile === 0) {
                                                        // create profile
                                                        console.log('create profile');
                                                        let handle =
                                                            'p' + Math.floor(Math.random() * 100000000);
                                                        const inputStruct = {
                                                            to: userAddress,
                                                            handle: handle,
                                                            imageURI:
                                                                'https://ipfs.io/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
                                                            followModule: ZERO_ADDRESS,
                                                            followModuleInitData: [],
                                                            followNFTURI:
                                                                'https://ipfs.io/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan',
                                                        };
                                                        console.log(inputStruct);
                                                        const x = await (
                                                            await contract.createProfile(inputStruct)
                                                        ).wait();
                                                        console.log(x);
                                                        console.log('get profileID');
                                                        const profileId = (
                                                            await contract.getProfileIdByHandle(handle)
                                                        ).toNumber();
                                                        console.log(profileId);

                                                        await (
                                                            await currency.mint(userAddress, 1000000000)
                                                        ).wait();

                                                        await (
                                                            await contract.setDefaultProfile(profileId)
                                                        ).wait();
                                                        defaultProfile = (
                                                            await contract.defaultProfile(userAddress)
                                                        ).toNumber();
                                                        console.log('prof', defaultProfile);
                                                    }

                                                    // create publication
                                                    const meetingTime =
                                                        new Date(
                                                            event.target.meetingTime.value
                                                        ).getTime() / 1000;
                                                    const inputStructPub = {
                                                        profileId: defaultProfile,
                                                        contentURI: `https://ipfs.io${ipfsurl}`,
                                                        collectModule:
                                                            Addresses['primetime collect module'],
                                                        collectModuleInitData: defaultAbiCoder.encode(
                                                            [
                                                                'uint256',
                                                                'address',
                                                                'uint256',
                                                                'uint256',
                                                            ],
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

                                                    //console.log('create publication');
                                                    let tx = await contract.post(inputStructPub);
                                                    //console.log(tx);
                                                    let pub = await tx.wait();
                                                    //console.log(pub);
                                                    console.log(Number(pub.events[0].topics[1]));
                                                    console.log(Number(pub.events[0].topics[2]));
                                                    let profileId = Number(pub.events[0].topics[1]);
                                                    let pubId = Number(pub.events[0].topics[2]);
                                                    setMeetingLink(
                                                        `http://localhost:3000/?publicationId=${profileId}&profileId=${pubId}`
                                                    );
                                                    //console.log(pub.logs);
                                                    //console.log(await pub.events[0].getTransaction());

                                                    const publication = await contract.getPub(profileId, pubId);
                                                    await fetch(publication['contentURI'])
                                                        .then(response => response.text())
                                                        .then(async meetingInformation => {
                                                            console.log(meetingInformation);
                                                        });
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
                                                            defaultValue={1000}
                                                            placeholder="Staking amount"
                                                        />
                                                    </Grid>
                                                    <Grid item>
                                                        <LocalizationProvider
                                                            dateAdapter={AdapterDateFns}
                                                        >
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
                                        ) : (
                                            <Typography>{meetingLink}</Typography>
                                        )}
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
