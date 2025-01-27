document.querySelector('#dataTable').addEventListener('click', function(e) {
    if (e.target && e.target.matches('.download-c1, .download-c2')) {
        const row = e.target.closest('tr');
        const isCycle1 = e.target.classList.contains('download-c1');
        downloadRow(row, isCycle1);
    }
});

function downloadRow(row, isCycle1) {
    const jsPDF = window.jspdf.jsPDF;

    // Extract row data
    const mealNo = row.cells[0].textContent.trim();
    const product = row.cells[3].textContent.trim();
    const qty = isCycle1 ? row.cells[1].textContent.trim() : row.cells[2].textContent.trim();
    const task = row.cells[11].textContent.trim();  // Task column (12th column)
    const uomText = row.cells[4].textContent.trim();
    const container = row.cells[6].textContent.trim(); // Container column (7th column)

    // List of containers that should not trigger "Transfer" text
    const specialContainers = [
        "tray 2 bagged meal extra", "tray 1 bagged meal extra", "bagged meal extra", 
        "unsealed body armor", "tray 1 unsealed body armor", "tray 2 unsealed body armor", "sealed body armor"
    ];

    // Logic to determine sleevingLoc and portion_location
    let sleevingLoc = '';
    let portion_location = row.cells[5].textContent.trim();  // Default to current row's portion_location

    // Find the first row with task 'Sleeving' for this mealNo
    const tableRows = document.querySelectorAll('#dataTable tbody tr');
    for (let r of tableRows) {
        if (r.cells[0].textContent.trim() === mealNo && r.cells[11].textContent.trim() === 'Sleeving') {
            sleevingLoc = r.cells[5].textContent.trim();  // Get sleeving location from this row
            break;
        }
    }

    const day = isCycle1 ? row.cells[7].textContent.trim() : row.cells[8].textContent.trim();
    let map = row.cells[9].textContent.trim();
    let tray = row.cells[10].textContent.trim();
    const taskDescription = row.cells[11].textContent.trim();
    const termID = row.dataset.termId || 'undefined'; // Assume you're storing termID in a data attribute for each row

    // Log mealNo, sleevingLoc, and portion_location for debugging
    console.log("Meal No:", mealNo);
    console.log("Qty:", qty);
    console.log("Task:", task);
    console.log("Container:", container);
    console.log("Sleeving Location:", sleevingLoc);  // This should now show the correct Sleeving Location
    console.log("Portion Location:", portion_location);

    // Extract all numerical values from the uomText
    const weightNumbers = uomText.match(/\d+\.?\d*/g); // This will get an array of all numbers

    let minWeightTexts = [];
    let maxWeightTexts = [];
    let runAtWeights = [];

    // Loop through each weight number to calculate min and max weights
    weightNumbers.forEach((numStr) => {
        const weightInGrams = parseFloat(numStr);
        const mav = NIST_MAV(weightInGrams);
        const minWeight = (weightInGrams - mav).toFixed(1);
        const maxWeight = (weightInGrams + mav).toFixed(1);
        minWeightTexts.push(`${minWeight} g`);
        maxWeightTexts.push(`${maxWeight} g`);

        // Calculate "Run at" weights for sachet containers
        if (container.includes('sachet') || container.includes('dry sachet')) {
            const runAtWeight = (weightInGrams - 2).toFixed(1); // Subtract 2g for the run-at weight
            runAtWeights.push(`${runAtWeight} g`);
        }
    });

    // Create an array of min and max weight lines
    const minMaxLines = minWeightTexts.map((minWeight, index) => {
        const maxWeight = maxWeightTexts[index];
        return `Min: ${minWeight} | Max: ${maxWeight}`;
    });

    // Hide 'no MAP' and 'normal' tray values
    if (map === 'no MAP') map = ''; // Hide 'no MAP'
    if (tray === 'normal') tray = ''; // Hide 'normal' tray

    // Corrected: Calculate Bins Qty and Max per Bin based on **container** (not sleevingLoc)
    let maxper_bin, perbin;
    if (container.includes('tray')) {
        if (tray === '1 tray') {
            maxper_bin = 480;  // Max per bin for 1 tray
            perbin = 48;
        } else {
            maxper_bin = 320;  // Max per bin for 2+ trays
            perbin = 32;
        }
    } else if (container.includes('sachet')) {
        maxper_bin = container.includes('dry') ? 300 : 400;
    } else if (container.includes('cup')) {
        maxper_bin = container.includes('1 oz') ? 500 : 400;
    } else {
        maxper_bin = 1000; // Default case for bags and other containers
    }

    // Calculate Towers using maxper_bin
    const towers = Math.ceil(qty / maxper_bin);
    const total_trays_remaining = qty % maxper_bin;

    // Divmod calculation for last page (for Tray Sealing and Band Sealing)
    let bins_string = "";
    if (container.includes("tray") || task.includes("Tray Sealing") || task.includes("Band Sealing/tin")) {
        const total_tower = Math.floor(qty / maxper_bin); // Full Tower
        const total_partial_trays = qty % maxper_bin; // Remainder trays
        const total_bins = Math.floor(total_partial_trays / perbin);
        const total_partial_bins = total_partial_trays % perbin;
        // Handle the full and partial bins and trays
        if (total_tower > 0) {
            bins_string = `${total_tower} Tower @ ${maxper_bin}, Full Bins: ${total_bins}, Partial Trays : ${total_partial_bins}`;
        } else {
            bins_string = `Partial Trays: ${total_partial_trays}`;
        }
    } else {
        // For other cases (like sachets or cups), simply display the remainder
        if (total_trays_remaining > 0) {
            bins_string = `Partial ${total_trays_remaining}`;
        }
    }

    // Create PDF for each tower
    const doc = new jsPDF({
        format: [101.6, 152.4] // 4x6 inches in mm
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // Get the width of the page

    for (let i = 1; i <= towers; i++) {
        // Add a new page for each tower except the first
        if (i > 1) {
            doc.addPage();
        }

        // Set up for Cycle label, only for Cycle 2
        if (!isCycle1) {
            doc.setFontSize(15);
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(255, 0, 0); // Red text
            doc.setFillColor(255, 192, 203); // Pink background
            doc.rect(0, 0, 101.6, 15, 'F'); // Pink row for Cycle 2
            doc.text('Cycle 2', pageWidth / 2, 10, { align: 'center' }); // Center text for Cycle 2
            doc.setTextColor(0); // Reset text color to black
        }

        // Task description on the left with light purple background
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        let taskTextWidth = doc.getTextWidth(taskDescription); // Get the width of the task description text
        let padding = 3; // Adjust padding to make it fit better

        // Adjusted purple background width for task description
        doc.setFillColor(128, 0, 128); // Light purple background
        doc.rect(3, 10, taskTextWidth + padding * 2, 10, 'F'); // Move task description 3 mm from left
        doc.setTextColor(255); // White text for task description
        doc.text(taskDescription, 3 + padding, 18); // Position the text slightly left

        // Check if map exists and is not "no MAP"
        if (map) {
            let mapText = `MAP: ${map}`;
            let mapTextWidth = doc.getTextWidth(mapText); // Get the width of map text

            // Draw yellow background for MAP
            doc.setFillColor(255, 255, 0); // Yellow background
            doc.rect(75, 10, mapTextWidth + padding * 2, 10, 'F'); // Position MAP on the right

            // Draw MAP text aligned to the right
            doc.setTextColor(0); // Set text color to black
            doc.text(mapText, 75 + padding, 18); // Position the MAP text
        }

        // Check if tray exists and is not 'normal'
        if (tray) {
            let trayText = `Tray: ${tray}`;
            let trayTextWidth = doc.getTextWidth(trayText); // Get the width of tray text

            // Draw yellow background for Tray
            doc.setFillColor(255, 255, 0); // Yellow background
            doc.rect(75, 25, trayTextWidth + padding * 2, 10, 'F'); // Position Tray below MAP

            // Draw Tray text aligned to the right
            doc.setTextColor(0); // Set text color to black
            doc.text(trayText, 75 + padding, 33); // Position the Tray text below MAP
        }

        // Centered term ID with yellow background
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 0); // Yellow background
        doc.setFillColor(255, 255, 0);
        doc.rect(pageWidth / 2 - 20, 20, 40, 10, 'F'); // Center the yellow rectangle
        doc.setTextColor(0);
        doc.text(`Term: ${termID}`, pageWidth / 2, 25, { align: 'center' });

        // Meal number, task, UoM, and tower count
        doc.setFontSize(16);
        doc.text(`Meal: ${mealNo}${!isCycle1 ? ' - A' : ''}`, pageWidth / 2, 40, { align: 'center' }); // Centered Meal No
        doc.setFontSize(14);
        // doc.text(`${task}`, pageWidth / 2, 50, { align: 'center' }); // Centered task

        // Wrap the product text if it's too long
        const wrappedProduct = doc.splitTextToSize(product, pageWidth - 20); // Adjust width as needed
        doc.text(wrappedProduct, pageWidth / 2, 50, { align: 'center' }); // Centered Product

        doc.setFontSize(14);
        doc.text(`${uomText}`, pageWidth / 2, 70, { align: 'center' }); // Centered UoM
        doc.text(`${container.includes('tray') ? `Towers: ${i} of ${towers}` : `Bins: ${i} of ${towers}`}`, pageWidth / 2, 80, { align: 'center' }); // Centered Towers/Bins based on container

        // Min and Max weights displayed line by line
        doc.setFontSize(12);
        let startY = 95; // Starting Y position for Min/Max weights
        minMaxLines.forEach((line) => {
            doc.text(line, pageWidth / 2, startY, { align: 'center' });
            startY += 5; // Adjust line spacing as needed
        });

        // Bins Qty and Total Quantity
        doc.text(`Bins Qty: ${perbin || maxper_bin}`, pageWidth / 2, startY + 5, { align: 'center' }); // Centered Bins Qty
        doc.text(`Total Qty: ${qty}`, pageWidth / 2, startY + 10, { align: 'center' }); // Centered Total Qty
        doc.text('Initial:__________', pageWidth / 2, startY + 30, { align: 'center' }); // Centered Initial line

        // Add "Run at" value for sachet and dry sachet containers
        if (container.includes('sachet') || container.includes('dry sachet')) {
            doc.setFontSize(14);
            doc.setTextColor(255, 0, 0); // Red color
            doc.setFont('Helvetica', 'bold');
            let runAtStartY = startY + 15;
            runAtWeights.forEach((runAtWeight) => {
                doc.text(`Run at ${runAtWeight}`, 35, runAtStartY);
                runAtStartY += 5;
            });
            doc.setTextColor(0); // Reset text color
        }

        // Check if sleevingLoc and portion_location are different AND container doesn't include specialContainers
        if (sleevingLoc && sleevingLoc !== portion_location && !specialContainers.some(sc => container.includes(sc))) {
            // Add 'Transfer' text if they are different and not in special containers
            console.log('Adding Transfer text: sleevingLoc and portion_location are different');
            doc.setTextColor(255, 0, 0); // Red color for 'Transfer'
            doc.setFontSize(20); // Font size 20
            doc.setFont('Helvetica', 'bold');

            // Add 'Transfer' text
            doc.text('Transfer', pageWidth / 2, 150, { align: 'center' });
            doc.setTextColor(0); // Reset text color to black after
        }

        // If it's the last page, append the bins string
        if (i === towers) {
            doc.setFontSize(10);
            doc.text(bins_string, 10, 150); // Append the bins string at the bottom of the last page
        }
    }

    // Open the PDF in a new window for print preview
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
}

// NIST_MAV Function (for calculating min and max weights)
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
