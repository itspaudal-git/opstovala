// Reference your Firebase database
const db = firebase.database();
const dataRef = db.ref('Looker');

let originalData = [];
let chart = null;
let chartType = 'line'; // Start with line chart

// Fetch data from Firebase
dataRef.once('value').then((snapshot) => {
    originalData = snapshot.val();
    createChart(originalData); // Initialize with "View All" (default)
});

function createChart(data) {
    const terms = [];
    const chicagoErrors = [];
    const chicagoTotalCustBoxes = [];
    const chicagoTotalMealsShipped = [];
    const chicagoTotalPick = [];
    const chicagoErrorCustBoxes = [];
    const chicagoErrorShippedMeals = [];
    const chicagoErrorTotalPicks = [];
    
    const slcErrors = [];
    const slcTotalCustBoxes = [];
    const slcTotalMealsShipped = [];
    const slcTotalPick = [];
    const slcErrorCustBoxes = [];
    const slcErrorShippedMeals = [];
    const slcErrorTotalPicks = [];

    // Process the data
    for (const item in data) {
        const facility = data[item].facility.toLowerCase();
        const termLabel = `Term ${data[item].term}`;
        if (!terms.includes(termLabel)) {
            terms.push(termLabel);
        }
        
        if (facility === "chicago") {
            chicagoErrors.push(data[item].error);
            chicagoTotalCustBoxes.push(data[item]['total cust boxes']);
            chicagoTotalMealsShipped.push(data[item]['total meals shipped']);
            chicagoTotalPick.push(data[item]['total pick']);
            chicagoErrorCustBoxes.push(data[item]['% error cust boxes'] * 100); // Store as percentage
            chicagoErrorShippedMeals.push(data[item]['% error shipped meals'] * 100); // Store as percentage
            chicagoErrorTotalPicks.push(data[item]['% error total picks'] * 100); // Store as percentage
        } else if (facility === "slc") {
            slcErrors.push(data[item].error);
            slcTotalCustBoxes.push(data[item]['total cust boxes']);
            slcTotalMealsShipped.push(data[item]['total meals shipped']);
            slcTotalPick.push(data[item]['total pick']);
            slcErrorCustBoxes.push(data[item]['% error cust boxes'] * 100); // Store as percentage
            slcErrorShippedMeals.push(data[item]['% error shipped meals'] * 100); // Store as percentage
            slcErrorTotalPicks.push(data[item]['% error total picks'] * 100); // Store as percentage
        }
    }

    const ctx = document.getElementById('myChart').getContext('2d');
    if (chart) chart.destroy(); // Destroy existing chart if any

    chart = new Chart(ctx, {
        type: chartType, // Dynamic chart type
        data: {
            labels: terms,
            datasets: [
                // Chicago Datasets
                {
                    label: 'Chicago Error',
                    data: chicagoErrors,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                    hidden: false
                },
                {
                    label: 'Chicago Total Cust Boxes',
                    data: chicagoTotalCustBoxes,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                    hidden: true
                },
                {
                    label: 'Chicago Total Meals Shipped',
                    data: chicagoTotalMealsShipped,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                    hidden: true
                },
                {
                    label: 'Chicago Total Pick',
                    data: chicagoTotalPick,
                    borderColor: 'rgba(153, 102, 255, 1)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(153, 102, 255, 1)',
                    hidden: true
                },
                {
                    label: 'Chicago % Error Cust Boxes',
                    data: chicagoErrorCustBoxes,
                    borderColor: 'rgba(255, 159, 64, 1)',
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 159, 64, 1)',
                    hidden: true
                },
                {
                    label: 'Chicago % Error Shipped Meals',
                    data: chicagoErrorShippedMeals,
                    borderColor: 'rgba(255, 206, 86, 1)',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 206, 86, 1)',
                    hidden: true
                },
                {
                    label: 'Chicago % Error Total Picks',
                    data: chicagoErrorTotalPicks,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                    hidden: true
                },
                // SLC Datasets
                {
                    label: 'SLC Error',
                    data: slcErrors,
                    borderColor: 'rgba(255, 99, 132, 0.7)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 99, 132, 0.7)',
                    hidden: true
                },
                {
                    label: 'SLC Total Cust Boxes',
                    data: slcTotalCustBoxes,
                    borderColor: 'rgba(54, 162, 235, 0.7)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(54, 162, 235, 0.7)',
                    hidden: true
                },
                {
                    label: 'SLC Total Meals Shipped',
                    data: slcTotalMealsShipped,
                    borderColor: 'rgba(75, 192, 192, 0.7)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(75, 192, 192, 0.7)',
                    hidden: true
                },
                {
                    label: 'SLC Total Pick',
                    data: slcTotalPick,
                    borderColor: 'rgba(153, 102, 255, 0.7)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(153, 102, 255, 0.7)',
                    hidden: true
                },
                {
                    label: 'SLC % Error Cust Boxes',
                    data: slcErrorCustBoxes,
                    borderColor: 'rgba(255, 159, 64, 0.7)',
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 159, 64, 0.7)',
                    hidden: true
                },
                {
                    label: 'SLC % Error Shipped Meals',
                    data: slcErrorShippedMeals,
                    borderColor: 'rgba(255, 206, 86, 0.7)',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 206, 86, 0.7)',
                    hidden: true
                },
                {
                    label: 'SLC % Error Total Picks',
                    data: slcErrorTotalPicks,
                    borderColor: 'rgba(75, 192, 192, 0.7)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(75, 192, 192, 0.7)',
                    hidden: true
                }
            ]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Term',
                        color: '#61dafb',
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Values',
                        color: '#61dafb',
                    },
                    beginAtZero: true,
                    ticks: {
                        callback: function(value, index, values) {
                            // Format numbers with commas for raw values and percentages
                            return value >= 100 ? value.toLocaleString() : value.toFixed(2) + '%'; 
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#61dafb'
                    },
                    onClick: function(e, legendItem) {
                        const index = legendItem.datasetIndex;
                        const ci = this.chart;
                        const meta = ci.getDatasetMeta(index);

                        // Toggle visibility
                        meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
                        ci.update();
                    },
                    position: 'right' // Positioning the legend on the right by default
                },
                tooltip: {
                    callbacks: {
                        label: function(tooltipItem) {
                            const value = tooltipItem.raw;
                            return tooltipItem.dataset.label + ': ' + (value >= 100 ? value.toLocaleString() : value.toFixed(2) + '%'); // Format numbers with commas or percentage
                        }
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x', // Allow panning only in the horizontal direction
                        onPanComplete({ chart }) {
                            chart.update('none');
                        },
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x', // Allow zooming only in the horizontal direction
                        onZoomComplete({ chart }) {
                            chart.update('none');
                        },
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 10,
                    bottom: 10
                }
            },
            onClick: (e) => {
                const activePoints = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
                if (activePoints.length) {
                    const firstPoint = activePoints[0];
                    const label = chart.data.labels[firstPoint.index];
                    bringToMiddle(label);
                }
            }
        }
    });

    // Handling the legend positioning for full-screen mode
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1200) {
            chart.options.plugins.legend.position = 'right';
        } else {
            chart.options.plugins.legend.position = 'top';
        }
        chart.update();
    });
}

