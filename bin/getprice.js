#!/usr/bin/env node --no-warnings
/* eslint-disable no-console */
const argv = require("optimist").argv;
const util = require("util");
const OasisApi = require("../src/oasis_api");
const errorTemplates = require("../src/error_templates");

function offerToString(offer) {
	const pair = offer.pair.split("/");
	return `${pair[0]} ${offer.payAmt} for ${pair[1]} ${offer.buyAmt}`;
}

async function run() {
	const pairText = argv.pair || argv.p;
	const amount = argv.amount || argv.a;
	const endpoint = argv.endpoint || argv.e;
	const orderLimit = argv["order-limit"] || argv.O || 10;
	const takesLimit = argv["takes-limit"] || argv.T || 10;
	const maxOrderCount = argv["max-order"] || argv.M || 1000;
	const debug = argv.debug;
	if (argv.h || (!pairText && !amount && !endpoint)) {
		console.log(`
Usage: getprice.js [OPTIONS]

A self-sufficient runtime for containers  

Options:
	--help        -h    Show this message
	--amount      -a    Amount of needed token 
	--pair        -p    Token pair (expample W-ETH/DAI)
	--endpoint    -e    Ethereum endpoint
	--order-limit -O    Order output limit [default 10]
	--takes-limit -T    Takes limit [default 10]
	--max-order   -M    Max order count  [default 1000]
`);
	}
	if (!pairText) {
		console.log(util.format(errorTemplates.PARAM_IS_REQUIRED, "--pair"));
		process.exit(1);
	}
	if (!amount) {
		console.error(util.format(errorTemplates.PARAM_IS_REQUIRED, "--amount"));
		process.exit(1);
	}
	if (!endpoint) {
		console.error(util.format(errorTemplates.PARAM_IS_REQUIRED, "--endpoint"));
		process.exit(1);
	}

	else {
		try {
			const oasisApi = new OasisApi(endpoint);
			const pair = await oasisApi.getPairFromText(pairText);
			if (!oasisApi.checkPair(pair)) {
				console.error(util.format(errorTemplates.PAIR_NOT_IN_WHITE_LIST, pair.text));
				process.exit(1);
			}
			const [rawOrders, takes] = await Promise.all([
				oasisApi.getAllOfferForPair(pair, maxOrderCount),
				oasisApi.getLastTakeOrder(pair, takesLimit)
			]);
			const price = await oasisApi.getPrice(pair, amount, rawOrders);
			const offers = OasisApi.makeOffersFromRaw(pair, rawOrders.slice(0, orderLimit));
			if (price > 0) {
				console.log(`Price for pair ${pair.text} is ${price}`);
			} else {
				console.log(`You can't buy ${amount} token. Amount too much`);
			}
			console.log("Top better order:");
			offers.map(o => {
				console.log(offerToString(o));
			});
			console.log("Last takes:");
			takes.map(o => {
				console.log(offerToString(o));
			});
			process.exit(0);
		} catch (e) {
			if (debug) {
				console.error(`Error: ${e.stack}`);
			} else {
				console.error(
					`Error: ${e.toString()}
Use --debug for details.
`);
			}
			process.exit(1);
		}
	}
}

run();

/* eslint-enable no-console */