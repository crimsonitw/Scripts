// Original concept: Costache Madalin → heavy modification 2025

let url = window.location.href;

if (!url.includes("screen=place&mode=call")) {
    alert("Run this script from Rally point → Mass support!");
    window.location.href = game_data.link_base_pure + "place&mode=call";
    throw new Error("Wrong screen");
}

// =============================================
// CONFIG / CONSTANTS
// =============================================

const DEFENSE_UNITS = ["spear", "sword", "archer", "spy", "heavy"];
const HEAVY_POP   = 6;          // heavy cavalry population (change if needed)
const POP_PER_K   = 1000;

// Unit labels for nicer prompt
const UNIT_LABELS = {
    spear:  "Spears",
    sword:  "Swords",
    archer: "Archers",
    spy:    "Scouts",
    heavy:  "Heavies"
};

// =============================================
// 1. Ask user for main parameters
// =============================================

let totalPopWantedK  = prompt("Total DEFENSE population you want to SEND (in thousands)\nExample: 45 → 45 000 pop", "40");
let targetPacketPopK = prompt("Desired packet size (in thousands pop)\nExample: 1 → 1000 pop packets", "1");

totalPopWantedK  = parseFloat(totalPopWantedK) || 0;
targetPacketPopK = parseFloat(targetPacketPopK) || 1;

if (totalPopWantedK <= 0) {
    alert("Invalid total population to send!");
    throw new Error("Invalid total pop input");
}
if (targetPacketPopK <= 0) {
    alert("Invalid packet size!");
    throw new Error("Invalid packet size");
}

const TOTAL_POP_WANTED  = Math.round(totalPopWantedK * POP_PER_K);
const TARGET_PACKET_POP = Math.round(targetPacketPopK * POP_PER_K);

// =============================================
// 2. Ask for per-unit reserves
// =============================================

UI.InfoMessage("Now enter how many units you want to KEEP in each village (per type)\nLeave blank or 0 for no reserve", 10000);

let reserve = {};

let reservePromptText = "RESERVE PER VILLAGE (number of units - leave blank/0 if none):\n\n";

DEFENSE_UNITS.forEach(unit => {
    let label = UNIT_LABELS[unit] || unit;
    let defaultVal = (unit === "heavy") ? "200" : (unit === "spear") ? "5000" : "0";
    let amount = prompt(reservePromptText + label + ":", defaultVal);
    reserve[unit] = parseInt(amount) || 0;
});

console.log("Reserve settings:", reserve);

// Show summary
let reserveSummary = "Reserves set:\n";
DEFENSE_UNITS.forEach(u => {
    if (reserve[u] > 0) {
        reserveSummary += `• ${UNIT_LABELS[u]}: ${reserve[u]}\n`;
    }
});
if (reserveSummary === "Reserves set:\n") reserveSummary += "• No reserves set\n";
UI.InfoMessage(reserveSummary, 8000);

// =============================================
// 3. Collect available troops (after per-unit reserve)
// =============================================

let villages = [];
alert("Total visible rows with troops: " + $("#village_troup_list tbody tr").length);
alert("First row spear text: " + $("#village_troup_list [data-unit='spear']").first().text());
let totalAvailablePop = 0;

Array.from($("#village_troup_list tbody tr")).forEach(row => {
    let coordMatch = row.querySelector(".village")?.innerText.match(/\d+\|\d+/);
    if (!coordMatch) return;
    let coord = coordMatch[0];

    let distance = parseFloat(row.querySelector(".distance")?.innerText) || 999;

    let troops = {};
    let availablePop = 0;

    DEFENSE_UNITS.forEach(unit => {
        let total = parseInt(row.querySelector(`[data-unit="${unit}"]`)?.innerText || "0");
        let reserved = reserve[unit] || 0;
        let available = Math.max(0, total - reserved);

        troops[unit] = available;
        availablePop += (unit === "heavy" ? available * HEAVY_POP : available);
    });

    if (availablePop > 0) {
        villages.push({
            coord,
            distance,
            troops,
            availablePop,
            totalTroops: Object.fromEntries(DEFENSE_UNITS.map(u => [u, parseInt(row.querySelector(`[data-unit="${u}"]`)?.innerText || "0")]))
        });
        totalAvailablePop += availablePop;
    }
});

