// verify-checkpoints.js
function calculatePmt(principal, annualRate, months) {
  const r = annualRate / 12;
  return principal * (r / (1 - Math.pow(1 + r, -months)));
}

function runAmort(startBal, monthlyPmt, extraMo, months, stopAt750k) {
  let bal = startBal;
  let totalInt = 0;
  for (let m = 1; m <= months; m++) {
    if (bal <= 0) break;
    const intr = bal * (0.0575 / 12);
    let extra = extraMo;
    if (stopAt750k && bal <= 750000) extra = 0;
    let prin = (monthlyPmt - intr) + extra;
    if (prin > bal) prin = bal;
    bal -= prin;
    totalInt += intr;
  }
  return { endBal: bal, totalInt };
}

const base = runAmort(1090532.21, 6454.32, 0, 107, false);
console.log("=== CHECKPOINT VERIFICATION ===");

// 1. $90,532.21 Lump Sum + Mode A + $0/mo
const b0 = 1090532.21 - 90532.21;
const pRecast = calculatePmt(b0, 0.0575, 347);
const diff = 6454.32 - pRecast;
const chk1 = runAmort(b0, 6454.32, 0, 107, false);
const chk1SavedInt = base.totalInt - chk1.totalInt;
const chk1Reset8 = calculatePmt(chk1.endBal, 0.08, 240);

console.log("Checkpoint 1:");
console.log("  Recast Required P&I:", pRecast.toFixed(2), "-> Target: 5918.41");
console.log("  Incremental Monthly Principal:", diff.toFixed(2), "-> Target: 535.91");
console.log("  Fixed-Period Interest Saved:", chk1SavedInt.toFixed(2), "-> Target: 60454.22");
console.log("  Ending Balance (09/01/2035):", chk1.endBal.toFixed(2), "-> Target: 768293.48");
console.log("  Post-Reset P&I @ 8.00%:", chk1Reset8.toFixed(2), "-> Target: 6426.31 (lower than $6,454.32)");

// 2. $90,532.21 Lump Sum + Mode B + $0/mo
const chk2 = runAmort(b0, pRecast, 0, 107, false);
const chk2SavedInt = base.totalInt - chk2.totalInt;

console.log("\nCheckpoint 2:");
console.log("  Required P&I Paid:", pRecast.toFixed(2), "-> Target: 5918.41");
console.log("  Monthly Cash Relief:", diff.toFixed(2), "-> Target: 535.91");
console.log("  Incremental Monthly Principal: 0.00 -> Target: 0.00");
console.log("  Fixed-Period Interest Saved:", chk2SavedInt.toFixed(2), "-> Target: 43112.41");
console.log("  Ending Balance (09/01/2035):", chk2.endBal.toFixed(2), "-> Target: 842977.66");

// 3. $90,532.21 Lump Sum + Mode A + $1,000/mo extra
const chk3 = runAmort(b0, 6454.32, 1000, 107, false);
const chk3SavedInt = base.totalInt - chk3.totalInt;
const chk3Reset1075 = calculatePmt(chk3.endBal, 0.1075, 240);

console.log("\nCheckpoint 3:");
console.log("  Incremental Monthly Principal:", (diff + 1000).toFixed(2), "-> Target: 1535.91");
console.log("  Fixed-Period Interest Saved:", chk3SavedInt.toFixed(2), "-> Target: 92813.65");
console.log("  Ending Balance (09/01/2035):", chk3.endBal.toFixed(2), "-> Target: 628934.05");
console.log("  Post-Reset P&I @ 10.75%:", chk3Reset1075.toFixed(2), "-> Target: 6385.12 (lower than $6,454.32)");
