document.getElementById('fetchData').addEventListener('click', fetchData);
document.getElementById('searchTerm').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        fetchData();
    }
});

document.getElementById('downloadCycle1').addEventListener('click', function() {
    generatePDF(true);  // Pass true for Cycle 1
});

document.getElementById('downloadCycle2').addEventListener('click', function() {
    generatePDF(false); // Pass false for Cycle 2
});

async function fetchData() {
    const term = document.getElementById('searchTerm').value.trim();
    const facility = document.getElementById('facilitySelect').value;

    if (term === '') {
        document.getElementById('status').textContent = "Please enter a term.";
        return;
    }

    const url = `https://misevala-api.tvla.co/v0/productionRecords/${term}?facilityNetwork=${facility}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const addonData = await fetchAddonData(); // Fetch the addon data from GitHub
        processAndDisplayData(data, addonData); // Pass both API and addon data to the function
    } catch (error) {
        document.getElementById('status').textContent = "Error fetching data: " + error.message;
    }
}

async function fetchAddonData() {
    const githubUrl = 'https://raw.githubusercontent.com/itspaudal-git/ignore_list/main/addon_container.json';
    const response = await fetch(githubUrl);
    const data = await response.json();
    return data;
}

function processAndDisplayData(packageJson, addonData) {
    const cycle1 = packageJson['cycles']['1']['meals'];
    const cycle2 = packageJson['cycles']['2']['meals'];
    const tableBody = document.querySelector('#dataTable tbody');
    tableBody.innerHTML = '';  // Clear existing rows

    const specialContainers = [
        "tray 2 bagged meal extra", "tray 1 bagged meal extra", "bagged meal extra", "sealed body armor","tray 1 sealed body armor","tray 2 sealed body armor",
        "unsealed body armor", "tray 1 unsealed body armor", "tray 2 unsealed body armor", "sealed body armor"
    ];

    let previousMealNo = null;

    cycle1.forEach((item, index) => {
        const mealNo = item['mealCode'];
        const name = item['apiMealTitle'];
        const qty1 = item['totalMeals'];
        const qty2 = cycle2[index]['totalMeals'];
        const termID = packageJson['termID'] || 'N/A'; // Ensure termID is passed, use 'N/A' as fallback

        let hasSpecialContainer = false;

        // Check materials for special containers
        item['billOfMaterials'].forEach(material => {
            const container = material['tags'].find(tag => tag['category'] === "container")?.title || '';

            if (name.includes("SOT")) {
                // Check for pre-portioned and additional tray conditions only when "SOT" is included in the name
                if (specialContainers.includes(container) || container === "pre-portioned" || container === "tray 1" || container === "tray 2") {
                    hasSpecialContainer = true;
                }
            } else {
                // If "SOT" is not in the name, apply only the original condition
                if (specialContainers.includes(container)) {
                    hasSpecialContainer = true;
                }
            }
        });

        // Display main meal row with Sleeving and Sleeve as static values
        if (name.includes("SOT") || hasSpecialContainer) {
            const sleevingLoc = item['tags'].find(tag => tag['category'] === "sleeving_location")?.title || '';
            const sleevingConfig = item['tags'].find(tag => tag['category'] === "sleeving_configuration")?.title || '';

            if (previousMealNo && mealNo !== previousMealNo) {
                const dividerRow = document.createElement('tr');
                dividerRow.classList.add('row-divider');
                dividerRow.innerHTML = '<td colspan="7" style="border-bottom: 2px solid black;"></td>';
                tableBody.appendChild(dividerRow);
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${mealNo}</td>
                <td>${qty1}</td>
                <td>${qty2}</td>
                <td>${name}</td>
                <td>${sleevingConfig}</td>
                <td>${sleevingLoc}</td>
                <td>Sleeve</td>
                <td>Sleeving</td>
            `;
            tableBody.appendChild(row);
        }

        // Display materials with special containers and task from GitHub JSON
        item['billOfMaterials'].forEach(material => {
            const container = material['tags'].find(tag => tag['category'] === "container")?.title || '';

            // If the special container condition is met
            if (specialContainers.includes(container) || (name.includes("SOT") && (container === "pre-portioned" || container === "tray 1" || container === "tray 2"))) {
                const weightUom = `${Math.round(material['qtyPounds'] * 453.59237)} g`;
                const portionLoc = material['tags'].find(tag => tag['category'] === "portion_location")?.title || '';

                // Fetch task and container info from the addon data based on the material title
                const matchedTask = addonData.find(task => task.Name === material['title']);
                const task = matchedTask ? matchedTask["Container"] : "No Task";

                // Add material details as a row
                const materialRow = document.createElement('tr');
                materialRow.innerHTML = `
                    <td>${mealNo}</td>
                    <td>${qty1}</td>
                    <td>${qty2}</td>
                    <td>${material['title']}</td>
                    <td>${weightUom}</td>
                    <td>${portionLoc}</td>
                    <td>${container}</td>
                    <td>${task}</td>
                `;
                tableBody.appendChild(materialRow);
            }
        });

        previousMealNo = mealNo;
    });

    document.getElementById('status').textContent = "Data fetched and displayed successfully.";
}


