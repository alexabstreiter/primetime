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
        address currency;
        address[] participants;
        //mapping(address => uint256) checkinTime;
        bool hasBeenDistributed;
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
        uint256 maxLateTime
        ) = abi.decode(data, (uint256, address, uint256, uint256));
        if (!_currencyWhitelisted(currency) || stakingAmount == 0) revert Errors.InitParamsInvalid();

        _dataByPublicationByProfile[profileId][pubId].stakingAmount = stakingAmount;
        _dataByPublicationByProfile[profileId][pubId].currency = currency;
        //_dataByPublicationByProfile[profileId][pubId].meetingTime = meetingTime;
        _dataByPublicationByProfile[profileId][pubId].meetingTime = 1000000;
        //_dataByPublicationByProfile[profileId][pubId].maxLateTime = maxLateTime;
        _dataByPublicationByProfile[profileId][pubId].maxLateTime = 1000;
        //_dataByPublicationByProfile[profileId][pubId].participants.push(recipient);

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
        if (_dataByPublicationByProfile[profileId][pubId].participants.length > 0) {
            _checkinTime[profileId][pubId][msg.sender] = 1000500;
        } else {
            _checkinTime[profileId][pubId][msg.sender] = 1000000;
        }
        /*
        int256 timeSinceMeetingStart = int256(block.timestamp) - int256(_dataByPublicationByProfile[profileId][pubId].meetingTime);
        if (timeSinceMeetingStart >= - 5 minutes) {
            _checkinTime[profileId][pubId][msg.sender] = block.timestamp;
        }*/
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
    ) external {
        CustomProfilePublicationData memory meeting = _dataByPublicationByProfile[profileId][pubId];
        //if (block.timestamp >= meeting.meetingTime + meeting.maxLateTime && !meeting.hasBeenDistributed) {
        if (true) {
            uint256 stakedAmount = meeting.participants.length * meeting.stakingAmount;
            uint256 treasuryAmount = stakedAmount / 100;
            int256 adjustedAmount = int256(stakedAmount - treasuryAmount);

            int256 totalLateTime = 0;
            for (uint256 i = 0; i < meeting.participants.length; i++) {
                int256 lateTime = int256(_checkinTime[profileId][pubId][meeting.participants[i]]) - int256(meeting.meetingTime);
                if (_checkinTime[profileId][pubId][meeting.participants[i]] == 0) {
                    lateTime = int256(meeting.maxLateTime);
                }
                if (lateTime < 0) {
                    lateTime = 0;
                }
                totalLateTime += lateTime;
            }

            for (uint256 i = 0; i < meeting.participants.length; i++) {
                int256 lateTime = int256(_checkinTime[profileId][pubId][meeting.participants[i]]) - int256(meeting.meetingTime);
                if (_checkinTime[profileId][pubId][meeting.participants[i]] == 0) {
                    lateTime = int256(meeting.maxLateTime);
                }
                if (lateTime < 0) {
                    lateTime = 0;
                }

                int256 reward = adjustedAmount - adjustedAmount * lateTime / int256(meeting.maxLateTime) * int256(meeting.participants.length) / int256(meeting.participants.length - 1);
                reward += adjustedAmount * totalLateTime / int256(meeting.maxLateTime) / int256(meeting.participants.length - 1);
                if (reward > 0) {
                    console.log('reward');
                    console.log(uint256(reward));
                    IERC20(meeting.currency).safeTransfer(meeting.participants[i], uint256(reward));
                    //(bool sent, bytes memory data) = payable(meeting.participants[i]).call{value : uint256(reward)}("");
                }
            }

            meeting.hasBeenDistributed = true;
        }
    }

}

