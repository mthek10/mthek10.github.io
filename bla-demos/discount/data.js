/* Discount (OrderDesk — Adidas-branded) seed data → window.PBX_DEMO.data. */
window.PBX_DEMO = window.PBX_DEMO || {};
window.PBX_DEMO.data = {
  case: { id: "611AD00000a7XZTRq2" },

  // The customer-service agent working the case.
  agent: { id: "A-882", name: "Marcus Lee", tierCapPct: 20 },

  customer: {
    id: "C-4471",
    name: "Diego Morales",
    email: "dmorales.run@gmail.com",
    memberId: "6042185530",
    codesInWindow: 3,
  },

  // Orders for this member — looked up on the Order Lookup stage.
  orders: [
    {
      id: "AD-123",
      customer: {
        id: "C-4471",
        name: "Diego Morales",
        email: "dmorales.run@gmail.com",
        memberId: "6042185530",
        codesInWindow: 3,
      },
      lineItems: [
        {
          sku: "HQ8708",
          name: "adidas Y-3 Qasa High",
          type: "merch",
          desc: "Lifestyle Shoes",
          color: "Core Black/Cloud White",
          listPrice: 250.0,
          unitPrice: 250.0,
          qty: 1,
          size: "10",
          sizeOptions: ["8", "8.5", "9", "9.5", "10", "10.5", "11", "12"],
        },
        {
          sku: "GC-ADI-050",
          name: "adidas Gift Card",
          type: "giftcard",
          desc: "Digital gift card",
          color: "—",
          listPrice: 50.0,
          unitPrice: 50.0,
          qty: 1,
          size: null,
          sizeOptions: [],
        },
        {
          sku: "IJ0732",
          name: "adidas Trefoil Crew Socks",
          type: "merch",
          desc: "Crew Socks (3 Pairs)",
          color: "Black/White",
          listPrice: 22.0,
          unitPrice: 18.97,
          qty: 1,
          size: "M (5-8)",
          sizeOptions: ["S (3-5)", "M (5-8)", "L (8-11)", "XL (12-15)"],
        },
      ],
    },
    {
      id: "AD-456",
      customer: {
        id: "C-5583",
        name: "Priya Nair",
        email: "priya.n88@gmail.com",
        memberId: "5127740183",
        codesInWindow: 1,
      },
      lineItems: [
        {
          sku: "HQ4198",
          name: "adidas Ultraboost Light",
          type: "merch",
          desc: "Men's Running Shoes",
          color: "Cloud White/Grey",
          listPrice: 190.0,
          unitPrice: 190.0,
          qty: 1,
          size: "10",
          sizeOptions: ["8", "8.5", "9", "9.5", "10", "10.5", "11", "12"],
        },
        {
          sku: "IC9770",
          name: "adidas Adicolor Classics Hoodie",
          type: "merch",
          desc: "Men's Hoodie",
          color: "Black",
          listPrice: 70.0,
          unitPrice: 70.0,
          qty: 1,
          size: "M",
          sizeOptions: ["XS", "S", "M", "L", "XL", "XXL"],
        },
      ],
    },
    {
      id: "AD-789",
      customer: {
        id: "C-6690",
        name: "Jordan Blake",
        email: "jblake.athletics@outlook.com",
        memberId: "7391026654",
        codesInWindow: 6,
      },
      lineItems: [
        {
          sku: "B75807",
          name: "adidas Samba OG",
          type: "merch",
          desc: "Originals Shoes",
          color: "Core Black/Cloud White",
          listPrice: 100.0,
          unitPrice: 100.0,
          qty: 1,
          size: "9",
          sizeOptions: ["7", "8", "9", "10", "11", "12"],
        },
        {
          sku: "IJ0740",
          name: "adidas Trefoil Crew Socks",
          type: "merch",
          desc: "Crew Socks (6 Pairs)",
          color: "White",
          listPrice: 22.0,
          unitPrice: 18.0,
          qty: 2,
          size: "L (8-11)",
          sizeOptions: ["S (3-5)", "M (5-8)", "L (8-11)", "XL (12-15)"],
        },
        {
          sku: "GC-ADI-025",
          name: "adidas Gift Card",
          type: "giftcard",
          desc: "Digital gift card",
          color: "—",
          listPrice: 25.0,
          unitPrice: 25.0,
          qty: 1,
          size: null,
          sizeOptions: [],
        },
      ],
    },
  ],

  // Clean address on file for this member (the safe default at checkout).
  shipping: {
    onFile: {
      name: "Diego Morales",
      street: "482 Larkspur Ave",
      apt: "Apt 5B",
      city: "Sacramento",
      state: "CA",
      zip: "95814",
      email: "dmorales.run@gmail.com",
      phone: "(916) 555-0148",
    },
  },

  // Seeded known-fraud address. The app does NOT block it — it only exposes the
  // signal (context + data-pbx-known-fraud). The PixieBrix layer is what blocks.
  fraudAddresses: [
    {
      name: "Diego Morales",
      street: "14 Maple St",
      apt: "",
      city: "Columbus",
      state: "OH",
      zip: "43004",
      reuseCount: 3,
      reason: "Linked to 3 prior chargebacks; flagged reshipper address",
    },
  ],
};
