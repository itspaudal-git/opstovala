console.log(ignoreList);
document.querySelector('#downloadsleevec1').addEventListener('click', function () {
    downloadSleevingPDF(true); // For Cycle 1
});

document.querySelector('#downloadsleevec2').addEventListener('click', function () {
    downloadSleevingPDF(false); // For Cycle 2
});

function downloadSleevingPDF(isCycle1) {
    // List of containers that are addons
    const specialContainers = [
        "tray 2 bagged meal extra", "tray 1 bagged meal extra", "bagged meal extra", "tray 1 sealed body armor", "tray 2 sealed body armor",
        "unsealed body armor", "tray 1 unsealed body armor", "tray 2 unsealed body armor", "sealed body armor"
    ];
    const { jsPDF } = window.jspdf;  // Access jsPDF from the global object
    const facilitySelect = document.getElementById('facilitySelect2');  // Facility dropdown
    const selectedFacility = facilitySelect.value;  // Get selected facility
    let tableRows = Array.from(document.querySelectorAll('#dataTable tbody tr'));

    // Filter rows based on matching 'portion_location' and the selected facility
    tableRows = tableRows.filter(row => {
        if (!row || row.cells.length < 12) {
            return false; // Skip rows that do not have enough cells
        }
        const portion_location = row.cells[5]?.textContent || '';  // Location column (6th column)
        return portion_location === selectedFacility;  // Only include rows where portion_location matches the selected facility
    });

    // Filter out rows where Task is undefined, empty, or not equals "Sleeving"
    tableRows = tableRows.filter(row => {
        const task = row.cells[11]?.textContent || ''; // Task column (12th column)
        return task && task === "Sleeving"; // Only include "Sleeving"
    });

    // Initialize jsPDF instance
    const doc = new jsPDF();

    // Track if content has been added
    let isContentAdded = false;

    tableRows.forEach((row, index) => {
        const originalMealNo = row.cells[0].textContent.trim();  // Original Meal No
        const displayMealNo = isCycle1
            ? originalMealNo  // If Cycle 1, keep the meal number as is
            : originalMealNo + " - A";  // If Cycle 2, append " - A"
        const mealDescription = row.cells[3]?.textContent.trim();  // Meal Description
    
        // Add this condition to skip meals with 'SOT' in the description
        if (mealDescription.includes('SOT')) {
            console.log(`Skipping meal with description containing 'SOT': ${mealDescription}`);
            return;  // Skip to the next iteration
        }
    
        const sleevingConfigSelect = row.cells[4]?.querySelector('select');
        const sleevingConfig = sleevingConfigSelect ? sleevingConfigSelect.value : null;
        const quantity = isCycle1 ? row.cells[1]?.textContent.trim() : row.cells[2]?.textContent.trim();  // Quantity for Cycle 1 or 2
        const termID = row.getAttribute('data-term-id');  // Term ID
        const sleevingLoc = row.getAttribute('data-sleeving-loc');  // Sleeving Location
    
        // Get components and trays data using originalMealNo
        const components = getComponentsForRow(row, originalMealNo, specialContainers);
    
        // Initialize currentY for each new page
        let currentY = 20; // Start with a top margin of 20mm
    
        // Generate content for the PDF for each row, passing currentY
        generatePDFContent(
            doc,
            displayMealNo,
            mealDescription,
            sleevingConfig,
            quantity,
            components,
            termID,
            sleevingLoc,
            isCycle1 ? 1 : 2,
            currentY
        );
    
        isContentAdded = true;
    
        // If not the last row, add a new page for the next set of data
        if (index !== tableRows.length - 1) {
            doc.addPage();
        }
    });
        // Save the PDF if content has been added
    if (isContentAdded) {
        // Open the PDF in a new window for print preview
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
    } else {
        alert('No data to download for the selected facility and cycle.');
    }


    // // Save the PDF if content has been added
    // if (isContentAdded) {
    //     doc.save(`Facility_${selectedFacility}_Cycle${isCycle1 ? '1' : '2'}_Sleeving.pdf`);
    // } else {
    //     alert('No data to download for the selected facility and cycle.');
    // }
}

// Helper function to check for page overflow
function checkPageOverflow(doc, currentY, requiredHeight) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY + requiredHeight > pageHeight - 20) { // 20mm bottom margin
        doc.addPage();
        return 20; // Reset currentY to top margin
    } else {
        return currentY;
    }
}


