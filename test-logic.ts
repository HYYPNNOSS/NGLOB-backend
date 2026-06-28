const now = new Date();
const pickupDate = "2026-06-29T00:00:00.000Z";
const pickupTimeSlot = "SLOT_08_12";

const parts = pickupTimeSlot.replace('SLOT_', '').split('_').map(Number);
const endHour = parts[1] || 12;
const deadline = new Date(pickupDate);
deadline.setHours(endHour, 0, 0, 0);

console.log("now:", now);
console.log("deadline:", deadline);
console.log("now.getTime():", now.getTime());
console.log("deadline.getTime():", deadline.getTime());
console.log("now > deadline:", now.getTime() > deadline.getTime());
