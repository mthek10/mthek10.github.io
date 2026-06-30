/* Chart Console (Epic-style) seed data → window.PBX_DEMO.data.
 * Demo moment: with no active call, Sam opens the restricted patient (Riverez)
 * → transactionMatch:false, restricted:true. The PixieBrix mod gates access.
 * Start call with that patient → transactionMatch:true (legitimate). */
window.PBX_DEMO = window.PBX_DEMO || {};
window.PBX_DEMO.data = {
  agent: { id: "sam.t", name: "Sam T.", searchCountSession: 0 },
  activeCall: { patientId: null },
  patients: [
    {
      id: "MRN-0099821",
      name: { last: "Riverez", first: "Alex" },
      ageSex: "47y M",
      dob: "1978-03-12",
      phone: "(415) 555-0148",
      address: "—",
      restricted: true, // VIP / sensitive
      allergies: ["Penicillin"],
      problems: ["Hypertension", "Type 2 diabetes"],
      meds: ["Lisinopril 10mg", "Metformin 500mg"],
      pcp: "Dr. Osei",
      coverage: "BlueShield PPO",
      vitals: { bp: "138/86", hr: "72" },
      encounters: [
        { date: "14JUN", type: "Office", department: "Cardiology", provider: "Dr. Lee", dx: "Essential hypertension" },
        { date: "02MAY", type: "Telephone", department: "Primary care", provider: "Dr. Osei", dx: "Medication review" },
      ],
    },
    {
      id: "MRN-0044120",
      name: { last: "Nguyen", first: "Pat" },
      ageSex: "34y F",
      dob: "1991-09-02",
      phone: "(415) 555-0192",
      address: "—",
      restricted: false,
      allergies: ["None on file"],
      problems: ["Asthma"],
      meds: ["Albuterol inhaler"],
      pcp: "Dr. Reyes",
      coverage: "Aetna HMO",
      vitals: { bp: "118/74", hr: "68" },
      encounters: [
        { date: "20JUN", type: "ER", department: "Emergency", provider: "Dr. Kim", dx: "Acute bronchitis" },
      ],
    },
  ],
};
