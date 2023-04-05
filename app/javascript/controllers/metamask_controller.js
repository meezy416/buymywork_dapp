import { Controller } from "@hotwired/stimulus";
import { ethers } from "ethers";
import abi from "../contract.json" assert { type: "json" };

const CONTRACT_ADDRESS = "0xE8DE8639B81b1b1C50979e564Ce86e25BD503C1c";
const CONTRACT_ABI = abi.abi;

let walletConnected = false;
let userAddress = null;
let userBalance = null;
let provider = null;
let contract = null;
let transaction = [];
let isOwner = false;

// Connects to data-controller="metamask"
export default class extends Controller {
  static targets = [
    "connect",
    "wallet",
    "results",
    "form",
    "address",
    "balance",
    "name",
    "message",
    "price",
    "notification",
    "transactionTemplate",
    "withdraw",
  ];

  connect() {
    this.isWalletConnected();
  }

  async isWalletConnected() {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      this.syncComponents(accounts);
    } else {
      console.log("Please install Metamask");
    }
  }

  async connectMetamask() {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      this.syncComponents(accounts);
    } else {
      console.log("Please install Metamask");
    }
  }

  async setupContract() {
    if (walletConnected && provider) {
      contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider.getSigner()
      );

      // Check if the current user is the owner or not
      const contractOwner = await contract.owner();
      isOwner =
        ethers.utils.getAddress(contractOwner) ===
        ethers.utils.getAddress(userAddress);

      console.log("isOwner:", isOwner);

      console.log("Contract is set up successfully", contract);
    }
  }

  async syncComponents(accounts) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    if (accounts.length !== 0) {
      walletConnected = true;
      userAddress = accounts[0];
      console.log("Your account address: ", userAddress);

      //Hide connect to MetaMask Button
      this.connectTarget.hidden = true;

      //Show elements
      this.walletTarget.hidden = false;
      this.resultsTarget.hidden = false;
      this.formTarget.hidden = false;

      this.addressTarget.innerText = `${userAddress.slice(
        0,
        6
      )}...${userAddress.slice(-3)}`.toUpperCase();

      userBalance = await provider.getBalance(userAddress);
      userBalance = ethers.utils.formatEther(userBalance);
      this.balanceTarget.innerText = Math.round(userBalance * 10000) / 10000;

      //Set up smart contract
      await this.setupContract();

      if (isOwner) {
        await this.getContractBalance();
        this.withdrawTarget.hidden = false;
      }

      //Fetch all marijuana in the blockchain
      this.getAllMarijuana();

      // MetaMask event: reload the page, if user switvh between accounts
      window.ethereum.on("accountsChanged", (accounts) => {
        window.location.reload();
      });
    } else {
      walletConnected = false;
      console.log("No accounts found");

      //Show connect to MetaMask Button
      this.connectTarget.hidden = false;

      //Hide elements
      this.walletTarget.hidden = true;
      this.resultsTarget.hidden = true;
      this.formTarget.hidden = true;
      this.addressTarget.innerText = "";
    }
  }

  showNotification(title, message) {
    const item = this.notificationTarget;
    item.querySelector(".type").innerText = title;
    item.querySelector(".message").innerText = message;
    this.notificationTarget.hidden = false;
  }

  async buyMarijuana() {
    try {
      const name = this.nameTarget.value;
      const message = this.nameTarget.value;

      // Get the price from the button's text
      const eth_price = this.priceTarget.innerText;

      //Exeucute contract's buyMarijuana function

      const transaction = await contract.buymarijuana(
        message ? message : "Enjoy your marijuana",
        name ? name : "Anonymous",
        {
          value: ethers.utils.parseEther(eth_price),
        }
      );

      // Disable the form
      this.formTarget.classList.add("pointer-events-none");

      // Show notification
      this.showNotification("Processing..", "We're almost there");
      console.log("Processing...", transaction.hash);
      await transaction.wait();

      console.log("Transaction completed! ");

      //Reload the whole page
      window.location.reload();
    } catch (error) {
      console.log(error.message);
    }
  }

  async getAllMarijuana() {
    try {
      transaction = await contract.getAllMarijuana();
      console.log(transaction);

      this.resultsTarget.innerText = "";
      transaction
        .slice(0)
        .reverse()
        .map((txn) => {
          this.addResultItem(txn);
        });
    } catch (error) {
      console.log(error.message);
    }
  }

  async getContractBalance() {
    try {
      let contractBalance = await contract.getBalance();
      contractBalance = ethers.utils.formatEther(contractBalance);
      contractBalance = Math.round(contractBalance * 10000) / 10000;

      // console.log("Contract's balance", contractBalance);

      if (contractBalance > 0) {
        this.withdrawTarget.innerText = `Withdraw ${contractBalance} ETH`;
      } else {
        this.withdrawTarget.disable = true;
        this.withdrawTarget.innerText = "No fund to withdraw";
      }
    } catch (error) {
      console.log(error);
    }
  }

  async withdraw() {
    try {
      const transaction = await contract.withdraw();
      // Disable the withdraw button (challenge)

      //show notification
      this.showNotification("Transferring fund...", "Please be patience!");
      console.log("Transferring...", transaction.hash);

      await transaction.wait();

      //Reload the page
      window.location.reload();
    } catch (error) {
      console.log(error);
    }
  }

  addResultItem(txn) {
    const item =
      this.transactionTemplateTarget.content.firstElementChild.cloneNode(true);

    const tx_eth = ethers.utils.formatEther(txn.amount);
    const tx_address = `${txn.supporter.slice(0, 6)}...${txn.supporter.slice(
      -3
    )}`.toUpperCase();
    const tx_date = new Date(txn.timestamp.toNumber() * 1000).toLocaleString(
      "en-US"
    );

    item.querySelector(".supporter").innerText = txn.name;
    item.querySelector(".message").innerText = txn.message;
    item.querySelector(".price").innerText = `supported ${tx_eth} ETH`;
    item.querySelector(".address").innerText = tx_address;
    item.querySelector(".timestamp").innerText = tx_date;

    this.resultsTarget.append(item);
  }
}