function getComponentsForRow(row, originalMealNo, specialContainers) {
    const components = [];
    const rows = document.querySelectorAll(`[data-term-id="${row.getAttribute('data-term-id')}"]`);

    rows.forEach((itemRow) => {
        const rowMealNo = itemRow.querySelector('td:first-child').textContent.trim();  // Extract Meal No from the row
        const container = itemRow.querySelector('td:nth-child(7)').textContent || ''; // Container column
        const componentCell = itemRow.querySelector('td:nth-child(4)');

        // If no componentCell or if component is in the ignoreList, skip this row
        if (!componentCell || ignoreList.includes(componentCell.textContent.trim())) {
            console.log(`Ignoring component: ${componentCell ? componentCell.textContent.trim() : 'undefined'}`);
            return; // Skip this component if it is in the ignoreList
        }

        // Use originalMealNo for comparison
        if (rowMealNo === originalMealNo && !specialContainers.some(sc => container.includes(sc))) {
            const containerCell = itemRow.querySelector('td:nth-child(7)');
            const traysCell = itemRow.querySelector('td:nth-child(11)');

            if (containerCell && traysCell) {
                const component = componentCell.textContent.trim();
                const container = containerCell.textContent.trim();
                const trays = traysCell.textContent.trim();

                // Skip 'sleeving' tasks
                if (container.toLowerCase() === 'sleeving') {
                    return;
                }

                components.push({ component, container, trays });
            }
        }
    });

    return components;
}

