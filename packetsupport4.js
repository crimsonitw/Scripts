let url = window.location.href;

if (!url.includes("screen=place&mode=call")) {
    alert("This script must be run from Rally point → Mass support!");
    window.location.href = game_data.link_base_pure + "place&mode=call";
    throw new Error("Wrong screen");
}

// =============================================
// CONFIG / CONSTANTS
// =============================================

const DEFENSE_UNITS = ["spear", "sword", "archer", "heavy"]; // only these count as defense pop
const HEAVY_POP   = 6;      // heavy cav population (can be changed)
const POP_PER_K   = 1000;

const MIN_PACKET_TOLERANCE = 0.92;  // allow packets to be at least ~92% of target

// =============================================
// 1. Ask user for desired values
// =============================================

let totalPopWantedK  = prompt("Total DEFENSE population to send (in thousands)\nExample: 45 = 45 000 pop", "40");
let targetPacketPopK = prompt("Desired packet size (in thousands pop)\nExample: 1 = 1000 pop packets", "1");

totalPopWantedK  = parseFloat(totalPopWantedK);
targetPacketPopK = parseFloat(targetPacketPopK);

if (isNaN(totalPopWantedK) || totalPopWantedK <= 0) {
    alert("Invalid total population value!");
    throw new Error("Invalid input");
}
if (isNaN(targetPacketPopK) || targetPacketPopK <= 0) {
    alert("Invalid packet size!");
    throw new Error("Invalid input");
}

const TOTAL_POP_WANTED  = Math.round(totalPopWantedK * POP_PER_K);
const TARGET_PACKET_POP = Math.round(targetPacketPopK * POP_PER_K);

UI.InfoMessage(`Target: ~${totalPopWantedK.toFixed(1)}k pop in ~${Math.round(TOTAL_POP_WANTED / TARGET_PACKET_POP)} packets of ~${targetPacketPopK.toFixed(1)}k pop each`, 8000);

// =============================================
// 2. Collect available defense troops from table
// =============================================

let villages = [];
let totalAvailablePop = 0;

Array.from($("#village_troup_list tbody tr")).forEach(row => {
    let coord = row.querySelector(".village").innerText.match(/\d+\|\d+/);
    if (!coord) return;
    coord = coord[0];

    let distance = parseFloat(row.querySelector(".distance").innerText) || 999;

    let troops = {};
    let villagePop = 0;

    DEFENSE_UNITS.forEach(unit => {
        let amount = parseInt(row.querySelector(`[data-unit="${unit}"]`)?.innerText || "0");
        troops[unit] = amount;
        if (unit === "heavy") {
            villagePop += amount * HEAVY_POP;
        } else {
            villagePop += amount;
        }
    });

    if (villagePop > 0) {
        villages.push({
            coord,
            distance,
            troops,
            totalPop: villagePop
        });
        totalAvailablePop += villagePop;
    }
});

if (villages.length === 0) {
    alert("No villages with defense troops found!");
    throw new Error("No villages");
}

if (totalAvailablePop < TOTAL_POP_WANTED * MIN_PACKET_TOLERANCE) {
    UI.ErrorMessage(`You only have ~${Math.round(totalAvailablePop/1000)}k defense pop available! (wanted ${totalPopWantedK}k)`, 8000);
}

// =============================================
// 3. Calculate proportional packets
// =============================================

villages.forEach(v => {
    let ratio = Math.min(1, TOTAL_POP_WANTED / totalAvailablePop); // safety cap

    let targetVillagePop = Math.round(v.totalPop * ratio);

    // We try to get as close as possible to target packet, but respect village proportions
    let scale = Math.min(1, TARGET_PACKET_POP / targetVillagePop);

    let packet = {};

    let packetPop = 0;

    DEFENSE_UNITS.forEach(unit => {
        let raw = v.troops[unit] * scale;
        let rounded = Math.round(raw);
        packet[unit] = rounded;
        packetPop += (unit === "heavy" ? rounded * HEAVY_POP : rounded);
    });

    // Small correction - try to reach target better
    if (packetPop < TARGET_PACKET_POP * 0.92 && packetPop < targetVillagePop) {
        // add 1 heavy if possible (most expensive)
        if (packet.heavy < v.troops.heavy) {
            packet.heavy++;
            packetPop += HEAVY_POP;
        }
        // or spear/sword/archer
        else if (packet.spear < v.troops.spear) {
            packet.spear++;
            packetPop += 1;
        }
    }

    v.packet = packet;
    v.packetPop = packetPop;
});

// =============================================
// 4. Fill the table
// =============================================

// First reset & select all villages
document.getElementById("place_call_select_all").click();
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
        // uncheck empty villages
        row.find("input[type=checkbox]").prop("checked", false);
    }
});

// =============================================
// 5. Final report
// =============================================

let realPackets = filledCount;
let avgPacket = totalSentPop / filledCount / 1000;
let totalSentK = totalSentPop / 1000;

UI.SuccessMessage(
    `Filled ${filledCount} villages<br>` +
    `Total sent: ≈${totalSentK.toFixed(1)}k pop<br>` +
    `Average packet: ≈${avgPacket.toFixed(0)} pop`, 12000
);

console.table(villages.map(v => ({
    coord: v.coord,
    distance: v.distance.toFixed(1),
    pop: v.packetPop,
    spear: v.packet.spear,
    sword: v.packet.sword,
    archer: v.packet.archer || 0,
    spy: v.packet.spy,
    heavy: v.packet.heavy
})));