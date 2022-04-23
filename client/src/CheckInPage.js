import React, { useEffect, useState, useCallback } from 'react';
import Typography from '@mui/material/Typography';

export const CheckInPage = ({ web3state }) => {
    const [isLoadingCheckIn, setIsLoadingCheckin] = useState(true);
    const [meetings, setMeetings] = useState([]);
    const urlSearchParams = new URLSearchParams(window.location.search);
    const urlParams = Object.fromEntries(urlSearchParams.entries());
    const isMeetingCheckIn = urlParams.action === 'checkin';

    /*useEffect(() => {
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
    }, [isMeetingCheckIn, web3state]);*/

    useEffect(() => {
        async function checkIn() {
            //setIsLoadingCheckin(true);
            console.log('run getAllPublications');
            const { primetimeContract } = web3state;

            const x = await primetimeContract.getAllPublications();
            console.log('getAllPublications');
            console.log(x);
            setMeetings(x);
            //setIsLoadingCheckin(false);
        }

        const { contract } = web3state;
        if (isMeetingCheckIn && contract !== null) {
            checkIn();
        }
    }, [isMeetingCheckIn, web3state, setMeetings]);

    return (
        <>
            {isLoadingCheckIn ? (
                <Typography variant="h5">Checking into meeting...</Typography>
            ) : (
                <Typography variant="h5">Check in done</Typography>
            )}
        </>
    );
};
