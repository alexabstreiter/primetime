import React, { useEffect, useState, useCallback } from 'react';
import Typography from '@mui/material/Typography';

export const CheckInPage = ({ web3state }) => {
    const [isLoadingCheckIn, setIsLoadingCheckin] = useState(true);
    const [meetings, setMeetings] = useState([]);
    const [meetingsWithInfo, setMeetingsWithInfo] = useState([]);
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
            console.log('getAllPublications result:');
            console.log(x);
            setMeetings(x);
            //setIsLoadingCheckin(false);
        }

        const { contract } = web3state;
        if (isMeetingCheckIn && contract !== null) {
            checkIn();
        }
    }, [isMeetingCheckIn, web3state, setMeetings]);

    useEffect(() => {
        async function loadIpfsData() {
            //setIsLoadingCheckin(true);
            console.log('run loadIpfsData');
            const { userAddress } = web3state;
            const test2 = await Promise.all(
                meetings.map(async (meeting) => {
                    return await fetch(meeting.contentURI);
                })
            );
            const test3 = await Promise.all(
                test2.map(async (response) => {
                    const r = await response.text();
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
            // TODO: filter for logged in profile
        }

        const { contract } = web3state;
        if (isMeetingCheckIn && contract !== null && meetings.length > 0) {
            loadIpfsData();
        }
    }, [isMeetingCheckIn, web3state, setMeetingsWithInfo, meetings]);

    return (
        <>
            {meetingsWithInfo.map((meeting) => (
                <>
                    <Typography>{meeting.contentURI}</Typography>
                </>
            ))}
        </>
    );
};
