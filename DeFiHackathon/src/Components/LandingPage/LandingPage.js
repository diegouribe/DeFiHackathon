import React, { Component } from "react";
import ReactDOM from "react-dom";
import * as constants from "../../constants/contractAddress";
import * as routes from "../../constants/routes";
import * as landingContract from "../../contracts/LandingPool.js"
import * as tokenContract from "../../contracts/Token.js"
import Web3 from "web3";
import { Spinner } from "reactstrap";
import Navbar from "react-bootstrap/Navbar";
import "./LandingPage.css";
import { Bar, Pie } from 'react-chartjs-2';
import { string } from "prop-types";
const axios = require("axios");
const price = require('crypto-price');


const web3 = new Web3(window.ethereum);
const lendingPlatformContract = new web3.eth.Contract(landingContract.lendingPlatformABI, constants.lendingPoolAddress);
const TokenContract = new web3.eth.Contract(tokenContract.tokenABI, constants.tokenAddress);
const supportedTokens = ["AMPL", "BAT", "DAI", "ETH", "KNC", "LEND", "LINK", "MANA", "MKR", "REP", "SUSD", "TUSD", "USDC", "USDT", "WBTC", "ZRX"];

class LandingPage extends Component {
  constructor(props) {
    super(props);
    window.ethereum.enable().catch(error => {
      // User denied account access
      console.log(error);
    });
    this.state = {
      userAddress: "",
      loadedInfo: false,
      availableBorrowsETH: 0,
      currentLiquidationThreshold: 0,
      healthFactor: 0,
      totalBorrowsETH: 0,
      totalCollateralETH: 0,
      totalLiquidityETH: 0,
      currencyData: new Array(supportedTokens.length),
      currencyPrices: new Array(supportedTokens.length),
      nums: ""
    };
    this.asyncForEach = this.asyncForEach.bind(this);
    this.getAllCurrencyData = this.getAllCurrencyData.bind(this);
    this.getUserReserveData = this.getUserReserveData.bind(this);
    this.getPrice = this.getPrice.bind(this);
  }


  componentDidMount() {
    web3.eth.getAccounts().then(addr => {
      this.setState({ userAddress: addr[0].toLocaleLowerCase() });
      axios
        .get(this.generateAPIEndpoint("txlist"))
        .then(response => {
          var transactions = response.data.result;
          this.processTransactions(transactions);

          this.setState({ loadedInfo: true });
        })
        .catch(error => console.log(error));
    });
  }

