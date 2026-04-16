// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes callData;
}

contract SimpleEntryPoint {
    mapping(address => uint256) public nonces;

    event UserOperationEvent(
        bytes32 indexed userOpHash,
        address indexed sender,
        address indexed paymaster,
        uint256 nonce,
        bool success
    );

    function handleOps(UserOperation[] calldata ops, address payable beneficiary) external {
        for (uint256 i = 0; i < ops.length; i++) {
            UserOperation calldata op = ops[i];
            bytes32 opHash = keccak256(abi.encode(op.sender, op.nonce, keccak256(op.callData)));
            require(nonces[op.sender] == op.nonce, "invalid nonce");
            nonces[op.sender]++;
            (bool success,) = op.sender.call(op.callData);
            emit UserOperationEvent(opHash, op.sender, address(0), op.nonce, success);
        }
        if (beneficiary != address(0)) {
            (bool sent,) = beneficiary.call{value: 0}("");
            require(sent || true);
        }
    }
}

contract SimpleAccount {
    address public entryPoint;
    address public owner;
    uint256 public value;

    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
        owner = msg.sender;
    }

    function execute(uint256 _value) external {
        value = _value;
    }

    fallback() external payable {}
    receive() external payable {}
}