// Toggle Full-Screen Mode
function toggleFullScreen() {
    const chartContainer = document.querySelector('.chart-container');
    if (!document.fullscreenElement) {
        chartContainer.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen();
    }
}

// Toggle between line and bar chart
function toggleChartType() {
    chartType = chartType === 'line' ? 'bar' : 'line'; // Toggle between line and bar chart
    createChart(originalData); // Recreate the chart with the new type
}

function applyTermRange() {
    const minTerm = document.getElementById('minTerm').value;
    const maxTerm = document.getElementById('maxTerm').value;

    if (minTerm && maxTerm && minTerm <= maxTerm) {
        const filteredData = originalData.filter(item => item.term >= minTerm && item.term <= maxTerm);
        createChart(filteredData);
    } else {
        alert("Please enter a valid term range where Min Term is less than or equal to Max Term.");
    }
}

function filterData(filterType) {
    // Filter original data
    const filteredData = filterTerms(originalData, filterType);
    createChart(filteredData);
}

function filterTerms(data, filterType) {
    const termsToShow = [];
    const maxTerm = Math.max(...Object.values(data).map(item => item.term));
    if (filterType === 'month') {
        for (let i = maxTerm - 3; i <= maxTerm; i++) {
            termsToShow.push(i);
        }
    } else if (filterType === 'quarter') {
        for (let i = maxTerm - 11; i <= maxTerm; i++) {
            termsToShow.push(i);
        }
    } else {
        return data; // Show all data if 'all' is selected
    }

    // Return filtered data
    return Object.fromEntries(Object.entries(data).filter(([_, item]) => termsToShow.includes(item.term)));
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}