function generatePDFContent(doc, mealNo, mealDescription, configuration, quantity, components, termID, sleevingLoc, cycle, currentY) {
    const capitalizedSleevingLoc = sleevingLoc.charAt(0).toUpperCase() + sleevingLoc.slice(1);
    const qrCodeData = `${termID}${capitalizedSleevingLoc}${mealNo}${cycle}`;

    // Create QR Code using QRious
    const qr = new QRious({
        value: qrCodeData,
        size: 50  // Keep QR code at a size of 50 for better visibility
    });
    const qrCodeImage = qr.toDataURL();

    // Set fill color to gray for the title background
    doc.setFillColor(211, 211, 211);

    // Draw a gray rectangle behind the title
    doc.rect(30, currentY, 130, 10, 'F');  // (x, y, width, height, 'F' for filled)

    // Add Title text
    doc.setFontSize(16);
    doc.text('SLEEVING VERIFICATION / INSPECTION FORM', 30, currentY + 7);

    // Add the QR code to the top-right corner
    doc.addImage(qrCodeImage, 'PNG', 180, currentY - 5, 20, 20);  // QR Code positioning

    // Update currentY after adding title
    currentY += 15;

    // Set font size for form fields
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    // Draw form fields like Date, Start Time, etc.
    const formFieldHeight = 8;
    const formFieldWidth = 30;

    // Check for page overflow before adding form fields
    currentY = checkPageOverflow(doc, currentY, formFieldHeight * 2);

    doc.rect(20, currentY, formFieldWidth, formFieldHeight);  // 'Date'
    doc.rect(50, currentY, 40, formFieldHeight);  // 'Start Time'
    doc.rect(90, currentY, 35, formFieldHeight);  // 'Break (min)'
    doc.rect(125, currentY, 35, formFieldHeight); // 'Lunch (min)'
    doc.rect(160, currentY, 35, formFieldHeight); // 'End Time'

    // Add labels for form fields
    doc.text('Date', 25, currentY + 5);
    doc.text('Start Time AM/PM', 55, currentY + 5);
    doc.text('Break (min)', 95, currentY + 5);
    doc.text('Lunch (min)', 130, currentY + 5);
    doc.text('End Time AM/PM', 165, currentY + 5);

    // Add empty form fields for input
    currentY += formFieldHeight;
    doc.rect(20, currentY, formFieldWidth, formFieldHeight);  // Empty 'Date' field
    doc.rect(50, currentY, 40, formFieldHeight);  // Empty 'Start Time' field
    doc.rect(90, currentY, 35, formFieldHeight);  // Empty 'Break (min)' field
    doc.rect(125, currentY, 35, formFieldHeight);  // Empty 'Lunch (min)' field
    doc.rect(160, currentY, 35, formFieldHeight);  // Empty 'End Time' field

    // Update currentY after adding form fields
    currentY += formFieldHeight + 10; // Add some spacing before the next section

    // Add table header for Term, Meal, Description, Configuration, Quantity
    doc.setFontSize(12);
    const rowHeight = 10;

    const columnPositions = {
        termX: 20,
        termWidth: 20,
        mealX: 40,  // Original X position for 'Meal'
        mealWidth: 25,  // Increase width of 'Meal' by 5 units to widen the column
        descriptionX: 65,  // Adjust this X position to follow the new 'Meal' width
        descriptionWidth: 80,
        configX: 145,  // Adjust this X position accordingly
        configWidth: 35,
        qtyX: 180,  // Adjust this X position accordingly
        qtyWidth: 30
    };
    

    // Table header
    doc.rect(columnPositions.termX, currentY, columnPositions.termWidth, rowHeight);
    doc.rect(columnPositions.mealX, currentY, columnPositions.mealWidth, rowHeight);
    doc.rect(columnPositions.descriptionX, currentY, columnPositions.descriptionWidth, rowHeight);
    doc.rect(columnPositions.configX, currentY, columnPositions.configWidth, rowHeight);
    doc.rect(columnPositions.qtyX, currentY, columnPositions.qtyWidth, rowHeight);

    // Header text
    doc.text('Term', columnPositions.termX + 5, currentY + 7);
    doc.text('Meal', columnPositions.mealX + 5, currentY + 7);
    doc.text('Description', columnPositions.descriptionX + 5, currentY + 7);
    doc.text('Configuration', columnPositions.configX + 5, currentY + 7);
    doc.text('Quantity', columnPositions.qtyX + 5, currentY + 7);

    // Update currentY after header
    currentY += rowHeight;

    // Wrap the description to limit it to 2 rows
    let wrappedDescription = doc.splitTextToSize(mealDescription, columnPositions.descriptionWidth - 5);

    // Limit description to 2 lines if necessary
    if (wrappedDescription.length > 2) {
        wrappedDescription = wrappedDescription.slice(0, 2);
        wrappedDescription[1] = wrappedDescription[1] + '...';
    }

    // Wrap the configuration text to limit it to 2 rows
    let wrappedConfiguration = doc.splitTextToSize(configuration, columnPositions.configWidth - 5);

    // Limit configuration to 2 lines if necessary
    if (wrappedConfiguration.length > 2) {
        wrappedConfiguration = wrappedConfiguration.slice(0, 2);
        wrappedConfiguration[1] = wrappedConfiguration[1] + '...';
    }

    // Calculate the height needed for the data row
    const dataRowHeight = rowHeight * Math.max(wrappedDescription.length, wrappedConfiguration.length, 1);

    // Check for page overflow before adding data row
    currentY = checkPageOverflow(doc, currentY, dataRowHeight);

    // Data row for Term, Meal, Description, Configuration, and Quantity
    doc.rect(columnPositions.termX, currentY, columnPositions.termWidth, dataRowHeight);
    doc.rect(columnPositions.mealX, currentY, columnPositions.mealWidth, dataRowHeight);
    doc.rect(columnPositions.descriptionX, currentY, columnPositions.descriptionWidth, dataRowHeight);
    doc.rect(columnPositions.configX, currentY, columnPositions.configWidth, dataRowHeight);
    doc.rect(columnPositions.qtyX, currentY, columnPositions.qtyWidth, dataRowHeight);

    // Add text data
    doc.text(termID, columnPositions.termX + 5, currentY + 7);
    doc.text(mealNo, columnPositions.mealX + 5, currentY + 7);
    doc.text(wrappedDescription, columnPositions.descriptionX + 5, currentY + 7);
    doc.text(wrappedConfiguration, columnPositions.configX + 5, currentY + 7);
    doc.text(quantity, columnPositions.qtyX + 5, currentY + 7);

    // Update currentY after data row
    currentY += dataRowHeight + 10; // Add some spacing before the next section

    // Remove the preemptive check for page overflow here
    // Call helper function to add component/container table
    currentY = addComponentTable(doc, components, currentY);

    // Add some spacing before the next section
    currentY += 10;

    // Call helper function to add trays, component check, seals check, and headcount
    currentY = addTrayAndChecks(doc, currentY);

    // Add some spacing before the next section
    currentY += 10;

    // Call helper function to add hourly checks section
    currentY = addHourlyChecks(doc, currentY);
}

