// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleERC1155 {
    string public uri;
    mapping(uint256 => mapping(address => uint256)) public balanceOf;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);

    constructor(string memory _uri) {
        uri = _uri;
    }

    function mint(address to, uint256 id, uint256 amount, bytes calldata) external {
        balanceOf[id][to] += amount;
        emit TransferSingle(msg.sender, address(0), to, id, amount);
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata) external {
        require(msg.sender == from, "not owner");
        require(balanceOf[id][from] >= amount, "insufficient");
        balanceOf[id][from] -= amount;
        balanceOf[id][to] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            result[i] = balanceOf[ids[i]][accounts[i]];
        }
        return result;
    }
}
