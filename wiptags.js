// Ensure these are defined at the top of the script
let tray1Items = [];
let tray2Items = [];
let ignoreList = [];
let productConfig = [];

// Fetch ignore list from GitHub
fetch('https://raw.githubusercontent.com/itspaudal-git/ignore_list/main/ignore_wips.json')
    .then(response => response.json())
    .then(data => {
        data.forEach(item => {
            let product = item.Product;
            ignoreList.push(product);  // Add both original and "- 2" version if present
        });
        console.log('ignoreList:', ignoreList);
    })
    .catch(error => console.error('Error fetching ignore list:', error));

// Fetch product configuration list from GitHub for handling "westvala" and "sachet"
fetch('https://raw.githubusercontent.com/itspaudal-git/ignore_list/main/Configuration.json')
    .then(response => response.json())
    .then(data => {
        productConfig = data;  // Store the fetched product configuration data
        console.log('Product Config:', productConfig);
    })
    .catch(error => console.error('Error fetching product config list:', error));

// Add listeners for group download buttons
document.querySelector('#downloadCycle1').addEventListener('click', function () {
    downloadGroupedPDFs(true); // For Cycle 1
});

document.querySelector('#downloadCycle2').addEventListener('click', function () {
    downloadGroupedPDFs(false); // For Cycle 2
});