// Helper function for component/container table
function addComponentTable(doc, components, currentY) {
    const trayWidth = 20;
    const componentWidth = 100;
    const containerWidth = 40;
    const rowHeight = 10; // Base row height for one line of text

    // Table header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold'); // Set font to bold for headers

    // Column positions based on cumulative width
    const trayX = 20;
    const componentX = trayX + trayWidth;
    const containerX = componentX + componentWidth;

    // Draw the table header (excluding '# of Trays' column)
    doc.rect(trayX, currentY, trayWidth, rowHeight);
    doc.rect(componentX, currentY, componentWidth, rowHeight);
    doc.rect(containerX, currentY, containerWidth, rowHeight);

    // Header text
    doc.text('Tray', trayX + 5, currentY + 7);
    doc.text('Component', componentX + 5, currentY + 7);
    doc.text('Container', containerX + 5, currentY + 7);

    // Reset the font to normal for the table data
    doc.setFont('helvetica', 'normal');

    // Update currentY to start the data rows
    currentY += rowHeight;

    // Rows for each component
    components.forEach((item) => {
        let trayType = item.container.toLowerCase().includes('tray 1') ? 'Tray 1' :
                       item.container.toLowerCase().includes('tray 2') ? 'Tray 2' : 'Garnish';

        // Wrap text for component and container cells
        const wrappedComponent = doc.splitTextToSize(item.component, componentWidth - 10);
        const wrappedContainer = doc.splitTextToSize(item.container, containerWidth - 10);
        const lineHeightFactor = 1.0;

        // Determine the maximum number of lines needed for this row
        const maxLines = Math.max(wrappedComponent.length, wrappedContainer.length);

        // Adjust the cell height to be 0.7 of the rowHeight
        const cellHeight = rowHeight * maxLines * lineHeightFactor * 0.7;


        // Check for page overflow before adding this row
        currentY = checkPageOverflow(doc, currentY, cellHeight);

        // Draw rectangles for the entire row without '# of Trays'
        doc.rect(trayX, currentY, trayWidth, cellHeight);
        doc.rect(componentX, currentY, componentWidth, cellHeight);
        doc.rect(containerX, currentY, containerWidth, cellHeight);

        // Vertical alignment for text in cells
        let textY = currentY + 5; // Starting Y position for text in the cell

        // Add text to the cells
        doc.text(trayType, trayX + 5, textY);
        doc.text(wrappedComponent, componentX + 5, textY, { maxWidth: componentWidth - 5, lineHeightFactor: 1.2 });
        doc.text(wrappedContainer, containerX + 5, textY, { maxWidth: containerWidth - 5, lineHeightFactor: 1.2 });

        // Update currentY for the next row
        currentY += cellHeight;

        // Check the number of trays and add an extra row if more than 1
        const trayCount = parseInt(item.trays.match(/\d+/)); // Extract the number of trays (e.g., "2 trays" => 2)
        if (trayCount > 1) {
            const extraTrays = trayCount - 1;
            doc.setFont('helvetica', 'bold');
            const extraTrayText = `${extraTrays} Extra Tray${extraTrays > 1 ? 's' : ''} Require`;
            
            // Add an extra row with the required trays
            currentY = checkPageOverflow(doc, currentY, rowHeight); // Ensure it doesn't overflow the page
            doc.rect(trayX, currentY, trayWidth, rowHeight);
            doc.rect(componentX, currentY, componentWidth, rowHeight);
            doc.rect(containerX, currentY, containerWidth, rowHeight);

            // Add text for the extra tray row
            doc.text(trayType, trayX + 5, currentY + 7);
            doc.text(extraTrayText, componentX + 5, currentY + 7);
            doc.setFont('helvetica', 'normal');
            doc.text('Aluminum Tray', containerX + 5, currentY + 7);

            // Update currentY after adding extra tray row
            currentY += rowHeight;
        }
    });

    // Return the final Y position after the table
    return currentY;
}




