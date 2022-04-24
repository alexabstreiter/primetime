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
import {CheckInPage} from './CheckInPage';

function App() {
    const [web3state, setWeb3state] = useState({
        web3: null,
        signer: null,
        userAddress: null,
        contract: null,
        primetimeContract: null,
        currency: null,
    });
    const [value, setValue] = React.useState(new Date());
    const [meetingLink, setMeetingLink] = React.useState(undefined);//'http://localhost:3000/?action=join&profileId=1&publicationId=1'
    const [joinMeetingPub, setJoinMeetingPub] = React.useState(undefined);
    const [isLoadingJoinMeeting, setIsLoadingJoinMeeting] = useState(false);
    const [isLoadingCheckinMeeting, setIsLoadingCheckinMeeting] = useState(false);

    const urlSearchParams = new URLSearchParams(window.location.search);
    const urlParams = Object.fromEntries(urlSearchParams.entries());
    const isMeetingCheckIn = urlParams.action === 'checkin'; //urlParams.publicationId && urlParams.profileId;
    const isJoinMeeting = urlParams.action === 'join';

    useEffect(() => {
        async function showJoinMeeting() {
            console.log('run join meeting');
            const {primetimeContract, contract, userAddress} = web3state;

            //const x = await (
            //  await primetimeContract.checkin(urlParams.profileId, urlParams.publicationId)
            //).wait();
            //console.log(x);
            //let pub = await contract.getPub(urlParams.profileId, urlParams.publicationId);
            //console.log('pub');
            //console.log(pub);
            const profileId = urlParams.profileId
            const publicationId = urlParams.publicationId
            let pubData = await primetimeContract.getPublicationData(profileId, publicationId);
            console.log('pubData');
            console.log(pubData);

            await fetch(pubData['contentURI'])
                .then((response) => response.text())
                .then(async (meetingInformation) => {
                    console.log(meetingInformation);
                    let participantInfo = [];
                    let isRegistered = false;
                    for (let i = 0; i < pubData.participants.length; i++) {
                        const p = pubData.participants[i];
                        if (p === userAddress) {
                            isRegistered = true;
                        }
                        const participantProfileId = (await contract.defaultProfile(p)).toNumber();
                        const handle = await contract.getHandle(participantProfileId);
                        const participant = {handle: handle}

                        if (pubData.hasBeenDistributed) {
                            const allRewards = (await primetimeContract.getAllRewards(profileId, publicationId));
                            const checkinTime = (await primetimeContract.getCheckinTime(profileId, publicationId, p)).toNumber();
                            participant['lateTime'] = checkinTime > 0 ? (checkinTime - pubData.meetingTime.toNumber()) : pubData.maxLateTime.toNumber();
                            participant['reward'] = await primetimeContract.getReward(profileId, publicationId, p);// - pubData.stakingAmount.toNumber();
                        }
                        participantInfo.push(participant);
                    }
                    let checkinTime = 0;
                    if (isRegistered) {
                        checkinTime = (await primetimeContract.getCheckinTime(profileId, publicationId, userAddress)).toNumber();
                    }
                    const newPubData = {
                        meetingInformation: meetingInformation,
                        participantInfo: participantInfo,
                        checkinTime: checkinTime,
                        isRegistered: isRegistered, ...pubData
                    }
                    setJoinMeetingPub(newPubData);
                    console.log(newPubData);
                });
        }

        const {contract} = web3state;
        if (isJoinMeeting && contract !== null) {
            showJoinMeeting();
        }
    }, [isJoinMeeting, web3state, isLoadingJoinMeeting, isLoadingCheckinMeeting]);

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

            /*
            console.log(
                'prime balance: ',
                (await currency.balanceOf(Addresses['primetime collect module'])).toNumber()
            );

            const participants = await primetimeContract.getParticipants(1, 1);
            console.log('participants');
            console.log(participants);
            for (let i = 0; i < participants.length; i++) {
                const p = participants[i];
                console.log(p);
                console.log('balance ', p, ' ', (await currency.balanceOf(p)).toNumber());
            }

            console.log('finished loading');

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

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    async function getDefaultProfile(state) {
        const {contract, userAddress, currency} = state;
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
                await currency.mint(userAddress, ethers.utils.parseEther('100'))
            ).wait();

            await (
                await contract.setDefaultProfile(profileId)
            ).wait();
            defaultProfile = (
                await contract.defaultProfile(userAddress)
            ).toNumber();
            console.log('prof', defaultProfile);
        }
        return defaultProfile;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <Grid container direction={'column'} xs={12} spacing={1} style={{padding: '16px'}}>
                {isJoinMeeting ? (
                        <Grid container direction={'column'}>
                            <Grid item xs={4} style={{marginBottom: '16px'}}>
                                <Typography variant="h5"></Typography>
                            </Grid>
                            {joinMeetingPub !== undefined ? (
                                <>
                                    <Grid item xs={4}>
                                        <Typography variant="h6">{joinMeetingPub.meetingName}</Typography>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Typography variant="h6">{joinMeetingPub.meetingInformation}</Typography>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Typography variant="h6">Staking
                                            amount: {ethers.utils.formatEther(joinMeetingPub.stakingAmount)}</Typography>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Typography variant="h6">Max
                                            tolerance: {joinMeetingPub.maxLateTime.toNumber() / 60}min</Typography>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Typography
                                            variant="h6">Date: {new Date(parseInt(joinMeetingPub.meetingTime.toNumber()) * 1000).toLocaleString()}</Typography>
                                    </Grid>
                                    <Grid item xs={4}>
                                        {joinMeetingPub.hasBeenDistributed ? (
                                            joinMeetingPub.participantInfo.map(pInfo => (
                                                <>
                                                    <Typography
                                                        variant="h6">{pInfo.handle} was {pInfo.lateTime}s too late,
                                                        got {ethers.utils.formatEther(pInfo.reward)} MATIC
                                                        back.</Typography>
                                                </>
                                            ))
                                        ) : (
                                            <Typography
                                                variant="h6">Participants: {joinMeetingPub.participantInfo.map(p => p.handle).join(', ')}</Typography>
                                        )}
                                    </Grid>
                                    <Grid item xs={4} style={{marginTop: '16px'}}>
                                        {joinMeetingPub.checkinTime > 0 ? (
                                            <Typography variant="h5">You are checked in!</Typography>
                                        ) : (
                                            joinMeetingPub.isRegistered ? (
                                                <>
                                                    <Typography variant="h5">You are registered!</Typography>
                                                    <Button
                                                        variant="contained"
                                                        style={{marginTop: '16px'}}
                                                        disabled={isLoadingCheckinMeeting === true}
                                                        onClick={async () => {
                                                            setIsLoadingCheckinMeeting(true);
                                                            const {primetimeContract} = web3state;
                                                            await (await primetimeContract.checkin(urlParams.profileId, urlParams.publicationId)).wait();
                                                            setIsLoadingCheckinMeeting(false);
                                                        }}
                                                    >
                                                        Checkin
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    variant="contained"
                                                    style={{marginTop: '16px'}}
                                                    disabled={isLoadingJoinMeeting === true}
                                                    onClick={async () => {
                                                        setIsLoadingJoinMeeting(true);
                                                        const {
                                                            contract,
                                                            userAddress,
                                                            signer,
                                                            currency,
                                                            primetimeContract,
                                                        } = web3state;
                                                        console.log('Approve');

                                                        await getDefaultProfile(web3state);

                                                        await (
                                                            await currency.approve(
                                                                Addresses['primetime collect module'],
                                                                joinMeetingPub.stakingAmount
                                                            )
                                                        ).wait();

                                                        console.log('Balance');
                                                        console.log(
                                                            ethers.utils.formatEther(await currency.balanceOf(userAddress))
                                                        );

                                                        console.log(
                                                            'prime balance: ',
                                                            ethers.utils.formatEther(
                                                                await currency.balanceOf(
                                                                    Addresses['primetime collect module']
                                                                )
                                                            )
                                                        );
                                                        console.log('Collect');
                                                        const x = await (await contract.collect(urlParams.profileId, urlParams.publicationId, [])).wait();
                                                        console.log(x);
                                                        console.log(
                                                            'prime balance: ',
                                                            ethers.utils.formatEther(
                                                                await currency.balanceOf(
                                                                    Addresses['primetime collect module']
                                                                )
                                                            )
                                                        );

                                                        console.log('Pub:');
                                                        console.log(await contract.getPub(urlParams.profileId, urlParams.publicationId));

                                                        const participants =
                                                            await primetimeContract.getParticipants(urlParams.profileId, urlParams.publicationId);
                                                        console.log('participants');
                                                        console.log(participants);
                                                        for (let i = 0; i < participants.length; i++) {
                                                            const p = participants[i];
                                                            console.log(p);
                                                            console.log(
                                                                'balance ',
                                                                p,
                                                                ' ',
                                                                ethers.utils.formatEther(await currency.balanceOf(p))
                                                            );
                                                        }
                                                        setIsLoadingJoinMeeting(false);
                                                    }}
                                                >
                                                    Join meeting
                                                </Button>
                                            ))}
                                    </Grid>
                                </>
                            ) : (<></>)
                            }
                        </Grid>
                    ) :
                    isMeetingCheckIn ? (
                        <CheckInPage web3state={web3state}></CheckInPage>
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
                            </Grid>
                            <Grid item container direction={'row'} spacing={4}>
                                <Grid
                                    item
                                    container
                                    direction={'column'}
                                    spacing={1}
                                    xs={20}
                                    style={{marginTop: '42px'}}
                                >
                                    {meetingLink === undefined ? (
                                        <Grid item>
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

                                                    const defaultProfile = await getDefaultProfile(web3state);

                                                    // create publication
                                                    const meetingTime =
                                                        new Date(
                                                            event.target.meetingTime.value
                                                        ).getTime() / 1000;
                                                    const contentURI = `https://ipfs.io${ipfsurl}`;
                                                    const stakingAmount = ethers.utils.parseEther(event.target.stakingAmount.value);
                                                    //console.log('stakingAmount', stakingAmount);
                                                    //console.log('stakingAmount', ethers.utils.formatEther(stakingAmount));
                                                    const inputStructPub = {
                                                        profileId: defaultProfile,
                                                        contentURI: contentURI,
                                                        collectModule:
                                                            Addresses['primetime collect module'],
                                                        collectModuleInitData: defaultAbiCoder.encode(
                                                            [
                                                                'uint256',
                                                                'address',
                                                                'uint256',
                                                                'uint256',
                                                                'string',
                                                                'string',
                                                            ],
                                                            [
                                                                stakingAmount,
                                                                Addresses['currency'],
                                                                meetingTime,
                                                                event.target.maxLateTime.value * 60,
                                                                contentURI,
                                                                event.target.meetingName.value,
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

                                                    /*const publication = await contract.getPub(
                                                        profileId,
                                                        pubId
                                                    );
                                                    await fetch(publication['contentURI'])
                                                        .then((response) => response.text())
                                                        .then(async (meetingInformation) => {
                                                            console.log(meetingInformation);
                                                        });*/
                                                }}
                                            >
                                                <Grid
                                                    item
                                                    container
                                                    spacing={1}
                                                    direction={'row'}
                                                    xs={8}
                                                    alignItems="center"
                                                >
                                                    <Grid item xs={8}>
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
                                                    <Grid item xs={8}>
                                                        <TextField
                                                            fullWidth
                                                            variant="outlined"
                                                            name="stakingAmount"
                                                            type="number"
                                                            defaultValue="20"
                                                            label="Staking amount"
                                                            InputProps={{
                                                                endAdornment: <InputAdornment
                                                                    position="end">MATIC</InputAdornment>,
                                                            }}
                                                            inputProps={{
                                                                min: "0.0001",
                                                                step: "0.0001",
                                                            }}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={8}>
                                                        <TextField
                                                            fullWidth
                                                            variant="outlined"
                                                            name="maxLateTime"
                                                            type="number"
                                                            defaultValue="10"
                                                            InputProps={{
                                                                endAdornment: <InputAdornment
                                                                    position="end">min</InputAdornment>,
                                                            }}
                                                            inputProps={{
                                                                min: "1",
                                                                step: "1",
                                                            }}
                                                            label="Max tolerance"
                                                        />
                                                    </Grid>
                                                    <Grid item xs={20}>
                                                        <TextField
                                                            fullWidth
                                                            variant="outlined"
                                                            name="meetingName"
                                                            label="Name"
                                                            defaultValue={'ETHGlobal finalist presentation'}
                                                            placeholder="Meeting name"
                                                        />
                                                    </Grid>
                                                    <Grid item xs={20}>
                                                        <TextField
                                                            fullWidth
                                                            variant="outlined"
                                                            name="meetingInformation"
                                                            multiline
                                                            label="Information"
                                                            defaultValue={'A stitch in time saves nine!\n\nhttps://meet.google.com/aqo-mwbq-mot'}
                                                            placeholder="Meeting information"
                                                        />
                                                    </Grid>
                                                    <Grid item>
                                                        <Button
                                                            style={{marginTop: '16px'}}
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
                                    ) : (
                                        <Typography>{meetingLink}</Typography>
                                    )}
                                </Grid>
                            </Grid>
                        </>
                    )}
                <Button
                    onClick={async () => {
                        const {primetimeContract, currency} = web3state;

                        const participants = await primetimeContract.getParticipants(urlParams.profileId, urlParams.publicationId);
                        console.log('participants');
                        console.log(participants);
                        for (let i = 0; i < participants.length; i++) {
                            const p = participants[i];
                            console.log(p);
                            console.log(
                                'balance ',
                                p,
                                ' ',
                                ethers.utils.formatEther(await currency.balanceOf(p))
                            );
                        }
                        console.log('Distribute stake');
                        console.log(
                            'prime balance: ',
                            ethers.utils.formatEther(
                                await currency.balanceOf(
                                    Addresses['primetime collect module']
                                )
                            )
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
                                ethers.utils.formatEther(await currency.balanceOf(p))
                            );
                        }
                    }}
                >
                    Distribute
                </Button>
            </Grid>
        </ThemeProvider>
    );
}

export default App;
