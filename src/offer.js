module.exports =  class Offer {
  constructor(pair, payAmt, buyAmt) {
    this.pair = pair;
    this.payAmt = payAmt;
    this.buyAmt = buyAmt;
  }

  static createFromTakeEvent(pair, event) {
    return new Offer(pair, event.returnValues.give_amt, event.returnValues.take_amt);
  }
};