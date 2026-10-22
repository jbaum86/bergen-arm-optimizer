// test-math.js
function calculatePmt(principal, annualRate, months) {
  const r = annualRate / 12;
  return principal * (r / (1 - Math.pow(1 + r, -months)));
}

function runAmortization(startBalance, annualRate, monthlyPayment, months, extraMonthly = 0, stopAt750k = false) {
  let balance = startBalance;
  let totalInterest = 0;
  let totalPrincipal = 0;
  const schedule = [];

  const r = annualRate / 12;

  for (let m = 1; m <= months; m++) {
    if (balance <= 0) {
      schedule.push({ month: m, balance: 0, interest: 0, principal: 0, payment: 0 });
      continue;
    }

    const interest = balance * r;
    let extra = extraMonthly;
    if (stopAt750k && balance <= 750000) {
      extra = 0;
    }

    let payment = monthlyPayment + extra;
    let principal = payment - interest;

    if (principal > balance) {
      principal = balance;
      payment = interest + principal;
    }

    balance -= principal;
    totalInterest += interest;
    totalPrincipal += principal;

    schedule.push({
      month: m,
      balance,
      interest,
      principal,
      payment
    });
  }

  return {
    endBalance: balance,
    totalInterest,
    totalPrincipal,
    schedule
  };
}

console.log("--- 1. Baseline Test ---");
const baseline = runAmortization(1090532.21, 0.0575, 6454.32, 107, 0);
console.log("Baseline Ending Balance:", baseline.endBalance.toFixed(2), "Target: 919279.91");
console.log("Baseline Total Interest:", baseline.totalInterest.toFixed(2), "Target: 524591.27");

console.log("\n--- 2. Strategy 9 ($90,532.21 lump sum, no recast) ---");
const strat9Balance = 1090532.21 - 90532.21;
const strat9 = runAmortization(strat9Balance, 0.0575, 6454.32, 107, 0);
console.log("Strat 9 Ending Balance:", strat9.endBalance.toFixed(2), "Target: 768293.48");
console.log("Strat 9 Interest Saved:", (baseline.totalInterest - strat9.totalInterest).toFixed(2), "Target: 60454.22");

console.log("\n--- 3. Strategy 10 ($90,532.21 lump sum with free recast over 347 mos) ---");
const recastPmt = calculatePmt(strat9Balance, 0.0575, 347);
console.log("Recast Monthly P&I:", recastPmt.toFixed(2), "Target: 5918.41");
const strat10 = runAmortization(strat9Balance, 0.0575, recastPmt, 107, 0);
console.log("Strat 10 Interest Saved:", (baseline.totalInterest - strat10.totalInterest).toFixed(2), "Target: 43112.41");

console.log("\n--- 4. Strategy 13 ($90,532.21 lump sum + $1000/mo extra, no recast) ---");
const strat13 = runAmortization(strat9Balance, 0.0575, 6454.32, 107, 1000);
console.log("Strat 13 Ending Balance:", strat13.endBalance.toFixed(2), "Target: 628934.05");
console.log("Strat 13 Interest Saved:", (baseline.totalInterest - strat13.totalInterest).toFixed(2), "Target: 92813.65");

const resetPmtStrat13 = calculatePmt(strat13.endBalance, 0.1075, 240);
console.log("Strat 13 Reset Payment @ 10.75%:", resetPmtStrat13.toFixed(2), "Target: 6385.12");
