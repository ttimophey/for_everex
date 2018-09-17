/**
 * Token Pair on oasisdex
 */
class Pair {
	/**
	 *
	 * @param text {String}
	 * @param fromAddress {String}
	 * @param fromText {String}
	 * @param fromDecimals {Number}
	 * @param toAddress {String}
	 * @param toText {String}
	 * @param toDecimals {Number}
	 * @param toDecimals {Number}
	 */
	constructor({
		text,
		fromAddress,
		fromText,
		fromDecimals,
		toAddress,
		toText,
		toDecimals,
	}) {
		this.text = text;
		this.from = fromAddress;
		this.fromText = fromText;
		this.fromDecimals = fromDecimals;
		this.to = toAddress;
		this.toText = toText;
		this.toDecimals = toDecimals;
	}
}

module.exports = Pair;