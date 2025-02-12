

// Wait for DOM to load
document.addEventListener("DOMContentLoaded", function () {
    const termInput = document.getElementById("termInput");
    const facilityInput = document.getElementById("facilityInput");
    const fetchBtn = document.getElementById("fetchBtn");
    const resultsContainer = document.getElementById("results-container");
  
    // On click of "Fetch Data", query the DB
    fetchBtn.addEventListener("click", () => {
      const term = termInput.value.trim();
      const facilityFilter = facilityInput.value.trim().toLowerCase();
  
      if (!term) {
        alert("Please enter a Term number.");
        return;
      }
  
      // Path: Master_Task/{term}
      const dbRef = firebase.database().ref("Master_Task/" + term);
  
      dbRef.once("value")
        .then((snapshot) => {
          if (!snapshot.exists()) {
            resultsContainer.innerHTML = `<p>No data found for term ${term}.</p>`;
            return;
          }
  
          let dataArr = [];
          const val = snapshot.val();
  
          // 'val' might be an array or object
          if (Array.isArray(val)) {
            // If array, each index = an entry
            val.forEach((obj, idx) => {
              if (obj) {
                dataArr.push({ index: idx, ...obj });
              }
            });
          } else {
            // If object, each key = an entry
            Object.keys(val).forEach((keyStr) => {
              dataArr.push({ index: keyStr, ...val[keyStr] });
            });
          }
  
          // Filter by facility if user typed something
          let filtered = dataArr;
          if (facilityFilter) {
            filtered = dataArr.filter((item) => {
              const fac = (item.Facility || "").toLowerCase();
              return fac.includes(facilityFilter);
            });
          }
  
          // Now display in a table
          if (filtered.length === 0) {
            resultsContainer.innerHTML = "<p>No matching data after facility filter.</p>";
          } else {
            const tableHtml = buildTableHTML(filtered);
            resultsContainer.innerHTML = tableHtml;
          }
        })
        .catch((err) => {
          console.error("Error reading data:", err);
          resultsContainer.innerHTML = `<p style="color:red;">Error reading data: ${err}</p>`;
        });
    });
  
    /**
     * Builds an HTML table from the fetched array
     * @param {Array} dataArr
     */
    function buildTableHTML(dataArr) {
      let html = `<table class="task-table">
        <thead>
          <tr>
            <th>Index</th>
            <th>Facility</th>
            <th>Meal</th>
            <th>Task</th>
            <th>Count</th>
            <th>Product</th>
            <!-- Add more columns as needed -->
          </tr>
        </thead>
        <tbody>
      `;
  
      dataArr.forEach((row) => {
        const facility = row.Facility || "";
        const meal = row.Meal || "";
        const task = row.Task || "";
        const count = row.Count || "";
        const product = row.Product || "";
  
        html += `
          <tr>
            <td>${row.index}</td>
            <td>${escapeHtml(facility)}</td>
            <td>${escapeHtml(meal)}</td>
            <td>${escapeHtml(task)}</td>
            <td>${escapeHtml(count)}</td>
            <td>${escapeHtml(product)}</td>
          </tr>
        `;
      });
  
      html += "</tbody></table>";
      return html;
    }
  
    /**
     * Minimal HTML escape
     * @param {string} str
     */
    function escapeHtml(str) {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  });
  