// Helper function to add trays, component check, seals check, and headcount
function addTrayAndChecks(doc, currentY) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const rowHeight = 12;

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

    const requiredHeight = rowHeight + 12 + rowHeight + 12 + rowHeight;

    // Check for page overflow before adding this section
    currentY = checkPageOverflow(doc, currentY, requiredHeight);

    // Draw first row rectangles
    doc.rect(trayX, currentY, trayWidth1, rowHeight);  // '# of Trays'
    doc.rect(componentCheckX, currentY, componentCheckWidth, rowHeight);  // 'Component Check'
    doc.rect(sealsCheckX, currentY, sealsCheckWidth, rowHeight);  // 'Seals Check'
    doc.rect(headcountX, currentY, headcountWidth, rowHeight);  // 'Headcount'
    doc.rect(bestByDateX, currentY, bestByDateWidth, rowHeight);  // 'Best by date'
    doc.rect(emptyCellX, currentY, emptyCellWidth, rowHeight);  // Empty cell after 'Best by date'

    // Add labels for the first row fields
    doc.text('# of Trays', trayX + 5, currentY + 7);
    doc.text('Component Check', componentCheckX + 2, currentY + 7);
    doc.text('Seals Check', sealsCheckX + 5, currentY + 7);
    doc.text('Headcount ____', headcountX + 5, currentY + 7);
    doc.text('Best by date', bestByDateX + 2, currentY + 7);

    // Add checkboxes for the first row
    const checkboxSize = 5;
    doc.rect(trayX + trayWidth1 - 10, currentY + 1, checkboxSize, checkboxSize);  // Checkbox for '# of Trays'
    doc.rect(componentCheckX + componentCheckWidth - 10, currentY + 1, checkboxSize, checkboxSize);  // Checkbox for 'Component Check'
    doc.rect(sealsCheckX + sealsCheckWidth - 10, currentY + 1, checkboxSize, checkboxSize);  // Checkbox for 'Seals Check'

    // Second row: QA, Leadership, Produced Qty
    const qaX = 20;
    const qaWidth = 40;
    const leadershipX = qaX + qaWidth;
    const leadershipWidth = 60;
    const producedQtyX = leadershipX + leadershipWidth;
    const producedQtyWidth = 50;

    const row2Y = currentY + rowHeight + 0;

    // Draw second row rectangles
    doc.rect(qaX, row2Y, qaWidth, rowHeight);  // QA
    doc.rect(leadershipX, row2Y, leadershipWidth, rowHeight);  // Leadership
    doc.rect(producedQtyX, row2Y, producedQtyWidth, rowHeight);  // Produced Qty

    // Text for second row
    doc.text('QA:___________', qaX + 2, row2Y + 7);
    doc.text('Leadership:___________', leadershipX + 2, row2Y + 7);
    doc.text('Produced Qty:______', producedQtyX + 2, row2Y + 7);

    // Third row: Box Closer
    const boxCloserX = 20;
    const boxCloserWidth1 = 150;
    const row3Y1 = row2Y + rowHeight + 0;

    // Draw third row rectangle
    doc.rect(boxCloserX, row3Y1, boxCloserWidth1, rowHeight);  // Box Closer
    doc.text('Box Closer____________________________________', boxCloserX + 5, row3Y1 + 7);

    // Return updated currentY
    return row3Y1 + rowHeight;
}

// Helper function for hourly checks
function addHourlyChecks(doc, currentY) {
    const boxHeight = 10;
    const boxWidth = 18;

    // Title for Hourly Checks
    doc.setFont('helvetica', 'normal');
    const title = 'Hourly Checks';
    const titleWidth = doc.getTextWidth(title);
    const centerX = (210 - titleWidth) / 2;
    doc.text(title, centerX, currentY);

    // Update currentY after title
    currentY += 5;

    // Hourly boxes
    for (let i = 0; i < 8; i++) {
        const boxX = 15 + (i * (boxWidth + 5));
        const labelY = currentY + 10;
        const boxY = labelY + 5;

        // Check for page overflow before adding each hour box
        currentY = checkPageOverflow(doc, currentY, boxHeight + 15);

        doc.text(`Hour ${i + 1}`, boxX + 2, labelY);
        doc.rect(boxX, boxY, boxWidth, boxHeight);
    }

    // Return updated currentY
    return currentY + boxHeight + 15;
}


// Helper function to check for page overflow
function checkPageOverflow(doc, currentY, requiredHeight) {
    const pageHeight = doc.internal.pageSize.height;
    if (currentY + requiredHeight > pageHeight) {
        doc.addPage();
        return 20;  // Reset Y position after adding a new page
    }
    return currentY;
}

