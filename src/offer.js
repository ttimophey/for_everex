module.exports =  class Offer {
  constructor(pair, payAmt, buyAmt) {
    this.pair = pair.text;
    this.payAmt = parseInt(payAmt, 10) / Math.pow(10, pair.fromDecimals);
    this.buyAmt = parseInt(buyAmt, 10) / Math.pow(10, pair.toDecimals);
  }

  static createFromTakeEvent(pair, event) {
    return new Offer(pair, event.returnValues.give_amt, event.returnValues.take_amt);
  }
};