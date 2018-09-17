const Web3 = require("web3");
const util = require("util");

const erc20Abi = require("./erc20.abi");
const config = require("./config");
const errorTemplates = require("./error_templates");
const abi = require("./oasisdex.abi");
const contracts = require("./contracts_addresses");
const Offer = require("./offer");
const Pair = require("./pair");

const BN = Web3.utils.BN;
const bn = num => new BN(num);

/**
 * Decimals count for non erc20 contract
 * @type {{DGD: number}}
 */
const decimals = {
	"DGD": 9,
};

const keypairRegexp = /([^/]*)\/([^/]*)/im;

const MAX_OFFER_COUNT = config.maxOfferCount;

const LAST_CHECK_BLOCK = config.lastCheckBlock;

const GET_OFFER_ATTEMPTS_COUNT = config.attemptsCount;

const OASISDEX_CONTRACT_ADDRESS = config.oasisAddress;

/**
 *  OasisDex  API
 *  @see https://oasisdex.com/
 */
class OasisApi {
	/**
	 * @param web3 {String|Web3}
	 */
	constructor(web3) {
		web3 = typeof web3 === "string" ? new Web3(web3) : web3;
		this.web3 = web3;
		this.contract = new web3.eth.Contract(
			abi,
			OASISDEX_CONTRACT_ADDRESS,
		);
		this.erc20Contracts = {};
		for (const name in contracts) {
			this.erc20Contracts[name] = new web3.eth.Contract(erc20Abi, contracts[name]);
		}
	}

	/**
	 * Parse Pair from pair string
	 * @param pairText
	 * @returns {Promise<Pair>}
	 */
	async getPairFromText(pairText) {
		const match = pairText.match(keypairRegexp);
		if (!match || match.length !== 3) {
			throw new Error(errorTemplates.CANT_PARSE_PAIR);
		}
		const [, from, to] = match;
		if (!this.erc20Contracts[from] || !this.erc20Contracts[to]) {
			throw new Error(
				util.format(
					errorTemplates.UNKNOWN_TOKEN,
					this.erc20Contracts[from] ? to : from
				)
			);
		}
		const [fromDecimals, toDecimals] = await Promise.all([
			decimals[from] || this.erc20Contracts[from].methods.decimals().call(),
			decimals[to] || this.erc20Contracts[to].methods.decimals().call(),
		]);
		return new Pair({
			text: pairText,
			fromAddress: contracts[from],
			fromText: from,
			fromDecimals: parseInt(fromDecimals, 10),
			toAddress: contracts[to],
			toDecimals: parseInt(toDecimals, 10),
			toText: to,
		});
	}

	/**
	 * Check is token pair in white list
	 * @param pair
	 * @returns {Promise<Boolean>}
	 */
	async checkPair(pair) {
		return await this.contract.methods.isTokenPairWhitelisted(
			contracts[pair.fromText],
			contracts[pair.toText],
		).call();
	}

	async _getPastEvent(fromBlock, toBlock, pair) {
		return (await this.contract.getPastEvents(
			"LogTake",
			{
				fromBlock: fromBlock,
				toBlock: toBlock,
				filter: {
					pair: this.web3.utils.soliditySha3(pair.to, pair.from),
				},
			},
		)).reverse();
	}

	/**
	 * Get last takes
	 * @param pair {Pair}
	 * @param limit {Number}
	 * @returns {Promise<Offer[]>}
	 */
	async getLastTakeOrder(pair, limit = 10) {
		let fromBlock = (await this.web3.eth.getBlock("latest")).number;
		let toBlock = "latest";
		const step = config.eventBlockStep;
		let events = await this._getPastEvent(fromBlock, toBlock, pair);
		toBlock = fromBlock;
		fromBlock = Math.max(fromBlock - step, 0);
		while (events.length <= limit && toBlock > LAST_CHECK_BLOCK) {
			events = events.concat(await this._getPastEvent(fromBlock, toBlock, pair));
			toBlock = fromBlock;
			fromBlock = Math.max(fromBlock - step, 0);
		}
		return events.slice(0, limit + 1).map((e) => Offer.createFromTakeEvent(pair, e));
	}

	/**
	 * Return offers from {pay_amt, buy_amt} objects
	 * @param pair {Pair}
	 * @param rawOffers {Object}
	 * @returns {Offer[]}
	 */
	static makeOffersFromRaw(pair, rawOffers) {
		return rawOffers.map(o => new Offer(pair, String(o.pay_amt), String(o.buy_amt)));
	}

	/**
	 * Get best offer as object { pay_amt, buy_amt, offerId }
	 * @param pair {Pair}
	 * @param maxCount {Number}
	 * @param attempt {Number}
	 * @returns {Promise<Object[]>}
	 */
	async getAllOfferForPair(
		pair,
		maxCount = MAX_OFFER_COUNT,
		attempt = GET_OFFER_ATTEMPTS_COUNT
	) {
		const offers = [];
		let [getCount, offerId] = await Promise.all(
			[
				this.contract.methods.getOfferCount(pair.from, pair.to).call(),
				this.contract.methods.getBestOffer(pair.from, pair.to).call(),
			]);
		let bestOffer, nextOfferId;
		let i = Math.min(maxCount, getCount);
		while (i > 0) {
			[bestOffer, nextOfferId] = await Promise.all([
				this.contract.methods.getOffer(offerId).call(),
				this.contract.methods.getWorseOffer(offerId).call(),
			]);
			if (bestOffer[0] === "0") {
				if (i > 0) {
					if (attempt > 0) {
						return this.getAllOfferForPair(pair, --attempt);
					} else {
						throw Error(errorTemplates.TRADE_TOO_FAST);
					}
				}
				break;
			}
			offers.push({
				pay_amt: bestOffer[0],
				buy_amt: bestOffer[2],
				id: offerId,
			});
			offerId = nextOfferId;
			i--;
		}
		return offers;
	}

	/**
	 * Convert amount to wei
	 * @param offers
	 * @param fromDecimals
	 * @param toDecimals
	 * @returns {Object}
	 */
	static offersToWei(offers, fromDecimals, toDecimals) {
		return offers.map(v => {
			v = Object.assign({}, v);
			v.buy_amt = bn(v.buy_amt).mul(bn(10).pow(bn(18 - toDecimals)));
			v.pay_amt = bn(v.pay_amt).mul(bn(10).pow(bn(18 - fromDecimals)));
			return v;
		});
	}

	/**
	 * Get price for buying `amount` for `pair`
	 * @param pair {Pair}
	 * @param amount {Number}
	 * @param rawOffers {Object[]}
	 * @returns {Promise<number>}
	 */
	async getPrice(pair, amount, rawOffers = false) {
		amount = bn(amount).mul(bn(10).pow(bn(18)));
		rawOffers = rawOffers || await this.getAllOfferForPair(pair);
		const offers =  OasisApi.offersToWei(rawOffers, pair.fromDecimals, pair.toDecimals);

		const allAmount = offers.reduce(
			(acc, val) => acc.add(val.buy_amt),
			bn(0),
		);

		if (amount.gte(allAmount)) {
			return 0;
		}
		for (let i = 0; i < offers.length; i++) {
			amount = amount.sub(offers[i].buy_amt);
			if (amount.lte(bn(0))) {
				return parseFloat(offers[i].pay_amt.toString()) /
					parseFloat(offers[i].buy_amt.toString());
			}
		}
		return 0;
	}

}

module.exports = OasisApi;