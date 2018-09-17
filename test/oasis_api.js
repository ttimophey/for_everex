const assert = require('assert');
const {OasisApi, Pair, Offer} = require('../index');
const Web3 = require("web3")

async function assertThrowsAsync(fn, param) {
	let f = () => {};
	try {
		await fn();
	} catch(e) {
		f = () => {throw e};
	} finally {
		assert.throws(f, param);
	}
}

describe('OasisApi client', () => {

	describe('construct', () => {
		it('should create Web3 instance if pass url', () => {
			const o = new OasisApi('http://localhost');
			assert.equal(o.web3 instanceof Web3, true);
		});
	});

	describe('getPairFromText', () => {
		const decimals = 18;
		const web3Mock = {
			eth: {
				Contract: function() {
					this.methods = {
						decimals: () => { return { call: () => decimals }}
					}
				}
			}
		};
		const o = new OasisApi(web3Mock);
		it('should throw error if invalid pair passed', async () => {
			await assertThrowsAsync(async () => await o.getPairFromText('ololo'), Error);
		});
		it('should throw error if get unknown token', async () => {
			await assertThrowsAsync(async () => await o.getPairFromText('DAI/OLOLO'), Error);
		});
		it('should return pair if it valid pair', async () => {
			const pair = await o.getPairFromText('DAI/W-ETH');
			assert.equal(pair.text, 'DAI/W-ETH');
			assert.equal(pair.fromText, 'DAI');
			assert.equal(pair.toText, 'W-ETH');
			assert.equal(pair.fromDecimals, decimals);
			assert.equal(pair.toDecimals, decimals);
		});
	});

});