if (villages.length === 0) {
    alert("No villages with defense troops above the set reserves!");
    throw new Error("No usable villages");
}

if (totalAvailablePop < TOTAL_POP_WANTED * 0.92) {
    UI.ErrorMessage(
        `Only ~${Math.round(totalAvailablePop/1000)}k defense pop available after reserves!\n` +
        `(wanted ${totalPopWantedK}k)`,
        9000
    );
}

// =============================================
// 4. Calculate proportional packets
// =============================================

villages.forEach(v => {
    // How much of the total send goal this village should contribute
    let contributionRatio = v.availablePop / totalAvailablePop;
    let targetVillagePop = Math.round(TOTAL_POP_WANTED * contributionRatio);

    // Scale to desired packet size
    let scale = Math.min(1, TARGET_PACKET_POP / targetVillagePop);

    let packet = {};
    let packetPop = 0;

    DEFENSE_UNITS.forEach(unit => {
        let raw = v.troops[unit] * scale;
        let rounded = Math.round(raw);
        packet[unit] = rounded;
        packetPop += (unit === "heavy" ? rounded * HEAVY_POP : rounded);
    });

    // Try to get closer to target packet size (small adjustment)
    if (packetPop < TARGET_PACKET_POP * 0.93 && packetPop < targetVillagePop) {
        const tryAddOrder = ["heavy", "spear", "sword", "archer", "spy"];
        for (let unit of tryAddOrder) {
            if (packet[unit] < v.troops[unit]) {
                packet[unit]++;
                packetPop += (unit === "heavy" ? HEAVY_POP : 1);
                break;
            }
        }
    }

    v.packet = packet;
    v.packetPop = packetPop;
});

// =============================================
// 5. Fill the support table
// =============================================

// Reset & select all
$("#place_call_select_all").prop("checked", true).trigger("click");
$("#village_troup_list input[type=number]").val(0);

let filledCount = 0;
let totalSentPop = 0;

villages.forEach(v => {
    let row = $(`#village_troup_list tr:contains("${v.coord}")`);
    if (row.length === 0) return;

    let hasTroops = false;

    Object.entries(v.packet).forEach(([unit, amount]) => {
        if (amount > 0) {
            let input = row.find(`input[data-unit="${unit}"]`);
            if (input.length) {
                input.val(amount);
                hasTroops = true;
            }
        }
    });

    if (hasTroops) {
        filledCount++;
        totalSentPop += v.packetPop;
    } else {
        row.find("input[type=checkbox]").prop("checked", false);
    }
});

// =============================================
// 6. Final feedback
// =============================================

let avgPacket = totalSentPop / filledCount / 1000 || 0;
let totalSentK = totalSentPop / 1000;

let reserveMsg = "Reserves active:\n" + 
    Object.entries(reserve)
        .filter(([_,v]) => v > 0)
        .map(([u,v]) => `• ${UNIT_LABELS[u]}: ${v}`)
        .join("\n") || "No unit reserves set";

UI.SuccessMessage(
    `Filled ${filledCount} villages<br>` +
    `Total sent: ≈${totalSentK.toFixed(1)}k pop<br>` +
    `Average packet: ≈${avgPacket.toFixed(0)} pop<br><br>` +
    `<small>${reserveMsg}</small>`,
    14000
);

console.table(villages.map(v => ({
    coord: v.coord,
    distance: v.distance.toFixed(1),
    sent_pop: v.packetPop,
    spear: v.packet.spear,
    sword: v.packet.sword,
    archer: v.packet.archer || 0,
    spy: v.packet.spy,
    heavy: v.packet.heavy,
    reserved_spear: reserve.spear,
    reserved_heavy: reserve.heavy
})));