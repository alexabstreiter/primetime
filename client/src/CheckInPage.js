import React, { useEffect, useState, useCallback } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

export const CheckInPage = ({ web3state }) => {
    const [isLoadingCheckIn, setIsLoadingCheckIn] = useState(true);
    const [meetings, setMeetings] = useState([]);
    const [meetingsWithInfo, setMeetingsWithInfo] = useState([]);
    const urlSearchParams = new URLSearchParams(window.location.search);
    console.log(window.location.origin);
    const urlParams = Object.fromEntries(urlSearchParams.entries());
    const isMeetingCheckIn = urlParams.action === 'overview';

    useEffect(() => {
        async function checkIn() {
            console.log('run getAllPublications');
            const { primetimeContract } = web3state;
            const x = await primetimeContract.getAllPublications();
            console.log('getAllPublications result:');
            console.log(x);
            setMeetings(x);
            setIsLoadingCheckIn(false);
        }

        const { contract } = web3state;
        if (isMeetingCheckIn && contract !== null) {
            checkIn();
        }
    }, [isMeetingCheckIn, web3state, setMeetings]);

    useEffect(() => {
        async function loadIpfsData() {
            setIsLoadingCheckIn(true);
            console.log('run loadIpfsData');
            const { userAddress } = web3state;
            const test2 = await Promise.all(
                meetings.map(async (meeting) => {
                    return '';//await fetch(meeting.contentURI);
                })
            );
            const test3 = await Promise.all(
                test2.map(async (response) => {
                    const r = '';//await response.text();
                    console.log('r: ' + r);
                    return r;
                })
            );
            const test4 = test3
                .map(function (information, i) {
                    const newPubData = {
                        meetingInformation: information,
                        ...meetings[i],
                    };
                    console.log(newPubData);
                    return newPubData;
                })
                .filter((meeting) => meeting.participants.includes(userAddress));
            console.log('loadIpfsData result');
            console.log(test4);
            setMeetingsWithInfo(test4);
            setIsLoadingCheckIn(false);
        }

        const { contract } = web3state;
        if (isMeetingCheckIn && contract !== null && meetings.length > 0) {
            //loadIpfsData();
        }
    }, [isMeetingCheckIn, web3state, setMeetingsWithInfo, meetings]);

    return (
        <Grid container direction={'column'} spacing={2}>
            <Grid item>
                <Typography variant={'h3'}>Your meetings</Typography>
            </Grid>
            <Grid item container direction={'column'} spacing={1} style={{marginLeft: '8px'}}>
                {isLoadingCheckIn ? (
                    <Typography variant={'h6'}>Loading...</Typography>
                ) : (
                    meetings.map((meeting) => (
                        <Grid
                            container
                            spacing={2}
                            key={meeting.meetingTime}
                            onClick={() => {
                                const origin = window.location.origin;
                                const url = `${origin}?action=meeting&profileId=${meeting.profileId}&publicationId=${meeting.pubId}`;
                                window.location.href = url;
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <Grid item>
                                <Typography variant={'h6'}>
                                    {new Date(
                                        parseInt(meeting.meetingTime.toNumber()) * 1000
                                    ).toLocaleString()}
                                    :
                                </Typography>
                            </Grid>
                            <Grid item>
                                <Typography variant={'h6'}>
                                    <Box sx={{ fontWeight: 800 }}>{meeting.meetingName}</Box>
                                </Typography>
                            </Grid>
                        </Grid>
                    ))
                )}
            </Grid>
        </Grid>
    );
};