function downloadGroupedPDFs(isCycle1) {
    const { jsPDF } = window.jspdf;
    const facilitySelect = document.getElementById('facilitySelect2');  // Facility dropdown
    const selectedFacility = facilitySelect.value;
    let tableRows = Array.from(document.querySelectorAll('#dataTable tbody tr'));

    // Combine tray1Items and tray2Items into a single array to handle both
    const allTrayItems = tray1Items.concat(tray2Items);

    // Initialize jsPDF instance
    const doc = new jsPDF({
        format: [101.6, 152.4] // 4x6 inches in mm
    });

    // Define pageWidth after initializing the doc
    const pageWidth = doc.internal.pageSize.getWidth();

    // Ensure there are tray items to process
    if (allTrayItems.length > 0) {
        let yPosition = 95; // Starting Y-position for Min/Max values

        // Extract UoM values (weights) from the combined tray items array
        allTrayItems.forEach(item => {
            let uomString = item.uom;  // Get the uom value like "170 g & 150 g"

            // Use the updated parseUomValues function to handle '&' separator
            let uomValues = parseUomValues(uomString);

            uomValues.forEach((weight, index) => {
                if (isNaN(weight) || weight === 0) {
                    // Skip invalid or zero weights
                    return;
                }
                const mav = NIST_MAV(weight);  // Use the NIST_MAV function
                const minWeight = (weight - mav).toFixed(1);
                const maxWeight = (weight + mav).toFixed(1);

                // Print Min and Max for each weight on separate rows
                doc.text(`Min: ${minWeight} g`, pageWidth / 2, yPosition, { align: 'center' });
                yPosition += 10; // Move to the next line for Max
                doc.text(`Max: ${maxWeight} g`, pageWidth / 2, yPosition, { align: 'center' });
                yPosition += 15; // Adjust Y-position for next weight
            });
        });
    } else {
        console.error('No tray items found!');
    }

    // Rest of the code for filtering and generating the PDF
    tableRows = tableRows.filter(row => {
        let product = row.cells[3]?.textContent || '';
        const isProductIgnored = ignoreList.includes(product);
        console.log(`Checking product: ${product}, Ignored: ${isProductIgnored}`);
        if (isProductIgnored) {
            console.log(`Ignoring product: ${product}`);
            return false; // Skip this row if the product is ignored
        }
        return true;
    });

    // Filter rows based on matching 'portion_location' and the selected facility
    tableRows = tableRows.filter(row => {
        if (!row || row.cells.length < 12) {
            return false; // Skip rows that do not have enough cells
        }
        const portion_location = row.cells[5]?.textContent || '';
        return portion_location === selectedFacility;  // Only include rows where portion_location matches the selected facility
    });

    // Filter out rows where Task is undefined, empty, or equals "Sleeving"
    tableRows = tableRows.filter(row => {
        const task = row.cells[11]?.textContent || '';
        return task && task !== "Sleeving"; // Only include rows where Task is defined, not empty, and not "Sleeving"
    });

    // Sort rows by the Task column (alphabetically A to Z)
    tableRows.sort((rowA, rowB) => {
        const taskA = rowA.cells[11]?.textContent.toLowerCase() || '';
        const taskB = rowB.cells[11]?.textContent.toLowerCase() || '';
        return taskA.localeCompare(taskB);
    });

    // Loop over each row in the sorted table
    tableRows.forEach((row, rowIndex) => {
        if (!row || row.cells.length < 12) {
            return;  // Skip this row
        }

        // Extract row data
        const mealNo = row.cells[0]?.textContent.trim() + (isCycle1 ? '' : ' - A');
        let product = row.cells[3]?.textContent || '';
        const qty = isCycle1 ? row.cells[1]?.textContent || '' : row.cells[2]?.textContent || '';
        const task = row.cells[11]?.textContent || '';
        const uom = row.cells[4]?.textContent || '';
        const container = row.cells[6]?.textContent || '';
        const day = isCycle1 ? row.cells[7]?.textContent || '' : row.cells[8]?.textContent || '';
        let map = row.cells[9]?.textContent || '';
        let tray = row.cells[10]?.textContent || '';
        const termID = row.dataset.termId || 'undefined';
        let sleevingLoc = '';
        const portion_location = row.cells[5]?.textContent || '';

        // Handle multiple UoM values
        const uomValues = parseUomValues(uom);

        // Calculate Min and Max weights for each UoM value
        const minMaxStrings = uomValues.map(weightInGrams => {
            const mav = NIST_MAV(weightInGrams);
            const minWeight = (weightInGrams - mav).toFixed(1);
            const maxWeight = (weightInGrams + mav).toFixed(1);
            return `Min: ${minWeight} g  |  Max: ${maxWeight} g`;
        });

        // Special handling for westvala + sachet
        let maxper_bin, perbin;
        if (portion_location === "westvala" && container === "sachet") {
            // Use Qty Per Bins from productConfig for these cases
            const matchingProduct = productConfig.find(config => config.Product.trim() === product.trim());
            if (matchingProduct) {
                maxper_bin = matchingProduct["Qty Per Bins"];
                console.log(`Setting maxper_bin from productConfig: ${maxper_bin}`);
            } else {
                maxper_bin = 400; // Default if not found
            }
        } else {
            // Default logic for other products
            if (container.includes('tray')) {
                if (portion_location === 'westvala' || (sleevingLoc !== portion_location && sleevingLoc === 'pershing')) {
                    maxper_bin = 320;  // Max per bin for transfer or westvala
                    perbin = 32;
                } else if (tray === '1 tray') {
                    maxper_bin = 480;
                    perbin = 48;
                } else {
                    maxper_bin = 320;
                    perbin = 32;
                }
            } else if (container.includes('sachet')) {
                maxper_bin = container.includes('dry') ? 300 : 400;
            } else if (container.includes('cup')) {
                maxper_bin = container.includes('1 oz') ? 500 : 400;
            } else {
                maxper_bin = 1000; // Default case for bags and other containers
            }
        }

        // Special containers list for transfer checks
        const specialContainers = [
            "tray 2 bagged meal extra", "tray 1 bagged meal extra", "bagged meal extra", "tray 1 sealed body armor",
            "tray 2 sealed body armor", "unsealed body armor", "tray 1 unsealed body armor", "tray 2 unsealed body armor", "sealed body armor"
        ];

        // Find the first row with task 'Sleeving' for this mealNo
        const tableRowsForSleeving = document.querySelectorAll('#dataTable tbody tr');
        for (let r of tableRowsForSleeving) {
            if (r.cells[0]?.textContent === mealNo && r.cells[11]?.textContent === 'Sleeving') {
                sleevingLoc = r.cells[5]?.textContent || '';
                break;
            }
        }

        // PDF generation logic continues here...
        const towers = Math.ceil(qty / maxper_bin);
        const total_trays_remaining = qty % maxper_bin;

        // Additional PDF logic for generating pages...
        let bins_string = "";
        if (container.includes("tray") || task.includes("Tray Sealing") || task.includes("Band Sealing/tin")) {
            const total_tower = Math.floor(qty / maxper_bin); // Full Tower
            const total_partial_trays = qty % maxper_bin; // Remainder trays
            const total_bins = Math.floor(total_partial_trays / perbin);
            const total_partial_bins = total_partial_trays % perbin;

            // Handle the full and partial bins and trays
            if (total_tower > 0) {
                bins_string = `Full Bins: ${total_bins}, Partial Trays: ${total_partial_bins}`;
            } else {
                bins_string = `Partial Trays: ${total_partial_trays}`;
            }
        } else {
            // For other cases (like sachets or cups), simply display the remainder
            if (total_trays_remaining > 0) {
                bins_string = `Partial ${total_trays_remaining}`;
            }
        }

        const notransfer = ['Tortilla, Casa Solana, Flour, 10', 'Three 6" Flour Tortillas for Flautas'];

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

            // Task and other details
            doc.setFontSize(12);
            let taskTextWidth = doc.getTextWidth(task);
            let padding = 3;
            doc.setFillColor(128, 0, 128); // Light purple background
            doc.rect(3, 10, taskTextWidth + padding * 2, 10, 'F');
            doc.setTextColor(255); // White text for task description
            doc.text(task, 3 + padding, 18);

            // MAP and Tray information
            if (map) {
                let mapText = `MAP: ${map}`;
                let mapTextWidth = doc.getTextWidth(mapText);
                doc.setFillColor(255, 255, 0); // Yellow background
                doc.rect(75, 10, mapTextWidth + padding * 2, 10, 'F');
                doc.setTextColor(0);
                doc.text(mapText, 75 + padding, 18);
            }
            if (tray) {
                let trayText = `Tray: ${tray}`;
                let trayTextWidth = doc.getTextWidth(trayText);
                doc.setFillColor(255, 255, 0);
                doc.rect(75, 25, trayTextWidth + padding * 2, 10, 'F');
                doc.setTextColor(0);
                doc.text(trayText, 75 + padding, 33);
            }

            // Main content
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(18);
            doc.setTextColor(255, 255, 0);
            doc.setFillColor(255, 255, 0);
            doc.rect(101.6 / 2 - 20, 20, 40, 10, 'F');
            doc.setTextColor(0);
            doc.text(`Term: ${termID}`, 101.6 / 2, 25, { align: 'center' });
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFontSize(18);
            doc.text(`Meal: ${mealNo}`, pageWidth / 2, 35, { align: 'center' });
            doc.setFontSize(16);
            const wrappedProductText = doc.splitTextToSize(`${product}`, 90);
            doc.text(wrappedProductText, pageWidth / 2, 55, { align: 'center' });
            doc.setFontSize(14);
            doc.text(`${uom}`, pageWidth / 2, 77, { align: 'center' });
            doc.setFontSize(16);
            doc.text(`${container.includes('tray') ? `Towers: ${i} of ${towers}` : `Bins: ${i} of ${towers}`}`, pageWidth / 2, 85, { align: 'center' });
            doc.setFontSize(12);

            // Add Min and Max weights to the PDF
            // If multiple UoM values, list all Min and Max values
            const minMaxYStart = 95; // Starting Y position
            minMaxStrings.forEach((minMaxStr, idx) => {
                doc.text(minMaxStr, pageWidth / 2, minMaxYStart + idx * 5, { align: 'center' });
            });

            // Additional details
            doc.text(`Bins Qty: ${perbin || maxper_bin}`, pageWidth / 2, 115, { align: 'center' });
            doc.text(`Total Qty: ${qty}`, pageWidth / 2, 125, { align: 'center' });
            doc.text('Initial:__________', pageWidth / 2, 135, { align: 'center' });
            doc.text(`Container: ${container}`, 101.6 / 2, 45, { align: 'center' });

            // Special instructions
            if (container.includes('sachet') || container.includes('dry sachet')) {
                const runAtWeight = (uomValues[0] - 2).toFixed(1); // Subtract 2g for the run-at weight
                doc.setFontSize(14);
                doc.setTextColor(255, 0, 0); // Red color
                doc.setFont('Helvetica', 'bold');
                doc.text(`Run at ${runAtWeight} g`, 35, 150);
            }

            // Transfer notice
            if (
                sleevingLoc &&
                sleevingLoc !== portion_location &&
                !specialContainers.some(sc => container.includes(sc)) &&
                !notransfer.includes(product)
            ) {
                doc.setTextColor(255, 0, 0); // Red color for 'Transfer'
                doc.setFontSize(20);
                doc.setFont('Helvetica', 'bold');
                doc.text('Transfer', 50, 145, { align: 'center' });
                doc.setTextColor(0); // Reset text color to black after
            }

            // Bins string
            if (i === towers) {
                doc.setTextColor(0); // Reset text color to black
                doc.setFontSize(10);
                doc.text(bins_string, 15, 148);
            }
        }
    });

    // Open the PDF in a new window for print preview
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
}

// Function to parse UoM values, handling multiple values separated by '/', ',', '+', '&'
function parseUomValues(uomString) {
    const separators = ['/', ',', '+', '&']; // Added '&' to the list of separators
    let regexPattern = separators.map(sep => `\\${sep}`).join('|');
    let regex = new RegExp(regexPattern, 'g');
    let uomParts = uomString.split(regex).map(part => part.trim());
    let uomValues = [];

    uomParts.forEach(part => {
        let weight = parseFloat(part.replace(/[^\d\.]/g, '')); // Remove non-numeric characters
        if (!isNaN(weight)) {
            uomValues.push(weight);
        }
    });

    return uomValues;
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
    if (weight < 426) return 16.3;
    if (weight < 489) return 18.1;
    if (weight < 571) return 19.9;
    if (weight < 635) return 21.7;
    if (weight < 698) return 23.5;
    if (weight < 761) return 25.4;
    return 0.0;
}
