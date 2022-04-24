// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.10;

import {ICollectModule} from '../../../interfaces/ICollectModule.sol';
import {Errors} from '../../../libraries/Errors.sol';
import {FeeModuleBase} from '../FeeModuleBase.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {FollowValidationModuleBase} from '../FollowValidationModuleBase.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import "hardhat/console.sol";

/**
 * @notice A struct containing the necessary data to execute collect actions on a publication.
 *
 * @param amount The collecting cost associated with this publication.
 * @param currency The currency associated with this publication.
 * @param recipient The recipient address associated with this publication.
 * @param referralFee The referral fee associated with this publication.
 * @param followerOnly Whether only followers should be able to collect.
 */
    struct CustomProfilePublicationData {
        uint256 stakingAmount;
        uint256 meetingTime;
        uint256 maxLateTime;
        uint256 pubId;
        uint256 profileId;
        string contentURI;
        string meetingName;
        address currency;
        address[] participants;
        //mapping(address => uint256) checkinTime;
        bool hasBeenDistributed;
    }

    struct MeetingID {
        uint256 profileId;
        uint256 pubId;
    }

/**
 * @title FeeCollectModule
 * @author Lens Protocol
 *
 * @notice This is a simple Lens CollectModule implementation, inheriting from the ICollectModule interface and
 * the FeeCollectModuleBase abstract contract.
 *
 * This module works by allowing unlimited collects for a publication at a given price.
 */
