// aaa.js

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // Initialize Firebase app if not already initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized.');
    } else {
        firebase.app();
        console.log('Firebase already initialized.');
    }

    const database = firebase.database();
    const userFacility = localStorage.getItem('userFacility') || 'All';
    console.log('User Facility:', userFacility);

    let rawData = [];
    let filteredData = [];
    let facilityOptions = new Set();
    let taskOptions = new Set();
    let dayOptions = new Set();
    let currentSortField = 'term';
    let currentSortDirection = 'asc';
    const specialTasks = ['Batch Mix', 'Sauce Mix', 'Open', 'Drain', 'Kettle', 'Oven', 'Thaw', 'VCM', 'Planetary Mix', 'Skillet'];
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday2", "Monday2"];

    /**
     * Calculate the status of a task based on various parameters.
     */
    function calculateStatus(start, end, count, producedQty, task) {
        if (producedQty && count > producedQty) {
            if (specialTasks.includes(task)) {
                return "Complete";
            } else {
                return "Shorts";
            }
        } else if (start && end) {
            return "Complete";
        } else if (start) {
            return "In progress";
        } else {
            return "Released";
        }
    }

    /**
     * Listen for changes in the 'Master_Task' node and update the UI accordingly.
     */
    database.ref('Master_Task').on('value', snapshot => {
        rawData = snapshot.val();
        populateFilters();
        displayData();
        updateProjectStatus();
        updateTimers();  
        setupAutoComplete('searchFacility', 'facilitySuggestions', Array.from(facilityOptions));
        setupAutoComplete('searchProduct', 'productSuggestions', filteredData.map(entry => entry.Product));
        setupAutoComplete('searchTask', 'taskSuggestions', Array.from(taskOptions));
        setupAutoComplete('searchDay', 'daySuggestions', Array.from(dayOptions));
        setupAutoComplete('searchStatus', 'statusSuggestions', ["Complete", "In progress", "Shorts","Released"]);
    });

    /**
     * Populate filter options based on the raw data.
     */
    function populateFilters() {
        filteredData = [];
        facilityOptions.clear();
        taskOptions.clear();
        dayOptions.clear();
    
        for (let term in rawData) {
            const termData = rawData[term];
            if (typeof termData === 'object') {
                for (let key in termData) {
                    const entry = termData[key];
    
                    // Only include entry if userFacility is 'All' or matches the entry's Facility
                    if (userFacility === 'All' || entry.Facility === userFacility) {
                        const variance = calculateVariance(entry["Man Hours"], entry["Actual Manhours"]);
    
                        filteredData.push({
                            term: term,
                            key: key,
                            ...entry,
                            Variance: variance
                        });
    
                        // Collect sets for auto-complete, etc.
                        if (entry.Facility) {
                            facilityOptions.add(entry.Facility);
                        }
                        if (entry.Task) {
                            taskOptions.add(entry.Task);
                        }
                        if (entry.Day) {
                            dayOptions.add(entry.Day);
                        }
                    }
                }
            }
        }
    }
    

    /**
     * Display the filtered and sorted data in the table.
     */
    function displayTable(data) {
        const tbody = document.getElementById('dataTable').querySelector('tbody');
        if (!tbody) {
            console.error('Table body element with id "dataTable" not found.');
            return;
        }
        tbody.innerHTML = '';
        
        const sortedData = data.sort((a, b) => {
            const taskA = (a.Task || '').toLowerCase();
            const taskB = (b.Task || '').toLowerCase();
            const productA = (a.Product || '').toLowerCase();
            const productB = (b.Product || '').toLowerCase();
    
            if (taskA < taskB) return -1;
            if (taskA > taskB) return 1;
            if (productA < productB) return -1;
            if (productA > productB) return 1;
    
            return 0;
        });
    
        sortedData.forEach((entry, index) => {
            const uniqueId = `${entry.term}-${entry.Facility}-${entry.key}`;
            
            const count = parseFloat(entry["Count"] || 0);
            const producedQty = parseFloat(entry["Produced Qty"] || 0);
            const status = calculateStatus(entry.Start, entry.End, count, producedQty, entry.Task);
            const difference = count - producedQty; 
            
            const duration = calculateDuration(entry.Start, entry.End, entry.Break,entry.Setup,entry.Cleanup);
            const actualManhours = calculateActualManhours(entry.Headcount, duration);
            const variance = calculateVariance(actualManhours, entry["Man Hours"]);
            
            const highlightClass = status === "Shorts" ? 'highlight-red' : '';
    
            const row = document.createElement('tr');
            row.dataset.uniqueId = uniqueId;
    
            row.innerHTML = `
                <td>${entry.term}</td>
                <td>${entry.Facility || ''}</td>
                <td contenteditable="true" class="meal-select">${entry.Meal || ''}</td>
                <td contenteditable="true" class="cycle-select">${entry.Cycle || ''}</td>
                <td contenteditable="true" class="product-select">${entry.Product || ''}</td>
                <td contenteditable="true" class="count ${highlightClass}">${count || ''}</td>
                <td class="${highlightClass}">${entry.Task || ''}</td>
                <td contenteditable="false" class="equipment-select">${entry.Equipment || ''}</td>
                <td contenteditable="false" class="project-hours">${parseFloat(entry["Project Hours"] || 0).toFixed(2)}</td>
                <td contenteditable="false" class="man-hours">${parseFloat(entry["Man Hours"] || 0).toFixed(2)}</td>
                <td><input type="number" value="${entry.Setup || ''}" class="setup-time" min="0"></td>
                <td><input type="time" value="${entry.Start || ''}" class="start-time"></td>
                <td><input type="number" value="${entry.Break || ''}" class="break-time" min="0"></td>
                <td><input type="time" value="${entry.End || ''}" class="end-time"></td>
                <td><input type="number" value="${entry.Cleanup || ''}" class="cleanup-time" min="0"></td>
                <td contenteditable="true" class="produced">${producedQty || ''}</td>
                <td contenteditable="true" class="lead">${entry.Lead || ''}</td>
                <td contenteditable="true" class="headcount">${entry.Headcount || ''}</td>
                <td class="duration">${duration > 0 ? duration.toFixed(2) : ''}</td>
                <td>${status}</td>
                <td><button class="edit-btn" data-unique-id="${uniqueId}">Update</button></td>
                <td>
                    <select class="day-select">
                        ${daysOfWeek.map(day => `<option value="${day}" ${entry.Day === day ? 'selected' : ''}>${day}</option>`).join('')}
                    </select>
                </td>
                <td class="actual-manhours">${actualManhours > 0 ? actualManhours.toFixed(2) : ''}</td>
                <td class="variance ${variance >= 0 ? 'positive-variance' : 'negative-variance'}">${variance}%</td>
                <td contenteditable="true" class="teams">${entry.Teams || ''}</td>
                <td contenteditable="true" class="notes">${entry.Notes || ''}</td>
            `;
    
            tbody.appendChild(row);
        });
    
        addEventListeners(); 
    }

    /**
     * Calculate the duration between start and end times, accounting for breaks, setup, and cleanup.
     */
    function calculateDuration(startTime, endTime, breakTime, setupTime, cleanupTime) {
        if (!startTime || !endTime) return 0;

        // Split time and modifier (AM/PM)
        const [startTimePart, startModifier] = startTime.split(' ');
        const [endTimePart, endModifier] = endTime.split(' ');

        let [startHour, startMin] = startTimePart.split(':').map(Number);
        let [endHour, endMin] = endTimePart.split(':').map(Number);

        // Convert to 24-hour format
        if (startModifier === 'PM' && startHour !== 12) {
            startHour += 12;
        } else if (startModifier === 'AM' && startHour === 12) {
            startHour = 0; 
        }

        if (endModifier === 'PM' && endHour !== 12) {
            endHour += 12;
        } else if (endModifier === 'AM' && endHour === 12) {
            endHour = 0;
        }

        // Calculate total minutes
        const startTotalMinutes = startHour * 60 + startMin;
        const endTotalMinutes = endHour * 60 + endMin;

        let totalDurationMinutes = endTotalMinutes - startTotalMinutes;
        if (totalDurationMinutes < 0) {
            totalDurationMinutes += 24 * 60;
        }

        // Subtract/Add break, setup, and cleanup times
        totalDurationMinutes += (parseInt(breakTime, 10) || 0);
        totalDurationMinutes += (parseInt(setupTime, 10) || 0);
        totalDurationMinutes += (parseInt(cleanupTime, 10) || 0);

        return totalDurationMinutes / 60;
    }

    /**
     * Calculate actual manhours based on headcount and duration.
     */
    function calculateActualManhours(headcount, durationInHours) {
        if (!headcount || !durationInHours) return 0;
        return headcount * durationInHours;
    }

    /**
     * Calculate variance between actual manhours and planned manhours.
     */
    function calculateVariance(actualManhours, manHours) {
        if (!actualManhours || !manHours) return 0;
        const difference = manHours - actualManhours;
        return ((difference / manHours) * 100).toFixed(2);
    }

    /**
     * Add event listeners to interactive elements within the table.
     */
    function addEventListeners() {
        const editButtons = document.querySelectorAll('.edit-btn');
        const startInputs = document.querySelectorAll('.start-time');
        const endInputs = document.querySelectorAll('.end-time');
    
        // Event listener for double-clicking start time to set current time
        startInputs.forEach(input => {
            input.addEventListener('dblclick', function () {
                const currentTime = getCurrentTime();
                this.value = currentTime;
                updateFieldInFirebase(this, 'Start');
            });
        });
    
        // Event listener for double-clicking end time to set current time
        endInputs.forEach(input => {
            input.addEventListener('dblclick', function () {
                const row = this.closest('tr');
                
                const breakInput = row.querySelector('.break-time').value.trim();
                const setupInput = row.querySelector('.setup-time').value.trim();
                const cleanupInput = row.querySelector('.cleanup-time').value.trim();
                const leadInput = row.querySelector('.lead').textContent.trim();
                const headcountInput = row.querySelector('.headcount').textContent.trim();
    
                if (breakInput && leadInput && headcountInput) {
                    const currentTime = getCurrentTime();
                    this.value = currentTime;
                    updateFieldInFirebase(this, 'End');
                    
                    const updateButton = row.querySelector('.edit-btn');
                    if (updateButton) {
                        updateButton.click();
                    }
                } else {
                    alert('Please fill in Lead, Break, and Headcount fields before setting the End time.');
                }
            });
        });

        // Event listener for Update buttons
        editButtons.forEach(button => {
            button.addEventListener('click', async function() { // Make the function async
                const uniqueId = this.dataset.uniqueId;
                const row = this.closest('tr');
        
                const startInput = row.querySelector('.start-time').value;
                const countInput = row.querySelector('.count').textContent.trim();
                const countProducedqty = row.querySelector('.produced').textContent.trim();
                const endInput = row.querySelector('.end-time').value;
                const breakInput = row.querySelector('.break-time').value;
                const cleanupInput = row.querySelector('.cleanup-time').value;
                const setupInput = row.querySelector('.setup-time').value;
                const leadInput = row.querySelector('.lead').textContent;
                const headcountInput = row.querySelector('.headcount').textContent;
                const notesInput = row.querySelector('.notes').textContent;
                const teamsInput = row.querySelector('.teams').textContent;
                const projectHoursInput = row.querySelector('.project-hours').textContent.trim();
                const manHoursInput = row.querySelector('.man-hours').textContent.trim();
                const equipmentInput = row.querySelector('.equipment-select').textContent;
                const mealInput = row.querySelector('.meal-select').textContent;
                const cycleInput = row.querySelector('.cycle-select').textContent;
                const productInput = row.querySelector('.product-select').textContent;
                const dayInput = row.querySelector('.day-select').value;
        
                const durationCell = row.querySelector('.duration');
                const duration = calculateDuration(startInput, endInput, breakInput);
                durationCell.textContent = duration > 0 ? duration.toFixed(2) : '';
        
                const actualManhoursCell = row.querySelector('.actual-manhours');
                const actualManhours = calculateActualManhours(headcountInput, duration);
                actualManhoursCell.textContent = actualManhours > 0 ? actualManhours.toFixed(2) : '';
        
                const varianceCell = row.querySelector('.variance');
                const manHours = parseFloat(row.querySelector('td:nth-child(9)').textContent);
                const variance = calculateVariance(actualManhours, manHours);
                varianceCell.textContent = variance ? variance : '';
                varianceCell.classList.toggle('positive-variance', variance >= 0);
                varianceCell.classList.toggle('negative-variance', variance < 0);
        
                const entryToUpdate = filteredData.find(entry => `${entry.term}-${entry.Facility}-${entry.key}` === uniqueId);
        
                if (entryToUpdate) {
                    const { term, key } = entryToUpdate;
        
                    entryToUpdate.Lead = leadInput;
                    entryToUpdate.Duration = duration;
                    entryToUpdate.Headcount = headcountInput;
                    entryToUpdate.Start = startInput;
                    entryToUpdate.Break = breakInput;
                    entryToUpdate.Setup = setupInput;
                    entryToUpdate.Cleanup = cleanupInput;
                    entryToUpdate.End = endInput;
                    entryToUpdate.ActualManhours = actualManhours;
                    entryToUpdate.Variance = variance;
                    entryToUpdate.Notes = notesInput;
                    entryToUpdate.Teams = teamsInput;
                    entryToUpdate["Count"] = countInput;
                    entryToUpdate["Produced Qty"] = countProducedqty;
                    entryToUpdate["Project Hours"] = projectHoursInput;
                    entryToUpdate["Man Hours"] = manHoursInput;
                    entryToUpdate["Equipment"] = equipmentInput;
                    entryToUpdate["Meal"] = mealInput;
                    entryToUpdate["Cycle"] = cycleInput;
                    entryToUpdate["Product"] = productInput;
                    entryToUpdate["Day"] = dayInput;
        
                    try {
                        // Update the main entry in Firebase
                        await database.ref(`Master_Task/${term}/${key}`).update(entryToUpdate);
                        console.log('Data updated successfully.');
    
                        // Display success message
                        const successMessage = document.getElementById('success-message');
                        if (successMessage) {
                            successMessage.classList.add('show');
                            setTimeout(() => {
                                successMessage.classList.remove('show');
                            }, 3000);
                        }
        
                        // Fetch current user information
                        const currentUser = firebase.auth().currentUser;
                        if (currentUser) {
                            const userName = currentUser.displayName || 'Unknown User';
                            const userEmail = currentUser.email || 'No Email';
                            // Get the current date and time
                            const now = new Date();
                            const formattedDate = now.toLocaleDateString('en-US'); // "MM/DD/YYYY"
                            const formattedTime = now.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                            }); // "HH:MM AM/PM"
                            // Create or update the "Responsible" node
                            const responsibleData = {
                                name: userName,
                                email: userEmail,
                                Date: formattedDate, 
                                TimeStamp: formattedTime 
                            };
        
                            await database.ref(`Master_Task/${term}/${key}/Responsible`).set(responsibleData);
                            console.log('Responsible node updated successfully.');
                        } else {
                            console.warn('No authenticated user found. "Responsible" node not updated.');
                        }
        
                    } catch (err) {
                        console.error('Error updating data:', err);
                        alert('Failed to update data. Please try again.');
                    }
                } else {
                    console.error('Entry not found for updating.');
                }
            });
        });
    } // Closing brace for addEventListeners function

    /**
     * Create the custom context menu for each row.
     */
    function createContextMenu(targetRow) {
        const contextMenu = document.createElement('div');
        contextMenu.className = 'custom-context-menu';

        const copyOption = document.createElement('div');
        copyOption.textContent = 'Copy';
        copyOption.addEventListener('click', function() {
            duplicateRow(targetRow);
            document.body.removeChild(contextMenu);
        });
        contextMenu.appendChild(copyOption);

        const editOption = document.createElement('div');
        editOption.textContent = 'Edit';
        editOption.addEventListener('click', function() {
            enableEditing(targetRow);
            document.body.removeChild(contextMenu);
        });
        contextMenu.appendChild(editOption);

        const deleteOption = document.createElement('div');
        deleteOption.textContent = 'Delete';
        deleteOption.addEventListener('click', function() {
            deleteRow(targetRow);
            document.body.removeChild(contextMenu);
        });
        contextMenu.appendChild(deleteOption);
        
        // Status Update option
        const statusUpdateOption = document.createElement('div');
        statusUpdateOption.textContent = 'Status Update';
        statusUpdateOption.addEventListener('click', function() {
            document.body.removeChild(contextMenu);
            addStatusUpdate(targetRow); 
        });
        contextMenu.appendChild(statusUpdateOption);

        return contextMenu;
    }

    /**
     * Add a status update with Log_time and Log_Qty.
     */
    async function addStatusUpdate(row) {
        const uniqueId = row.dataset.uniqueId;
        const entryToUpdate = filteredData.find(entry => `${entry.term}-${entry.Facility}-${entry.key}` === uniqueId);

        if (!entryToUpdate) {
            console.error('Entry not found for status update.');
            return;
        }

        const { term, key } = entryToUpdate;

        // Prompt user for the quantity (Log_Qty)
        const userNumber = prompt('Please enter the quantity for this update:');
        if (userNumber === null) {
            return; // User canceled
        }

        // Current time in 00:00 AM/PM format
        const currentTime = formatAMPM(new Date());

        // Find how many updates already exist.
        const snapshot = await database.ref(`Master_Task/${term}/${key}`).once('value');
        const entryData = snapshot.val() || {};

        let updateCount = 0;
        for (let field in entryData) {
            if (field.startsWith('Update')) {
                updateCount++;
            }
        }

        // The next update number
        const nextUpdateNumber = updateCount + 1;
        const updateFieldName = `Update${nextUpdateNumber}`;

        // Create the new update node with Log_time and Log_Qty
        const updateData = {
            Log_time: currentTime,
            Log_Qty: userNumber
        };

        try {
            await database.ref(`Master_Task/${term}/${key}/${updateFieldName}`).set(updateData);
            alert(`Status updated! ${updateFieldName}: Log_time=${currentTime}, Log_Qty=${userNumber}`);
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update status. Please try again.');
        }
    }

    /**
     * Helper function to format time in 00:00 AM/PM.
     */
    function formatAMPM(date) {
        let hours = date.getHours();
        let minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours || 12; 
        minutes = minutes < 10 ? '0'+minutes : minutes;
        const strTime = (hours < 10 ? '0'+hours : hours) + ':' + minutes + ' ' + ampm;
        return strTime;
    }

    /**
     * Show the custom context menu.
     */
    function showContextMenu(event, targetRow) {
        event.preventDefault();

        const existingMenu = document.querySelector('.custom-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const contextMenu = createContextMenu(targetRow);
        contextMenu.style.top = `${event.pageY}px`;
        contextMenu.style.left = `${event.pageX}px`;

        document.body.appendChild(contextMenu);
    }

    /**
     * Listen for right-clicks to display the custom context menu.
     */
    document.addEventListener('contextmenu', function(event) {
        const targetRow = event.target.closest('tr');
        if (targetRow && targetRow.dataset.uniqueId) {
            showContextMenu(event, targetRow);
        }
    });

    /**
     * Hide the context menu when clicking outside of it.
     */
    document.addEventListener('click', function(event) {
        const contextMenu = document.querySelector('.custom-context-menu');
        if (contextMenu && !contextMenu.contains(event.target)) {
            contextMenu.remove();
        }
    });

    /**
     * Duplicate a row in the Firebase Realtime Database.
     */
    function duplicateRow(row) {
        const uniqueId = row.dataset.uniqueId;
        const entryToCopy = filteredData.find(entry => `${entry.term}-${entry.Facility}-${entry.key}` === uniqueId);

        if (entryToCopy) {
            database.ref(`Master_Task/${entryToCopy.term}`).once('value', snapshot => {
                const numericKeys = Object.keys(snapshot.val()).filter(key => !isNaN(key));
                let maxKey = numericKeys.length > 0 ? Math.max(...numericKeys.map(Number)) : -1;

                let newKey = (maxKey + 1).toString();
                const newEntry = { ...entryToCopy, key: newKey };

                database.ref(`Master_Task/${entryToCopy.term}/${newKey}`).set(newEntry)
                    .then(() => {
                        alert('Row duplicated successfully!');
                        displayData();
                    })
                    .catch(err => console.error('Error duplicating row in Firebase:', err));
            }).catch(err => console.error('Error reading from Firebase:', err));
        }
    }

    /**
     * Enable editing for specific cells in a row.
     */
    function enableEditing(row) {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, index) => {
            if (index >= 0 && index <= 6) {
                cell.contentEditable = true;
                cell.style.backgroundColor = 'yellow';
            }
        });
        alert('Row is now editable for columns 1 to 7. Click the "Update" button to save changes.');
    }

    /**
     * Delete a row from the Firebase Realtime Database after password confirmation.
     */
    function deleteRow(row) {
        const uniqueId = row.dataset.uniqueId;
        const entryToDelete = filteredData.find(entry => `${entry.term}-${entry.Facility}-${entry.key}` === uniqueId);

        if (entryToDelete) {
            const password = prompt('Please enter the password to delete this entry:');
            if (password === 'tovala') {
                if (confirm('Are you sure you want to delete this entry?')) {
                    database.ref(`Master_Task/${entryToDelete.term}/${entryToDelete.key}`).remove()
                        .then(() => {
                            alert('Data deleted successfully');
                            row.remove();
                        })
                        .catch(err => console.error('Error deleting data:', err));
                }
            } else {
                alert('Incorrect password. Deletion canceled.');
            }
        } else {
            console.error('Entry not found for deletion.');
        }
    }

    /**
     * Get the current time in HH:MM format.
     */
    function getCurrentTime() {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();

        hours = hours < 10 ? '0' + hours : hours;
        minutes = minutes < 10 ? '0' + minutes : minutes;

        return `${hours}:${minutes}`;
    }

    /**
     * Update a specific field in Firebase when a cell's value changes.
     */
    function updateFieldInFirebase(inputElement, field) {
        const row = inputElement.closest('tr');
        const uniqueId = row.dataset.uniqueId;
        const entryToUpdate = filteredData.find(entry => `${entry.term}-${entry.Facility}-${entry.key}` === uniqueId);

        if (entryToUpdate) {
            const { term, key } = entryToUpdate;
            const newValue = inputElement.value;

            entryToUpdate[field] = newValue;

            database.ref(`Master_Task/${term}/${key}/${field}`).set(newValue)
                .then(() => console.log(`${field} updated in Firebase`))
                .catch(err => console.error(`Error updating ${field} in Firebase:`, err));
        } else {
            console.error('Entry not found for updating.');
        }
    }

    /**
     * Display the filtered data in the table.
     */
    function displayData() {
        const searchProductElement = document.getElementById('searchProduct');
        const searchTaskElement = document.getElementById('searchTask');
        const searchFacilityElement = document.getElementById('searchFacility');
        const searchDayElement = document.getElementById('searchDay');
        const searchStatusElement = document.getElementById('searchStatus');
        const termElement = document.getElementById('term');
    
        const searchProduct = searchProductElement ? searchProductElement.value.toLowerCase() : '';
        const searchTask = searchTaskElement ? searchTaskElement.value.toLowerCase() : '';
        const searchFacility = searchFacilityElement ? searchFacilityElement.value.toLowerCase() : '';
        const searchDay = searchDayElement ? searchDayElement.value.toLowerCase() : '';
        const searchStatus = searchStatusElement ? searchStatusElement.value.toLowerCase() : '';
        const term = termElement ? parseInt(termElement.value, 10) : '';
    
        const searchTaskArray = searchTask.split(',').map(task => task.trim().toLowerCase()).filter(task => task !== '');

        const filtered = filteredData.filter(entry => {
            const termValue = parseInt(entry.term, 10);
            const product = entry.Product ? entry.Product.toLowerCase() : "";
            const facility = entry.Facility ? entry.Facility.toLowerCase() : "";
            const task = entry.Task ? entry.Task.toLowerCase() : "";
            const day = entry.Day ? entry.Day.toLowerCase() : "";
    
            const count = parseFloat(entry["Count"] || 0);
            const producedQty = parseFloat(entry["Produced Qty"] || 0);
            const status = calculateStatus(entry.Start, entry.End, count, producedQty, entry.Task).toLowerCase();
    
            const productMatch = product.includes(searchProduct);
            const facilityMatch = facility.includes(searchFacility);
            const taskMatch = searchTaskArray.length === 0 || searchTaskArray.some(taskTerm => task.includes(taskTerm));
            const dayMatch = day.includes(searchDay);
            const statusMatch = status.includes(searchStatus);  
            const termMatch = termValue === term;
    
            return productMatch && facilityMatch && taskMatch && dayMatch && statusMatch && termMatch;
        });
    
        displayTable(filtered);
    }

    /**
     * Setup autocomplete functionality for input fields.
     */
    function setupAutoComplete(inputId, suggestionBoxId, data) {
        const input = document.getElementById(inputId);
        const suggestionBox = document.getElementById(suggestionBoxId);

        if (!input || !suggestionBox) {
            console.error(`Input element with id "${inputId}" or suggestion box with id "${suggestionBoxId}" not found.`);
            return;
        }

        input.addEventListener('input', function() {
            const inputValue = this.value.toLowerCase();
            const lastCommaIndex = inputValue.lastIndexOf(',');
            let currentInput = inputValue;

            if (lastCommaIndex !== -1) {
                currentInput = inputValue.substring(lastCommaIndex + 1).trim();
            }

            suggestionBox.innerHTML = '';
            if (currentInput === '') {
                suggestionBox.style.display = 'none';
                return;
            }

            const uniqueData = [...new Set(data)];
            const suggestions = uniqueData.filter(item => item.toLowerCase().includes(currentInput));

            if (suggestions.length === 0) {
                suggestionBox.style.display = 'none';
                return;
            }

            suggestionBox.style.display = 'block';
            suggestions.forEach(suggestion => {
                const suggestionItem = document.createElement('div');
                suggestionItem.textContent = suggestion;
                suggestionBox.appendChild(suggestionItem);

                suggestionItem.addEventListener('click', function() {
                    const inputValueArray = input.value.split(',');
                    inputValueArray[inputValueArray.length - 1] = suggestion;
                    input.value = inputValueArray.join(', ');
                    suggestionBox.style.display = 'none';
                });
            });
        });

        input.addEventListener('focus', function() {
            const uniqueData = [...new Set(data)];
            suggestionBox.innerHTML = '';
            uniqueData.forEach(suggestion => {
                const suggestionItem = document.createElement('div');
                suggestionItem.textContent = suggestion;
                suggestionBox.appendChild(suggestionItem);

                suggestionItem.addEventListener('click', function() {
                    const inputValueArray = input.value.split(',');
                    inputValueArray[inputValueArray.length - 1] = suggestion;
                    input.value = inputValueArray.join(', ');
                    suggestionBox.style.display = 'none';
                });
            });
            suggestionBox.style.display = 'block';
        });

        document.addEventListener('click', function(event) {
            if (!input.contains(event.target) && !suggestionBox.contains(event.target)) {
                suggestionBox.style.display = 'none';
            }
        });
    }

    /**
     * Update the project status display based on current tasks.
     */
    function updateProjectStatus() {
        const tubewayStatusEl = document.getElementById('tubeway-status');
        const pershingStatusEl = document.getElementById('pershing-status');
        const westvalaStatusEl = document.getElementById('westvala-status');

        if (!tubewayStatusEl || !pershingStatusEl || !westvalaStatusEl) {
            console.error("One or more status elements are missing");
            return;
        }

        let tubewayStatus = "No Project Running";
        let pershingStatus = "No Project Running";
        let westvalaStatus = "No Project Running";

        for (let term in rawData) {
            const termData = rawData[term];
            if (Array.isArray(termData)) {
                termData.forEach(entry => {
                    if (entry.Facility === "Tubeway" && entry.Start) {
                        tubewayStatus = "Project Running";
                    }
                    if (entry.Facility === "Pershing" && entry.Start) {
                        pershingStatus = "Project Running";
                    }
                    if (entry.Facility === "Westvala" && entry.Start) {
                        westvalaStatus = "Project Running";
                    }
                });
            }
        }

        tubewayStatusEl.textContent = tubewayStatus;
        pershingStatusEl.textContent = pershingStatus;
        westvalaStatusEl.textContent = westvalaStatus;
    }

    /**
     * Event listener for the filter button.
     */
    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) {
        filterBtn.addEventListener('click', displayData);
    }

    /**
     * Event listeners for Enter key on input fields.
     */
    const inputFields = ['term', 'searchFacility', 'searchProduct', 'searchTask', 'searchDay'];
    inputFields.forEach(id => {
        const inputField = document.getElementById(id);
        if (inputField) {
            inputField.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    displayData();
                }
            });
        }
    });

    /**
     * Update timers for each facility every second.
     */
    function updateTimers() {
        const currentTime = new Date();
        
        const facilities = {
            Tubeway: [],
            Pershing: [],
            Westvala: []
        };

        for (let term in rawData) {
            const termData = rawData[term];
            if (Array.isArray(termData)) {
                termData.forEach(entry => {
                    const facility = entry.Facility || 'Unknown Facility';
                    const startTime = entry.Start || '';
                    const endTime = entry.End || '';
                    const product = entry.Product || '';
                    const projectHours = parseFloat(entry["Project Hours"] || 0).toFixed(2);

                    if (endTime) {
                        return;
                    }

                    if (startTime && facility) {
                        const currentTime = new Date();
                        
                        const [time, modifier] = startTime.split(' ');
                        let [hours, minutes] = time.split(':').map(Number);
                        
                        if (modifier === 'PM' && hours !== 12) {
                            hours = parseInt(hours, 10) + 12;
                        }
                        if (modifier === 'AM' && hours === 12) {
                            hours = 0;
                        }
                    
                        const startDate = new Date(currentTime);
                        startDate.setHours(parseInt(hours, 10));
                        startDate.setMinutes(parseInt(minutes, 10));
                        startDate.setSeconds(0);
                    
                        if (startDate > currentTime) {
                            startDate.setDate(startDate.getDate() - 1);
                        }
                    
                        let timer;
                    
                        if (endTime) {
                            const endTimeSplit = endTime.split(':');
                            let endHours = parseInt(endTimeSplit[0], 10);
                            let endMinutes = parseInt(endTimeSplit[1], 10);
                    
                            if (endTime.includes('PM') && endHours < 12) {
                                endHours += 12;
                            } else if (endTime.includes('AM') && endHours === 12) {
                                endHours = 0;
                            }
                    
                            const endDate = new Date(currentTime);
                            endDate.setHours(endHours);
                            endDate.setMinutes(endMinutes);
                            endDate.setSeconds(0);
                    
                            if (endDate > currentTime) {
                                endDate.setDate(endDate.getDate() - 1);
                            }
                    
                            const diffMs = endDate - startDate;
                            const elapsedMinutes = Math.floor(diffMs / (1000 * 60));
                            const elapsedHours = Math.floor(elapsedMinutes / 60);
                            const remainingMinutes = elapsedMinutes % 60;
                    
                            timer = `${String(elapsedHours).padStart(2, '0')}h ${String(remainingMinutes).padStart(2, '0')}m`;
                    
                        } else {
                            const diffMs = currentTime - startDate;
                            const elapsedMinutes = Math.floor(diffMs / (1000 * 60));
                            const elapsedHours = Math.floor(elapsedMinutes / 60);
                            const remainingMinutes = elapsedMinutes % 60;
                    
                            timer = `${String(elapsedHours).padStart(2, '0')}h ${String(remainingMinutes).padStart(2, '0')}m`;
                        }
                    
                        facilities[facility].push({ product, projectHours, timer });
                    }
                    
                });
            }
        }

        updateFacilityTimers('tubeway', facilities.Tubeway);
        updateFacilityTimers('pershing', facilities.Pershing);
        updateFacilityTimers('westvala', facilities.Westvala);

        setTimeout(updateTimers, 1000);
    }

    /**
     * Update the timer display for a specific facility.
     */
    function updateFacilityTimers(facilityId, data) {
        const tbody = document.getElementById(`${facilityId}-timers`);
        if (!tbody) {
            console.error(`Timer table body with id "${facilityId}-timers" not found.`);
            return;
        }
        tbody.innerHTML = '';

        if (data.length === 0) {
            const noDataRow = document.createElement('tr');
            noDataRow.innerHTML = `<td colspan="3">No Project Running</td>`;
            tbody.appendChild(noDataRow);
        } else {
            data.forEach(entry => {
                const row = document.createElement('tr');

                const projectHours = parseFloat(entry.projectHours);
                const hours = Math.floor(projectHours);
                const minutes = Math.round((projectHours - hours) * 60);
                const formattedProjectHours = `${hours}h ${minutes}m`;

                row.innerHTML = `
                    <td>${entry.product}</td>
                    <td class="project-hours">${formattedProjectHours}</td>
                    <td class="timer-cell">${entry.timer}</td>
                `;
                tbody.appendChild(row);

                const timerCell = row.querySelector('.timer-cell');

                let [hoursPart, minutesPart] = entry.timer.split(' ').map(part => parseInt(part.replace(/[h,m]/g, '')));
                if (isNaN(hoursPart)) hoursPart = 0;
                if (isNaN(minutesPart)) minutesPart = 0;

                let elapsedTimeInMinutes = (hoursPart * 60) + minutesPart;

                const projectHoursInMinutes = projectHours * 60;
                const timeDiff = elapsedTimeInMinutes - projectHoursInMinutes;

                if (timeDiff >= -5 && timeDiff <= 5) {
                    timerCell.classList.add('blink-yellow');
                    timerCell.classList.remove('blink-green', 'blink-red');
                } else if (timeDiff > 5) {
                    timerCell.classList.add('blink-red');
                    timerCell.classList.remove('blink-green', 'blink-yellow');
                } else if (timeDiff < -5) {
                    timerCell.classList.add('blink-green');
                    timerCell.classList.remove('blink-yellow', 'blink-red');
                }
            });
        }
    }

    /**
     * Parse time string into total minutes.
     */
    function parseTime(timeString) {
        if (!timeString) return 0;
        const [time, modifier] = timeString.split(' ');
        let [hours, minutes] = time.split(':').map(Number);

        if (modifier === 'PM' && hours < 12) {
            hours += 12;
        } else if (modifier === 'AM' && hours === 12) {
            hours = 0;
        }

        return (hours * 60) + minutes;
    }

    /**
     * Inject CSS styles for blinking effects.
     */
    const style = document.createElement('style');
    style.innerHTML = `
        .blink-green {
            animation: blinkGreen 5s infinite;
        }
        .blink-yellow {
            animation: blinkYellow 1s infinite;
        }
        .blink-red {
            animation: blinkRed 1s infinite;
        }
        @keyframes blinkGreen {
            50% { background-color: lightgreen; }
        }
        @keyframes blinkYellow {
            50% { background-color: yellow; }
        }
        @keyframes blinkRed {
            50% { background-color: red; }
        }
    `;
    document.head.appendChild(style);
});

