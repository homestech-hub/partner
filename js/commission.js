const RATE = {
    camera: 0.05,    // 5%
    wifi: 0.04,      // 4%
    smarthome: 0.12  // 12%
};

export function calcCommission(orderValue, type) {
    const rate = RATE[type] || 0;
    return Math.round(orderValue * rate);
}