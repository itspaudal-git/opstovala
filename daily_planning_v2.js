// daily_planning_v2.js

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // Initialize Firebase app if not already initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized.');
    } else {
        console.log('Firebase already initialized.');
    }

    const auth = firebase.auth();
    const database = window.database; // Use the globally declared database

    // References to DOM elements
    const termInput = document.getElementById('termInput');
    const dayInput = document.getElementById('dayInput');
    const taskInput = document.getElementById('taskInput');
    const equipmentInput = document.getElementById('equipmentInput');
    const facilityInput = document.getElementById('facilityInput');
    const searchButton = document.getElementById('searchButton');
    const clearButton = document.getElementById('clearButton');
    const dataTableBody = document.querySelector('#dataTable tbody');
    const customAlert = document.getElementById('customAlert');
    const customAlertMessage = document.getElementById('customAlertMessage');
    const successNotification = document.getElementById('successNotification');
    const copyButton = document.getElementById('copyButton');

    // Variables to store data
    let masterTaskData = []; // All data from Master_Task
    let filteredData = []; // Data after applying filters
    let currentListener = null;

    // Variables for sorting
    let currentSortField = 'Priority'; // Default sort by 'Priority'
    let currentSortDirection = 'asc'; // 'asc' or 'desc'

    // Variables for auto-complete
    const taskOptions = new Set();

    // Fetch user role and facility from localStorage
    let userRole = localStorage.getItem('userRole') || null;
    let userFacility = localStorage.getItem('userFacility') || null;

    // Days of the week (including possible duplicates as per existing code)
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday2", "Monday2"];

    // On page load, set the default term and load data
    window.onload = function () {
        if (userRole && userFacility) {
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('planningView').style.display = 'block';
            termInput.value = calculateCurrentTerm();
            loadData(); // Load data when the page loads
            populateUserInfo(); // Display user info in header
        } else {
            document.getElementById('planningView').style.display = 'none';
            document.getElementById('login-container').style.display = 'block';
        }
    };

    // Function to populate user info in header
    function populateUserInfo() {
        const userInfoDiv = document.getElementById('user-info');
        const user = auth.currentUser;
        if (user) {
            userInfoDiv.innerHTML = `
                <p>Welcome, ${user.displayName}</p>
                <img src="${user.photoURL}" alt="User Photo">
            `;
            document.getElementById('logout-button').style.display = 'block';
        }
    }

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

    // Function to load data from Firebase
    function loadData() {
        const termInputValue = termInput.value.trim();
        if (termInputValue === '') {
            showCustomAlert('Please enter a term.');
            return;
        }

        // Remove previous listener if it exists
        if (currentListener) {
            database.ref('Master_Task').off('value', currentListener);
            database.ref('Master_Task').off('child_changed', currentListener);
        }

        // Listen for value changes to load initial data
        currentListener = database.ref('Master_Task').on('value', (snapshot) => {
            masterTaskData = [];
            taskOptions.clear(); // Clear previous task options

            snapshot.forEach((termSnapshot) => {
                const termKey = termSnapshot.key; // Use term as is
                const termData = termSnapshot.val();

                if (termData) {
                    for (let key in termData) {
                        const item = termData[key];
                        const uniqueId = `${termKey}-${key}`;
                        masterTaskData.push({ ...item, key: key, term: termKey, uniqueId });
                        if (item.Task) taskOptions.add(item.Task);
                    }
                }
            });

            populateFilters(masterTaskData);
            setupTaskAutoComplete(); // Set up task auto-complete
            applyFilters(); // Apply filters after data is loaded
        });

        // Listen for individual changes to avoid reloading the entire data
        database.ref('Master_Task').on('child_changed', (snapshot) => {
            const termKey = snapshot.ref.parent.key;
            const updatedItem = snapshot.val();

            // Find the item in masterTaskData using uniqueId and update it
            const index = masterTaskData.findIndex(item => item.term === termKey && item.key === snapshot.key);
            if (index !== -1) {
                masterTaskData[index] = { ...masterTaskData[index], ...updatedItem };
                applyFilters(); // Re-apply filters to update the display
            }
        });
    }

    // Function to populate filter options
    function populateFilters(data) {
        // Collect unique values for each filter
        const days = new Set();
        const equipments = new Set();
        const facilities = new Set();

        data.forEach((item) => {
            if (item.Day) days.add(item.Day);
            if (item.Equipment) equipments.add(item.Equipment);
            if (item.Facility) facilities.add(item.Facility);
        });

        // Populate datalists
        populateDatalist('dayOptions', days);
        populateDatalist('equipmentOptions', equipments);
        populateDatalist('facilityOptions', facilities);

        // Prioritize userFacility assignment
        if (userFacility && userFacility.toLowerCase() !== 'all') {
            // Set Facility input to userFacility and disable it to prevent changes
            facilityInput.value = userFacility;
            facilityInput.disabled = true;
        } else if (userRole === 'Admin' && (userFacility.toLowerCase() === 'all' || !userFacility)) {
            // Allow 'All' option for Admin if userFacility is 'All' or not set
            const facilityDatalist = document.getElementById('facilityOptions');
            const allOption = document.createElement('option');
            allOption.value = 'All';
            facilityDatalist.appendChild(allOption);

            // Set 'All' as the default selected value
            facilityInput.value = 'All';
            facilityInput.disabled = false; // Ensure it's enabled for Admin to change
        }
    }

    // Helper function to populate datalists
    function populateDatalist(datalistId, items) {
        const datalist = document.getElementById(datalistId);
        datalist.innerHTML = '';
        items.forEach((item) => {
            const option = document.createElement('option');
            option.value = item;
            datalist.appendChild(option);
        });
    }

    // Function to apply filters and update task/equipment options based on selected Facility and Day
    function applyFilters() {
        const term = termInput.value.trim();
        const day = dayInput.value.trim();
        const task = taskInput.value.trim();
        const equipment = equipmentInput.value.trim();
        let facility = facilityInput.value.trim();

        // Debugging logs
        console.log('Before role check - Facility:', facility);

        // If user role is not Admin or similar, ensure facility is set correctly
        if (userRole !== 'Admin' && userRole !== 'Manager' && userRole !== 'HR' && userRole !== 'Production' && userRole !== 'Warehouse' && userRole !== 'Quality' && userRole !== 'Reports') {
            facility = userFacility;
        }

        console.log('After role check - Facility:', facility);

        // If facility is 'All', include all relevant facilities
        if (facility.toLowerCase() === 'all') {
            facility = ['Tubeway', 'Westvala', 'Pershing'];
        } else {
            facility = [facility];
        }

        console.log('Final facility array:', facility);

        // Split the task input by commas and trim each task
        const taskArray = task.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '');

        // Filter the masterTaskData based on selected inputs
        filteredData = masterTaskData.filter((item) => {
            const termMatch = term === '' || (item.term && item.term.toString().trim() === term);
            const dayMatch = day === '' || (item.Day && item.Day.toLowerCase() === day.toLowerCase());
            const equipmentMatch = equipment === '' || (item.Equipment && item.Equipment.toLowerCase().includes(equipment.toLowerCase()));
            
            // Ensure case-insensitive and trimmed matching for Facility
            const itemFacility = item.Facility ? item.Facility.trim().toLowerCase() : '';
            const facilityMatch = facility.length === 0 || facility.some(fac => fac.trim().toLowerCase() === itemFacility);

            // Check if item's Task matches any of the tasks in taskArray
            const itemTask = item.Task ? item.Task.toLowerCase() : '';
            const taskMatch = taskArray.length === 0 || taskArray.some(taskTerm => itemTask.includes(taskTerm));

            return termMatch && dayMatch && taskMatch && equipmentMatch && facilityMatch;
        });

        // Debugging logs
        console.log('Filtered Data Count:', filteredData.length);

        // Update Task and Equipment options based on filtered data
        updateTaskAndEquipmentOptions(filteredData);

        // Display filtered data in the table
        displayData(filteredData);
    }

    // Function to update Task and Equipment options based on filtered data
    function updateTaskAndEquipmentOptions(filteredData) {
        const uniqueTasks = new Set();
        const uniqueEquipments = new Set();

        // Collect unique values for Task and Equipment based on filtered data
        filteredData.forEach((item) => {
            if (item.Task) uniqueTasks.add(item.Task);
            if (item.Equipment) uniqueEquipments.add(item.Equipment);
        });

        // Populate task options
        const taskDatalist = document.getElementById('taskOptions');
        taskDatalist.innerHTML = '';
        uniqueTasks.forEach(task => {
            const option = document.createElement('option');
            option.value = task;
            taskDatalist.appendChild(option);
        });

        // Populate equipment options
        const equipmentDatalist = document.getElementById('equipmentOptions');
        equipmentDatalist.innerHTML = '';
        uniqueEquipments.forEach(equipment => {
            const option = document.createElement('option');
            option.value = equipment;
            equipmentDatalist.appendChild(option);
        });
    }

    // Event listener to update table and options when Facility or Day changes
    dayInput.addEventListener('change', applyFilters);
    facilityInput.addEventListener('change', applyFilters);

    // Event listener for Task input to enable auto-complete and handle comma-separated values
    function setupTaskAutoComplete() {
        const taskDatalist = document.getElementById('taskOptions');
        taskDatalist.innerHTML = '';

        taskOptions.forEach(task => {
            const option = document.createElement('option');
            option.value = task;
            taskDatalist.appendChild(option);
        });

        taskInput.addEventListener('input', function (e) {
            const inputValue = taskInput.value;
            const lastCommaIndex = inputValue.lastIndexOf(',');
            let currentInput = inputValue;

            if (lastCommaIndex !== -1) {
                currentInput = inputValue.substring(lastCommaIndex + 1).trim();
            }

            // Create a temporary datalist with options matching the current input
            const tempDatalist = document.createElement('datalist');
            tempDatalist.id = 'tempTaskOptions';
            tempDatalist.innerHTML = '';

            taskOptions.forEach(task => {
                if (task.toLowerCase().includes(currentInput.toLowerCase())) {
                    const option = document.createElement('option');
                    option.value = task;
                    tempDatalist.appendChild(option);
                }
            });

            // Remove old temporary datalist if it exists
            const oldTempDatalist = document.getElementById('tempTaskOptions');
            if (oldTempDatalist) {
                oldTempDatalist.parentNode.removeChild(oldTempDatalist);
            }

            document.body.appendChild(tempDatalist);
            taskInput.setAttribute('list', 'tempTaskOptions');
        });
    }

    // Function to format decimal numbers to 2 decimal places
    function formatNumber(num) {
        return num ? parseFloat(num).toFixed(2) : '';
    }

    // Function to abbreviate text longer than a certain length
    function abbreviateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // Function to display data in the table
    function displayData(data) {
        // Clear existing rows before displaying new data to prevent duplicates
        dataTableBody.innerHTML = '';

        // Apply sorting to the data before displaying
        if (currentSortField) {
            data.sort((a, b) => {
                let valueA = a[currentSortField];
                let valueB = b[currentSortField];

                // Handle null or undefined values
                const valueAEmpty = valueA === undefined || valueA === null || valueA === '';
                const valueBEmpty = valueB === undefined || valueB === null || valueB === '';

                if (currentSortField === 'Priority') {
                    if (valueAEmpty && !valueBEmpty) return 1;
                    if (!valueAEmpty && valueBEmpty) return -1;
                    if (valueAEmpty && valueBEmpty) return 0;
                }

                // Convert values to appropriate types for comparison
                if (currentSortField === 'Project Hours' || currentSortField === 'Priority') {
                    valueA = parseFloat(valueA) || 0;
                    valueB = parseFloat(valueB) || 0;
                } else {
                    valueA = valueA.toString().toLowerCase();
                    valueB = valueB.toString().toLowerCase();
                }

                if (valueA < valueB) return currentSortDirection === 'asc' ? -1 : 1;
                if (valueA > valueB) return currentSortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // Display each item as a row in the table
        data.forEach((item) => {
            // Check if the row already exists
            let row = document.querySelector(`[data-unique-id="${item.uniqueId}"]`);

            if (!row) {
                // Create a new row if it doesn't exist
                row = document.createElement('tr');
                row.dataset.uniqueId = item.uniqueId;

                // Create cells for each item attribute
                const cells = [
                    { content: item.Cycle || '', editable: false },
                    { content: abbreviateText(item.Meal || '', 15), editable: false, title: item.Meal },
                    { content: item.Product || '', editable: false },
                    { content: item.Count || '', editable: false },
                    { content: item.Priority || '', editable: true, field: 'Priority' },
                    { content: createDayDropdown(item.Day), editable: true, field: 'Day' }, // Use dropdown for Day
                    { content: item.Lead || '', editable: true, field: 'Lead' },
                    { content: createEquipmentDropdown(item), editable: true, field: 'Equipment' }, // Use dropdown for Equipment
                    { content: formatNumber(item['Project Hours']), editable: true, field: 'Project Hours' },
                    { content: item.Start_Time || '', editable: true, field: 'Start_Time' },
                    { content: item.Break_Time || '', editable: true, field: 'Break_Time' },
                    { content: item.End_Time || '', editable: true, field: 'End_Time' },
                    { content: item.Teams || '', editable: true, field: 'Teams' },
                ];

                // Append cells to the row
                cells.forEach((cellData) => {
                    const cell = document.createElement('td');
                    if (cellData.title) cell.setAttribute('title', cellData.title);

                    if (typeof cellData.content === 'object') {
                        // If content is a DOM element (e.g., select element for Day or Equipment dropdown), append it directly
                        cell.appendChild(cellData.content);
                    } else {
                        // Otherwise, set text content as usual
                        cell.textContent = cellData.content;
                    }

                    // Add class to Equipment cell for easy selection
                    if (cellData.field === 'Equipment') {
                        cell.classList.add('equipment-cell');
                    }

                    if (cellData.editable && typeof cellData.content !== 'object') {
                        cell.setAttribute('contenteditable', 'true');
                        // Event listener for when a cell loses focus (blur event)
                        cell.addEventListener('blur', function () {
                            let newValue = this.textContent.trim(); // Use 'this' instead of 'cell' to refer to the current cell element
                            const fieldName = cellData.field;

                            // Ensure numeric validation for the Break_Time field, but allow it to be empty
                            if (fieldName === 'Break_Time') {
                                if (newValue !== '' && isNaN(newValue)) {
                                    showCustomAlert('Break Time must be a numeric value.');
                                    this.textContent = item[fieldName] || ''; // Revert to the old value if validation fails
                                    return;
                                }
                                // Allow the field to be empty by proceeding without alert
                                this.textContent = newValue;
                            }

                            // Validate and format time fields like Start_Time and End_Time, but allow them to be empty
                            if (fieldName === 'Start_Time' || fieldName === 'End_Time') {
                                if (newValue === '') {
                                    // If the field is empty, allow it and skip formatting
                                    this.textContent = newValue;
                                } else {
                                    const parsedTime = parseTime(newValue); // Parse the time input
                                    if (parsedTime) {
                                        newValue = formatTime(parsedTime); // Format and set the new time value
                                        this.textContent = newValue;
                                    } else {
                                        showCustomAlert('Invalid time format. Please enter a valid time (e.g., 10:00 AM).');
                                        this.textContent = item[fieldName] || ''; // Revert to the old value if validation fails
                                        return;
                                    }
                                }
                            }

                            // Update the item in the data array with the new value and save it to Firebase
                            item[fieldName] = newValue;
                            updateFieldInFirebase(this, fieldName);

                            // If the field is 'Priority', re-sort and refresh the table
                            if (fieldName === 'Priority') {
                                displayData(filteredData);
                            }

                            // If the field is 'Start_Time', calculate the corresponding 'End_Time'
                            if (fieldName === 'Start_Time') {
                                calculateAndSetEndTime(this.closest('tr'), item);

                                // After calculating End_Time, propagate it to subsequent rows
                                const rowIndex = filteredData.findIndex(entry => entry.uniqueId === item.uniqueId);
                                propagateTimesFromRow(rowIndex);
                            }

                            // If the field is 'Task', update the Equipment dropdown
                            if (fieldName === 'Task') {
                                // Update the Equipment dropdown in this row
                                const equipmentCell = this.parentElement.querySelector('.equipment-cell');
                                if (equipmentCell) {
                                    // Replace the Equipment cell with a new dropdown based on the new Task
                                    const newEquipmentDropdown = createEquipmentDropdown(item);
                                    equipmentCell.innerHTML = '';
                                    equipmentCell.appendChild(newEquipmentDropdown);
                                }
                            }
                        });
                    }

                    row.appendChild(cell);
                });

                // Append row to the table
                dataTableBody.appendChild(row);

                // Initial calculation of End_Time if Start_Time is present
                if (item.Start_Time) {
                    calculateAndSetEndTime(row, item);
                }
            }
        });
    }

    // Function to create a dropdown menu for Day column
    function createDayDropdown(selectedDay) {
        const selectElement = document.createElement('select');
        selectElement.className = 'day-dropdown'; // Optional: Add class for styling

        daysOfWeek.forEach(day => {
            const option = document.createElement('option');
            option.value = day;
            option.textContent = day;
            if (day === selectedDay) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });

        // Add event listener to update value in Firebase when selection changes
        selectElement.addEventListener('change', function () {
            const row = selectElement.closest('tr');
            const uniqueId = row.dataset.uniqueId;
            const entryToUpdate = filteredData.find(entry => entry.uniqueId === uniqueId);

            if (entryToUpdate) {
                const { term, key } = entryToUpdate;
                entryToUpdate.Day = selectElement.value;

                const updates = {};
                updates[`Master_Task/${term}/${key}/Day`] = selectElement.value;

                database.ref().update(updates)
                    .then(() => {
                        console.log('Day updated in Firebase');
                    })
                    .catch(err => console.error('Error updating Day in Firebase:', err));
            }
        });

        return selectElement;
    }

    // Function to create a dropdown menu for Equipment based on Task
    function createEquipmentDropdown(item) {
        const selectElement = document.createElement('select');
        selectElement.className = 'equipment-dropdown'; // Optional: Add class for styling

        const task = item.Task;
        let equipmentOptions = [];

        // Define tasksData or fetch it from an external source if necessary
        const tasksData = {
            "tasks": [
              {
                "Task": "Dry Sachet Depositing",
                "Equipment": ["Dry Bucket 1", "Dry Bucket 2", "Dry Bucket 3"]
              },
              {
                "Task": "Band Sealing",
                "Equipment": ["Bandsealer 1", "Bandsealer 2", "Bandsealer 3", "Bandsealer 4", "Bandsealer 5"]
              },
              {
                "Task": "Liquid Sachet Depositing",
                "Equipment": ["Dangan"]
              },
              {
                "Task": "Tray Portioning and Sealing",
                "Equipment": [
                  "GTRe 1 Tray Sealing Line",
                  "GTRe 2 Tray Sealing Line",
                  "GTRe 1 3rd Tray Sealing Line",
                  "GTRe 2 3rd Tray Sealing Line",
                  "SealMax Tray Sealing Line",
                  "GT4"
                ]
              },
              {
                "Task": "Cup Portioning",
                "Equipment": [
                  "Manual Portioning Station 1",
                  "Manual Portioning Station 2",
                  "Manual Portioning Station 3",
                  "Manual Portioning Station 1 3rd",
                  "Manual Portioning Station 2 3rd",
                  "Manual Portioning Station 3 3rd"
                ]
              },
              {
                "Task": "Batch Mix",
                "Equipment": [
                  "Large Tumbler 1",
                  "Large Tumbler 2",
                  "Small Tumbler 1",
                  "Bowl Mixing Station 1",
                  "Bowl Mixing Station 2"
                ]
              },
              {
                "Task": "Kettle",
                "Equipment": [
                  "Kettle-80 1",
                  "Kettle-80 2",
                  "Kettle-80 3",
                  "Kettle-60",
                  "Tilt Skillet 1",
                  "Tilt Skillet 2",
                  "Candy Burner 1",
                  "Candy Burner 2",
                  "Kettle-1",
                  "Kettle-2",
                  "Kettle-3",
                  "Kettle 4-60",
                  "Skillet 1",
                  "Skillet 2"
                ]
              },
              {
                "Task": "Open Pneumatic",
                "Equipment": ["Can Opener 1", "Manual Can Opener 1"]
              },
              {
                "Task": "Oven",
                "Equipment": ["Unox Combi Oven 1", "Unox Combi Oven 2", "Unox Combi Oven 3"]
              },
              {
                "Task": "Sauce Mix",
                "Equipment": ["Stick Blender STANDARD 1", "Stick Blender STANDARD 2", "Stick Blender STANDARD 3", "Stick Blender STANDARD 4"]
              },
              {
                "Task": "Thaw",
                "Equipment": ["Thaw 1", "Thaw 2"]
              },
              {
                "Task": "VCM",
                "Equipment": ["Vertical Cutting Machine 1"]
              },
              {
                "Task": "Packout",
                "Equipment": ["Line 1", "Line 2"]
              },
              {
                "Task": "Sleeving",
                "Equipment": [
                  "Prep Station 1",
                  "Prep Station 2",
                  "Prep Station 3",
                  "Prep Station 4",
                  "Prep Station 5",
                  "Prep Station 6",
                  "Prep Station 7",
                  "Prep Station 8",
                  "Prep Station 9",
                  "Sleeving Station 1",
                  "Sleeving Station 2",
                  "Sleeving Station 3",
                  "Sleeving Station 1 3rd",
                  "Sleeving Station 2 3rd",
                  "Sleeving Station 3 3rd"
                ]
              }
            ]
        };

        // Find the equipment options for the given task
        const taskEntry = tasksData.tasks.find(t => t.Task === task);
        if (taskEntry) {
            equipmentOptions = taskEntry.Equipment;
        }

        // Populate the select element with options
        equipmentOptions.forEach(equipment => {
            const option = document.createElement('option');
            option.value = equipment;
            option.textContent = equipment;
            if (equipment === item.Equipment) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });

        // If there are no equipment options, allow manual entry
        if (equipmentOptions.length === 0) {
            const option = document.createElement('option');
            option.value = item.Equipment || '';
            option.textContent = item.Equipment || '';
            option.selected = true;
            selectElement.appendChild(option);
        }

        // Add event listener to update value in Firebase when selection changes
        selectElement.addEventListener('change', function () {
            const row = selectElement.closest('tr');
            const uniqueId = row.dataset.uniqueId;
            const entryToUpdate = filteredData.find(entry => entry.uniqueId === uniqueId);

            if (entryToUpdate) {
                const { term, key } = entryToUpdate;
                entryToUpdate.Equipment = selectElement.value;

                const updates = {};
                updates[`Master_Task/${term}/${key}/Equipment`] = selectElement.value;

                database.ref().update(updates)
                    .then(() => {
                        console.log('Equipment updated in Firebase');
                    })
                    .catch(err => console.error('Error updating Equipment in Firebase:', err));
            }
        });

        return selectElement;
    }

    // Function to propagate Start and End times based on Equipment, Facility, and Day
    function propagateTimesFromRow(startRowIndex) {
        // Retrieve relevant input values
        const selectedFacility = facilityInput.value.trim();
        const selectedDay = dayInput.value.trim();

        // If Facility or Day is not selected, exit the function
        if (!selectedFacility || !selectedDay) return;

        // If facility is 'All', we need to handle multiple facilities
        let facilitiesToConsider = [selectedFacility];
        if (selectedFacility.toLowerCase() === 'all') {
            facilitiesToConsider = ['Tubeway', 'Westvala', 'Pershing'];
        }

        // Get the row data for the starting row
        const startRow = filteredData[startRowIndex];
        let currentEndTime = startRow.End_Time ? parseTime(startRow.End_Time) : null;

        // Iterate through all subsequent rows with the same Equipment, Facility, and Day
        for (let i = startRowIndex + 1; i < filteredData.length; i++) {
            const row = filteredData[i];

            // Check if the row matches the criteria
            if (facilitiesToConsider.includes(row.Facility) && row.Day === selectedDay && row.Equipment === startRow.Equipment) {
                if (currentEndTime) {
                    // Calculate the new Start time as the previous row's End time
                    row.Start_Time = formatTime(currentEndTime);

                    // Calculate the new End time based on Start Time and Project Hours
                    const projectHours = parseFloat(row['Project Hours']) || 0;
                    const breakTime = parseInt(row.Break_Time, 10) || 0;

                    // Calculate total minutes to add
                    const totalMinutesToAdd = Math.round(projectHours * 60) + breakTime;

                    // Calculate new End time
                    currentEndTime = new Date(currentEndTime.getTime() + totalMinutesToAdd * 60000);
                    row.End_Time = formatTime(currentEndTime);

                    // Update row in table and Firebase
                    updateRowInTableAndFirebase(i, row);
                }
            } else {
                // Break the loop if the Equipment changes or if Day/Facility are different
                break;
            }
        }

        // Re-display data to reflect the changes
        displayData(filteredData);
    }

    // Function to update a specific row in the table and Firebase
    function updateRowInTableAndFirebase(rowIndex, updatedRow) {
        const row = document.querySelector(`[data-unique-id="${updatedRow.uniqueId}"]`);

        // Update the Start and End time cells in the table
        if (row) {
            row.children[9].textContent = updatedRow.Start_Time; // Assuming Start_Time is the 10th cell
            row.children[11].textContent = updatedRow.End_Time; // Assuming End_Time is the 12th cell
        }

        // Update Firebase
        const { term, key } = updatedRow;
        const updates = {
            [`Master_Task/${term}/${key}/Start_Time`]: updatedRow.Start_Time,
            [`Master_Task/${term}/${key}/End_Time`]: updatedRow.End_Time
        };

        database.ref().update(updates)
            .then(() => {
                console.log(`Start and End times updated in Firebase for row index ${rowIndex}`);
            })
            .catch(err => console.error(`Error updating Start and End times in Firebase:`, err));
    }

    // Custom alert function
    function showCustomAlert(message) {
        customAlertMessage.textContent = message;
        customAlert.style.display = 'block';

        // Automatically hide the alert after 2 seconds
        setTimeout(() => {
            customAlert.style.display = 'none';
        }, 2000);
    }

    // Function to calculate and set End_Time based on Start_Time, Project Hours, and Break_Time
    function calculateAndSetEndTime(row, item) {
        const startTimeStr = item.Start_Time;
        const projectHoursStr = item['Project Hours'];
        const breakTimeStr = item.Break_Time || '0';

        if (!startTimeStr || !projectHoursStr) return;

        // Parse Start_Time
        const startTime = parseTime(startTimeStr);
        if (startTime === null) return;

        // Parse Project Hours
        const projectHours = parseFloat(projectHoursStr);
        if (isNaN(projectHours)) return;

        // Parse Break Time
        const breakTimeMinutes = parseInt(breakTimeStr, 10) || 0;

        // Calculate total minutes to add
        const totalMinutesToAdd = Math.round(projectHours * 60) + breakTimeMinutes;

        // Calculate End Time
        const endTime = new Date(startTime.getTime() + totalMinutesToAdd * 60000);

        // Format End Time
        const endTimeStr = formatTime(endTime);

        // Update End_Time in the table and data
        const endTimeCell = row.children[11]; // Assuming End_Time is the 12th cell
        endTimeCell.textContent = endTimeStr;
        item.End_Time = endTimeStr;

        // Update Firebase
        updateFieldInFirebase(endTimeCell, 'End_Time');
    }

    // Helper function to parse time string into Date object and normalize it
    function parseTime(timeStr) {
        if (!timeStr) return null;

        // Remove leading/trailing whitespace and convert to uppercase
        timeStr = timeStr.trim().toUpperCase();

        // Add a space before AM/PM if missing
        timeStr = timeStr.replace(/(AM|PM)$/, ' $1');

        // Regular expression to match time formats
        const timeParts = timeStr.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/i);

        if (!timeParts) return null;

        let hours = parseInt(timeParts[1], 10);
        let minutes = parseInt(timeParts[2], 10) || 0;
        let ampm = timeParts[3] ? timeParts[3].toUpperCase() : null;

        if (hours > 12) {
            // If hours are greater than 12, it's in 24-hour format
            ampm = null;
        }

        if (ampm === 'PM' && hours < 12) {
            hours += 12;
        } else if (ampm === 'AM' && hours === 12) {
            hours = 0;
        }

        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    // Helper function to format Date object into time string (e.g., '11:00 AM')
    function formatTime(date) {
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12; // '0' should be '12'
        const minutesStr = minutes < 10 ? '0' + minutes : minutes;

        return `${hours}:${minutesStr} ${ampm}`;
    }

    // Function to update a specific field in Firebase
    function updateFieldInFirebase(cellElement, field) {
        const row = cellElement.closest('tr');
        const uniqueId = row.dataset.uniqueId;
        const entryToUpdate = filteredData.find(entry => entry.uniqueId === uniqueId);

        if (entryToUpdate) {
            const { term, key } = entryToUpdate;
            const newValue = cellElement.textContent.trim();

            // Update only locally; do not trigger a data reload
            entryToUpdate[field] = newValue;

            const updates = {};
            updates[`Master_Task/${term}/${key}/${field}`] = newValue;

            database.ref().update(updates)
                .then(() => {
                    // Show success notification
                    showSuccessNotification();
                })
                .catch(err => console.error(`Error updating ${field} in Firebase:`, err));
        } else {
            console.error('Entry not found for updating.');
        }
    }

    // Function to show the success notification
    function showSuccessNotification() {
        successNotification.style.display = 'block';

        // Hide the notification after 2 seconds
        setTimeout(() => {
            successNotification.style.display = 'none';
        }, 2000);
    }

    // Event listeners for sorting
    const tableHeaders = document.querySelectorAll('#dataTable th');
    tableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const field = header.getAttribute('data-field');
            if (currentSortField === field) {
                // Toggle sort direction
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = field;
                currentSortDirection = 'asc';
            }

            // Remove sort classes from all headers
            tableHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
            // Add sort class to the current header
            header.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');

            // Re-display data with new sorting
            displayData(filteredData);
        });
    });

    // Event listeners for buttons
    searchButton.addEventListener('click', applyFilters);

    clearButton.addEventListener('click', () => {
        dayInput.value = '';
        taskInput.value = '';
        equipmentInput.value = '';
        if (userRole === 'Admin') {
            facilityInput.value = 'All';
        } else {
            facilityInput.value = userFacility;
        }
        currentSortField = 'Priority'; // Reset sorting to Priority
        currentSortDirection = 'asc';
        // Remove sort classes from all headers
        tableHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        applyFilters();
    });

    // Define the filterTimeout variable at the top of your script
    let filterTimeout = null;

    // Event listener for termInput change
    termInput.addEventListener('change', () => {
        // Clear the previous timeout if it exists
        if (filterTimeout) {
            clearTimeout(filterTimeout);
        }

        // Set a new timeout to debounce the filter application
        filterTimeout = setTimeout(() => {
            applyFilters(); // Apply filters after a 300ms delay (or any suitable delay)
        }, 300);
    });

    // Create a Copy button and add it to your toolbar or desired location
    // Already added in HTML as <button id="copyButton">Copy Selected Rows with Styles</button>

    // Function to copy selected table rows along with headers, styles, and format
    copyButton.addEventListener('click', () => {
        const selectedDay = dayInput.value.trim();
        if (!selectedDay) {
            alert('Please select a day to copy rows.');
            return;
        }

        // Create a temporary container to store the selected table content
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px'; // Hide the container offscreen

        // Create a table element to hold the selected rows and headers
        const tempTable = document.createElement('table');
        tempTable.style.borderCollapse = 'collapse'; // Maintain original table style
        tempTable.style.width = '100%';

        // Get all the table headers and append to a new header row
        const tableHeaders = document.querySelectorAll('#dataTable th');
        const headerRow = document.createElement('tr');
        headerRow.style.backgroundColor = 'Aqua'; // Set header background color
        headerRow.style.color = 'black'; // Set header text color
        headerRow.style.fontWeight = 'bold'; // Bold header text

        tableHeaders.forEach(header => {
            const headerCell = document.createElement('th');
            headerCell.textContent = header.textContent;
            headerCell.style.border = '1px solid #000'; // Add border for clarity
            headerCell.style.padding = '5px'; // Add padding for aesthetics
            headerCell.style.textAlign = 'center';
            headerRow.appendChild(headerCell);
        });
        tempTable.appendChild(headerRow); // Append the header row to the temp table

        // Filter rows based on the selected day using Firebase data (filteredData)
        let index = 0; // Track row index for alternating background colors
        filteredData.forEach(item => {
            if (item.Day && item.Day.trim().toLowerCase() === selectedDay.toLowerCase()) {
                const row = document.createElement('tr');
                row.dataset.uniqueId = item.uniqueId; // Preserve unique identifier

                // Create cells for each item attribute based on the same structure as displayData
                const cells = [
                    { content: item.Cycle || '', editable: false },
                    { content: abbreviateText(item.Meal || '', 15), editable: false, title: item.Meal },
                    { content: item.Product || '', editable: false },
                    { content: item.Count || '', editable: false },
                    { content: item.Priority || '', editable: true, field: 'Priority' },
                    { content: item.Day || '', editable: true, field: 'Day' }, // Show day value directly in text
                    { content: item.Lead || '', editable: true, field: 'Lead' },
                    { content: item.Equipment || '', editable: true, field: 'Equipment' },
                    { content: formatNumber(item['Project Hours']), editable: true, field: 'Project Hours' },
                    { content: item.Start_Time || '', editable: true, field: 'Start_Time' },
                    { content: item.Break_Time || '', editable: true, field: 'Break_Time' },
                    { content: item.End_Time || '', editable: true, field: 'End_Time' },
                    { content: item.Teams || '', editable: true, field: 'Teams' },
                ];

                // Append cells to the row
                cells.forEach((cellData) => {
                    const cell = document.createElement('td');
                    if (cellData.title) cell.setAttribute('title', cellData.title);

                    // Set the content of the cell based on whether it's a DOM element or text
                    if (typeof cellData.content === 'object') {
                        cell.appendChild(cellData.content);
                    } else {
                        cell.textContent = cellData.content;
                    }

                    // Apply styles and attributes for editable cells
                    if (cellData.editable && typeof cellData.content !== 'object') {
                        cell.setAttribute('contenteditable', 'true');
                        cell.style.backgroundColor = '#f8f9fa'; // Light background color for editable cells
                        cell.style.cursor = 'pointer';
                    }

                    // Style and append the cell to the row
                    cell.style.border = '1px solid #000'; // Maintain border style
                    cell.style.padding = '5px'; // Maintain padding
                    row.appendChild(cell);
                });

                // Alternate row background colors: light gray and white
                row.style.backgroundColor = index % 2 === 0 ? 'lightgray' : 'white';
                index++;

                // Append the filtered row to the temporary table
                tempTable.appendChild(row);
            }
        });

        // Check if any rows were copied
        if (tempTable.rows.length === 1) { // Only the header row exists
            alert('No rows match the selected day.');
            return;
        }

        // Append the temporary table to the temporary container
        tempContainer.appendChild(tempTable);

        // Append the temporary container to the body
        document.body.appendChild(tempContainer);

        // Copy the temporary container's HTML content to the clipboard as HTML format
        const htmlToCopy = tempContainer.innerHTML;
        navigator.clipboard.write([
            new ClipboardItem({ 'text/html': new Blob([htmlToCopy], { type: 'text/html' }) })
        ]).then(() => {
            alert(`Copied selected rows for "${selectedDay}" with headers, styles, and formatting!`);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('Failed to copy the selected rows.');
        });

        // Remove the temporary container after copying
        document.body.removeChild(tempContainer);
    });

    /**
     * Function to display user info in the header
     */
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            if (document.getElementById('login-container')) {
                document.getElementById('login-container').style.display = 'none';
            }
            if (document.getElementById('planningView')) {
                document.getElementById('planningView').style.display = 'block';
            }
            if (document.getElementById('user-info')) { // Ensure 'user-info' exists
                populateUserInfo();
            }

            // Ensure user is recorded in DB
            await storeUserData(user);

            // Fetch role and facility from Realtime Database
            await fetchUserRole(user.email);
        } else {
            if (document.getElementById('planningView')) {
                document.getElementById('planningView').style.display = 'none';
            }
            if (document.getElementById('login-container')) {
                document.getElementById('login-container').style.display = 'block';
            }
            if (document.getElementById('user-info')) { // Ensure 'user-info' exists
                const userInfoDiv = document.getElementById('user-info');
                userInfoDiv.innerHTML = '';
                userInfoDiv.style.display = 'none';
            }
            if (document.getElementById('logout-button')) { // Ensure 'logout-button' exists
                document.getElementById('logout-button').style.display = 'none';
            }
            console.log('No user is signed in.');
        }
    });

    /**
     * Store user data in Firebase Realtime Database under /User/:uid
     */
    async function storeUserData(user) {
        try {
            const userRef = database.ref('User/' + user.uid);
            // We set placeholders for role/facility; they'll be updated in fetchUserRole
            await userRef.set({
                name: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                uid: user.uid,
                role: null,
                facility: null
            });
            console.log('User data stored successfully.');
        } catch (error) {
            console.error('Error storing user data:', error);
            showCustomAlert('Failed to store user data.');
        }
    }

    /**
     * Fetch user role and facility from your JSON (role.json).
     * Then update both fields in the Realtime Database and store
     * the facility in localStorage so other pages can read it.
     */
    async function fetchUserRole(email) {
        const roleUrl = 'https://raw.githubusercontent.com/itspaudal-git/ignore_list/main/role.json';
        try {
            const response = await fetch(roleUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const roles = await response.json();

            console.log('Fetched roles:', roles); // Debugging

            const userRoleEntry = roles.find(role => role.Email.toLowerCase() === email.toLowerCase());

            console.log('User Role Entry:', userRoleEntry); // Debugging

            if (userRoleEntry) {
                // Update user role and facility in Realtime Database
                const user = auth.currentUser;
                if (user) {
                    const userRef = database.ref('User/' + user.uid);
                    await userRef.update({
                        role: userRoleEntry.Role,
                        facility: userRoleEntry.Facility
                    });
                    console.log(`Updated user role to: ${userRoleEntry.Role}`);
                    console.log(`Updated user facility to: ${userRoleEntry.Facility}`);

                    // ****** IMPORTANT: Save role and facility in localStorage ******
                    localStorage.setItem('userRole', userRoleEntry.Role || 'Admin');
                    localStorage.setItem('userFacility', userRoleEntry.Facility || 'All');

                    // Update variables
                    userRole = userRoleEntry.Role || 'Admin';
                    userFacility = userRoleEntry.Facility || 'All';
                }

                // Reload filters and data based on updated role and facility
                populateFilters(masterTaskData);
                applyFilters();
            } else {
                showCustomAlert('Your role is not defined in the system.');
                await auth.signOut();
            }
        } catch (error) {
            console.error('Error fetching user role:', error);
            showCustomAlert('Failed to fetch user role.');
        }
    }

    /**
     * Display the user's name and photo in the header area.
     * (Consolidated with populateUserInfo to avoid duplication)
     */
    // Removed duplicate displayUserInfo as it's already handled in populateUserInfo()
});
