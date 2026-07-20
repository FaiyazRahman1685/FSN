export type PlayerSlot = "p1" | "p2";

export type PlayerScoreTotals = Record<PlayerSlot, number>;

export class PlayerScoreLedger {
  private scores: PlayerScoreTotals = { p1: 0, p2: 0 };

  reset() {
    this.scores = { p1: 0, p2: 0 };
  }

  add(slot: PlayerSlot, points: number) {
    if (points <= 0) return;
    this.scores[slot] += points;
  }

  get(slot: PlayerSlot) {
    return Math.floor(this.scores[slot]);
  }

  getTotals() {
    return {
      p1: this.get("p1"),
      p2: this.get("p2"),
    };
  }

  getCombinedTotal() {
    return this.get("p1") + this.get("p2");
  }

  distributeRemainder(totalScore: number, hasPlayer2: boolean) {
    const remainder = totalScore - this.getCombinedTotal();
    if (remainder <= 0) return;

    if (hasPlayer2) {
      this.add("p1", remainder / 2);
      this.add("p2", remainder / 2);
      return;
    }

    this.add("p1", remainder);
  }
}