contract PrimetimeCollectModule is FeeModuleBase, FollowValidationModuleBase, ICollectModule {
    using SafeERC20 for IERC20;

    mapping(uint256 => mapping(uint256 => CustomProfilePublicationData)) internal _dataByPublicationByProfile;
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) internal _checkinTime;
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) internal _rewards;

    mapping(uint256 => MeetingID) meetings;
    uint256 meetingCounter;

    constructor(address hub, address moduleGlobals) FeeModuleBase(moduleGlobals) ModuleBase(hub) {}

    /**
     * @notice This collect module levies a fee on collects and supports referrals. Thus, we need to decode data.
     *
     * @param profileId The token ID of the profile of the publisher, passed by the hub.
     * @param pubId The publication ID of the newly created publication, passed by the hub.
     * @param data The arbitrary data parameter, decoded into:
     *      uint256 amount: The currency total amount to levy.
     *      address currency: The currency address, must be internally whitelisted.
     *      address recipient: The custom recipient address to direct earnings to.
     *      uint16 referralFee: The referral fee to set.
     *      bool followerOnly: Whether only followers should be able to collect.
     *
     * @return bytes An abi encoded bytes parameter, which is the same as the passed data parameter.
     */
    function initializePublicationCollectModule(
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external override onlyHub returns (bytes memory) {
        (uint256 stakingAmount,
        address currency,
        uint256 meetingTime,
        uint256 maxLateTime,
        string memory contentURI,
        string memory meetingName
        ) = abi.decode(data, (uint256, address, uint256, uint256, string, string));
        if (!_currencyWhitelisted(currency) || stakingAmount == 0) revert Errors.InitParamsInvalid();

        _dataByPublicationByProfile[profileId][pubId].stakingAmount = stakingAmount;
        _dataByPublicationByProfile[profileId][pubId].currency = currency;
        _dataByPublicationByProfile[profileId][pubId].meetingTime = meetingTime;
        //_dataByPublicationByProfile[profileId][pubId].meetingTime = 1000000;
        _dataByPublicationByProfile[profileId][pubId].maxLateTime = maxLateTime;
        //_dataByPublicationByProfile[profileId][pubId].maxLateTime = 1000;
        _dataByPublicationByProfile[profileId][pubId].contentURI = contentURI;
        _dataByPublicationByProfile[profileId][pubId].meetingName = meetingName;

        meetings[meetingCounter] = MeetingID(profileId, pubId);
        meetingCounter += 1;

        return data;
    }

    /**
     * @dev Processes a collect by:
     *  1. Ensuring the collector is a follower
     *  2. Charging a fee
     */
    function processCollect(
        uint256 referrerProfileId,
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external virtual override onlyHub {
        _processCollect(collector, profileId, pubId, data);
    }

    /**
     * @notice Returns the publication data for a given publication, or an empty struct if that publication was not
     * initialized with this module.
     *
     * @param profileId The token ID of the profile mapped to the publication to query.
     * @param pubId The publication ID of the publication to query.
     *
     * @return CustomProfilePublicationData The CustomProfilePublicationData struct mapped to that publication.
     */
    function getPublicationData(uint256 profileId, uint256 pubId)
    external
    view
    returns (CustomProfilePublicationData memory)
    {
        return _dataByPublicationByProfile[profileId][pubId];
    }

    function _processCollect(
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) internal {
        // staking happens here
        // transfer stakingAmount to treasury
        uint256 stakingAmount = _dataByPublicationByProfile[profileId][pubId].stakingAmount;
        address currency = _dataByPublicationByProfile[profileId][pubId].currency;
        //_validateDataIsExpected(data, currency, amount);

        //(address treasury, uint16 treasuryFee) = _treasuryData();
        //address recipient = _dataByPublicationByProfile[profileId][pubId].recipient;
        //uint256 treasuryAmount = (amount * treasuryFee) / BPS_MAX;
        //uint256 adjustedAmount = amount - treasuryAmount;

        //IERC20(currency).safeTransferFrom(collector, recipient, adjustedAmount);
        //if (treasuryAmount > 0)
        IERC20(currency).safeTransferFrom(collector, address(this), stakingAmount);
        _dataByPublicationByProfile[profileId][pubId].participants.push(collector);
    }

    function checkin(
        uint256 profileId,
        uint256 pubId
    ) external {
        /*
        console.log('nParticipatns', _dataByPublicationByProfile[profileId][pubId].participants.length);
        if (_dataByPublicationByProfile[profileId][pubId].participants.length > 1) {
            _checkinTime[profileId][pubId][msg.sender] = 1000500;
        } else {
            _checkinTime[profileId][pubId][msg.sender] = 1000000;
        }
        */
        console.log('checkintime', uint256(_checkinTime[profileId][pubId][msg.sender]));
        int256 timeSinceMeetingStart = int256(block.timestamp) - int256(_dataByPublicationByProfile[profileId][pubId].meetingTime);
        if (timeSinceMeetingStart >= - 5 minutes) {
            _checkinTime[profileId][pubId][msg.sender] = block.timestamp;
        }
    }

    function getParticipants(
        uint256 profileId,
        uint256 pubId
    ) external view returns (address[] memory) {
        return _dataByPublicationByProfile[profileId][pubId].participants;
    }

    function distributeStake(
        uint256 profileId,
        uint256 pubId
    ) internal {
        CustomProfilePublicationData memory meeting = _dataByPublicationByProfile[profileId][pubId];
        if (block.timestamp >= meeting.meetingTime + meeting.maxLateTime && !meeting.hasBeenDistributed) {
        //if (!meeting.hasBeenDistributed) {
            uint256 stakedAmount = meeting.stakingAmount;
            uint256 treasuryAmount = 0;//stakedAmount / 100;
            int256 adjustedAmount = int256(stakedAmount - treasuryAmount);

            int256 totalLateTime = 0;
            for (uint256 i = 0; i < meeting.participants.length; i++) {
                console.log('checkintime', i, uint256(_checkinTime[profileId][pubId][meeting.participants[i]]));
                console.log('meetingTime', uint256(meeting.meetingTime));
                int256 lateTime = int256(_checkinTime[profileId][pubId][meeting.participants[i]]) - int256(meeting.meetingTime);
                if (_checkinTime[profileId][pubId][meeting.participants[i]] == 0) {
                    lateTime = int256(meeting.maxLateTime);
                }
                if (lateTime < 0) {
                    lateTime = 0;
                }
                totalLateTime += lateTime;
            }
            console.log('totalLateTime', uint256(totalLateTime));

            for (uint256 i = 0; i < meeting.participants.length; i++) {
                int256 reward = adjustedAmount;
                if (totalLateTime > 0 && meeting.participants.length > 1) {
                    int256 lateTime = int256(_checkinTime[profileId][pubId][meeting.participants[i]]) - int256(meeting.meetingTime);
                    if (_checkinTime[profileId][pubId][meeting.participants[i]] == 0) {
                        lateTime = int256(meeting.maxLateTime);
                    }
                    if (lateTime < 0) {
                        lateTime = 0;
                    }
                    console.log('lateTime', i, uint256(lateTime));

                    reward = adjustedAmount - adjustedAmount * lateTime / int256(meeting.maxLateTime) * int256(meeting.participants.length) / int256(meeting.participants.length - 1);
                    console.log('prereward', i, uint256(reward));
                    reward += adjustedAmount * totalLateTime / int256(meeting.maxLateTime) / int256(meeting.participants.length - 1);
                }
                console.log('reward', meeting.participants[i], uint256(reward));
                _rewards[profileId][pubId][meeting.participants[i]] = uint256(reward);
                if (reward > 0) {
                    console.log('reward', i, uint256(reward));
                    IERC20(meeting.currency).safeTransfer(meeting.participants[i], uint256(reward));
                    //(bool sent, bytes memory data) = payable(meeting.participants[i]).call{value : uint256(reward)}("");
                }
            }

            _dataByPublicationByProfile[profileId][pubId].hasBeenDistributed = true;
        }
    }

    function maybeDistribute() external {
        for (uint256 i = 0; i < meetingCounter; i++) {
            distributeStake(meetings[i].profileId, meetings[i].pubId);
        }
    }

    function getCheckinTime(
        uint256 profileId,
        uint256 pubId,
        address participant
    ) external view returns (uint256) {
        return _checkinTime[profileId][pubId][participant];
    }

    function getAllRewards(
        uint256 profileId,
        uint256 pubId
    ) public view returns (uint256[] memory) {
        uint256[] memory arr = new uint256[](_dataByPublicationByProfile[profileId][pubId].participants.length);
        for (uint256 i = 0; i < _dataByPublicationByProfile[profileId][pubId].participants.length; i++) {
            console.log(_dataByPublicationByProfile[profileId][pubId].participants[i], _rewards[profileId][pubId][_dataByPublicationByProfile[profileId][pubId].participants[i]]);
            arr[i] = _rewards[profileId][pubId][_dataByPublicationByProfile[profileId][pubId].participants[i]];
        }
        return arr;
    }


    function getReward(
        uint256 profileId,
        uint256 pubId,
        address participant
    ) external view returns (uint256) {
        console.log(participant);
        return _rewards[profileId][pubId][participant];
    }

    function getAllPublications() public view returns (CustomProfilePublicationData[] memory) {
        console.log("getAllPublications called123");
        CustomProfilePublicationData[] memory arr = new CustomProfilePublicationData[](meetingCounter);
        for (uint256 i = 0; i < meetingCounter; i++) {
            console.log(_dataByPublicationByProfile[meetings[i].profileId][meetings[i].pubId].meetingTime);
            arr[i] = _dataByPublicationByProfile[meetings[i].profileId][meetings[i].pubId];
            arr[i].profileId = meetings[i].profileId;
            arr[i].pubId = meetings[i].pubId;
        }
        return arr;
    }

}

