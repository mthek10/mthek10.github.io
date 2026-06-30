/* Loyalty (FQTV Servicing Console) seed data → window.PBX_DEMO.data.
 * Ships the console already showing the fraud pattern (a +75,000 goodwill credit
 * followed by a −75,000 transfer to a 2-day-old account, agent at 8 manual
 * credits vs a baseline of 2). The PixieBrix mod acts on this during the demo. */
window.PBX_DEMO = window.PBX_DEMO || {};
window.PBX_DEMO.data = {
  agent: { id: "dana.k", name: "Dana K.", manualCreditsToday: 8, peerBaseline: 2 },
  members: [
    {
      id: "AA-1029384",
      name: { last: "VALE", first: "JORDAN", title: "MR" },
      tier: "Gold",
      nextTier: "Platinum",
      milesToNextTier: 12500,
      balance: 64300,
      pnr: "X4K9TQ",
      coBrandCardLast4: "4417",
      ledger: [
        { date: "20JUN", description: "Mileage transfer → #88231", type: "Transfer", miles: -75000, balance: 64300 },
        { date: "20JUN", description: "Goodwill – service recovery", type: "Goodwill adj", miles: 75000, balance: 139300 },
        { date: "18JUN", description: "Flight AA1423 LAX–JFK", type: "Flight earn", miles: 2450, balance: 64300 },
        { date: "12JUN", description: "Hotel partner – 3 nights", type: "Partner earn", miles: 1100, balance: 61850 },
        { date: "05JUN", description: "Award ticket SFO–LHR", type: "Redemption", miles: -40000, balance: 60750 },
      ],
    },
  ],
  accounts: [
    { id: "#88231", ageDays: 2, balance: 0 }, // fraud recipient (brand new)
    { id: "#40012", ageDays: 900, balance: 18250 }, // clean recipient
  ],
  retroClaims: [
    { flightNo: "AA1423", flightDate: "18JUN", matchingFlightExists: true, daysSinceDeparture: 6, milesIfAccepted: 2450 },
    { flightNo: "ZZ9999", flightDate: "02JAN", matchingFlightExists: false, daysSinceDeparture: 210, milesIfAccepted: 9000 },
  ],
};
