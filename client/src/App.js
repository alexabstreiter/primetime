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
    const [meetingLink, setMeetingLink] = React.useState(undefined); //'http://localhost:3000/?action=join&profileId=1&publicationId=1'
    const [joinMeetingPub, setJoinMeetingPub] = React.useState(undefined);
    const [isLoadingJoinMeeting, setIsLoadingJoinMeeting] = useState(false);
    const [isLoadingCheckinMeeting, setIsLoadingCheckinMeeting] = useState(false);
    const [loadingState, setLoadingState] = useState('');
    const [joinMeetingLoadingState, setJoinMeetingLoadingState] = useState('');

    const urlSearchParams = new URLSearchParams(window.location.search);
    const urlParams = Object.fromEntries(urlSearchParams.entries());
    const isMeetingCheckIn = urlParams.action === 'checkin'; //urlParams.publicationId && urlParams.profileId;
    const isJoinMeeting = urlParams.action === 'meeting';

    useEffect(() => {
        async function showJoinMeeting() {
            setLoadingState('Fetching meeting information...');
            console.log('run join meeting');
            const {primetimeContract, contract, userAddress} = web3state;

            //const x = await (
            //  await primetimeContract.checkin(urlParams.profileId, urlParams.publicationId)
            //).wait();
            //console.log(x);
            //let pub = await contract.getPub(urlParams.profileId, urlParams.publicationId);
            //console.log('pub');
            //console.log(pub);
            const profileId = urlParams.profileId;
            const publicationId = urlParams.publicationId;
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
                        const participant = {handle: handle};

                        if (pubData.hasBeenDistributed) {
                            const allRewards = await primetimeContract.getAllRewards(
                                profileId,
                                publicationId
                            );
                            const checkinTime = (
                                await primetimeContract.getCheckinTime(profileId, publicationId, p)
                            ).toNumber();
                            participant['lateTime'] =
                                checkinTime > 0
                                    ? checkinTime - pubData.meetingTime.toNumber()
                                    : pubData.maxLateTime.toNumber();
                            participant['reward'] = await primetimeContract.getReward(
                                profileId,
                                publicationId,
                                p
                            ); // - pubData.stakingAmount.toNumber();
                        }
                        participantInfo.push(participant);
                    }
                    let checkinTime = 0;
                    if (isRegistered) {
                        checkinTime = (
                            await primetimeContract.getCheckinTime(
                                profileId,
                                publicationId,
                                userAddress
                            )
                        ).toNumber();
                    }
                    const newPubData = {
                        meetingInformation: meetingInformation,
                        participantInfo: participantInfo,
                        checkinTime: checkinTime,
                        isRegistered: isRegistered,
                        ...pubData,
                    };
                    setJoinMeetingPub(newPubData);
                    console.log(newPubData);
                    setLoadingState('');
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
        let defaultProfile = (await contract.defaultProfile(userAddress)).toNumber();
        console.log('defaultProfile', defaultProfile);
        if (defaultProfile === 0) {
            // create profile
            console.log('create profile');
            const names = ["Aaran", "Aaren", "Aarez", "Aarman", "Aaron", "AaronJames", "Aarron", "Aaryan", "Aaryn", "Aayan", "Aazaan", "Abaan", "Abbas", "Abdallah", "Abdalroof", "Abdihakim", "Abdirahman", "Abdisalam", "Abdul", "AbdulAziz", "Abdulbasir", "Abdulkadir", "Abdulkarem", "Abdulkhader", "Abdullah", "AbdulMajeed", "Abdulmalik", "AbdulRehman", "Abdur", "Abdurraheem", "AbdurRahman", "AbdurRehmaan", "Abel", "Abhinav", "Abhisumant", "Abid", "Abir", "Abraham", "Abu", "Abubakar", "Ace", "Adain", "Adam", "AdamJames", "Addison", "Addisson", "Adegbola", "Adegbolahan", "Aden", "Adenn", "Adie", "Adil", "Aditya", "Adnan", "Adrian", "Adrien", "Aedan", "Aedin", "Aedyn", "Aeron", "Afonso", "Ahmad", "Ahmed", "AhmedAziz", "Ahoua", "Ahtasham", "Aiadan", "Aidan", "Aiden", "AidenJack", "AidenVee", "Aidian", "Aidy", "Ailin", "Aiman", "Ainsley", "Ainslie", "Airen", "Airidas", "Airlie", "AJ", "Ajay", "AJay", "Ajayraj", "Akan", "Akram", "Al", "Ala", "Alan", "Alanas", "Alasdair", "Alastair", "Alber", "Albert", "Albie", "Aldred", "Alec", "Aled", "Aleem", "Aleksandar", "Aleksander", "Aleksandr", "Aleksandrs", "Alekzander", "Alessandro", "Alessio", "Alex", "Alexander", "Alexei", "Alexx", "Alexzander", "Alf", "Alfee", "Alfie", "Alfred", "Alfy", "Alhaji", "AlHassan", "Ali", "Aliekber", "Alieu", "Alihaider", "Alisdair", "Alishan", "Alistair", "Alistar", "Alister", "Aliyaan", "Allan", "AllanLaiton", "Allen", "Allesandro", "Allister", "Ally", "Alphonse", "Altyiab", "Alum", "Alvern", "Alvin", "Alyas", "Amaan", "Aman", "Amani", "Ambanimoh", "Ameer", "Amgad", "Ami", "Amin", "Amir", "Ammaar", "Ammar", "Ammer", "Amolpreet", "Amos", "Amrinder", "Amrit", "Amro", "Anay", "Andrea", "Andreas", "Andrei", "Andrejs", "Andrew", "Andy", "Anees", "Anesu", "Angel", "Angelo", "Angus", "Anir", "Anis", "Anish", "Anmolpreet", "Annan", "Anndra", "Anselm", "Anthony", "AnthonyJohn", "Antoine", "Anton", "Antoni", "Antonio", "Antony", "Antonyo", "Anubhav", "Aodhan", "Aon", "Aonghus", "Apisai", "Arafat", "Aran", "Arandeep", "Arann", "Aray", "Arayan", "Archibald", "Archie", "Arda", "Ardal", "Ardeshir", "Areeb", "Areez", "Aref", "Arfin", "Argyle", "Argyll", "Ari", "Aria", "Arian", "Arihant", "Aristomenis", "Aristotelis", "Arjuna", "Arlo", "Armaan", "Arman", "Armen", "Arnab", "Arnav", "Arnold", "Aron", "Aronas", "Arran", "Arrham", "Arron", "Arryn", "Arsalan", "Artem", "Arthur", "Artur", "Arturo", "Arun", "Arunas", "Arved", "Arya", "Aryan", "Aryankhan", "Aryian", "Aryn", "Asa", "Asfhan", "Ash", "Ashleejay", "Ashley", "Ashton", "AshtonLloyd", "Ashtyn", "Ashwin", "Asif", "Asim", "Aslam", "Asrar", "Ata", "Atal", "Atapattu", "Ateeq", "Athol", "Athon", "AthosCarlos", "Atli", "Atom", "Attila", "Aulay", "Aun", "Austen", "Austin", "Avani", "Averon", "Avi", "Avinash", "Avraham", "Awais", "Awwal", "Axel", "Ayaan", "Ayan", "Aydan", "Ayden", "Aydin", "Aydon", "Ayman", "Ayomide", "Ayren", "Ayrton", "Aytug", "Ayub", "Ayyub", "Azaan", "Azedine", "Azeem", "Azim", "Aziz", "Azlan", "Azzam", "Azzedine", "Babatunmise", "Babur", "Bader", "Badr", "Badsha", "Bailee", "Bailey", "Bailie", "Bailley", "Baillie", "Baley", "Balian", "Banan", "Barath", "Barkley", "Barney", "Baron", "Barrie", "Barry", "Bartlomiej", "Bartosz", "Basher", "Basile", "Baxter", "Baye", "Bayley", "Beau", "Beinn", "Bekim", "Believe", "Ben", "Bendeguz", "Benedict", "Benjamin", "Benjamyn", "Benji", "Benn", "Bennett", "Benny", "Benoit", "Bentley", "Berkay", "Bernard", "Bertie", "Bevin", "Bezalel", "Bhaaldeen", "Bharath", "Bilal", "Bill", "Billy", "Binod", "Bjorn", "Blaike", "Blaine", "Blair", "Blaire", "Blake", "Blazej", "Blazey", "Blessing", "Blue", "Blyth", "Bo", "Boab", "Bob", "Bobby", "BobbyLee", "Bodhan", "Boedyn", "Bogdan", "Bohbi", "Bony", "Bowen", "Bowie", "Boyd", "Bracken", "Brad", "Bradan", "Braden", "Bradley", "Bradlie", "Bradly", "Brady", "Bradyn", "Braeden", "Braiden", "Brajan", "Brandan", "Branden", "Brandon", "Brandonlee", "BrandonLee", "Brandyn", "Brannan", "Brayden", "Braydon", "Braydyn", "Breandan", "Brehme", "Brendan", "Brendon", "Brendyn", "Breogan", "Bret", "Brett", "Briaddon", "Brian", "Brodi", "Brodie", "Brody", "Brogan", "Broghan", "Brooke", "Brooklin", "Brooklyn", "Bruce", "Bruin", "Bruno", "Brunon", "Bryan", "Bryce", "Bryden", "Brydon", "BrydonCraig", "Bryn", "Brynmor", "Bryson", "Buddy", "Bully", "Burak", "Burhan", "Butali", "Butchi", "Byron", "Cabhan", "Cadan", "Cade", "Caden", "Cadon", "Cadyn", "Caedan", "Caedyn", "Cael", "Caelan", "Caelen", "Caethan", "Cahl", "Cahlum", "Cai", "Caidan", "Caiden", "CaidenPaul", "Caidyn", "Caie", "Cailaen", "Cailean", "CailebJohn", "Cailin", "Cain", "Caine", "Cairn", "Cal", "Calan", "Calder", "Cale", "Calean", "Caleb", "Calen", "Caley", "Calib", "Calin", "Callahan", "Callan", "CallanAdam", "Calley", "Callie", "Callin", "Callum", "Callun", "Callyn", "Calum", "CalumJames", "Calvin", "Cambell", "Camerin", "Cameron", "Campbel", "Campbell", "Camron", "Caolain", "Caolan", "Carl", "Carlo", "Carlos", "Carrich", "Carrick", "Carson", "Carter", "Carwyn", "Casey", "Casper", "Cassy", "Cathal", "Cator", "Cavan", "Cayden", "CaydenRobert", "CaydenTiamo", "Ceejay", "Ceilan", "Ceiran", "Ceirin", "Ceiron", "Cejay", "Celik", "Cephas", "Cesar", "Cesare", "Chad", "Chaitanya", "ChangHa", "Charles", "Charley", "Charlie", "Charly", "Chase", "Che", "Chester", "Chevy", "Chi", "Chibudom", "Chidera", "Chimsom", "Chin", "Chintu", "Chiqal", "Chiron", "Chris", "ChrisDaniel", "Chrismedi", "Christian", "Christie", "Christoph", "Christopher", "ChristopherLee", "Christy", "Chu", "Chukwuemeka", "Cian", "Ciann", "Ciar", "Ciaran", "Ciarian", "Cieran", "Cillian", "Cillin", "Cinar", "CJ", "CJay", "Clark", "Clarke", "Clayton", "Clement", "Clifford", "Clyde", "Cobain", "Coban", "Coben", "Cobi", "Cobie", "Coby", "Codey", "Codi", "Codie", "Cody", "CodyLee", "Coel", "Cohan", "Cohen", "Colby", "Cole", "Colin", "Coll", "Colm", "Colt", "Colton", "Colum", "Colvin", "Comghan", "Conal", "Conall", "Conan", "Conar", "Conghaile", "Conlan", "Conley", "Conli", "Conlin", "Conlly", "Conlon", "Conlyn", "Connal", "Connall", "Connan", "Connar", "Connel", "Connell", "Conner", "Connolly", "Connor", "ConnorDavid", "Conor", "Conrad", "Cooper", "Copeland", "Coray", "Corben", "Corbin", "Corey", "CoreyJames", "CoreyJay", "Cori", "Corie", "Corin", "Cormac", "Cormack", "Cormak", "Corran", "Corrie", "Cory", "Cosmo", "Coupar", "Craig", "CraigJames", "Crawford", "Creag", "Crispin", "Cristian", "Crombie", "Cruiz", "Cruz", "Cuillin", "Cullen", "Cullin", "Curtis", "Cyrus", "Daanyaal", "Daegan", "Daegyu", "Dafydd", "Dagon", "Dailey", "Daimhin", "Daithi", "Dakota", "Daksh", "Dale", "Dalong", "Dalton", "Damian", "Damien", "Damon", "Dan", "Danar", "Dane", "Danial", "Daniel", "Daniele", "DanielJames", "Daniels", "Daniil", "Danish", "Daniyal", "Danniel", "Danny", "Dante", "Danyal", "Danyil", "Danys", "Daood", "Dara", "Darach", "Daragh", "Darcy", "Darcy", "Dareh", "Daren", "Darien", "Darius", "Darl", "Darn", "Darrach", "Darragh", "Darrel", "Darrell", "Darren", "Darrie", "Darrius", "Darroch", "Darryl", "Darryn", "Darwyn", "Daryl", "Daryn", "Daud", "Daumantas", "Davi", "David", "DavidJay", "DavidLee", "Davie", "Davis", "Davy", "Dawid", "Dawson", "Dawud", "Dayem", "Daymian", "Deacon", "Deagan", "Dean", "Deano", "Decklan", "Declain", "Declan", "Declyan", "Declyn", "Dedeniseoluwa", "Deecan", "Deegan", "Deelan", "DeklainJaimes", "Del", "Demetrius", "Denis", "Deniss", "Dennan", "Dennin", "Dennis", "Denny", "Dennys", "Denon", "Denton", "Denver", "Denzel", "Deon", "Derek", "Derick", "Derin", "Dermot", "Derren", "Derrie", "Derrin", "Derron", "Derry", "Derryn", "Deryn", "Deshawn", "Desmond", "Dev", "Devan", "Devin", "Devlin", "Devlyn", "Devon", "Devrin", "Devyn", "Dex", "Dexter", "Dhani", "Dharam", "Dhavid", "Dhyia", "Diarmaid", "Diarmid", "Diarmuid", "Didier", "Diego", "Diesel", "Diesil", "Digby", "Dilan", "Dilano", "Dillan", "Dillon", "Dilraj", "Dimitri", "Dinaras", "Dion", "Dissanayake", "Dmitri", "Doire", "Dolan", "Domanic", "Domenico", "Domhnall", "Dominic", "Dominick", "Dominik", "Donald", "Donnacha", "Donnie", "Dorian", "Dougal", "Douglas", "Dougray", "Drakeo", "Dre", "Dregan", "Drew", "Dugald", "Duncan", "Duriel", "Dustin", "Dylan", "DylanJack", "DylanJames", "DylanJohn", "DylanPatrick", "Dylin", "Dyllan", "DyllanJames", "Dyllon", "Eadie", "Eagann", "Eamon", "Eamonn", "Eason", "Eassan", "Easton", "Ebow", "Ed", "Eddie", "Eden", "Ediomi", "Edison", "Eduardo", "Eduards", "Edward", "Edwin", "Edwyn", "Eesa", "Efan", "Efe", "Ege", "Ehsan", "Ehsen", "Eiddon", "Eidhan", "Eihli", "Eimantas", "Eisa", "Eli", "Elias", "Elijah", "Eliot", "Elisau", "Eljay", "Eljon", "Elliot", "Elliott", "Ellis", "Ellisandro", "Elshan", "Elvin", "Elyan", "Emanuel", "Emerson", "Emil", "Emile", "Emir", "Emlyn", "Emmanuel", "Emmet", "Eng", "Eniola", "Enis", "Ennis", "Enrico", "Enrique", "Enzo", "Eoghain", "Eoghan", "Eoin", "Eonan", "Erdehan", "Eren", "Erencem", "Eric", "Ericlee", "Erik", "Eriz", "ErnieJacks", "Eroni", "Eryk", "Eshan", "Essa", "Esteban", "Ethan", "Etienne", "Etinosa", "Euan", "Eugene", "Evan", "Evann", "Ewan", "Ewen", "Ewing", "Exodi", "Ezekiel", "Ezra", "Fabian", "Fahad", "Faheem", "Faisal", "Faizaan", "Famara", "Fares", "Farhaan", "Farhan", "Farren", "Farzad", "Fauzaan", "Favour", "Fawaz", "Fawkes", "Faysal", "Fearghus", "Feden", "Felix", "Fergal", "Fergie", "Fergus", "Ferre", "Fezaan", "Fiachra", "Fikret", "Filip", "Filippo", "Finan", "Findlay", "FindlayJames", "Findlie", "Finlay", "Finley", "Finn", "Finnan", "Finnean", "Finnen", "Finnlay", "Finnley", "Fintan", "Fionn", "Firaaz", "Fletcher", "Flint", "Florin", "Flyn", "Flynn", "Fodeba", "Folarinwa", "Forbes", "Forgan", "Forrest", "Fox", "Francesco", "Francis", "Francisco", "Franciszek", "Franco", "Frank", "Frankie", "Franklin", "Franko", "Fraser", "Frazer", "Fred", "Freddie", "Frederick", "Fruin", "Fyfe", "Fyn", "Fynlay", "Fynn", "Gabriel", "Gallagher", "Gareth", "Garren", "Garrett", "Garry", "Gary", "Gavin", "GavinLee", "Gene", "Geoff", "Geoffrey", "Geomer", "Geordan", "Geordie", "George", "Georgia", "Georgy", "Gerard", "Ghyll", "Giacomo", "Gian", "Giancarlo", "Gianluca", "Gianmarco", "Gideon", "Gil", "Gio", "Girijan", "Girius", "Gjan", "Glascott", "Glen", "Glenn", "Gordon", "Grady", "Graeme", "Graham", "Grahame", "Grant", "Grayson", "Greg", "Gregor", "Gregory", "Greig", "Griffin", "Griffyn", "Grzegorz", "Guang", "Guerin", "Guillaume", "Gurardass", "Gurdeep", "Gursees", "Gurthar", "Gurveer", "Gurwinder", "Gus", "Gustav", "Guthrie", "Guy", "Gytis", "Habeeb", "Hadji", "Hadyn", "Hagun", "Haiden", "Haider", "Hamad", "Hamid", "Hamish", "Hamza", "Hamzah", "Han", "Hansen", "Hao", "Hareem", "Hari", "Harikrishna", "Haris", "Harish", "Harjeevan", "Harjyot", "Harlee", "Harleigh", "Harley", "Harman", "Harnek", "Harold", "Haroon", "Harper", "Harri", "Harrington", "Harris", "Harrison", "Harry", "Harvey", "Harvie", "Harvinder", "Hasan", "Haseeb", "Hashem", "Hashim", "Hassan", "Hassanali", "Hately", "Havila", "Hayden", "Haydn", "Haydon", "Haydyn", "Hcen", "Hector", "Heddle", "Heidar", "Heini", "Hendri", "Henri", "Henry", "Herbert", "Heyden", "Hiro", "Hirvaansh", "Hishaam", "Hogan", "Honey", "Hong", "Hope", "Hopkin", "Hosea", "Howard", "Howie", "Hristomir", "Hubert", "Hugh", "Hugo", "Humza", "Hunter", "Husnain", "Hussain", "Hussan", "Hussnain", "Hussnan", "Hyden", "I", "Iagan", "Iain", "Ian", "Ibraheem", "Ibrahim", "Idahosa", "Idrees", "Idris", "Iestyn", "Ieuan", "Igor", "Ihtisham", "Ijay", "Ikechukwu", "Ikemsinachukwu", "Ilyaas", "Ilyas", "Iman", "Immanuel", "Inan", "Indy", "Ines", "Innes", "Ioannis", "Ireayomide", "Ireoluwa", "Irvin", "Irvine", "Isa", "Isaa", "Isaac", "Isaiah", "Isak", "Isher", "Ishwar", "Isimeli", "Isira", "Ismaeel", "Ismail", "Israel", "Issiaka", "Ivan", "Ivar", "Izaak", "J", "Jaay", "Jac", "Jace", "Jack", "Jacki", "Jackie", "JackJames", "Jackson", "Jacky", "Jacob", "Jacques", "Jad", "Jaden", "Jadon", "Jadyn", "Jae", "Jagat", "Jago", "Jaheim", "Jahid", "Jahy", "Jai", "Jaida", "Jaiden", "Jaidyn", "Jaii", "Jaime", "JaiRajaram", "Jaise", "Jak", "Jake", "Jakey", "Jakob", "Jaksyn", "Jakub", "Jamaal", "Jamal", "Jameel", "Jameil", "James", "JamesPaul", "Jamey", "Jamie", "Jan", "Jaosha", "Jardine", "Jared", "Jarell", "Jarl", "Jarno", "Jarred", "Jarvi", "JaseyJay", "Jasim", "Jaskaran", "Jason", "Jasper", "Jaxon", "Jaxson", "Jay", "Jaydan", "Jayden", "JaydenJames", "JaydenLee", "JaydenPaul", "JaydenThomas", "Jaydn", "Jaydon", "Jaydyn", "Jayhan", "JayJay", "Jayke", "Jaymie", "Jayse", "Jayson", "Jaz", "Jazeb", "Jazib", "Jazz", "Jean", "JeanLewis", "JeanPierre", "Jebadiah", "Jed", "Jedd", "Jedidiah", "Jeemie", "Jeevan", "Jeffrey", "Jensen", "Jenson", "Jensyn", "Jeremy", "Jerome", "Jeronimo", "Jerrick", "Jerry", "Jesse", "Jesuseun", "Jeswin", "Jevan", "Jeyun", "Jez", "Jia", "Jian", "Jiao", "Jimmy", "Jincheng", "JJ", "Joaquin", "Joash", "Jock", "Jody", "Joe", "Joeddy", "Joel", "Joey", "JoeyJack", "Johann", "Johannes", "Johansson", "John", "Johnathan", "Johndean", "Johnjay", "JohnMichael", "Johnnie", "Johnny", "Johnpaul", "JohnPaul", "JohnScott", "Johnson", "Jole", "Jomuel", "Jon", "Jonah", "Jonatan", "Jonathan", "Jonathon", "Jonny", "Jonothan", "JonPaul", "Jonson", "Joojo", "Jordan", "Jordi", "Jordon", "Jordy", "Jordyn", "Jorge", "Joris", "Jorryn", "Josan", "Josef", "Joseph", "Josese", "Josh", "Joshiah", "Joshua", "Josiah", "Joss", "Jostelle", "Joynul", "Juan", "Jubin", "Judah", "Jude", "Jules", "Julian", "Julien", "Jun", "Junior", "Jura", "Justan", "Justin", "Justinas", "Kaan", "Kabeer", "Kabir", "Kacey", "Kacper", "Kade", "Kaden", "Kadin", "Kadyn", "Kaeden", "Kael", "Kaelan", "Kaelin", "Kaelum", "Kai", "Kaid", "Kaidan", "Kaiden", "Kaidinn", "Kaidyn", "Kaileb", "Kailin", "Kain", "Kaine", "Kainin", "Kainui", "Kairn", "Kaison", "Kaiwen", "Kajally", "Kajetan", "Kalani", "Kale", "Kaleb", "Kaleem", "Kalel", "Kalen", "Kalin", "Kallan", "Kallin", "Kalum", "Kalvin", "Kalvyn", "Kameron", "Kames", "Kamil", "Kamran", "Kamron", "Kane", "Karam", "Karamvir", "Karandeep", "Kareem", "Karim", "Karimas", "Karl", "Karol", "Karson", "Karsyn", "Karthikeya", "Kasey", "Kash", "Kashif", "Kasim", "Kasper", "Kasra", "Kavin", "Kayam", "Kaydan", "Kayden", "Kaydin", "Kaydn", "Kaydyn", "Kaydyne", "Kayleb", "Kaylem", "Kaylum", "Kayne", "Kaywan", "Kealan", "Kealon", "Kean", "Keane", "Kearney", "Keatin", "Keaton", "Keavan", "Keayn", "Kedrick", "Keegan", "Keelan", "Keelin", "Keeman", "Keenan", "KeenanLee", "Keeton", "Kehinde", "Keigan", "Keilan", "Keir", "Keiran", "Keiren", "Keiron", "Keiryn", "Keison", "Keith", "Keivlin", "Kelam", "Kelan", "Kellan", "Kellen", "Kelso", "Kelum", "Kelvan", "Kelvin", "Ken", "Kenan", "Kendall", "Kendyn", "Kenlin", "Kenneth", "Kensey", "Kenton", "Kenyon", "Kenzeigh", "Kenzi", "Kenzie", "Kenzo", "Kenzy", "Keo", "Ker", "Kern", "Kerr", "Kevan", "Kevin", "Kevyn", "Kez", "Khai", "Khalan", "Khaleel", "Khaya", "Khevien", "Khizar", "Khizer", "Kia", "Kian", "KianJames", "Kiaran", "Kiarash", "Kie", "Kiefer", "Kiegan", "Kienan", "Kier", "Kieran", "KieranScott", "Kieren", "Kierin", "Kiern", "Kieron", "Kieryn", "Kile", "Killian", "Kimi", "Kingston", "Kinneil", "Kinnon", "Kinsey", "Kiran", "Kirk", "Kirwin", "Kit", "Kiya", "Kiyonari", "Kjae", "Klein", "Klevis", "Kobe", "Kobi", "Koby", "Koddi", "Koden", "Kodi", "Kodie", "Kody", "Kofi", "Kogan", "Kohen", "Kole", "Konan", "Konar", "Konnor", "Konrad", "Koray", "Korben", "Korbyn", "Korey", "Kori", "Korrin", "Kory", "Koushik", "Kris", "Krish", "Krishan", "Kriss", "Kristian", "Kristin", "Kristofer", "Kristoffer", "Kristopher", "Kruz", "Krzysiek", "Krzysztof", "Ksawery", "Ksawier", "Kuba", "Kurt", "Kurtis", "KurtisJae", "Kyaan", "Kyan", "Kyde", "Kyden", "Kye", "Kyel", "Kyhran", "Kyie", "Kylan", "Kylar", "Kyle", "KyleDerek", "Kylian", "Kym", "Kynan", "Kyral", "Kyran", "Kyren", "Kyrillos", "Kyro", "Kyron", "Kyrran", "Lachlainn", "Lachlan", "Lachlann", "Lael", "Lagan", "Laird", "Laison", "Lakshya", "Lance", "Lancelot", "Landon", "Lang", "Lasse", "Latif", "Lauchlan", "Lauchlin", "Laughlan", "Lauren", "Laurence", "Laurie", "Lawlyn", "Lawrence", "Lawrie", "Lawson", "Layne", "Layton", "Lee", "Leigh", "Leigham", "Leighton", "Leilan", "Leiten", "Leithen", "Leland", "Lenin", "Lennan", "Lennen", "Lennex", "Lennon", "Lennox", "Lenny", "Leno", "Lenon", "Lenyn", "Leo", "Leon", "Leonard", "Leonardas", "Leonardo", "Lepeng", "Leroy", "Leven", "Levi", "Levon", "Levy", "Lewie", "Lewin", "Lewis", "Lex", "Leydon", "Leyland", "Leylann", "Leyton", "Liall", "Liam", "LiamStephen", "Limo", "Lincoln", "LincolnJohn", "Lincon", "Linden", "Linton", "Lionel", "Lisandro", "Litrell", "LiyonelaElam", "LLeyton", "Lliam", "Lloyd", "Lloyde", "Loche", "Lochlan", "Lochlann", "LochlanOliver", "Lock", "Lockey", "Logan", "Logann", "LoganRhys", "Loghan", "Lokesh", "Loki", "Lomond", "Lorcan", "Lorenz", "Lorenzo", "Lorne", "Loudon", "Loui", "Louie", "Louis", "Loukas", "Lovell", "Luc", "Luca", "Lucais", "Lucas", "Lucca", "Lucian", "Luciano", "Lucien", "Lucus", "Luic", "Luis", "Luk", "Luka", "Lukas", "Lukasz", "Luke", "Lukmaan", "Luqman", "Lyall", "Lyle", "Lyndsay", "Lysander", "Maanav", "Maaz", "Mac", "Macallum", "Macaulay", "Macauley", "Macaully", "Machlan", "Maciej", "Mack", "Mackenzie", "Mackenzy", "Mackie", "Macsen", "Macy", "Madaki", "Maddison", "Maddox", "Madison", "MadisonJake", "Madox", "Mael", "Magnus", "Mahan", "Mahdi", "Mahmoud", "Maias", "Maison", "Maisum", "Maitlind", "Majid", "Makensie", "Makenzie", "Makin", "Maksim", "Maksymilian", "Malachai", "Malachi", "Malachy", "Malakai", "Malakhy", "Malcolm", "Malik", "Malikye", "Malo", "Mamoon", "Manas", "Maneet", "Manmohan", "Manolo", "Manson", "Mantej", "Manuel", "Manus", "Marc", "MarcAnthony", "Marcel", "Marcello", "Marcin", "Marco", "Marcos", "Marcous", "Marcquis", "Marcus", "Mario", "Marios", "Marius", "Mark", "Marko", "Markus", "Marley", "Marlin", "Marlon", "Maros", "Marshall", "Martin", "Marty", "Martyn", "Marvellous", "Marvin", "Marwan", "Maryk", "Marzuq", "Mashhood", "Mason", "MasonJay", "Masood", "Masson", "Matas", "Matej", "Mateusz", "Mathew", "Mathias", "Mathu", "Mathuyan", "Mati", "Matt", "Matteo", "Matthew", "MatthewWilliam", "Matthias", "Max", "Maxim", "Maximilian", "Maximillian", "Maximus", "Maxwell", "Maxx", "Mayeul", "Mayson", "Mazin", "Mcbride", "McCaulley", "McKade", "McKauley", "McKay", "McKenzie", "McLay", "Meftah", "Mehmet", "Mehraz", "Meko", "Melville", "Meshach", "Meyzhward", "Micah", "Michael", "MichaelAlexander", "MichaelJames", "Michal", "Michat", "Micheal", "Michee", "Mickey", "Miguel", "Mika", "Mikael", "Mikee", "Mikey", "Mikhail", "Mikolaj", "Miles", "Millar", "Miller", "Milo", "Milos", "Milosz", "Mir", "Mirza", "Mitch", "Mitchel", "Mitchell", "Moad", "Moayd", "Mobeen", "Modoulamin", "Modu", "Mohamad", "Mohamed", "Mohammad", "MohammadBilal", "Mohammed", "Mohanad", "Mohd", "Momin", "Momooreoluwa", "Montague", "Montgomery", "Monty", "Moore", "Moosa", "Moray", "Morgan", "Morgyn", "Morris", "Morton", "Moshy", "Motade", "Moyes", "Msughter", "Mueez", "Muhamadjavad", "Muhammad", "Muhammed", "Muhsin", "Muir", "Munachi", "Muneeb", "Mungo", "Munir", "Munmair", "Munro", "Murdo", "Murray", "Murrough", "Murry", "Musa", "Musse", "Mustafa", "Mustapha", "Muzammil", "Muzzammil", "Mykie", "Myles", "Mylo", "Nabeel", "Nadeem", "Nader", "Nagib", "Naif", "Nairn", "Narvic", "Nash", "Nasser", "Nassir", "Natan", "Nate", "Nathan", "Nathanael", "Nathanial", "Nathaniel", "NathanRae", "Nawfal", "Nayan", "Neco", "Neil", "Nelson", "Neo", "Neshawn", "Nevan", "Nevin", "Ngonidzashe", "Nial", "Niall", "Nicholas", "Nick", "Nickhill", "Nicki", "Nickson", "Nicky", "Nico", "Nicodemus", "Nicol", "Nicolae", "Nicolas", "Nidhish", "Nihaal", "Nihal", "Nikash", "Nikhil", "Niki", "Nikita", "Nikodem", "Nikolai", "Nikos", "Nilav", "Niraj", "Niro", "Niven", "Noah", "Noel", "Nolan", "Noor", "Norman", "Norrie", "Nuada", "Nyah", "Oakley", "Oban", "Obieluem", "Obosa", "Odhran", "Odin", "Odynn", "Ogheneochuko", "Ogheneruno", "Ohran", "Oilibhear", "Oisin", "OjimaOjo", "Okeoghene", "Olaf", "OlaOluwa", "Olaoluwapolorimi", "Ole", "Olie", "Oliver", "Olivier", "Oliwier", "Ollie", "Olurotimi", "Oluwadamilare", "Oluwadamiloju", "Oluwafemi", "Oluwafikunayomi", "Oluwalayomi", "Oluwatobiloba", "Oluwatoni", "Omar", "Omri", "Oran", "Orin", "Orlando", "Orley", "Orran", "Orrick", "Orrin", "Orson", "Oryn", "Oscar", "Osesenagha", "Oskar", "Ossian", "Oswald", "Otto", "Owain", "Owais", "Owen", "Owyn", "Oz", "Ozzy", "Pablo", "Pacey", "Padraig", "Paolo", "Pardeepraj", "Parkash", "Parker", "Pascoe", "Pasquale", "Patrick", "PatrickJohn", "Patrikas", "Patryk", "Paul", "Pavit", "Pawel", "Pawlo", "Pearce", "Pearse", "Pearsen", "Pedram", "Pedro", "Peirce", "Peiyan", "Pele", "Peni", "Peregrine", "Peter", "Phani", "Philip", "Philippos", "Phinehas", "Phoenix", "Phoevos", "Pierce", "PierreAntoine", "Pieter", "Pietro", "Piotr", "Porter", "Prabhjoit", "Prabodhan", "Praise", "Pranav", "Pravin", "Precious", "Prentice", "Presley", "Preston", "PrestonJay", "Prinay", "Prince", "Prithvi", "Promise", "Puneetpaul", "Pushkar", "Qasim", "Qirui", "Quinlan", "Quinn", "Radmiras", "Raees", "Raegan", "Rafael", "Rafal", "Rafferty", "Rafi", "Raheem", "Rahil", "Rahim", "Rahman", "Raith", "Raithin", "Raja", "RajabAli", "Rajan", "Ralfs", "Ralph", "Ramanas", "Ramit", "Ramone", "Ramsay", "Ramsey", "Rana", "Ranolph", "Raphael", "Rasmus", "Rasul", "Raul", "Raunaq", "Ravin", "Ray", "Rayaan", "Rayan", "Rayane", "Rayden", "Rayhan", "Raymond", "Rayne", "Rayyan", "Raza", "Reace", "Reagan", "Reean", "Reece", "Reed", "Reegan", "Rees", "Reese", "Reeve", "Regan", "Regean", "Reggie", "Rehaan", "Rehan", "Reice", "Reid", "Reigan", "Reilly", "Reily", "Reis", "Reiss", "Remigiusz", "Remo", "Remy", "Ren", "Renars", "Reng", "Rennie", "Reno", "Reo", "Reuben", "Rexford", "Reynold", "Rhein", "Rheo", "Rhett", "Rheyden", "Rhian", "Rhoan", "Rholmark", "Rhoridh", "Rhuairidh", "Rhuan", "Rhuaridh", "Rhudi", "Rhy", "Rhyan", "Rhyley", "Rhyon", "Rhys", "RhysBernard", "Rhyse", "Riach", "Rian", "Ricards", "Riccardo", "Ricco", "Rice", "Richard", "Richey", "Richie", "Ricky", "Rico", "Ridley", "Ridwan", "Rihab", "Rihan", "Rihards", "Rihonn", "Rikki", "Riley", "Rio", "Rioden", "Rishi", "Ritchie", "Rivan", "Riyadh", "Riyaj", "Roan", "Roark", "Roary", "Rob", "Robbi", "Robbie", "Robbielee", "Robby", "Robert", "RobertGordon", "Robertjohn", "Robi", "Robin", "Rocco", "Roddy", "Roderick", "Rodrigo", "Roen", "Rogan", "Roger", "Rohaan", "Rohan", "Rohin", "Rohit", "Rokas", "Roman", "Ronald", "Ronan", "RonanBenedict", "Ronin", "Ronnie", "Rooke", "Roray", "Rori", "Rorie", "Rory", "Roshan", "Ross", "RossAndrew", "Rossi", "Rowan", "Rowen", "Roy", "Ruadhan", "Ruaidhri", "Ruairi", "Ruairidh", "Ruan", "Ruaraidh", "Ruari", "Ruaridh", "Ruben", "Rubhan", "Rubin", "Rubyn", "Rudi", "Rudy", "Rufus", "Rui", "Ruo", "Rupert", "Ruslan", "Russel", "Russell", "Ryaan", "Ryan", "RyanLee", "Ryden", "Ryder", "Ryese", "Ryhs", "Rylan", "Rylay", "Rylee", "Ryleigh", "Ryley", "Rylie", "Ryo", "Ryszard", "Saad", "Sabeen", "Sachkirat", "Saffi", "Saghun", "Sahaib", "Sahbian", "Sahil", "Saif", "Saifaddine", "Saim", "Sajid", "Sajjad", "Salahudin", "Salman", "Salter", "Salvador", "Sam", "Saman", "Samar", "Samarjit", "Samatar", "Sambrid", "Sameer", "Sami", "Samir", "SamiUllah", "Samual", "Samuel", "Samuela", "Samy", "Sanaullah", "Sandro", "Sandy", "Sanfur", "Sanjay", "Santiago", "Santino", "Satveer", "Saul", "Saunders", "Savin", "Sayad", "Sayeed", "Sayf", "Scot", "Scott", "ScottAlexander", "Seaan", "Seamas", "Seamus", "Sean", "Seane", "SeanJames", "SeanPaul", "SeanRay", "Seb", "Sebastian", "Sebastien", "Selasi", "Seonaidh", "Sephiroth", "Sergei", "Sergio", "Seth", "Sethu", "Seumas", "Shaarvin", "Shadow", "Shae", "Shahmir", "Shai", "Shane", "Shannon", "Sharland", "Sharoz", "Shaughn", "Shaun", "Shaunpaul", "ShaunPaul", "ShaunThomas", "Shaurya", "Shaw", "Shawn", "Shawnpaul", "Shay", "Shayaan", "Shayan", "Shaye", "Shayne", "Shazil", "Shea", "Sheafan", "Sheigh", "Shenuk", "Sher", "Shergo", "Sheriff", "Sherwyn", "Shiloh", "Shiraz", "Shreeram", "Shreyas", "Shyam", "Siddhant", "Siddharth", "Sidharth", "Sidney", "Siergiej", "Silas", "Simon", "Sinai", "Skye", "Sofian", "Sohaib", "Sohail", "Soham", "Sohan", "Sol", "Solomon", "Sonneey", "Sonni", "Sonny", "Sorley", "Soul", "Spencer", "Spondon", "Stanislaw", "Stanley", "Stefan", "Stefano", "Stefin", "Stephen", "Stephenjunior", "Steve", "Steven", "Stevenlee", "Stevie", "Stewart", "Stewarty", "Strachan", "Struan", "Stuart", "Su", "Subhaan", "Sudais", "Suheyb", "Suilven", "Sukhi", "Sukhpal", "Sukhvir", "Sulayman", "Sullivan", "Sultan", "Sung", "Sunny", "Suraj", "Surien", "Sweyn", "Syed", "Sylvain", "Symon", "Szymon", "Tadd", "Taddy", "Tadhg", "Taegan", "Taegen", "Tai", "Tait", "Taiwo", "Talha", "Taliesin", "Talon", "Talorcan", "Tamar", "Tamiem", "Tammam", "Tanay", "Tane", "Tanner", "Tanvir", "Tanzeel", "Taonga", "Tarik", "TariqJay", "Tate", "Taylan", "Taylar", "Tayler", "Taylor", "TaylorJay", "TaylorLee", "Tayo", "Tayyab", "Tayye", "Tayyib", "Teagan", "Tee", "Teejay", "Teejay", "Tegan", "Teighen", "Teiyib", "TeJay", "Temba", "Teo", "Teodor", "Teos", "Terry", "Teydren", "Theo", "Theodore", "Thiago", "Thierry", "Thom", "Thomas", "ThomasJay", "Thomson", "Thorben", "Thorfinn", "Thrinei", "Thumbiko", "Tiago", "Tian", "Tiarnan", "Tibet", "Tieran", "Tiernan", "Timothy", "Timucin", "Tiree", "Tisloh", "Titi", "Titus", "Tiylar", "TJ", "Tjay", "TJay", "Tobey", "Tobi", "Tobias", "Tobie", "Toby", "Todd", "Tokinaga", "Toluwalase", "Tom", "Tomas", "Tomasz", "TommiLee", "Tommy", "Tomson", "Tony", "Torin", "Torquil", "Torran", "Torrin", "Torsten", "Trafford", "Trai", "Travis", "Tre", "Trent", "Trey", "Tristain", "Tristan", "Troy", "Tubagus", "Turki", "Turner", "Ty", "TyAlexander", "Tye", "Tyelor", "Tylar", "Tyler", "TylerJames", "TylerJay", "Tyllor", "Tylor", "Tymom", "Tymon", "Tymoteusz", "Tyra", "Tyree", "Tyrnan", "Tyrone", "Tyson", "Ubaid", "Ubayd", "Uchenna", "Uilleam", "Umair", "Umar", "Umer", "Umut", "Urban", "Uri", "Usman", "Uzair", "Uzayr", "Valen", "Valentin", "Valentino", "Valery", "Valo", "Vasyl", "Vedantsinh", "Veeran", "Victor", "Victory", "Vinay", "Vince", "Vincent", "Vincenzo", "Vinh", "Vinnie", "Vithujan", "Vladimir", "Vladislav", "Vrishin", "Vuyolwethu", "Wabuya", "Wai", "Walid", "Wallace", "Walter", "Waqaas", "Warkhas", "Warren", "Warrick", "Wasif", "Wayde", "Wayne", "Wei", "Wen", "Wesley", "WesleyScott", "Wiktor", "Wilkie", "Will", "William", "WilliamJohn", "Willum", "Wilson", "Windsor", "Wojciech", "Woyenbrakemi", "Wyatt", "Wylie", "Wynn", "Xabier", "Xander", "Xavier", "Xiao", "Xida", "Xin", "Xue", "Yadgor", "Yago", "Yahya", "Yakup", "Yang", "Yanick", "Yann", "Yannick", "Yaseen", "Yasin", "Yasir", "Yassin", "Yoji", "Yong", "Yoolgeun", "Yorgos", "Youcef", "Yousif", "Youssef", "Yu", "Yuanyu", "Yuri", "Yusef", "Yusuf", "Yves", "Zaaine", "Zaak", "Zac", "Zach", "Zachariah", "Zacharias", "Zacharie", "Zacharius", "Zachariya", "Zachary", "ZacharyMarc", "Zachery", "Zack", "Zackary", "Zaid", "Zain", "Zaine", "Zaineddine", "Zainedin", "Zak", "Zakaria", "Zakariya", "Zakary", "Zaki", "Zakir", "Zakk", "Zamaar", "Zander", "Zane", "Zarran", "Zayd", "Zayn", "Zayne", "Ze", "Zechariah", "Zeek", "Zeeshan", "Zeid", "Zein", "Zen", "Zendel", "Zenith", "Zennon", "Zeph", "Zerah", "Zhen", "Zhi", "Zhong", "Zhuo", "Zi", "Zidane", "Zijie", "Zinedine", "Zion", "Zishan", "Ziya", "Ziyaan", "Zohaib", "Zohair", "Zoubaeir", "Zubair", "Zubayr", "Zuriel"];
            let handle = names[parseInt(Math.random() * names.length)].toLowerCase();
            console.log('handle', handle);
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
            const x = await (await contract.createProfile(inputStruct)).wait();
            console.log(x);
            console.log('get profileID');
            const profileId = (await contract.getProfileIdByHandle(handle)).toNumber();
            console.log(profileId);

            await (await currency.mint(userAddress, ethers.utils.parseEther('100'))).wait();

            await (await contract.setDefaultProfile(profileId)).wait();
            defaultProfile = (await contract.defaultProfile(userAddress)).toNumber();
            console.log('prof', defaultProfile);
        }
        return defaultProfile;
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <Grid container direction={'column'} xs={12} spacing={1} style={{padding: '16px'}}>
                {isJoinMeeting ? (
                    <Grid container direction={'column'} spacing={2}>
                        <Grid item xs={4} style={{marginBottom: '16px'}}>
                            <Typography variant="h5"></Typography>
                        </Grid>
                        {joinMeetingPub !== undefined ? (
                            <>
                                <Grid item xs={4} style={{marginBottom: '16px'}}>
                                    <Typography variant="h4">{joinMeetingPub.meetingName}</Typography>
                                </Grid>
                                <Grid item xs={4}>
                                    <Typography variant="h6"
                                                style={{whiteSpace: 'pre-line'}}>{joinMeetingPub.meetingInformation}</Typography>
                                </Grid>
                                <Grid item xs={4}>
                                    <Typography variant="h6">
                                        Staking amount:{' '}
                                        {ethers.utils.formatEther(joinMeetingPub.stakingAmount)}{' '}
                                        MATIC
                                    </Typography>
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
                                        <>
                                            <Typography variant="h5">You are checked in!</Typography>
                                            <Button
                                                style={{marginTop: '128px'}}
                                                onClick={async () => {
                                                    const {primetimeContract, currency} = web3state;

                                                    const participants = await primetimeContract.getParticipants(
                                                        urlParams.profileId,
                                                        urlParams.publicationId
                                                    );
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
                                                            await currency.balanceOf(Addresses['primetime collect module'])
                                                        )
                                                    );
                                                    //console.log(await (await primetimeContract.distributeStake(2, 1)).wait());
                                                    console.log(await (await primetimeContract.maybeDistribute()).wait());
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
                                                Distribute stakes
                                            </Button>
                                        </>
                                    ) : (
                                        joinMeetingPub.isRegistered ? (
                                            <>
                                                <Typography variant="h5">You are registered!</Typography>
                                                <Button
                                                    variant="contained"
                                                    style={{marginTop: '16px'}}
                                                    disabled={isLoadingCheckinMeeting === true || (joinMeetingPub.meetingTime - 5 * 60 >= (new Date().getTime() / 1000))}
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
                                            <>
                                                <Button
                                                    variant="contained"
                                                    style={{marginTop: '16px'}}
                                                    disabled={isLoadingJoinMeeting === true}
                                                    onClick={async () => {
                                                        setIsLoadingJoinMeeting(true);
                                                        setJoinMeetingLoadingState('Join meeting...')
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
                                                            ethers.utils.formatEther(
                                                                await currency.balanceOf(userAddress)
                                                            )
                                                        );

                                                        console.log(
                                                            'prime balance: ',
                                                            ethers.utils.formatEther(
                                                                await currency.balanceOf(
                                                                    Addresses[
                                                                        'primetime collect module'
                                                                        ]
                                                                )
                                                            )
                                                        );
                                                        console.log('Collect');
                                                        const x = await (
                                                            await contract.collect(
                                                                urlParams.profileId,
                                                                urlParams.publicationId,
                                                                []
                                                            )
                                                        ).wait();
                                                        console.log(x);
                                                        console.log(
                                                            'prime balance: ',
                                                            ethers.utils.formatEther(
                                                                await currency.balanceOf(
                                                                    Addresses[
                                                                        'primetime collect module'
                                                                        ]
                                                                )
                                                            )
                                                        );

                                                        console.log('Pub:');
                                                        console.log(
                                                            await contract.getPub(
                                                                urlParams.profileId,
                                                                urlParams.publicationId
                                                            )
                                                        );

                                                        const participants =
                                                            await primetimeContract.getParticipants(
                                                                urlParams.profileId,
                                                                urlParams.publicationId
                                                            );
                                                        console.log('participants');
                                                        console.log(participants);
                                                        for (let i = 0; i < participants.length; i++) {
                                                            const p = participants[i];
                                                            console.log(p);
                                                            console.log(
                                                                'balance ',
                                                                p,
                                                                ' ',
                                                                ethers.utils.formatEther(
                                                                    await currency.balanceOf(p)
                                                                )
                                                            );
                                                        }
                                                        setIsLoadingJoinMeeting(false);
                                                        setJoinMeetingLoadingState('');
                                                    }}
                                                >
                                                    Join meeting
                                                </Button>
                                                {joinMeetingLoadingState !== '' ? (
                                                    <Grid
                                                        container
                                                        direction={'row'}
                                                        alignItems="center"
                                                    >
                                                        <Grid
                                                            item
                                                            style={{
                                                                visibility:
                                                                    joinMeetingLoadingState === ''
                                                                        ? 'hidden'
                                                                        : 'visible',
                                                                display: 'flex',
                                                                fontSize: 15,
                                                            }}
                                                        >
                                                            <BallTriangle
                                                                height="40"
                                                                width="40"
                                                                color="grey"
                                                                ariaLabel="loading-indicator"
                                                            />
                                                        </Grid>
                                                        <Grid item>
                                                            <Typography
                                                                variant="h6"
                                                                style={{fontWeight: 'bold'}}
                                                            >
                                                                {joinMeetingLoadingState}{' '}
                                                            </Typography>
                                                        </Grid>
                                                    </Grid>
                                                ) : (
                                                    <></>
                                                )}
                                            </>
                                        ))}
                                </Grid>
                            </>
                        ) : (
                            <>
                                {loadingState !== '' ? (
                                    <Grid container direction={'row'} alignItems="center">
                                        <Grid
                                            item
                                            style={{
                                                visibility:
                                                    loadingState === '' ? 'hidden' : 'visible',
                                                display: 'flex',
                                                fontSize: 15,
                                            }}
                                        >
                                            <BallTriangle
                                                height="40"
                                                width="40"
                                                color="grey"
                                                ariaLabel="loading-indicator"
                                            />
                                        </Grid>
                                        <Grid item>
                                            <Typography variant="h6" style={{fontWeight: 'bold'}}>
                                                {loadingState}{' '}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                ) : (
                                    <></>
                                )}
                            </>
                        )}
                    </Grid>
                ) : isMeetingCheckIn ? (
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
                                                setLoadingState('Creating meeting...');
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

                                                const defaultProfile = await getDefaultProfile(
                                                    web3state
                                                );

                                                // create publication
                                                const meetingTime =
                                                    new Date(
                                                        event.target.meetingTime.value
                                                    ).getTime() / 1000;
                                                const contentURI = `https://ipfs.io${ipfsurl}`;
                                                const stakingAmount = ethers.utils.parseEther(
                                                    event.target.stakingAmount.value
                                                );
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

                                                const origin = window.location.origin;
                                                const url = `${origin}?action=meeting&profileId=${profileId}&publicationId=${pubId}`;
                                                setMeetingLink(url);
                                                setLoadingState('');
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
                                                            endAdornment: (
                                                                <InputAdornment position="end">
                                                                    MATIC
                                                                </InputAdornment>
                                                            ),
                                                        }}
                                                        inputProps={{
                                                            min: '0.0001',
                                                            step: '0.0001',
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
                                                            endAdornment: (
                                                                <InputAdornment position="end">
                                                                    min
                                                                </InputAdornment>
                                                            ),
                                                        }}
                                                        inputProps={{
                                                            min: '1',
                                                            step: '1',
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
                                                        defaultValue={
                                                            'ETHGlobal finalist presentation'
                                                        }
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
                                                        defaultValue={
                                                            'A stitch in time saves nine!\nhttps://meet.google.com/aqo-mwbq-mot'
                                                        }
                                                        placeholder="Meeting information"
                                                    />
                                                </Grid>
                                                <Grid item>
                                                    <Button
                                                        style={{marginTop: '16px'}}
                                                        variant="contained"
                                                        type="submit"
                                                        className="cta-button submit-gif-button"
                                                        disabled={loadingState !== ''}
                                                    >
                                                        Create meeting
                                                    </Button>
                                                </Grid>
                                                {loadingState !== '' ? (
                                                    <Grid
                                                        container
                                                        direction={'row'}
                                                        alignItems="center"
                                                    >
                                                        <Grid
                                                            item
                                                            style={{
                                                                visibility:
                                                                    loadingState === ''
                                                                        ? 'hidden'
                                                                        : 'visible',
                                                                display: 'flex',
                                                                fontSize: 15,
                                                            }}
                                                        >
                                                            <BallTriangle
                                                                height="40"
                                                                width="40"
                                                                color="grey"
                                                                ariaLabel="loading-indicator"
                                                            />
                                                        </Grid>
                                                        <Grid item>
                                                            <Typography
                                                                variant="h6"
                                                                style={{fontWeight: 'bold'}}
                                                            >
                                                                {loadingState}{' '}
                                                            </Typography>
                                                        </Grid>
                                                    </Grid>
                                                ) : (
                                                    <></>
                                                )}
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
            </Grid>
        </ThemeProvider>
    );
}

export default App;
