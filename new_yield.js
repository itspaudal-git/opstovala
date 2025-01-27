// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Function to calculate the current term number based on the current week
function calculateCurrentTerm() {
    const baseTerm = 403; // Starting term
    const startDate = new Date('2024-09-15'); // Starting date of term 403
    const currentDate = new Date();

    // Calculate the number of weeks between the starting date and the current date
    const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
    const weeksPassed = Math.floor((currentDate - startDate) / millisecondsPerWeek);

    // Calculate the current term
    return baseTerm + weeksPassed;
}

// Set default min and max term to the current term
const currentTerm = calculateCurrentTerm();
document.getElementById('minTerm').value = currentTerm;
document.getElementById('maxTerm').value = currentTerm;

// List of allowed tasks
const allowedTasks = [
    "Batch Mix", "Sauce Mix", "Open", "Drain",
    "Kettle", "Oven", "Thaw", "VCM", "Planetary Mix", "Skillet"
];

// Function to calculate variance percentage
function calculateVariance(count, value) {
    if (value === 0 || isNaN(value)) return ""; // Return empty string for NaN or zero
    return ((count - value) / value) * 100;
}

// Function to fetch and display data
function fetchData() {
    const minTerm = document.getElementById('minTerm').value;
    const maxTerm = document.getElementById('maxTerm').value;
    const facility = document.getElementById('facility').value.toLowerCase();
    const product = document.getElementById('product').value.toLowerCase();
    const task = document.getElementById('task').value.toLowerCase();
    const search = document.getElementById('search').value.toLowerCase();

    const tableBody = document.querySelector('#dataTable tbody');
    tableBody.innerHTML = '';

    // Loop through the range of terms from minTerm to maxTerm
    for (let term = minTerm; term <= maxTerm; term++) {
        const ref = database.ref(`Master_Task/${term}`);
        ref.once('value').then((snapshot) => {
            
            const data = snapshot.val();
            console.log(`Term ${term} Data:`, data); // Log the data for each term
            if (data) {
                data.forEach((item, key) => {
                    const termValue = item.Term;
                    const cycle = item.Cycle;
                    const meal = item.Meal;
                    const productName = item.Product.toLowerCase();
                    const taskName = item.Task.toLowerCase();
                    const count = parseFloat(item.Count);
                    const yieldValue = parseFloat(item.Yield);
                    const producedQty = parseFloat(item['Produced Qty']);

                    // Skip rows with empty Yield
                    if (!yieldValue) return;

                    // Check if the task is in the allowed tasks list
                    if (allowedTasks.includes(item.Task)) {
                        if ((!facility || item.Facility.toLowerCase().includes(facility)) &&
                            (!product || productName.includes(product)) &&
                            (!task || taskName.includes(task)) &&
                            (!search || termValue.toString().includes(search) || cycle.includes(search) || meal.includes(search) || productName.includes(search) || taskName.includes(search) || count.toString().includes(search) || yieldValue.toString().includes(search) || producedQty.toString().includes(search))) {

                            // Calculate variances
                            const varianceYield = calculateVariance(count, yieldValue);
                            const varianceProducedQty = calculateVariance(yieldValue, producedQty);

                            // Create table row
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${termValue}</td>
                                <td>${item.Facility}</td>
                                <td>${cycle}</td>
                                <td>${meal}</td>
                                <td>${item.Product}</td>
                                <td>${item.Task}</td>
                                <td>${count}</td>
                                <td>${yieldValue}</td>
                                <td class="${varianceYield < 0 ? 'negative' : 'positive'}">${varianceYield === "" ? "" : varianceYield.toFixed(2) + "%"}</td>
                                <td>${isNaN(producedQty) ? "" : producedQty}</td>
                                <td class="${varianceProducedQty < 0 ? 'negative' : 'positive'}">${varianceProducedQty === "" ? "" : varianceProducedQty.toFixed(2) + "%"}</td>
                                <td><input type="text" class="notes-input" data-term="${termValue}" data-key="${key}" placeholder="Enter notes..." /></td>
                            `;
                            tableBody.appendChild(row);

                            // Fetch and populate notes
                            const notesRef = database.ref(`Master_Task/${termValue}/${key}/yield_note`);
                            notesRef.on('value', (notesSnapshot) => {
                                const notes = notesSnapshot.val();
                                if (notes) {
                                    row.querySelector('.notes-input').value = notes;
                                }
                            });

                            // Add blur event to save notes
                            row.querySelector('.notes-input').addEventListener('blur', (event) => {
                                const notes = event.target.value;
                                const term = event.target.getAttribute('data-term');
                                const key = event.target.getAttribute('data-key');
                                database.ref(`Master_Task/${term}/${key}/yield_note`).set(notes);
                            });
                        }
                    }
                });
            }
        });
    }
}

// Function to sort the table
function sortTable(columnIndex, isNumeric) {
    const table = document.getElementById('dataTable');
    const rows = Array.from(table.querySelectorAll('tbody tr'));

    rows.sort((a, b) => {
        const aValue = a.cells[columnIndex].textContent.trim();
        const bValue = b.cells[columnIndex].textContent.trim();

        if (isNumeric) {
            return parseFloat(aValue) - parseFloat(bValue);
        } else {
            return aValue.localeCompare(bValue);
        }
    });

    // Clear the table body
    const tableBody = table.querySelector('tbody');
    tableBody.innerHTML = '';

    // Append sorted rows
    rows.forEach(row => tableBody.appendChild(row));
}

// Add click event listeners to table headers for sorting
document.querySelectorAll('#dataTable th').forEach((header, index) => {
    header.addEventListener('click', () => {
        const isNumeric = index === 0 || index === 6 || index === 7 || index === 9; // Columns with numeric data
        sortTable(index, isNumeric);
    });
});

// Event listeners for filter and clear buttons
document.getElementById('applyFilters').addEventListener('click', fetchData);
document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('minTerm').value = currentTerm;
    document.getElementById('maxTerm').value = currentTerm;
    document.getElementById('facility').value = '';
    document.getElementById('product').value = '';
    document.getElementById('task').value = '';
    document.getElementById('search').value = '';
    fetchData();
});

// Event listener for search input
document.getElementById('search').addEventListener('input', fetchData);

// Initial data fetch
fetchData();