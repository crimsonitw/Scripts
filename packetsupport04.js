(function() {
    'use strict';

    if (!window.location.href.includes('screen=place&mode=call')) {
        alert("Run on Mass Support screen (Rally point → Mass support)!");
        return;
    }

    const DEFENSE_UNITS = ["spear", "sword", "archer", "heavy"]; // spy excluded from defense
    const POP_PER_K = 1000;

    const UNIT_LABELS = {
        spear: "Spears",
        sword: "Swords",
        archer: "Archers",
        spy: "Scouts",
        heavy: "Heavies"
    };

    // === GUI ===
    const gui = document.createElement('div');
    gui.id = 'mass-support-gui';
    gui.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        width: 380px;
        background: rgba(30, 30, 50, 0.92);
        border: 2px solid #4a6fa5;
        border-radius: 10px;
        padding: 0;
        z-index: 9999;
        box-shadow: 0 8px 30px rgba(0,0,0,0.7);
        color: #e0e0ff;
        font-family: Verdana, sans-serif;
        overflow: hidden;
        backdrop-filter: blur(6px);
    `;

    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
        background: linear-gradient(to right, #2a4066, #3a5688);
        padding: 10px 16px; text-align: center; font-size: 18px;
        font-weight: bold; color: #ffffff; border-bottom: 1px solid #4a6fa5;
    `;
    titleBar.textContent = "PacketSender by Crim";
    gui.appendChild(titleBar);

    const content = document.createElement('div');
    content.style.padding = '16px';
    gui.appendChild(content);

    const form = document.createElement('div');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '14px';

    form.innerHTML = `
        <label style="font-weight:bold;">Total defense pop to send (k):</label>
        <input type="number" id="gui-total-k" value="10" min="1" step="1" style="padding:6px; font-size:15px;">

        <label style="font-weight:bold;">Max packet size per village (k pop):</label>
        <input type="number" id="gui-packet-k" value="1" min="0.5" step="0.5" style="padding:6px; font-size:15px;">

        <label style="font-weight:bold;">Max scouts/spies to send per village:</label>
        <input type="number" id="gui-max-spy" value="50" min="0" step="1" style="padding:6px; font-size:15px;">

        <label style="font-weight:bold;">Heavy Pop Count:</label>
        <input type="number" id="gui-heavy-pop" value="6" min="1" step="1" style="padding:6px; font-size:15px;">

        <div style="margin-top:8px;"><strong>Reserves per village (units to keep):</strong></div>
    `;

    const resGrid = document.createElement('div');
    resGrid.style.display = 'grid';
    resGrid.style.gridTemplateColumns = '1fr 1fr';
    resGrid.style.gap = '10px';

    const units = [
        {key:'spear',  label:'Spears',  def:0},
        {key:'sword',  label:'Swords',  def:0},
        {key:'archer', label:'Archers', def:0},
        {key:'spy',    label:'Scouts',  def:0},
        {key:'heavy',  label:'Heavies', def:100}
    ];

    units.forEach(u => {
        const d = document.createElement('div');
        d.innerHTML = `
            <label style="font-size:0.9em;">${u.label}</label>
            <input type="number" class="gui-reserve" data-unit="${u.key}" value="${u.def}" min="0" style="width:100%;padding:5px;">
        `;
        resGrid.appendChild(d);
    });

    form.appendChild(resGrid);

    const resultDiv = document.createElement('div');
    resultDiv.id = 'gui-result';
    resultDiv.style.marginTop = '16px';
    resultDiv.style.padding = '10px';
    resultDiv.style.background = 'rgba(0,0,0,0.3)';
    resultDiv.style.borderRadius = '6px';
    resultDiv.style.display = 'none';
    form.appendChild(resultDiv);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '12px';
    btnRow.style.marginTop = '12px';

    const sendBtn = document.createElement('button');
    sendBtn.textContent = "Send Packets";
    sendBtn.style.cssText = `
        flex:1; padding:12px; font-size:16px; font-weight:bold;
        background:#4a6fa5; color:white; border:none; border-radius:6px;
        cursor:pointer;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = "Close";
    closeBtn.style.cssText = `
        flex:1; padding:12px; font-size:16px;
        background:#555; color:white; border:none; border-radius:6px;
        cursor:pointer;
    `;

    btnRow.appendChild(sendBtn);
    btnRow.appendChild(closeBtn);
    form.appendChild(btnRow);
    content.appendChild(form);

    // Draggable
    let isDrag = false, curX, curY, initX, initY;
    titleBar.addEventListener('mousedown', e => {
        isDrag = true;
        initX = e.clientX - curX;
        initY = e.clientY - curY;
    });

    document.addEventListener('mousemove', e => {
        if (!isDrag) return;
        e.preventDefault();
        curX = e.clientX - initX;
        curY = e.clientY - initY;
        gui.style.left = curX + 'px';
        gui.style.top = curY + 'px';
        gui.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => isDrag = false);

    curX = window.innerWidth - 420;
    curY = 80;
    gui.style.left = curX + 'px';
    gui.style.top = curY + 'px';

    document.body.appendChild(gui);

    closeBtn.onclick = () => gui.remove();

    // === COOKIE HANDLING ===
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    function setCookie(name, value) {
        document.cookie = `${name}=${value}; path=/; max-age=31536000`; // 1 year
    }

    // Load saved values from cookies
    const savedTotalK = getCookie('ps_total_k');
    const savedPacketK = getCookie('ps_packet_k');
    const savedMaxSpy = getCookie('ps_max_spy');
    const savedHeavyPop = getCookie('ps_heavy_pop');

    if (savedTotalK) document.getElementById('gui-total-k').value = savedTotalK;
    if (savedPacketK) document.getElementById('gui-packet-k').value = savedPacketK;
    if (savedMaxSpy) document.getElementById('gui-max-spy').value = savedMaxSpy;
    if (savedHeavyPop) document.getElementById('gui-heavy-pop').value = savedHeavyPop;

    document.querySelectorAll('.gui-reserve').forEach(inp => {
        const savedRes = getCookie(`ps_reserve_${inp.dataset.unit}`);
        if (savedRes) inp.value = savedRes;
    });

    // === SEND LOGIC ===
    sendBtn.onclick = () => {
        const totalK = parseFloat(document.getElementById('gui-total-k').value) || 0;
        const maxPacketK = parseFloat(document.getElementById('gui-packet-k').value) || 1;
        const maxSpyPerVillage = parseInt(document.getElementById('gui-max-spy').value) || 50;
        const heavyPop = parseInt(document.getElementById('gui-heavy-pop').value) || 6;

        if (totalK <= 0 || maxPacketK <= 0 || heavyPop <= 0) {
            alert("Enter valid positive numbers.");
            return;
        }

        // Save to cookies
        setCookie('ps_total_k', totalK);
        setCookie('ps_packet_k', maxPacketK);
        setCookie('ps_max_spy', maxSpyPerVillage);
        setCookie('ps_heavy_pop', heavyPop);

        document.querySelectorAll('.gui-reserve').forEach(inp => {
            setCookie(`ps_reserve_${inp.dataset.unit}`, inp.value);
        });

        const TOTAL_DEFENSE_TARGET = Math.round(totalK * 1000);
        const MAX_PACKET_DEFENSE = Math.round(maxPacketK * 1000);

        const reserve = {};
        document.querySelectorAll('.gui-reserve').forEach(i => {
            reserve[i.dataset.unit] = parseInt(i.value) || 0;
        });

        // Collect
        const villages = [];
        let totalAvailDefensePop = 0;

        document.querySelectorAll("#village_troup_list tbody tr.call-village").forEach(row => {
            const coordEl = row.querySelector("td:first-child a");
            if (!coordEl) return;
            const coordMatch = coordEl.textContent.match(/\(?(\d+\|\d+)\)?/);
            if (!coordMatch) return;
            const coord = coordMatch[1];

            let defensePop = 0;
            const availTroops = {};
            let availSpies = 0;

            ["spear","sword","archer","spy","heavy"].forEach(u => {
                const cell = row.querySelector(`td[data-unit="${u}"]`);
                if (!cell) return;
                const span = cell.querySelector(".call-unit-count");
                let txt = span?.textContent?.trim() || "0";

                if (/k/i.test(txt)) txt = txt.replace(/k/i,"000").replace(/[.,]/g,"");
                txt = txt.replace(/[^0-9]/g,"");

                const total = parseInt(txt) || 0;
                const res = reserve[u] || 0;
                const avail = Math.max(0, total - res);

                availTroops[u] = avail;

                if (u === "spy") {
                    availSpies = avail;
                } else {
                    defensePop += (u === "heavy" ? avail * heavyPop : avail);
                }
            });

            if (defensePop > 0 || availSpies > 0) {
                villages.push({
                    coord,
                    availTroops,
                    defensePop,
                    availSpies,
                    rowElement: row
                });
                totalAvailDefensePop += defensePop;
            }
        });

        if (villages.length === 0) {
            alert("No villages with defense troops or scouts after reserves.");
            return;
        }

        const globalScale = TOTAL_DEFENSE_TARGET / totalAvailDefensePop;

        villages.forEach(v => {
            const villageDefenseMax = Math.floor(v.defensePop * globalScale);
            const packetDefenseCap = Math.min(villageDefenseMax, MAX_PACKET_DEFENSE);

            const packet = {};
            let packetDefensePop = 0;

            const totalDefenseThis = v.defensePop || 1;

            DEFENSE_UNITS.forEach(u => {
                let amt = 0;

                if (v.availTroops[u] > 0) {
                    const proportion = v.availTroops[u] / totalDefenseThis;
                    const raw = proportion * packetDefenseCap;
                    amt = Math.trunc(raw);
                    amt = Math.min(amt, v.availTroops[u]);
                }

                if (v.availTroops[u] <= 0) {
                    amt = 0;
                }

                packet[u] = amt;
                packetDefensePop += (u === "heavy" ? amt * heavyPop : amt);
            });

            if (packetDefensePop > MAX_PACKET_DEFENSE) {
                const ratio = MAX_PACKET_DEFENSE / packetDefensePop;
                DEFENSE_UNITS.forEach(u => {
                    packet[u] = Math.trunc(packet[u] * ratio);
                });
                packetDefensePop = DEFENSE_UNITS.reduce((s,u) => {
                    const a = packet[u] || 0;
                    return s + (u === "heavy" ? a * heavyPop : a);
                }, 0);
            }

            let spyAmt = Math.floor((v.availSpies / (totalDefenseThis + v.availSpies || 1)) * packetDefenseCap);
            spyAmt = Math.min(spyAmt, maxSpyPerVillage, v.availSpies);
            packet.spy = spyAmt;

            v.packet = packet;
            v.packetPop = packetDefensePop;
        });

        // === FIXED FILLING: Clear all + set values ===
        villages.forEach(v => {
            const row = v.rowElement;
            if (!row) return;

            // Clear ALL inputs to 0 first
            ["spear","sword","archer","spy","heavy"].forEach(u => {
                const inp = row.querySelector(`input[name^="call["][name$="[${u}]"]`);
                if (inp) {
                    inp.value = "0";
                    inp.dispatchEvent(new Event('input', {bubbles:true}));
                    inp.dispatchEvent(new Event('change', {bubbles:true}));
                }
            });

            // Check row only if sending something
            const cb = row.querySelector('input.troop-request-selector');
            const isSending = Object.values(v.packet).some(a => a > 0);
            if (isSending && cb && !cb.checked) {
                cb.checked = true;
                cb.dispatchEvent(new Event('change', {bubbles:true}));
                cb.dispatchEvent(new Event('click', {bubbles:true}));
            } else if (cb) {
                cb.checked = false;
            }

            // Fill values with longer delay
            setTimeout(() => {
                Object.entries(v.packet).forEach(([u, amt]) => {
                    const inp = row.querySelector(`input[name^="call["][name$="[${u}]"]`);
                    if (inp) {
                        inp.disabled = false;
                        inp.value = amt;
                        inp.dispatchEvent(new Event('input', {bubbles:true}));
                        inp.dispatchEvent(new Event('change', {bubbles:true}));
                    }
                });
            }, 300); // Increased delay to 300ms
        });

        // Results
        const sentDefenseTotal = villages.reduce((s,v)=>s+v.packetPop,0);
        const sentDefenseK = (sentDefenseTotal / 1000).toFixed(1);
        const filled = villages.filter(v=> Object.values(v.packet).some(a=>a>0)).length;

        let unitTotals = {spear:0, sword:0, archer:0, spy:0, heavy:0};
        villages.forEach(v => {
            Object.keys(unitTotals).forEach(u => {
                unitTotals[u] += v.packet[u] || 0;
            });
        });

        const resultHTML = `
            <strong style="color:#8ab4f8;">Results:</strong><br>
            Filled villages: <b>${filled}</b><br>
            Total defense sent (excl. scouts): <b>${sentDefenseK}k</b> pop (requested ${totalK}k)<br>
            <br>
            <strong>Units sent total:</strong><br>
            Spears: <b>${unitTotals.spear.toLocaleString()}</b><br>
            Swords: <b>${unitTotals.sword.toLocaleString()}</b><br>
            Archers: <b>${unitTotals.archer.toLocaleString()}</b><br>
            Scouts: <b>${unitTotals.spy.toLocaleString()}</b> (max ${maxSpyPerVillage} per village)<br>
            Heavies: <b>${unitTotals.heavy.toLocaleString()}</b><br>
        `;

        document.getElementById('gui-result').innerHTML = resultHTML;
        document.getElementById('gui-result').style.display = 'block';

        UI.SuccessMessage(
            `Success! Check GUI for exact totals.<br>Defense sent: <b>${sentDefenseK}k</b> pop`,
            8000
        );
    };
})();