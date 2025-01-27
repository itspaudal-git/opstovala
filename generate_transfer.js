document.getElementById('generatetransfer').addEventListener('click', async function () {
    const selectedDay = dayDropdown.value;
    const selectedRun = runDropdown.value;
    const destination = destinationCheckbox.checked ? 'Tubeway' : 'Pershing';
    const shippingAddress = destination === 'Tubeway'
        ? 'Ship To:\nPershing\n815 W Pershing Rd Chicago, IL- 60609'
        : 'Ship To:\nTubeway\n248 Tubeway Dr Carol Stream, IL 60188';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'letter');

    const titleText = destination === 'Tubeway' ? 'TUBEWAY' : 'PERSHING';
    const today = new Date().toLocaleDateString();

    // Iterate through each row in the table to generate the transfer tags
    const rowsData = tableBody.querySelectorAll('tr');
    let pageCount = 0;

    rowsData.forEach((row) => {
        const type = row.cells[4].textContent.trim();
        const transportedIn = row.cells[7].textContent.trim();
        
        // Filter based on conditions: not "Sleeved Meal" and in specified transported types
        if (type !== 'Sleeved Meal' && ["Drums", "Lexan", "Cases"].includes(transportedIn)) {
            const term = row.cells[0].textContent.trim();
            const cycle = row.cells[1].textContent.trim();
            const meal = row.cells[2].textContent.trim();
            const item = row.cells[3].textContent.trim();
            const qty = parseFloat(row.cells[5].textContent.trim());
            const unit = row.cells[6].textContent.trim();
            
            const totalWeight = qty;
            const pageQty = Math.ceil(totalWeight / 350); // Assuming 350 LBS per page

            for (let i = 1; i <= pageQty; i++) {
                doc.addPage(); // Add a new page per iteration
                pageCount++;
                const currentWeight = i === pageQty ? (totalWeight % 350 || 350) : 350; // Handle the last page

                // Red Title
                doc.setFontSize(42);
                doc.setTextColor(255, 0, 0);
                doc.text(titleText, 230, 80);

                // Term Text
                doc.setFontSize(36);
                doc.setTextColor(0, 0, 0);
                doc.text(`Term : ${term}`, 230, 120);

                // Yellow Background for Product Name
                const itemTextWidth = doc.getTextWidth(item);  // Get the width of the item text
                const rectHeight = 40; // Height of the rectangle background

                doc.setFillColor(255, 255, 0); // Set the fill color to yellow
                doc.rect(80 - 5, 150, itemTextWidth + 10, rectHeight, 'F'); // Draw a rectangle slightly larger than the text

                doc.setFontSize(34); // Set the font size for the item
                doc.setFont('Courier', 'bold'); // Set the font style
                doc.text(item, 80, 180); // Print the item text


                // Cycle and Meal Info
                doc.setFontSize(20);
                doc.setTextColor(0, 0, 0);
                doc.text(`Meal ${meal} | Cycle - ${cycle}`, 150, 240);

                // Weight Display
                doc.setFontSize(22);
                doc.setTextColor(0, 0, 0);
                doc.text(`${currentWeight.toFixed(2)} ${unit} Of ${totalWeight.toFixed(2)} ${unit}`, 150, 270);

                // Transported In Text
                doc.setFontSize(40);
                doc.setTextColor(0, 0, 0);
                doc.text(`${transportedIn} : ${i} Of ${pageQty}`, 150, 350);
                doc.setFontSize(24);

                // Drum approval checklist (if applicable)
                if (transportedIn === 'Drums') {
                    doc.setFontSize(16);
                    doc.text('> Cap seals on the drum are both on and tight', 100, 480);
                    doc.text('> Locking rim is on and locked', 100, 500);
                    doc.text('> Garnish/Sauce in drum matches tag', 100, 520);
                }

                // MOD/Supervisor Initials
                doc.setFontSize(20);
                doc.text('MOD/Supervisor initials', 170, 580);
                doc.text('_______________________', 170, 630);
            }
        }
    });

    if (pageCount > 0) {
        const pdfBlob = doc.output('blob');
        const storageRef = firebase.storage().ref();
        const pdfRef = storageRef.child(`Transfers/Transfer_${today}.pdf`);

        try {
            const snapshot = await pdfRef.put(pdfBlob);
            const downloadURL = await snapshot.ref.getDownloadURL();
            console.log('PDF uploaded successfully! Download URL:', downloadURL);
            doc.save(`Transfer_${today}.pdf`); // Save locally
        } catch (error) {
            console.error('Error uploading PDF:', error);
        }
    } else {
        alert('No valid data found for Transfer PDF.');
    }
});
