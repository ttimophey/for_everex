/**
 * Class present OasisDex Offer
 */
class Offer {
	constructor(pair, payAmt, buyAmt) {
		this.pair = pair.text;
		this.payAmt = parseInt(payAmt, 10) / Math.pow(10, pair.fromDecimals);
		this.buyAmt = parseInt(buyAmt, 10) / Math.pow(10, pair.toDecimals);
	}

	/**
	 * Create offers from web3 OasisDex take event
	 * @param pair {Pair}
	 * @param event {Object}
	 * @returns {Offer}
	 */
	static createFromTakeEvent(pair, event) {
		return new Offer(
			pair,
			event.returnValues.give_amt,
			event.returnValues.take_amt
		);
	}
}

module.exports = Offer;