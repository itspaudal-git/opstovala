// quality.js
// JavaScript for a real-time QA Dashboard
// 1) Realtime using on('value',...)
// 2) Sort by Term, then Task, then Product
// 3) Limit to 1000 rows
// 4) Extra columns for multiple logs (Weight2, Weight3, etc. => QA Logs2, QA Logs3...)
// 5) Searching across all row contents

const cookingTasks = new Set([
    "Batch Mix", "Sauce Mix", "Open", "Drain",
    "Kettle", "Oven", "Thaw", "VCM", "Planetary Mix", "Skillet"
]);

// Tasks to exclude
const excludedTasks = new Set([
    "Batch Mix", "Open", "Drain", "Oven", "Thaw", "VCM", "Planetary Mix","Band Sealing",
]);

document.addEventListener('DOMContentLoaded', function() {
    // If not already initialized
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

    const db = firebase.database();

    // Query selectors
    const termMin       = document.getElementById('termMin');
    const termMax       = document.getElementById('termMax');
    const filterTask    = document.getElementById('filterTask');
    const filterFacility= document.getElementById('filterFacility');
    const filterDate    = document.getElementById('filterDate');
    const applyFilterBtn= document.getElementById('applyFilterBtn');
    const clearFilterBtn= document.getElementById('clearFilterBtn');

    const globalSearch  = document.getElementById('globalSearch');

    const taskTableHead = document.getElementById('taskTableHead');
    const taskTableBody = document.getElementById('taskTableBody');

    // Modal references
    const qaModal   = new bootstrap.Modal(document.getElementById('qaModal'), {});
    const modalSaveBtn = document.getElementById('modalSaveBtn');
    const formError = document.getElementById('formError');

    // pH
    const phSection    = document.getElementById('phSection');
    const phType       = document.getElementById('phType');
    const phValue      = document.getElementById('phValue');
    const phTempNeeded = document.getElementById('phTempNeeded');
    const phInitials   = document.getElementById('phInitials');
    const phReviewed   = document.getElementById('phReviewed');
    const phDate       = document.getElementById('phDate');

    // Weight
    const weightSection= document.getElementById('weightSection');
    const wtWeight     = document.getElementById('wtWeight');
    const wtDirectInsp = document.getElementById('wtDirectInsp');
    const wtInitials   = document.getElementById('wtInitials');
    const wtComments   = document.getElementById('wtComments');
    const wtDate       = document.getElementById('wtDate');

    // Tray
    const traySection   = document.getElementById('traySection');
    const trayEquipment = document.getElementById('trayEquipment');
    const trayOxygen    = document.getElementById('trayOxygen');
    const trayTime      = document.getElementById('trayTime');

    let allEntries = [];
    let currentEntry = null;
    let isPhForm = false;

    // Real-time: We watch Master_Task for any changes
    db.ref('Master_Task').on('value', snapshot => {
        if (!snapshot.exists()) {
            allEntries = [];
            buildFilterOptions();
            renderTable();
            return;
        }
        // We'll parse all data from 'Master_Task'
        allEntries = [];
        const bigVal = snapshot.val();
        // bigVal is an object: term => { index => {...} }
        // parse all
        Object.keys(bigVal).forEach(termKey => {
            const termData = bigVal[termKey];
            if (Array.isArray(termData)) {
                parseArray(termKey, termData);
            } else if (typeof termData === 'object') {
                parseDict(termKey, termData);
            }
        });
        buildFilterOptions();
        renderTable();
    });

    // parse array
    function parseArray(term, arr) {
        arr.forEach((dict, index) => {
            allEntries.push(buildEntry(term, index, dict));
        });
    }
    function parseDict(term, obj) {
        let sortedKeys = Object.keys(obj).sort((a,b) => parseInt(a)-parseInt(b));
        sortedKeys.forEach(k => {
            const dict = obj[k];
            allEntries.push(buildEntry(term, k, dict));
        });
    }

    function buildEntry(term, index, dict) {
        return {
            id: term + "-" + index,
            term: parseInt(term),
            facility: (dict["Facility"] || "").toString(),
            meal: (dict["Meal"] || "").toString(),
            task: (dict["Task"] || "").toString(),
            product: (dict["Product"] || "").toString(),
            day: (dict["Day"] || "").toString()
            // more fields if needed
        };
    }

    // Build or rebuild the filter <select> options
    function buildFilterOptions() {
        let taskSet = new Set();
        let facSet  = new Set();
        let dateSet = new Set();

        allEntries.forEach(e => {
            if (e.task && !excludedTasks.has(e.task)) taskSet.add(e.task);
            if (e.facility) facSet.add(e.facility);
            if (e.day) dateSet.add(e.day);
        });
        fillOptions(filterTask, Array.from(taskSet));
        fillOptions(filterFacility, Array.from(facSet));
        fillOptions(filterDate, Array.from(dateSet));
    }
    function fillOptions(selectElem, arr) {
        while (selectElem.options.length > 1) {
            selectElem.remove(1);
        }
        arr.sort().forEach(v => {
            let opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            selectElem.appendChild(opt);
        });
    }

    // On clicks
    applyFilterBtn.addEventListener('click', renderTable);
    clearFilterBtn.addEventListener('click', () => {
        termMin.value = "";
        termMax.value = "";
        filterTask.value = "";
        filterFacility.value = "";
        filterDate.value = "";
        globalSearch.value = "";
        renderTable();
    });

    // Update table dynamically as user types in search
    globalSearch.addEventListener('input', renderTable);

    // Double-tap => fill date/time
    phDate.addEventListener('dblclick', () => {
        if (!phDate.value) phDate.value = todayString();
    });
    wtDate.addEventListener('dblclick', () => {
        if (!wtDate.value) wtDate.value = todayString();
    });
    trayTime.addEventListener('dblclick', () => {
        if (!trayTime.value) trayTime.value = currentTimeHHmm();
    });

    // Save from modal
    modalSaveBtn.addEventListener('click', () => {
        formError.textContent = "";
        if (!currentEntry) {
            formError.textContent = "No entry selected.";
            return;
        }
        if (isPhForm) savePhRecord();
        else saveWeightRecord();
    });

    // Render table with filters, sorting, logs in multiple columns
    function renderTable() {
        // 1) Gather user filters
        let tMin = parseInt(termMin.value) || 0;
        let tMax = parseInt(termMax.value) || 999999;
        let fTask = filterTask.value;
        let fFac  = filterFacility.value;
        let fDate = filterDate.value;
        let search = globalSearch.value.toLowerCase();

        // Filter
        let filtered = allEntries.filter(e => {
            // Exclude specific tasks
            if (excludedTasks.has(e.task)) return false;
            if (e.term < tMin || e.term > tMax) return false;
            if (fTask && e.task !== fTask) return false;
            if (fFac && e.facility !== fFac) return false;
            if (fDate && e.day !== fDate) return false;
            // global search
            if (search) {
                let rowStr = (e.facility + " " + e.meal + " " + e.task + " " + e.product + " " + e.day).toLowerCase();
                if (!rowStr.includes(search)) return false;
            }
            return true;
        });

        // 2) Sort by Term, then Task, then Product
        filtered.sort((a,b) => {
            if (a.term !== b.term) return a.term - b.term;
            if (a.task !== b.task) return a.task.localeCompare(b.task);
            return a.product.localeCompare(b.product);
        });

        // 3) Limit to 1000
        if (filtered.length > 1000) {
            filtered = filtered.slice(0,1000);
        }

        // 4) Determine the maximum # of logs columns needed
        const maxColumns = 5;

        // Build HEAD: Facility, Term, Meal, Task, Product, Day, + QA Logs columns
        let theadHTML = `
            <tr class="table-light">
                <th scope="col">Facility</th>
                <th scope="col">Term</th>
                <th scope="col">Meal</th>
                <th scope="col">Task</th>
                <th scope="col">Product</th>
                <th scope="col">Day</th>
        `;
        for (let i=1; i<=maxColumns; i++) {
            theadHTML += `<th scope="col">QA Logs${i===1 ? "" : i}</th>`;
        }
        theadHTML += `</tr>`;
        taskTableHead.innerHTML = theadHTML;

        // Clear body
        taskTableBody.innerHTML = "";

        filtered.forEach(entry => {
            // We'll build a row with facility, term, meal, task, product, day, and up to 5 logs
            let tr = document.createElement('tr');
            // Facility
            let tdFac = document.createElement('td');
            tdFac.textContent = entry.facility;
            tr.appendChild(tdFac);

            // Term
            let tdTerm = document.createElement('td');
            tdTerm.textContent = entry.term;
            tr.appendChild(tdTerm);

            // Meal
            let tdMeal = document.createElement('td');
            tdMeal.textContent = entry.meal;
            tr.appendChild(tdMeal);

            // Task
            let tdTask = document.createElement('td');
            tdTask.textContent = entry.task;
            tr.appendChild(tdTask);

            // Product
            let tdProd = document.createElement('td');
            tdProd.textContent = entry.product;
            tr.appendChild(tdProd);

            // Day
            let tdDay = document.createElement('td');
            tdDay.textContent = entry.day;
            tr.appendChild(tdDay);

            // We'll do checkQAData to get an array of logs. e.g. ["pH 3.2"] or multiple weights.
            checkQADataArray(entry, (logsArray, highlight) => {
                // logsArray might be e.g. ["Weight 174 g|Oxy 2%", "Weight 200 g|Oxy 1.5%", "Weight 201 g|Oxy 1.5%"]
                if (highlight) tr.classList.add("highlight");
                // up to 5 columns
                for (let i=0; i<maxColumns; i++) {
                    let tdLog = document.createElement('td');
                    tdLog.textContent = logsArray[i] || "";
                    tr.appendChild(tdLog);
                }
            });

            // double click => open form
            tr.addEventListener('dblclick', () => {
                if (cookingTasks.has(entry.task)) {
                    openPhForm(entry);
                } else {
                    openWeightForm(entry);
                }
            });

            taskTableBody.appendChild(tr);
        });
    }

    // checkQAData but return an array of strings instead of single joined
    function checkQADataArray(entry, cb) {
        if (cookingTasks.has(entry.task)) {
            loadPHRecord(entry, data => {
                if (!data) {
                    cb([""], false);
                } else {
                    // e.g. "pH 3.2"
                    let line = `pH ${data["QA_pH"] || "?"}`;
                    cb([line], true);
                }
            });
        } else {
            loadWeightRecords(entry, logs => {
                if (!logs || !logs.length) {
                    cb([], false);
                    return;
                }
                let arr = logs.map(log => {
                    let w = log["Weight"] || "?";
                    let oxy = log["oxygen_level"] || "?";
                    let time = log["QA_time"] || "?";
                    let comment = log["QA_Comments"] || "?";
                    if (entry.task === "Tray Portioning and Sealing") {
                        return `Weight: ${w} g\nOxy: ${oxy}%\nTime: ${time}\nC/C: ${comment}`;
                    } else {
                        return `Weight: ${w} g\nTime: ${time}\nC/C: ${comment}`;
                    }
                });
                cb(arr, true);
            });
        }
    }

    // pH
    function loadPHRecord(entry, cb) {
        let comps = entry.id.split("-");
        if (comps.length<2) { cb(null); return;}
        let path = "Master_Task/"+comps[0]+"/"+comps[1]+"/QA_pH";
        db.ref(path).once('value').then(snap => {
            if (!snap.exists()) cb(null);
            else cb(snap.val());
        }).catch(_=>cb(null));
    }
    function openPhForm(entry) {
        currentEntry = entry;
        isPhForm = true;
        phSection.style.display = "block";
        weightSection.style.display = "none";
        traySection.style.display = "none";
        formError.textContent = "";
        clearPhFields();
        loadPHRecord(entry, data => {
            if (!data) return;
            phType.value       = data["QA_Type"]       || "";
            phValue.value      = data["QA_pH"]         || "";
            phTempNeeded.value = data["QA_Temp"]       || "";
            phInitials.value   = data["QA_Initials"]   || "";
            phReviewed.value   = data["QA_ReviewedBy"] || "";
            phDate.value       = data["QA_date"]       || "";
        });
        qaModal.show();
    }
    function clearPhFields() {
        phType.value="";
        phValue.value="";
        phTempNeeded.value="";
        phInitials.value="";
        phReviewed.value="";
        phDate.value="";
    }
    function savePhRecord() {
        if (!phType.value || !phValue.value || !phTempNeeded.value ||
            !phInitials.value || !phReviewed.value || !phDate.value) {
            formError.textContent = "All pH fields required.";
            return;
        }
        let data = {
            "QA_Type": phType.value,
            "QA_pH": phValue.value,
            "QA_Temp": phTempNeeded.value,
            "QA_Initials": phInitials.value,
            "QA_ReviewedBy": phReviewed.value,
            "QA_date": phDate.value
        };
        addPHRecord(currentEntry, data, err=>{
            if (err) formError.textContent = "Error saving pH: " + err;
            else {
                qaModal.hide();
            }
        });
    }
    function addPHRecord(entry, data, cb) {
        let comps = entry.id.split("-");
        if (comps.length<2) { cb("Bad ID"); return;}
        let path = "Master_Task/"+comps[0]+"/"+comps[1]+"/QA_pH";
        db.ref(path).set(data, cb);
    }

    // Weight
    function loadWeightRecords(entry, cb) {
        let comps = entry.id.split("-");
        if (comps.length<2) { cb([]); return;}
        let path = "Master_Task/"+comps[0]+"/"+comps[1]+"/WeightCheck";
        db.ref(path).once('value').then(snap=>{
            if (!snap.exists()) {
                cb([]);
                return;
            }
            let logs = [];
            snap.forEach(child => {
                logs.push(child.val());
            });
            cb(logs);
        }).catch(_=>cb([]));
    }
    function openWeightForm(entry) {
        currentEntry = entry;
        isPhForm = false;
        phSection.style.display = "none";
        weightSection.style.display = "block";
        traySection.style.display = "none";
        formError.textContent = "";
        clearWtFields();
        if (entry.task === "Tray Portioning and Sealing") {
            traySection.style.display = "block";
        }
        loadWeightRecords(entry, logs=>{
            if (!logs.length) return;
            let last = logs[logs.length-1];
            wtWeight.value     = last["Weight"] || "";
            wtDirectInsp.value = last["DirectInsp"] || "";
            wtInitials.value   = last["QA_Initials"] || "";
            wtComments.value   = last["QA_Comments"] || "";
            wtDate.value       = last["QA_date"] || "";
            if (entry.task==="Tray Portioning and Sealing") {
                trayEquipment.value = last["oxygen_equipment"]||"";
                trayOxygen.value    = last["oxygen_level"]||"";
                trayTime.value      = last["oxygen_time"]||"";
            }
        });
        qaModal.show();
    }
    function clearWtFields() {
        wtWeight.value="";
        wtDirectInsp.value="";
        wtInitials.value="";
        wtComments.value="";
        wtDate.value="";
        trayEquipment.value="";
        trayOxygen.value="";
        trayTime.value="";
    }
    function saveWeightRecord() {
        let wVal = parseFloat(wtWeight.value);
        if (isNaN(wVal)) {
            formError.textContent = "Weight must be numeric.";
            return;
        }
        if (!wtDirectInsp.value || !wtInitials.value || !wtDate.value) {
            formError.textContent = "Missing required Weight fields.";
            return;
        }
        let data = {
            "Weight": wtWeight.value,
            "DirectInsp": wtDirectInsp.value,
            "QA_Initials": wtInitials.value,
            "QA_Comments": wtComments.value,
            "QA_date": wtDate.value,
            "QA_time": currentTimeHHmm()
        };
        if (currentEntry.task==="Tray Portioning and Sealing") {
            data["oxygen_equipment"] = trayEquipment.value;
            data["oxygen_level"]     = trayOxygen.value;
            data["oxygen_time"]      = trayTime.value;
        }
        getNextWeightKey(currentEntry, key=>{
            addWeightRecord(currentEntry, key, data, err=>{
                if (err) formError.textContent="Error saving Weight: "+err;
                else {
                    qaModal.hide();
                }
            });
        });
    }
    function getNextWeightKey(entry, cb) {
        let comps = entry.id.split("-");
        if (comps.length<2) { cb("Weight1"); return;}
        let path = "Master_Task/"+comps[0]+"/"+comps[1]+"/WeightCheck";
        db.ref(path).once('value').then(snap=>{
            let count = snap.numChildren()+1;
            cb("Weight"+count);
        }).catch(_=>cb("Weight1"));
    }
    function addWeightRecord(entry, key, data, cb) {
        let comps = entry.id.split("-");
        if (comps.length<2){cb("Bad ID");return;}
        let path = "Master_Task/"+comps[0]+"/"+comps[1]+"/WeightCheck/"+key;
        db.ref(path).set(data, cb);
    }

    // Helpers
    function todayString() {
        let d=new Date();
        let mm = String(d.getMonth()+1).padStart(2,'0');
        let dd = String(d.getDate()).padStart(2,'0');
        let yyyy = d.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
    }
    function currentTimeHHmm() {
        let d=new Date();
        let hh= String(d.getHours()).padStart(2,'0');
        let min=String(d.getMinutes()).padStart(2,'0');
        return `${hh}:${min}`;
    }
});