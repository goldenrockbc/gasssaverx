// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title GasSaver
 * @dev A contract for gas-efficient bulk token transfers
 */
contract GasSaver is Ownable, ReentrancyGuard {
    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() Ownable(msg.sender) {}

    event BulkTransfer(
        address indexed token,
        address indexed sender,
        uint256 totalTransfers,
        uint256 totalAmount
    );

    event TokenTransfer(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 amount
    );

    /**
     * @dev Execute bulk token transfers in a single transaction with different tokens for each recipient
     * @param tokens Array of token contract addresses (address(0) for native currency)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to transfer (in wei/token units)
     */
    function bulkTransfer(
        address[] calldata tokens,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable nonReentrant {
        require(
            tokens.length == recipients.length && 
            recipients.length == amounts.length, 
            "Arrays length mismatch"
        );
        require(recipients.length > 0, "No recipients provided");
        require(recipients.length <= 100, "Too many recipients");

        uint256 totalNativeAmount = 0;
        
        // First pass: Calculate total native currency needed and validate inputs
        for (uint256 i = 0; i < recipients.length; i++) {
            require(amounts[i] > 0, "Amount must be greater than 0");
            if (tokens[i] == address(0)) {
                totalNativeAmount += amounts[i];
            }
        }
        
        // Handle native currency transfer if needed
        if (totalNativeAmount > 0) {
            require(msg.value >= totalNativeAmount, "Insufficient native currency sent");
        }
        
        // Process each transfer
        for (uint256 i = 0; i < recipients.length; i++) {
            if (tokens[i] == address(0)) {
                // Native currency transfer
                (bool success, ) = payable(recipients[i]).call{value: amounts[i]}("");
                require(success, "Native transfer failed");
            } else {
                // ERC20 token transfer
                IERC20 tokenContract = IERC20(tokens[i]);
                require(
                    tokenContract.transferFrom(msg.sender, recipients[i], amounts[i]),
                    "Token transfer failed"
                );
            }
        }
        
        // Refund any excess native currency
        if (msg.value > totalNativeAmount) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - totalNativeAmount}("");
            require(success, "Refund failed");
        }
        
        // Emit event for each token type
        emit BulkTransfer(address(0), msg.sender, recipients.length, totalNativeAmount);
    }
    
    /**
     * @dev Withdraw any ERC20 tokens accidentally sent to the contract
     * @param token The token contract address
     * @param to The address to withdraw to
     */
    function withdrawTokens(address token, address to) external onlyOwner {
        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        require(tokenContract.transfer(to, balance), "Withdraw failed");
    }
    
    /**
     * @dev Withdraw native currency (ETH/BNB/MATIC etc.)
     * @param to The address to withdraw to
     */
    function withdrawNative(address payable to) external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No native currency to withdraw");
        (bool success, ) = to.call{value: balance}("");
        require(success, "Withdraw failed");
    }
    
    // Allow the contract to receive native currency
    receive() external payable {}
}