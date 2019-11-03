import React, { Component } from "react";
import * as constants from "../../constants/contractAddress";
import * as routes from "../../constants/routes";
import Web3 from "web3";
import { Spinner } from "reactstrap";
import "./LandingPage.css";
const axios = require("axios");

const web3 = new Web3(window.ethereum);

class LandingPage extends Component {
  constructor(props) {
    super(props);
    window.ethereum.enable().catch(error => {
      // User denied account access
      console.log(error);
    });
    this.state = {
      userAddress: "",
      loadedInfo: false
    };
  }

  componentDidMount() {
    web3.eth.getAccounts().then(addr => {
      this.setState({ userAddress: addr[0].toLocaleLowerCase() });
      axios
        .get(this.generateAPIEndpoint())
        .then(response => {
          var transactions = response.data.result;
          this.processTransactions(transactions);
          this.setState({ loadedInfo: true });
        })
        .catch(error => console.log(error));
    });
  }

  generateAPIEndpoint = () => {
    let moduleAccount = routes.moduleAccount;
    let action = routes.getERC20Transactions;
    let address = this.state.userAddress;
    let startblock = routes.startBlock;
    let endblock = routes.endBlock;
    let sortDesc = routes.sortDesc;
    let apiKey = routes.ApiKeyToken;
    return (
      "http://api-kovan.etherscan.io/api?module=" +
      moduleAccount +
      "&action=" +
      action +
      "&address=" +
      address +
      "&startblock=" +
      startblock +
      "&endblock=" +
      endblock +
      "&sort=" +
      sortDesc +
      "&apikey=" +
      apiKey
    );
  };

  processTransactions = transactions => {
    let receivedERC20Txts = [];
    let sentERC20Txts = [];
    for (let i = 0; i < transactions.length; i++) {
      let currTxt = transactions[i];
      if (
        currTxt.from === this.state.userAddress &&
        constants.setContractAddresses.has(currTxt.to)
      ) {
        sentERC20Txts.push({
          timeStamp: currTxt.timeStamp,
          toAddress: currTxt.to,
          tokenName: currTxt.tokenName,
          tokenSymbol: currTxt.tokenSymbol,
          value: parseInt(currTxt.value) / 10 ** parseInt(currTxt.tokenDecimal)
        });
      } else if (
        currTxt.to === this.state.userAddress &&
        constants.setContractAddresses.has(currTxt.from)
      ) {
        receivedERC20Txts.push({
          timeStamp: currTxt.timeStamp,
          fromAddress: currTxt.from,
          tokenName: currTxt.tokenName,
          tokenSymbol: currTxt.tokenSymbol,
          value: parseInt(currTxt.value) / 10 ** parseInt(currTxt.tokenDecimal)
        });
      }
    }
    console.log(receivedERC20Txts);
    console.log(sentERC20Txts);
  };

  render() {
    return (
      <div className="all">
        {this.state.loadedInfo ? <Spinner color="primary" /> : <h1>Hello</h1>}
      </div>
    );
  }
}

export default LandingPage;