  generateAPIEndpoint = (type) => {
    let moduleAccount = routes.moduleAccount;
    let action = type;
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

  async asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index]);
    }
  }

  async getAllCurrencyData() {
    await this.asyncForEach(supportedTokens, this.getPrice);
    this.asyncForEach(supportedTokens, this.getUserReserveData).then(response => {
      var stat = [];
      for (let i = 0; i < supportedTokens.length; i++) {
        stat.push(this.state.currencyData[i] * parseFloat(this.state.currencyPrices[i]));
      }
      this.setState({ nums: stat });
    })
  }

  async getPrice(currency) {
    price.getCryptoPrice("USD", currency).then(obj => { // Base for ex - USD, Crypto for ex - ETH 
      if (obj == undefined) {
        this.state.currencyPrices[supportedTokens.indexOf(currency)] = 1;
      } else {
        this.state.currencyPrices[supportedTokens.indexOf(currency)] = obj.price;
      }
    }).catch(err => {
      console.log(err)
    })
  }


  async getUserReserveData(currency) {
    var result = await lendingPlatformContract.methods.getUserReserveData(constants.currencies[currency], this.state.userAddress).call();
    if (currency == "USDC") {
      var divide = 10 ** 6;
    } else {
      var divide = 10 ** 18;
    }
    this.state.currencyData[supportedTokens.indexOf(currency)] = parseInt(result.currentBorrowBalance) / divide;
  }

  processTransactions = transactions => {
    this.getAllCurrencyData();
    var borrowedERC20Txts = new Set();
    var repaidERC20Txts = new Set();
    for (let i = 0; i < transactions.length; i++) {
      var currTxt = transactions[i];
      if (currTxt.to === constants.lendingPoolAddress) {
        var bytes = currTxt.input;
        if (bytes.length >= 10) {
          if (bytes.slice(0, 10) == "0xc858f5f9") {
            borrowedERC20Txts.add(currTxt.hash);
          } else if (bytes.slice(0, 10) == "0x5ceae9c4") {
            repaidERC20Txts.add(currTxt.hash);
          }
        }
      }
    }

    axios
      .get(this.generateAPIEndpoint("tokentx"))
      .then(response => {
        var transactions = response.data.result;
        var processedBorrowedERC20Txts = [];
        var processedRepaidERC20Txts = [];
        for (let i = 0; i < transactions.length; i++) {
          let currTxt = transactions[i];
          if (borrowedERC20Txts.has(currTxt.hash)) {
            processedBorrowedERC20Txts.push({
              timeStamp: currTxt.timeStamp,
              toAddress: currTxt.to,
              tokenName: currTxt.tokenName,
              tokenSymbol: currTxt.tokenSymbol,
              value: parseInt(currTxt.value) / 10 ** parseInt(currTxt.tokenDecimal)
            });
          } else if (repaidERC20Txts.has(currTxt.hash)) {
            processedRepaidERC20Txts.push({
              timeStamp: currTxt.timeStamp,
              fromAddress: currTxt.from,
              tokenName: currTxt.tokenName,
              tokenSymbol: currTxt.tokenSymbol,
              value: parseInt(currTxt.value) / 10 ** parseInt(currTxt.tokenDecimal)
            });
          }
        }
        lendingPlatformContract.methods.getUserAccountData(this.state.userAddress).call().then(response => {
          console.log(processedBorrowedERC20Txts);
          console.log(processedRepaidERC20Txts);
          console.log(response);
          this.setState({
            availableBorrowsETH: parseInt(response.availableBorrowsETH) / 10 ** 18,
            currentLiquidationThreshold: parseInt(response.currentLiquidationThreshold),
            healthFactor: parseInt(response.healthFactor) / 10 ** 18,
            totalBorrowsETH: parseInt(response.totalBorrowsETH) / 10 ** 18,
            totalCollateralETH: parseInt(response.totalCollateralETH) / 10 ** 18,
            totalLiquidityETH: parseInt(response.totalLiquidityETH) / 10 ** 18
          })
          var healthFactor = response.healthFactor;
        })
      })
      .catch(error => console.log(error));
  };

  barGraphData = () => {
    return {
      labels: supportedTokens,
      datasets: [
        {
          label: 'USD Value of Borrowed Cryptocurrencies',
          backgroundColor: '#87CEFA',
          borderColor: '#1E90FF',
          borderWidth: 1,
          hoverBackgroundColor: 'rgba(255,99,132,0.4)',
          hoverBorderColor: 'rgba(255,99,132,1)',
          data: this.state.nums
        }
      ]
    }
  }

  pieGraphData = () => {
    return {
      labels: [
        'totalBorrowedETH',
        'totalCollateralETH',
      ],
      datasets: [{
        data: [this.state.totalBorrowsETH, this.state.totalCollateralETH],
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
        ],
        hoverBackgroundColor: [
          '#FF6384',
          '#36A2EB',
        ]
      }]
    }
  };

  render() {
    return (
      <div className="all">
        {this.state.loadedInfo ?
          <div>
            <Navbar bg="dark" variant="dark">
              <Navbar.Brand>
                {'Defining DeFi'}
              </Navbar.Brand>
            </Navbar>
            <h1 className="dashboard"> User Dashboard </h1>
            <h6 className="message"> Welcome to our reputation staking platform! </h6>
            <div className="barGraph">
              <h2>Borrowings Composition</h2>
              <Bar
                data={this.barGraphData}
                width={100}
                height={50}
              />
            </div>
            <div className="pieGraph">
              <h2>Borrowed vs. Collateral</h2>
              <Pie data={this.pieGraphData} />
            </div>

          </div>
          : <Spinner color="primary" />}
      </div>
    );
  }
}

export default LandingPage;
