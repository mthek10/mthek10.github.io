/* Shipping (Consumer Services OMS) seed data → window.PBX_DEMO.data. */
window.PBX_DEMO = window.PBX_DEMO || {};
window.PBX_DEMO.data = {
  agent: { id: "A-3391" },

  orders: [
    {
      id: "100247",
      status: "PLACED",
      items: [
        { name: "SNKRS Air Jordan 1 Retro (hyped)", price: 220.0, isHyped: true },
        { name: "Crew Socks 3-pack", price: 18.0, isHyped: false },
      ],
      billingAddress: { name: "Alex Rivera", street: "88 Birch Rd", city: "Portland, OR", zip: "97201" },
      shippingAddress: { name: "Alex Rivera", street: "88 Birch Rd", city: "Portland, OR", zip: "97201" },
    },
    {
      id: "100312",
      status: "SHIPPED",
      items: [{ name: "Running Tee", price: 35.0, isHyped: false }],
      billingAddress: { name: "Jordan Lee", street: "5 Oak Ave", city: "Austin, TX", zip: "73301" },
      shippingAddress: { name: "Jordan Lee", street: "5 Oak Ave", city: "Austin, TX", zip: "73301" },
    },
  ],

  // Address reuse history per agent. "14 Maple St" is the fraud pattern
  // (reused 3 times by this agent); the billing address has count 1.
  addressHistory: [
    { address: "14 Maple St", reuseCountForAgent: 3 },
    { address: "88 Birch Rd", reuseCountForAgent: 1 },
    { address: "5 Oak Ave", reuseCountForAgent: 1 },
  ],
};