// PDF generation logic
const { jsPDF } = window.jspdf; // Add this line to properly reference jsPDF
async function generatePDF(isCycle1) {
    const term = document.getElementById('searchTerm').value.trim();
    const facility = document.getElementById('facilitySelect').value;

    if (term === '') {
        document.getElementById('status').textContent = "Please enter a term.";
        return;
    }

    const url = `https://misevala-api.tvla.co/v0/productionRecords/${term}?facilityNetwork=${facility}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const addonData = await fetchAddonData();
        createPDF(data, addonData, isCycle1);
    } catch (error) {
        document.getElementById('status').textContent = "Error fetching data: " + error.message;
    }
}

function createPDF(packageJson, addonData, isCycle1) {
    const cycleMeals = isCycle1 ? packageJson['cycles']['1']['meals'] : packageJson['cycles']['2']['meals'];
    const termID = packageJson['termID'] || 'N/A'; // Use termID from the packageJson or fallback to 'N/A'

    // Initialize jsPDF instance
    const doc = new jsPDF({
        format: [101.6, 152.4] // 4x6 inches in mm
    });

    cycleMeals.forEach((item, index) => {
        const mealNo = item['mealCode'];
        const name = item['apiMealTitle'];
        const qty = isCycle1 ? item['totalMeals'] : packageJson['cycles']['2']['meals'][index]['totalMeals'];
        let hasSpecialContainer = false;

        // Check for special containers in the bill of materials
        item['billOfMaterials'].forEach(material => {
            const container = material['tags'].find(tag => tag['category'] === "container")?.title || '';
            if (["tray 2 bagged meal extra", "tray 1 bagged meal extra", "bagged meal extra", "tray 1 sealed body armor","tray 2 sealed body armor",
                 "unsealed body armor", "tray 1 unsealed body armor", "tray 2 unsealed body armor", "sealed body armor"].includes(container)) {
                hasSpecialContainer = true;
            }
        });

        // Only proceed if the name includes "SOT" or if it has a special container
        if (name.includes("SOT") || hasSpecialContainer) {
            item['billOfMaterials'].forEach(material => {
                const materialTitle = material['title'];
                const weightInGrams = parseFloat(material['qtyPounds']) * 453.59237;
                const mav = NIST_MAV(weightInGrams);
                const minWeight = (weightInGrams - mav).toFixed(1);
                const maxWeight = (weightInGrams + mav).toFixed(1);
                const container = material['tags'].find(tag => tag['category'] === "container")?.title || '';
                const task = addonData.find(task => task.Name === material['title'])?.Container || "No Task";

                // Skip generating the PDF if the task is "No Task" or "vac pack"
                if (task === "No Task" || task.toLowerCase() === "vac pack") return;

                // Logic for bin calculations
                let maxper_bin, total_pages, total_bins, total_partial_bins;

                if (container.includes('tray')) {
                    // Trays logic
                    if (container.includes('tray 1')) {
                        maxper_bin = 480;
                    } else {
                        maxper_bin = 320;
                    }
                } else if (container.includes('sachet')) {
                    maxper_bin = container.includes('dry') ? 300 : 400;
                } else if (container.includes('cup')) {
                    maxper_bin = container.includes('1 oz') ? 500 : 400;
                } else {
                    maxper_bin = 1000; // Default case for bags and other containers
                }

                const towers = Math.ceil(qty / maxper_bin); // Calculate total number of towers/bins
                const total_trays_remaining = qty % maxper_bin; // Remaining trays/bins after full towers

                // PDF generation logic for bins and towers
                let bins_string = "";
                if (container.includes("tray") || task.includes("Tray Sealing") || task.includes("Band Sealing/tin")) {
                    const total_tower = Math.floor(qty / maxper_bin); // Full Tower
                    const total_partial_trays = qty % maxper_bin; // Remainder trays
                    const total_bins = Math.floor(total_partial_trays / maxper_bin);
                    const total_partial_bins = total_partial_trays % maxper_bin;

                    // Handle the full and partial bins and trays
                    if (total_tower > 0) {
                        bins_string = `${total_tower} Tower @ ${maxper_bin}, Full Bins: ${total_bins}, Partial Trays: ${total_partial_bins}`;
                    } else {
                        bins_string = `Partial Trays: ${total_partial_trays}`;
                    }
                } else {
                    // For other containers (sachets, cups), display remainder
                    if (total_trays_remaining > 0) {
                        bins_string = `Partial ${total_trays_remaining}`;
                    }
                }

                // Create PDF for each tower/page
                for (let i = 1; i <= towers; i++) {
                    if (doc.getNumberOfPages() > 0) {
                        doc.addPage();
                    }

                    // Set up Cycle label for Cycle 2
                    if (!isCycle1) {
                        doc.setFontSize(12);
                        doc.setFont('Helvetica', 'bold');
                        doc.setTextColor(255, 0, 0); // Red text
                        doc.setFillColor(255, 192, 203); // Pink background
                        doc.rect(0, 0, 101.6, 15, 'F'); // Pink row for Cycle 2
                        doc.text('Cycle 2', 101.6 / 2, 10, { align: 'center' });
                        doc.setTextColor(0); // Reset text color to black
                    }

                    // Task section
                    doc.setFontSize(12);
                    const taskTextWidth = doc.getTextWidth(task); // Get the width of the task description text
                    const padding = 3; // Adjust padding for better fit
                    doc.setFillColor(128, 0, 128); // Light purple background
                    doc.rect(3, 10, taskTextWidth + padding * 2, 10, 'F'); 
                    doc.setTextColor(255); // White text for task description
                    doc.text(task, 3 + padding, 18);

                    // Term and Meal Section
                    doc.setFont('Helvetica', 'normal');
                    doc.setFontSize(18);
                    doc.setTextColor(255, 255, 0); 
                    doc.setFillColor(255, 255, 0);
                    doc.rect(101.6 / 2 - 20, 20, 40, 10, 'F'); 
                    doc.setTextColor(0);
                    doc.text(`Term: ${termID}`, 101.6 / 2, 25, { align: 'center' });

                    const pageWidth = doc.internal.pageSize.getWidth(); 
                    doc.setFontSize(18);
                    doc.text(`Meal: ${mealNo}`, pageWidth / 2, 40, { align: 'center' });

                    // Use material['title'] instead of name
                    const wrappedMaterialText = doc.splitTextToSize(`${materialTitle}`, 90); // You can adjust the width as needed
                    doc.text(wrappedMaterialText, pageWidth / 2, 55, { align: 'center' });

                    doc.setFontSize(15);
                    doc.text(`Total Qty: ${qty}`, pageWidth / 2, 75, { align: 'center' });

                    // Towers or bins depending on the container type
                    doc.setFontSize(16);
                    doc.text(`${container.includes('tray') ? `Towers: ${i} of ${towers}` : `Bins: ${i} of ${towers}`}`, pageWidth / 2, 85, { align: 'center' });

                    // Min and Max weight details
                    doc.setFontSize(12);
                    doc.text(`Min: ${minWeight} g | Max: ${maxWeight} g`, pageWidth / 2, 95, { align: 'center' });
                    doc.text(`Bins Qty: ${maxper_bin}`, pageWidth / 2, 105, { align: 'center' });
                    doc.text(`Total Qty: ${qty}`, pageWidth / 2, 115, { align: 'center' });
                    doc.text('Initial:__________', pageWidth / 2, 130, { align: 'center' });

                    // Special handling for sachets
                    if (container.includes('sachet') || container.includes('dry sachet')) {
                        const runAtWeight = (weightInGrams - 2).toFixed(1); // Subtract 2g for the run-at weight
                        doc.setFontSize(14);
                        doc.setTextColor(255, 0, 0); // Red color
                        doc.setFont('Helvetica', 'bold');
                        doc.text(`Run at ${runAtWeight} g`, 35, 120);
                    }

                    // Display final details at the end of pages
                    if (i === towers) {
                        doc.setTextColor(0); // Reset text color to black
                        doc.setFontSize(10);
                        doc.text(bins_string, 15, 148);
                    }
                }
            });
        }
    });

    doc.save(`Term_${termID}__Facility_${packageJson['facility']} Cycle${isCycle1 ? '1' : '2'}_Bulk.pdf`);
}


function NIST_MAV(weight) {
    if (weight < 36) return weight * 0.1;
    if (weight < 54) return 3.6;
    if (weight < 81) return 5.4;
    if (weight < 117) return 7.2;
    if (weight < 154) return 9.0;
    if (weight < 208) return 10.8;
    if (weight < 263) return 12.7;
    if (weight < 317) return 14.5;
    if (weight < 318) return 16.3;
    if (weight < 426) return 18.1;
    if (weight < 489) return 19.9;
    if (weight < 571) return 21.7;
    if (weight < 635) return 23.5;
    if (weight < 698) return 25.4;
    return 0.0;
}



function createPDF_sleeving(isCycle1) {
    const doc = new jsPDF({
        format: 'a4' // A4 paper format
    });

    const tableBody = document.querySelector('#dataTable tbody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));

    const termID = document.getElementById('searchTerm').value.trim() || 'N/A'; // Get the Term ID
    let pageCount = 0;
    let hasData = false;

    // Iterate over the table rows and group them by Meal No
    let mealsGroupedByMealNo = {};

    rows.forEach((row) => {
        const columns = row.querySelectorAll('td');
        const mealNo = columns[0]?.textContent.trim(); // Get Meal No (Column 1)
        const qty = isCycle1 ? columns[1]?.textContent.trim() : columns[2]?.textContent.trim(); // Get the quantity based on cycle

        // Skip meals where the quantity is 0
        if (parseInt(qty, 10) === 0) {
            return;
        }

        if (!mealsGroupedByMealNo[mealNo]) {
            mealsGroupedByMealNo[mealNo] = [];
        }
        mealsGroupedByMealNo[mealNo].push(row); // Group rows by Meal No
    });

    // Iterate over the grouped meals
    Object.keys(mealsGroupedByMealNo).forEach((mealNo) => {
        const rowsForMeal = mealsGroupedByMealNo[mealNo];
        let taskBodyYPosition = 100; // Starting Y position for tasks under each meal

        rowsForMeal.forEach((row, index) => {
            const columns = row.querySelectorAll('td');
            const task = columns[7]?.textContent.trim();
            const materialTitle = columns[3]?.textContent.trim() || 'N/A';
            const qty = isCycle1 ? columns[1]?.textContent.trim() : columns[2]?.textContent.trim();

            // Ensure qty is valid before generating content
            if (parseInt(qty, 10) > 0 && task === 'Sleeving') {
                hasData = true; // Ensure we have data to display
                pageCount++;

                if (pageCount > 1) {
                    doc.addPage();
                }

                // Add Title Section (Sleeving as Title)
                doc.setFillColor(211, 211, 211);
                doc.rect(30, 7, 130, 10, 'F');
                doc.setFontSize(16);
                doc.text('SLEEVING VERIFICATION / INSPECTION FORM', 30, 12);

                // Set font size for form fields
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');

                // Draw form fields like Date, Start Time, etc.
                doc.rect(20, 25, 30, 8);  // 'Date'
                doc.rect(50, 25, 40, 8);  // 'Start Time'
                doc.rect(90, 25, 35, 8);  // 'Break (min)'
                doc.rect(125, 25, 35, 8); // 'Lunch (min)'
                doc.rect(160, 25, 35, 8); // 'End Time'

                // Add labels for form fields
                doc.text('Date', 25, 30);
                doc.text('Start Time AM/PM', 55, 30);
                doc.text('Break (min)', 95, 30);
                doc.text('Lunch (min)', 130, 30);
                doc.text('End Time AM/PM', 165, 30);

                // Add empty form fields for input
                doc.rect(20, 33, 30, 8);  // Empty 'Date' field
                doc.rect(50, 33, 40, 8);  // Empty 'Start Time' field
                doc.rect(90, 33, 35, 8);  // Empty 'Break (min)' field
                doc.rect(125, 33, 35, 8);  // Empty 'Lunch (min)' field
                doc.rect(160, 33, 35, 8);  // Empty 'End Time' field
                
                // Add Term ID, Qty, Meal
                doc.setFontSize(14);
                doc.text(`Term: ${termID}`, doc.internal.pageSize.getWidth() / 2, 50, { align: 'center' });
                doc.text(`Qty: ${qty}`, doc.internal.pageSize.getWidth() / 2, 60, { align: 'center' });

                // Append "- A" to the mealNo if it's Cycle 2
                const displayMealNo = isCycle1 ? mealNo : `${mealNo} - A`;

                doc.text(`Meal: ${displayMealNo}`, doc.internal.pageSize.getWidth() / 2, 70, { align: 'center' });
                doc.setFontSize(16);
                doc.text(`${materialTitle}`, doc.internal.pageSize.getWidth() / 2, 80, { align: 'center' });

                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                // Add tasks related to the current meal
                let taskBodyYPosition = 100; // Adjust position for task entries
                
                rowsForMeal.forEach((row) => {
                    const taskForRow = row.querySelectorAll('td')[7]?.textContent.trim();
                    const materialTitleForRow = row.querySelectorAll('td')[3]?.textContent.trim() || 'N/A';

                    if (taskForRow && taskForRow !== 'undefined' && taskForRow !== 'Sleeving' && materialTitleForRow !== 'undefined') {
                        doc.text(`${taskForRow}`, 10, taskBodyYPosition);
                        doc.text(`${materialTitleForRow}`, 60, taskBodyYPosition);
                        taskBodyYPosition += 10; // Move down for the next task
                    }
                });

                // Call the function to add trays, component check, seals check, and headcount at the end of each page
                addTrayAndChecks(doc);
            }
        });
    });

    // If no data is found, show an alert
    if (!hasData) {
        alert("No Sleeving tasks found in the table.");
    } else {
        // Save the PDF
        doc.save(`Term_${termID}_Sleeving_and_Task_Cycle_${isCycle1 ? '1' : '2'}.pdf`);
    }
}
// Helper function to add trays, component check, seals check, and headcount
function addTrayAndChecks(doc) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const rowHeight = 10;
    const startY1 = 220;

    // First row: # of Trays, Component Check, Seals Check, Headcount, Best by date, and an empty cell
    const trayX = 20;
    const trayWidth1 = 30;
    const componentCheckWidth = 30;
    const sealsCheckWidth = 30;
    const headcountWidth = 30;
    const bestByDateWidth = 30;
    const emptyCellWidth = 30;

    const componentCheckX = trayX + trayWidth1;
    const sealsCheckX = componentCheckX + componentCheckWidth;
    const headcountX = sealsCheckX + sealsCheckWidth;
    const bestByDateX = headcountX + headcountWidth;
    const emptyCellX = bestByDateX + bestByDateWidth;

    // Draw first row
    doc.rect(trayX, startY1 - 10, trayWidth1, rowHeight);  // '# of Trays'
    doc.rect(componentCheckX, startY1 - 10, componentCheckWidth, rowHeight);  // 'Component Check'
    doc.rect(sealsCheckX, startY1 - 10, sealsCheckWidth, rowHeight);  // 'Seals Check'
    doc.rect(headcountX, startY1 - 10, headcountWidth, rowHeight);  // 'Headcount'
    doc.rect(bestByDateX, startY1 - 10, bestByDateWidth, rowHeight);  // 'Best by date'
    doc.rect(emptyCellX, startY1 - 10, emptyCellWidth, rowHeight);  // Empty cell after 'Best by date'

    // Add labels back for the first row fields
    doc.text('# of Trays', trayX + 5, startY1 - 3);
    doc.text('Component Check', componentCheckX + 2, startY1 - 3);
    doc.text('Seals Check', sealsCheckX + 5, startY1 - 3);
    doc.text('Headcount ____', headcountX + 5, startY1 - 3);
    doc.text('Best by date', bestByDateX + 2, startY1 - 3);

    // Add checkboxes for the first row
    const checkboxSize = 5;
    doc.rect(trayX + trayWidth1 - 10, startY1 - 9, checkboxSize, checkboxSize);  // Checkbox for '# of Trays'
    doc.rect(componentCheckX + componentCheckWidth - 10, startY1 - 9, checkboxSize, checkboxSize);  // Checkbox for 'Component Check'
    doc.rect(sealsCheckX + sealsCheckWidth - 10, startY1 - 9, checkboxSize, checkboxSize);  // Checkbox for 'Seals Check'
    
    // Second row: QA, Leadership, Produced Qty
    const qaX = 20;
    const qaWidth = 40;
    const leadershipX = qaX + qaWidth;
    const leadershipWidth = 60;
    const producedQtyX = leadershipX + leadershipWidth;
    const producedQtyWidth = 50;

    const row2Y = startY1 + 12;

    // Draw second row
    doc.rect(qaX, row2Y - 10, qaWidth, rowHeight);  // QA
    doc.rect(leadershipX, row2Y - 10, leadershipWidth, rowHeight);  // Leadership
    doc.rect(producedQtyX, row2Y - 10, producedQtyWidth, rowHeight);  // Produced Qty

    // Text for second row
    doc.text('QA:___________', qaX + 2, row2Y - 3);
    doc.text('Leadership:___________', leadershipX + 2, row2Y - 3);
    doc.text('Produced Qty:______', producedQtyX + 2, row2Y - 3);

    // Third row: Box Closer
    const boxCloserX = 20;
    const boxCloserWidth1 = 150;
    const row3Y1 = row2Y + 12;

    // Draw third row
    doc.rect(boxCloserX, row3Y1 - 10, boxCloserWidth1, rowHeight);  // Box Closer
    doc.text('Box Closer____________________________________', boxCloserX + 5, row3Y1 - 3);
    
    // Hourly Checks section
    addHourlyChecks(doc, row3Y1 + 10);
}

// Helper function for hourly checks
function addHourlyChecks(doc, startY) {
    const boxHeight = 10;
    const boxWidth = 18;

    // Title for Hourly Checks
    doc.setFont('helvetica', 'normal');
    const title = 'Hourly Checks';
    const titleWidth = doc.getTextWidth(title);
    const centerX = (210 - titleWidth) / 2;
    doc.text(title, centerX, startY);

    // Hourly boxes
    for (let i = 0; i < 8; i++) {
        const boxX = 15 + (i * (boxWidth + 5));
        const labelY = startY + 10;
        const boxY = labelY + 5;

        doc.text(`Hour ${i + 1}`, boxX + 5, labelY);
        doc.rect(boxX, boxY, boxWidth, boxHeight);
    }
}

// Button listeners for generating PDFs
document.getElementById('downloadsleevec1').addEventListener('click', function() {
    createPDF_sleeving(true); // Generate PDF for Cycle 1
});

document.getElementById('downloadsleevec2').addEventListener('click', function() {
    createPDF_sleeving(false); // Generate PDF for Cycle 2
});




function generate_towersheet(isCycle1) {
    const doc = new jsPDF({
        format: 'a4'
    });

    const tableBody = document.querySelector('#dataTable tbody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));

    const termID = document.getElementById('searchTerm').value.trim() || 'N/A'; // Get Term ID
    let pageCount = 0;

    rows.forEach((row) => {
        const columns = row.querySelectorAll('td');
        const mealNo = columns[0]?.textContent.trim(); // Meal Number
        const qty = isCycle1 ? columns[1]?.textContent.trim() : columns[2]?.textContent.trim(); // Quantity based on cycle
        const mealDescription = columns[3]?.textContent.trim(); // Meal Description
        const configuration = columns[4]?.textContent.trim(); // Configuration
        const cycle = isCycle1 ? 'Cycle 1' : 'Cycle 2';
        const column7 = columns[6]?.textContent.trim(); // Column 7

        // Only generate for rows where Column 7 is "Sleeve"
        if (column7 !== 'Sleeve') {
            return; // Skip this row if not "Sleeve"
        }

        let tower_ct = 216; // Meals per tower
        let bins_ct = 18;   // Bins per tower
        let bins_ct1 = 12;
        let totalTowers = Math.ceil(qty / tower_ct);
        let notes = "Add-on & Decoupled Add-on";

        // For each tower, create a new page
        for (let towerNum = 1; towerNum <= totalTowers; towerNum++) {
            if (pageCount > 0) doc.addPage(); // Add new page for subsequent towers
            pageCount++;

            // Title in Red
            doc.setFont("Arial", "bold");
            doc.setFontSize(48);
            doc.setTextColor(255, 0, 0);
            doc.text(`Term ${termID}`, 105, 35, null, null, 'center');

            // Meal with Cycle 1 or Cycle 2
            doc.setTextColor(0, 0, 0);
            doc.setFont("Arial", "normal");
            doc.setFontSize(40);
            if (isCycle1) {
                doc.text(`MEAL ${mealNo}`, 105, 55, null, null, 'center');
            } else {
                doc.text(`MEAL ${mealNo} - A`, 105, 55, null, null, 'center');
            }

            // Meal Description without wrapping
            doc.setFillColor(0, 255, 255);
            doc.setFont("Arial", "bold");
            doc.setFontSize(42);
            doc.rect(10, 65, 190, 20, 'F');
            doc.text(mealDescription, 15, 80);
            doc.text(`Qty. ${qty}`, 105, 95, null, null, 'center');

            // Tower Info
            doc.setFont("Times", "normal");
            doc.setFontSize(48);
            doc.text(`Tower ${towerNum}`, 105, 130, null, null, 'center');
            doc.text('OF', 105, 160, null, null, 'center');
            doc.text(`Tower ${totalTowers}`, 105, 190, null, null, 'center');

            // Bins and Meals
            let remainingMeals = qty % tower_ct;
            let remainingBins = Math.floor(remainingMeals / bins_ct);
            let remainingMealsLastBin = remainingMeals % bins_ct;

            doc.setFont("Arial", "bold");
            doc.setFontSize(36);
            if (towerNum === totalTowers) {
                doc.text(`Bins ${remainingBins} Meals ${remainingMealsLastBin}`, 105, 220, null, null, 'center');
            } else {
                doc.text('Bins 12 Meals 0', 105, 220, null, null, 'center');
            }

            // Display Notes Section without wrapping
            doc.setFont("Arial", "normal");
            doc.setFontSize(24);
            doc.text(notes, 105, 240, null, null, 'center');

            // Add Bins Configuration at the bottom
            doc.setFont("Arial", "bold");
            doc.setFontSize(18);
            doc.text(`Bins Config: 12 bins per Tower, 18 meals per bin`, 95, 270, null, null, 'center');
        }
    });

    // Save the PDF
    doc.save(`Term_${termID}_Tower_Sheet_Cycle_${isCycle1 ? '1' : '2'}.pdf`);
}

// Button listeners for generating PDFs
document.getElementById('downloadtowerc1').addEventListener('click', function() {
    generate_towersheet(true); // Generate Tower Sheet for Cycle 1
});

document.getElementById('downloadtowerc2').addEventListener('click', function() {
    generate_towersheet(false); // Generate Tower Sheet for Cycle 2
});
