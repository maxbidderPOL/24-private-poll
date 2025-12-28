// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * Private Poll Contract
 * Allows users to create polls with encrypted responses
 */
contract PrivatePoll is ZamaEthereumConfig {
    
    struct Poll {
        address creator;
        string question;
        uint256 minValue;
        uint256 maxValue;
        uint256 endTime;
        uint256 createdAt;
        uint256 responseCount;
        bool isActive;
    }
    
    struct EncryptedResponse {
        address respondent;
        euint32 encryptedValue;
        uint256 submittedAt;
    }
    
    mapping(uint256 => Poll) public polls;
    mapping(uint256 => EncryptedResponse[]) public pollResponses;
    mapping(uint256 => mapping(address => bool)) public hasResponded;
    mapping(address => uint256[]) public userPolls;
    mapping(address => uint256[]) public userResponses;
    
    uint256 public pollCounter;
    
    event PollCreated(
        uint256 indexed pollId,
        address indexed creator,
        string question,
        uint256 minValue,
        uint256 maxValue,
        uint256 endTime
    );
    
    event ResponseSubmitted(
        uint256 indexed pollId,
        address indexed respondent
    );
    
    event PollClosed(
        uint256 indexed pollId,
        address indexed creator
    );
    
    function createPoll(
        string memory _question,
        uint256 _minValue,
        uint256 _maxValue,
        uint256 _endTime
    ) external returns (uint256) {
        require(bytes(_question).length > 0, "Question cannot be empty");
        require(_minValue < _maxValue, "Min value must be less than max value");
        require(_endTime > block.timestamp, "End time must be in the future");
        
        uint256 pollId = pollCounter;
        pollCounter++;
        
        polls[pollId] = Poll({
            creator: msg.sender,
            question: _question,
            minValue: _minValue,
            maxValue: _maxValue,
            endTime: _endTime,
            createdAt: block.timestamp,
            responseCount: 0,
            isActive: true
        });
        
        userPolls[msg.sender].push(pollId);
        
        emit PollCreated(pollId, msg.sender, _question, _minValue, _maxValue, _endTime);
        return pollId;
    }
    
    function submitResponse(
        uint256 _pollId,
        externalEuint32 encryptedValue,
        bytes calldata inputProof
    ) external {
        Poll storage poll = polls[_pollId];
        require(poll.creator != address(0), "Poll does not exist");
        require(poll.isActive, "Poll is not active");
        require(block.timestamp <= poll.endTime, "Poll has ended");
        require(!hasResponded[_pollId][msg.sender], "You have already responded to this poll");
        
        euint32 value = FHE.fromExternal(encryptedValue, inputProof);
        FHE.allow(value, msg.sender);
        FHE.allow(value, poll.creator);
        
        pollResponses[_pollId].push(EncryptedResponse({
            respondent: msg.sender,
            encryptedValue: value,
            submittedAt: block.timestamp
        }));
        
        hasResponded[_pollId][msg.sender] = true;
        poll.responseCount++;
        
        bool alreadyInList = false;
        for (uint256 i = 0; i < userResponses[msg.sender].length; i++) {
            if (userResponses[msg.sender][i] == _pollId) {
                alreadyInList = true;
                break;
            }
        }
        if (!alreadyInList) {
            userResponses[msg.sender].push(_pollId);
        }
        
        emit ResponseSubmitted(_pollId, msg.sender);
    }
    
    function closePoll(uint256 _pollId) external {
        Poll storage poll = polls[_pollId];
        require(poll.creator == msg.sender, "Only creator can close poll");
        require(poll.isActive, "Poll is already closed");
        
        poll.isActive = false;
        emit PollClosed(_pollId, msg.sender);
    }
    
    function getPoll(uint256 _pollId) external view returns (
        string memory question,
        address creator,
        uint256 minValue,
        uint256 maxValue,
        uint256 endTime,
        uint256 createdAt,
        uint256 responseCount,
        bool isActive
    ) {
        Poll storage poll = polls[_pollId];
        require(poll.creator != address(0), "Poll does not exist");
        
        return (
            poll.question,
            poll.creator,
            poll.minValue,
            poll.maxValue,
            poll.endTime,
            poll.createdAt,
            poll.responseCount,
            poll.isActive
        );
    }
    
    function getPollResponses(uint256 _pollId) external view returns (
        EncryptedResponse[] memory responses
    ) {
        require(polls[_pollId].creator != address(0), "Poll does not exist");
        return pollResponses[_pollId];
    }
    
    function getResponseCount(uint256 _pollId) external view returns (uint256) {
        return polls[_pollId].responseCount;
    }
    
    function getUserPolls(address _user) external view returns (uint256[] memory) {
        return userPolls[_user];
    }
    
    function getUserResponses(address _user) external view returns (uint256[] memory) {
        return userResponses[_user];
    }
    
    function checkIfResponded(uint256 _pollId, address _user) external view returns (bool) {
        return hasResponded[_pollId][_user];
    }
    
    function getActivePolls(uint256 _limit) external view returns (uint256[] memory) {
        uint256[] memory activePolls = new uint256[](_limit);
        uint256 count = 0;
        
        for (uint256 i = pollCounter; i > 0 && count < _limit; i--) {
            uint256 pollId = i - 1;
            Poll storage poll = polls[pollId];
            
            if (poll.creator != address(0) && 
                poll.isActive && 
                block.timestamp <= poll.endTime) {
                activePolls[count] = pollId;
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activePolls[i];
        }
        
        return result;
    }
}
