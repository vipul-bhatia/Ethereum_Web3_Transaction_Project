import './App.css';
import React, {useEffect, useState,useCallback} from 'react';
import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';
import { loadContract } from './utils/load-contract';

function App() {

  const [web3Api, setWeb3Api] = useState({
    provider: null,
    isProviderLoaded: false,
    web3: null,
    contract: null
  })

  const [account, setAccount] = useState(null)
  const [balance,setBallance] = useState(null)
  const [shouldReload, reload] = useState(false)
  const [transactions, setTransactions] = useState([]);

  const canConnectToContract = account && web3Api.contract

  const reloadEffect =useCallback(()=>reload(!shouldReload),[shouldReload])

  const setAccountListner = (provider) =>{
    provider.on("accountsChanged",(accounts)=> window.location.reload())
    provider.on("chainChanged",(accounts)=> window.location.reload())


    // not a suggested method below have some errors
    // provider._jsonRpcConnection.events.on('notification',payload=>{
    //   const {method} = payload

    //   if(method === "metamask_unlockStateChanged"){
    //     setAccount(null)
    //   }
    // })
  }

  useEffect(() => {
    const loadProvider = async () => {
      // with metamask we have access to window.ethereum & to window.web3
      // metamask injects a global API into website
      // this API will allow website to request users, accounts, read data to blockchain
      // can also sign messages and transactions

      const provider = await detectEthereumProvider()


      if(provider) {
        const contract = await loadContract('Faucet', provider)
        setAccountListner(provider)
        setWeb3Api({
          web3: new Web3(provider),
          provider,
          contract,
          isProviderLoaded: true
        })
      } else {
        setWeb3Api((api)=>{
          return{
            ...api,
           isProviderLoaded: true
          }
        })
        console.error('Please install Metamask')
      }
    }

    loadProvider()
  }, [])


  useEffect(() => {
    const loadBalance = async () => {
        const { contract, web3 } = web3Api
        web3.eth.getBalance(contract.address, (err, balance) => {
 
          setBallance(web3.fromWei(parseInt(balance), "ether"))
        });
    }
    web3Api.contract && loadBalance()
  }, [web3Api,shouldReload])


  useEffect(() => {
    const getAccount = async () => {
      web3Api.web3.eth.getAccounts((err, accounts) => {
        setAccount(accounts[0])
      })
    }
    web3Api.web3 && getAccount()
  }, [web3Api.web3])

  const addFunds =useCallback( async()=>{
    const { contract, web3 } = web3Api
    await contract.addFunds({
      from : account,
      value: web3.toWei("1", 'ether')
    })
    reloadEffect()
    // window.location.reload()
  },[web3Api, account,reloadEffect])

  const withdraw = async () =>{
    const { contract, web3 } = web3Api
    const withdrawAmount = web3.toWei("0.1", 'ether')
    await contract.withdraw(withdrawAmount, {
      from : account,
    })
    reloadEffect()
  }
  
  useEffect(() => {
    const { contract } = web3Api;
  
    const loadEvents = () => {
      if (!contract) return;
  
      // Listening for FundsAdded events
      contract.FundsAdded({
        fromBlock: 0
      }).on('data', event => {
        setTransactions(prevTransactions => [...prevTransactions, {
          type: 'Buy',
          from: event.returnValues.funder,
          amount: web3Api.web3.fromWei(event.returnValues.amount, 'ether')
        }]);
      })
      .on('error', console.error);
  
      // Listening for FundsWithdrawn events
      contract.FundsWithdrawn({
        fromBlock: 0
      }).on('data', event => {
        setTransactions(prevTransactions => [...prevTransactions, {
          type: 'Sell',
          from: event.returnValues.requester,
          amount: web3Api.web3.fromWei(event.returnValues.amount, 'ether')
        }]);
      })
      .on('error', console.error);
    };
  
    loadEvents();
  
    // Cleanup function
    return () => {
      if (contract) {
        // Remove all event listeners for FundsAdded and FundsWithdrawn events
        contract.FundsAdded().removeAllListeners();
        contract.FundsWithdrawn().removeAllListeners();
      }
    };
  }, [web3Api]); // This effect depends on the web3Api state
  
  
  
  
  return (
    <>
      <div className = 'faucet-wrapper'>
        <div className = 'faucet'>
          {web3Api.isProviderLoaded ?
          <div className = 'is-flex is-align-items-center'>
            <span>
              <strong className = 'mr-2'>Account: </strong>
            </span>
            
              {account ? 
              <div>{account}</div>:
              !web3Api.provider?
              <>
               <div className='notification is-warning is-size-6 is-rounded'>
                Wallet is not detected!{` `}
                <a target='_blank' rel="noreferrer" href='https://docs.metamask.io'>
                  Install Metamask
                </a>
               </div>
              </>:
              <button
              className = 'button is-small'
              onClick={() => {
                if (web3Api.provider) {
                  web3Api.provider.request({ method: 'eth_requestAccounts' });
                } else {
                  console.error('Metamask provider not available');
                }
              }}
              
              >
                Connect Wallet
              </button>
              }
          </div> : 
          <span> Looking for web3...</span>
}
          <div className = 'balance-view is-size-2 my-4'>
            Current Balance: <strong>{balance}</strong> ETH
          </div>
          {
            !canConnectToContract && 
            <i className='is-block'>
              Connect to Ganache
            </i>
          }
          <button disabled={!canConnectToContract} onClick={addFunds} className = 'button is-link mr-2'>Buy 1 eth</button>
          <button disabled={!canConnectToContract} onClick={withdraw} className = 'button is-primary is-dark'>Sell 0.1 eth</button>
          <div className = 'transactions'>
        <h2>All Transactions</h2>
        {transactions.map((tx, index) => (
          <div key={index}>{tx.type} - From: {tx.from} - Amount: {tx.amount} ETH</div>
        ))}
      </div>
        </div>
      
      </div>
    
    </>
  );
}

export default App;


// Private key 32 byte number
// c0ab562fa567abc1597a9f9c840537342809a387f6d45f5e112d0d074c6875ce

// Public key(Uncompressed) 64 byte number
// 04 8bd5fbf4bc3d8421b8024229943170babd858b9338552ddccb2fa3da24f867ca071f658662bc263ef3272e15fd10a3abc9533991586f2e93136f548db9cb921f

// Public key(Compressed) 32 byte number
// 03 8bd5fbf4bc3d8421b8024229943170babd858b9338552ddccb2fa3da24f867ca
