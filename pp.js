// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app();
}

// Initialize Firebase
const db = firebase.database();
const packoutRef = db.ref('Packoutdata');

// Fetch Term, Facility, and Date options from Firebase
window.onload = function() {
    const searchTermInput = document.getElementById('searchTerm');
    const searchFacilitySelect = document.getElementById('searchFacility');
    const searchDaySelect = document.getElementById('searchDay');
    
    // Populate Facility dropdown
    packoutRef.once('value', snapshot => {
        const facilities = new Set();
        const dates = new Set();
        
        snapshot.forEach(childSnapshot => {
            childSnapshot.forEach(data => {
                const facility = data.val().Location;
                const date = data.val().ShipDate;
                
                facilities.add(facility);
                dates.add(date);
            });
        });
        
        facilities.forEach(facility => {
            const option = document.createElement('option');
            option.value = facility;
            option.textContent = facility;
            searchFacilitySelect.appendChild(option);
        });

        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            searchDaySelect.appendChild(option);
        });
    });

    // Event listener for Facility and Date change
    searchFacilitySelect.addEventListener('change', updateTable);
    searchDaySelect.addEventListener('change', updateTable);

    // Update table dynamically based on filters
    function updateTable() {
        const term = searchTermInput.value;
        const facility = searchFacilitySelect.value;
        const date = searchDaySelect.value;
        
        // Clear current table data
        const tableBody = document.querySelector('#packoutTable tbody');
        const tableHeader = document.querySelector('#packoutTable thead tr');

        tableBody.innerHTML = '';
        
        // Clear dynamic headers
        tableHeader.innerHTML = `
            <th>Facility</th>
            <th>Cycle</th>
            <th>Carrier, Origin</th>
             <th>Origin</th>
              <th>Date</th>
        `;
        
        // Filter data and populate table
        packoutRef.child(term).once('value', snapshot => {
            snapshot.forEach(data => {
                const rowData = data.val();
                if ((facility === '' || rowData.Location === facility) && 
                    (date === '' || rowData.ShipDate === date)) {
                    
                    // Create dynamic headers based on the data keys (1, 2, 3, A, B, C, etc.)
                    const dynamicHeaders = Object.keys(rowData).filter(key => {
                        return !['Location', 'Cycle', 'Carrier', 'Origin', 'ShipDate', 'Term'].includes(key);
                    });

                    // Add dynamic headers to the table
                    dynamicHeaders.forEach(key => {
                        const headerCell = document.createElement('th');
                        headerCell.textContent = key;
                        tableHeader.appendChild(headerCell);
                    });

                    // Create a table row for the filtered data
                    const row = document.createElement('tr');
                    const columns = ['Location', 'Cycle', 'Carrier', 'Origin', 'ShipDate'];

                    columns.forEach(col => {
                        const cell = document.createElement('td');
                        if (col === 'Carrier') {
                            cell.textContent = `${rowData.Carrier} ${rowData.Origin}`;
                        } else {
                            cell.textContent = rowData[col] || '';
                        }
                        row.appendChild(cell);
                    });

                    // Add dynamic data columns
                    dynamicHeaders.forEach(key => {
                        const cell = document.createElement('td');
                        cell.textContent = rowData[key] || '';
                        row.appendChild(cell);
                    });

                    tableBody.appendChild(row);
                }
            });
        });
    }
};
