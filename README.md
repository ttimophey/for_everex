# Get price from OasisDex library
## Usage
```javascript
async () => {
  const {OasisApi} = require('for_everex');
  const oasisClient = new OasisApi("eth_url");
  const pair = await oasisClient.getPairFromText("DAI/W-ETH");
  if (await oasisClient.checkPair(pair)) {
    console.log(await oasisClient.getPrice(pair, 100)); // get price for 100 W-ETH from DAI
  } else {
    console.log('Pair not in whitelist');
  }
}
```
# CLI usage getprice.js
Getting price for offer in OasisDEX. Working with infura API (some times crashed)

## Example

```bash
$ ./bin/getprice.js --pair=MKR/W-ETH --amount=1000 -e eth_url # Price for buy 1000 W-ETH for MKR
$ ./bin/getprice.js --pair=W-ETH/MKR --amount=1000 -e eth_url # Price for buy 1000 MKR for W-ETH
```

