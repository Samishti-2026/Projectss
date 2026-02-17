/**
 * Dynamic Dashboard Application Logic
 * Handles UI interactions, API calls, and state management.
 */

// Constants and State
const DATABASE = "salesDB";
let allFields = [];

/**
 * Load all available fields from the database
 */
async function loadFields() {
  try {
    const res = await fetch(`/all-fields/${DATABASE}`);
    const json = await res.json();
    if (json.error) {
      console.error('Error loading fields:', json.error);
      showNotification(`Error loading fields: ${json.error}`, "error");
      allFields = [];
    } else {
      allFields = json.fields || [];
    }
    // Only add an initial row if there are none and we are just starting
    if (document.querySelectorAll("#filters .filter-row").length === 0) {
      addRow();
    }
  } catch (error) {
    console.error('Network error loading fields:', error);
    showNotification('Network error: Could not load fields', "error");
    allFields = [];
    if (document.querySelectorAll("#filters .filter-row").length === 0) {
      addRow();
    }
  }
}

/**
 * Add a new filter row to the UI
 */
/**
 * Add a new filter row to the UI
 */
function addRow() {
  const filtersContainer = document.getElementById("filters");
  const isFirstRow = filtersContainer.children.length === 0;

  const row = document.createElement("div");
  row.className = "filter-row";

  // Logic Operator (AND/OR) - Only for subsequent rows
  if (!isFirstRow) {
    const logicGroup = document.createElement("div");
    logicGroup.className = "form-group logic-group";
    // logicGroup.style.width = "80px"; // Move style to CSS ideally, but inline for now is safe

    const logicSel = document.createElement("select");
    logicSel.className = "logic-select";
    logicSel.innerHTML = `
      <option value="AND">AND</option>
      <option value="OR">OR</option>
    `;
    logicGroup.appendChild(logicSel);
    row.appendChild(logicGroup);
  } else {
    // Placeholder for alignment if needed, or just append nothing
    // distinctive class to identifying first row might be useful
    row.dataset.first = "true";
  }

  // Create form groups for better structure
  const fieldGroup = document.createElement("div");
  fieldGroup.className = "form-group";
  const fieldLabel = document.createElement("label");
  fieldLabel.textContent = "Collection.Field";
  const fieldSel = document.createElement("select");
  fieldSel.innerHTML = `<option value="">Select field</option>`;
  if (allFields && Array.isArray(allFields)) {
    allFields.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = `${f.collection}.${f.value}`;
      opt.textContent = `${f.collection}.${f.value}`;
      opt.dataset.collection = f.collection;
      opt.dataset.field = f.value;
      fieldSel.appendChild(opt);
    });
  }
  fieldGroup.append(fieldLabel, fieldSel);

  const opGroup = document.createElement("div");
  opGroup.className = "form-group";
  const opLabel = document.createElement("label");
  opLabel.textContent = "Operator";
  const opSel = document.createElement("select");
  opSel.innerHTML = `
    <option value="eq">Equals (=)</option>
    <option value="ne">Not Equals (!=)</option>
    <option value="gt">Greater Than (&gt;)</option>
    <option value="gte">Greater Than or Equal (&gt;=)</option>
    <option value="lt">Less Than (&lt;)</option>
    <option value="lte">Less Than or Equal (&lt;=)</option>
    <option value="contains">Contains</option>
    <option value="startsWith">Starts With</option>
    <option value="between">Between</option>
    <option value="in">In List</option>
  `;
  opGroup.append(opLabel, opSel);

  const valGroup = document.createElement("div");
  valGroup.className = "form-group";
  const valLabel = document.createElement("label");
  valLabel.textContent = "Value";
  const valInp = document.createElement("input");
  valInp.placeholder = "Enter value (use comma for lists)";

  // Wrap input in a container for positioning suggestions
  const valWrapper = document.createElement("div");
  valWrapper.className = "suggestions-container";
  valWrapper.appendChild(valInp);

  valGroup.append(valLabel, valWrapper);

  // Setup suggestions
  setupSuggestions(valInp, fieldSel);

  const btn = document.createElement("button");
  btn.className = "btn-danger btn-small"; // Added btn-small for better look
  btn.textContent = "Remove";
  btn.setAttribute("aria-label", "Remove filter");
  btn.onclick = () => {
    row.style.opacity = '0';
    row.style.transform = 'translateY(-10px)';
    setTimeout(() => row.remove(), 200);
  };

  row.append(fieldGroup, opGroup, valGroup, btn);
  filtersContainer.appendChild(row);

  // Add animation
  row.style.opacity = "0";
  row.style.transform = "translateY(-10px)";
  setTimeout(() => {
    row.style.transition = "all 0.3s ease";
    row.style.opacity = "1";
    row.style.transform = "translateY(0)";
  }, 10);
}

/**
 * Collect all filters from the UI
 */
function collectFilters() {
  const rows = document.querySelectorAll("#filters .filter-row");
  const regularFilters = [];

  rows.forEach((r, index) => {
    // Check if there is a logic selector (it might be the first child if present)
    let logic = 'AND'; // Default for first row or implicit
    let fieldSel, opSel, valInp;

    const logicSel = r.querySelector(".logic-select");
    if (logicSel) {
      logic = logicSel.value;
    }

    // We need to find the other inputs. They are inside form-groups.
    // The structure is: [logicGroup?] -> fieldGroup -> opGroup -> valGroup -> btn

    // Let's use querySelector since we added classes/structure
    // But wait, the previous code used r.children index which is brittle if we add a child at the start.
    // Let's rely on finding the selects/inputs inside the row.

    const selects = r.querySelectorAll("select:not(.logic-select)");
    // Expect 2 selects: field, operator
    if (selects.length < 2) return;

    fieldSel = selects[0];
    opSel = selects[1];
    valInp = r.querySelector("input");

    if (!fieldSel || !opSel || !valInp) {
      console.warn(`Skipping filter row ${index}: Missing elements`);
      return;
    }

    const op = opSel.value;
    let val = valInp.value;

    // Skip empty filters
    if (!fieldSel.value) {
      return;
    }

    const opt = fieldSel.selectedOptions[0];
    const collection = opt.dataset.collection;
    const field = opt.dataset.field;

    // Handle regular filter logic
    if (!val && op !== 'exists') {
      // Allow empty value for some cases? No, strict for now based on previous code
    }

    if (op === "in") {
      val = val.split(",").map((v) => v.trim()).filter((v) => v);
    }

    if (op === "between") {
      const parts = val.split(",").map((v) => v.trim()).filter((v) => v);
      if (parts.length >= 2) {
        val = { from: parts[0], to: parts[1] };
      } else {
        console.warn("Between operator requires two values separated by comma");
        return;
      }
    }

    // Auto-convert numbers if they look like numbers
    if (typeof val === 'string' && !isNaN(val) && val.trim() !== '') {
      // val = Number(val); // Optional: keep as string to let backend handle or user specificity
    }

    console.log(`Row ${index} logic:`, logic);

    regularFilters.push({
      collection,
      field,
      operator: op,
      value: val,
      logic: logic // Capture the logic
    });
  });

  return regularFilters;
}

/**
 * Add a new aggregation row to the UI
 */
function addAggregationRow() {
  const aggregationsContainer = document.getElementById("aggregations");

  const row = document.createElement("div");
  row.className = "aggregation-row";

  // Field to Calculate
  const fieldGroup = document.createElement("div");
  fieldGroup.className = "form-group";
  const fieldLabel = document.createElement("label");
  fieldLabel.textContent = "Field to Calculate";
  const fieldSel = document.createElement("select");
  fieldSel.innerHTML = `<option value="">Select field</option>`;
  if (allFields && Array.isArray(allFields)) {
    allFields.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = `${f.collection}.${f.value}`;
      opt.textContent = `${f.collection}.${f.value}`;
      opt.dataset.collection = f.collection;
      opt.dataset.field = f.value;
      fieldSel.appendChild(opt);
    });
  }
  fieldGroup.append(fieldLabel, fieldSel);

  // Calculation Type
  const opGroup = document.createElement("div");
  opGroup.className = "form-group";
  const opLabel = document.createElement("label");
  opLabel.textContent = "Calculation Type";
  const opSel = document.createElement("select");
  opSel.innerHTML = `
    <option value="sum">SUM (Total)</option>
    <option value="count">COUNT (Number of Items)</option>
    <option value="avg">AVERAGE (Mean Value)</option>
    <option value="min">MINIMUM (Smallest Value)</option>
    <option value="max">MAXIMUM (Largest Value)</option>
  `;
  opGroup.append(opLabel, opSel);

  // Group By
  const groupByGroup = document.createElement("div");
  groupByGroup.className = "form-group";
  const groupByLabel = document.createElement("label");
  groupByLabel.textContent = "Group By (for totals)";
  const groupBySel = document.createElement("select");
  groupBySel.innerHTML = `<option value="">Same as calculation field (default)</option>`;
  if (allFields && Array.isArray(allFields)) {
    allFields.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = `${f.collection}.${f.value}`;
      opt.textContent = `${f.collection}.${f.value}`;
      opt.dataset.collection = f.collection;
      opt.dataset.field = f.value;
      groupBySel.appendChild(opt);
    });
  }
  groupByGroup.append(groupByLabel, groupBySel);

  // Condition (HAVING)
  const havingOpGroup = document.createElement("div");
  havingOpGroup.className = "form-group";
  const havingOpLabel = document.createElement("label");
  havingOpLabel.textContent = "Apply Condition";
  const havingOpSel = document.createElement("select");
  havingOpSel.innerHTML = `
    <option value="">No condition (optional)</option>
    <option value="gt">Greater than (>)</option>
    <option value="gte">Greater than or equal (>=)</option>
    <option value="lt">Less than (<)</option>
    <option value="lte">Less than or equal (<=)</option>
    <option value="eq">Equal to (=)</option>
    <option value="ne">Not equal to (!=)</option>
  `;
  havingOpGroup.append(havingOpLabel, havingOpSel);

  const havingValueGroup = document.createElement("div");
  havingValueGroup.className = "form-group";
  const havingValueLabel = document.createElement("label");
  havingValueLabel.textContent = "Condition Value";
  const havingValueInput = document.createElement("input");
  havingValueInput.type = "text";
  havingValueInput.placeholder = "e.g. 1000";
  havingValueGroup.append(havingValueLabel, havingValueInput);

  const btn = document.createElement("button");
  btn.className = "btn-danger btn-small";
  btn.textContent = "Remove";
  btn.setAttribute("aria-label", "Remove calculation");
  btn.onclick = () => {
    row.style.opacity = '0';
    row.style.transform = 'translateY(-10px)';
    setTimeout(() => row.remove(), 200);
  };

  row.append(fieldGroup, opGroup, groupByGroup, havingOpGroup, havingValueGroup, btn);
  aggregationsContainer.appendChild(row);

  // Add animation
  row.style.opacity = "0";
  row.style.transform = "translateY(-10px)";
  setTimeout(() => {
    row.style.transition = "all 0.3s ease";
    row.style.opacity = "1";
    row.style.transform = "translateY(0)";
  }, 10);
}

/**
 * Collect all aggregations from the UI
 */
function collectAggregations() {
  const rows = document.querySelectorAll(".aggregation-row");
  const aggregations = [];
  const havingFilters = [];
  const groupByFields = [];

  rows.forEach((r, index) => {
    const fieldSel = r.children[0].querySelector("select");
    const opSel = r.children[1].querySelector("select");
    const groupBySel = r.children[2].querySelector("select");
    const havingOpSel = r.children[3].querySelector("select");
    const havingValueInput = r.children[4].querySelector("input");

    if (!fieldSel || !opSel) return;

    const fieldSelVal = fieldSel.value;
    const op = opSel.value;
    const groupByValue = groupBySel ? groupBySel.value : '';
    const havingOp = havingOpSel ? havingOpSel.value : '';
    const havingValue = havingValueInput ? havingValueInput.value : '';

    if (!fieldSelVal || !op) return;

    const opt = fieldSel.selectedOptions[0];
    const collection = opt.dataset.collection;
    const field = opt.dataset.field;

    const aggregation = {
      operator: op,
      collection: collection,
      field: field,
      alias: `${op}_${field.replace(/\./g, '_')}`,
    };

    aggregations.push(aggregation);

    if (groupByValue) {
      const groupOpt = groupBySel.selectedOptions[0];
      const groupCollection = groupOpt.dataset.collection;
      const groupField = groupOpt.dataset.field;

      groupByFields.push({
        collection: groupCollection,
        field: groupField
      });
    } else {
      groupByFields.push({
        collection: collection,
        field: field
      });
    }

    if (havingOp && havingValue) {
      havingFilters.push({
        field: aggregation.alias,
        operator: havingOp,
        value: havingValue
      });
    }
  });

  return {
    aggregations: aggregations,
    having: havingFilters,
    groupBy: groupByFields
  };
}

/**
 * Generate the SQL query JSON object from current UI state
 */
function generateQueryJSON() {
  const regularFilters = collectFilters();
  const aggResult = collectAggregations();
  const aggregations = aggResult.aggregations;
  const havingFilters = aggResult.having;
  const groupByFields = aggResult.groupBy;

  const requestBody = {
    database: DATABASE,
    filters: regularFilters,
  };

  if (aggregations.length > 0) requestBody.aggregation = aggregations;
  if (havingFilters.length > 0) requestBody.having = havingFilters;
  if (groupByFields.length > 0) requestBody.groupBy = groupByFields;

  return requestBody;
}

let debounceTimer;

/**
 * Update the query preview section with SQL from backend
 */
function updateQueryPreview() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const requestBody = generateQueryJSON();
    requestBody.preview = true;

    console.log("Fetching preview with body:", requestBody);

    try {
      const res = await fetch("/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      console.log("Preview response:", data);

      const previewEl = document.getElementById('query-preview-content');

      if (previewEl) {
        let html = '';

        if (data.sql) {
          html += `<div class="preview-sql">${highlightSQL(data.sql)}</div>`;
        }

        if (data.error) {
          html += `<div class="error" style="margin-top: 10px; color: #f44336;">Error: ${data.error}</div>`;
        } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          html += `<div class="preview-results" style="margin-top: 15px; border-top: 1px solid #444; padding-top: 10px;">`;
          html += `<h4 style="margin: 0 0 10px 0; color: #ddd; font-size: 0.9em;">Preview Results (Limit 5)</h4>`;
          html += `<div style="overflow-x: auto;">`;
          html += `<table style="width: 100%; border-collapse: collapse; font-size: 0.85em; color: #ccc;">`;

          // Header
          html += `<thead><tr style="border-bottom: 1px solid #555;">`;
          const keys = Object.keys(data.data[0]);
          keys.forEach(k => {
            html += `<th style="text-align: left; padding: 5px;">${k}</th>`;
          });
          html += `</tr></thead>`;

          // Body
          html += `<tbody>`;
          data.data.forEach(row => {
            html += `<tr>`;
            keys.forEach(k => {
              let val = row[k];
              if (val === null || val === undefined) val = '-';
              else if (typeof val === 'object' && val instanceof Date) val = val.toISOString().split('T')[0];
              // Attempt to format date strings if they look like dates
              else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) val = val.split('T')[0];

              html += `<td style="padding: 5px; border-bottom: 1px solid #444;">${val}</td>`;
            });
            html += `</tr>`;
          });
          html += `</tbody></table></div></div>`;
        } else if (data.success && (!data.data || data.data.length === 0)) {
          html += `<div style="margin-top: 10px; color: #888; font-style: italic;">No results found for this query preview.</div>`;
        }

        previewEl.innerHTML = html;

      }
    } catch (err) {
      console.error("Preview fetch error:", err);
    }
  }, 300); // 300ms debounce
}

/**
 * Simple SQL syntax highlighter
 */
function highlightSQL(sql) {
  if (!sql) return '';

  // Basic keywords list
  const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'JOIN', 'LEFT JOIN', 'INNER JOIN', 'ON', 'AS', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'IS', 'NOT', 'NULL', 'IN', 'BETWEEN', 'LIKE'];

  // Escape HTML first
  let html = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Highlight keywords
  keywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'g');
    html = html.replace(regex, `<span class="sql-keyword">${kw}</span>`);
  });

  // Highlight strings
  html = html.replace(/'([^']*)'/g, '<span class="sql-string">\'$1\'</span>');

  // Highlight numbers
  html = html.replace(/\b(\d+)\b/g, '<span class="sql-number">$1</span>');

  return html;
}

/**
 * Execute the query
 */
async function run() {
  const runButton = document.getElementById('btn-run-query') || document.querySelector('.actions-section .btn-primary');
  const originalText = runButton.textContent;

  // Show loading state
  runButton.innerHTML = "⏳ Executing...";
  runButton.disabled = true;

  try {
    // Show loading indicator
    const detailedContainer = document.getElementById("detailedTableContainer");
    const aggregationContainer = document.getElementById("aggregationTableContainer");

    // Clear previous results
    detailedContainer.innerHTML = '<div class="loading"></div>';
    aggregationContainer.innerHTML = '<div class="loading"></div>';
    document.getElementById("out").textContent = "Processing...";

    const requestBody = generateQueryJSON();

    const res = await fetch("/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const json = await res.json();
    document.getElementById("out").textContent = JSON.stringify(json, null, 2);

    displayResultsInTables(json);

    let successMessage = "Query executed successfully!";
    if (json.type === "both") {
      successMessage = `Found ${json.detailed_count} details and ${json.aggregation_count} summaries.`;
    } else if (json.type === "regular") {
      successMessage = `Found ${json.count} results.`;
    }
    showNotification(successMessage, "success");

  } catch (error) {
    console.error("Query execution failed:", error);
    showNotification("Query execution failed.", "error");
    document.getElementById("detailedTableContainer").innerHTML = '<div class="no-results">Error executing query</div>';
    document.getElementById("aggregationTableContainer").innerHTML = '';
  } finally {
    runButton.innerHTML = originalText;
    runButton.disabled = false;
  }
}

/**
 * Clear all inputs and results
 */
function clearAll() {
  document.getElementById("filters").innerHTML = "";
  document.getElementById("aggregations").innerHTML = "";
  document.getElementById("detailedTableContainer").innerHTML = "";
  document.getElementById("aggregationTableContainer").innerHTML = "";
  document.getElementById("out").textContent = "";
  showNotification("All filters cleared", "info");
  addRow(); // Add one empty row
}

/**
 * Save the current query configuration
 */
function saveQueryConfig() {
  const name = prompt("Enter a name for this query configuration:");
  if (!name) return;

  const description = prompt("Enter a description (optional):") || "";
  const filters = collectFilters();
  const aggResult = collectAggregations();

  if (filters.length === 0 && aggResult.aggregations.length === 0) {
    showNotification("No configuration to save! Add filters first.", "warning");
    return;
  }

  fetch("/save-query-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      description,
      filters,
      aggregation: aggResult.aggregations,
      having: aggResult.having,
      groupBy: aggResult.groupBy
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showNotification(`Saved "${name}"!`, "success");
        loadSavedConfigsList();
      } else {
        showNotification("Failed to save configuration", "error");
      }
    })
    .catch(error => {
      console.error("Save config error:", error);
      showNotification("Error saving configuration", "error");
    });
}

/**
 * Global function to load a saved config (called from dynamic HTML)
 */
window.loadSavedConfig = function (configName) {
  fetch("/query-configs")
    .then(response => response.json())
    .then(data => {
      const config = data.configs.find(c => c.name === configName);

      if (config) {
        document.getElementById("filters").innerHTML = "";
        document.getElementById("aggregations").innerHTML = "";

        // Restore Filters
        if (config.filters) {
          config.filters.forEach(filter => {
            addRow();
            const rows = document.querySelectorAll(".filter-row");
            const lastRow = rows[rows.length - 1];
            // Handle Logic Selector (if present)
            const logicSelect = lastRow.querySelector(".logic-select");
            if (logicSelect && filter.logic) {
              logicSelect.value = filter.logic;
            }

            // Handle Field and Operator Selectors
            const selects = lastRow.querySelectorAll("select:not(.logic-select)");
            const valInp = lastRow.querySelector("input");

            if (selects[0]) selects[0].value = `${filter.collection}.${filter.field}`;
            if (selects[1]) selects[1].value = filter.operator;

            if (valInp) {
              valInp.value = typeof filter.value === 'object' ?
                (Array.isArray(filter.value) ? filter.value.join(',') : JSON.stringify(filter.value)) :
                filter.value;
            }
          });
        }

        // Restore Aggregations
        if (config.aggregation && Array.isArray(config.aggregation)) {
          config.aggregation.forEach((agg, index) => {
            addAggregationRow();
            const aggRows = document.querySelectorAll(".aggregation-row");
            const lastRow = aggRows[aggRows.length - 1];
            const selects = lastRow.querySelectorAll("select");
            const inputs = lastRow.querySelectorAll("input");

            if (selects[0]) selects[0].value = `${agg.collection}.${agg.field}`;
            if (selects[1]) selects[1].value = agg.operator;

            // Group By
            if (config.groupBy && config.groupBy[index] && selects[2]) {
              selects[2].value = `${config.groupBy[index].collection}.${config.groupBy[index].field}`;
            }

            // Having
            if (config.having && Array.isArray(config.having)) {
              const h = config.having.find(h => h.field === agg.alias);
              if (h && selects[3] && inputs[0]) {
                selects[3].value = h.operator;
                inputs[0].value = h.value;
              }
            }
          });
        }

        showNotification(`Loaded "${configName}"`, "info");

        // Update preview
        updateQueryPreview();
      } else {
        showNotification("Configuration not found", "error");
      }
    })
    .catch(err => {
      console.error(err);
      showNotification("Error loading config", "error");
    });
};

/**
 * Global function to delete a saved config
 */
window.deleteSavedConfig = function (configId) {
  if (!confirm("Are you sure you want to delete this?")) return;

  fetch(`/query-config/${configId}`, { method: "DELETE" })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showNotification("Deleted!", "info");
        loadSavedConfigsList();
      } else {
        showNotification("Failed to delete", "error");
      }
    })
    .catch(e => showNotification("Error deleting", "error"));
};

/**
 * Load list of saved configurations
 */
function loadSavedConfigsList() {
  fetch("/query-configs")
    .then(res => res.json())
    .then(data => {
      const configs = data.configs || [];
      const content = document.getElementById("savedConfigsContent");

      if (configs.length === 0) {
        content.innerHTML = '<div class="empty-state" style="padding: 20px;"><p>No saved queries yet.</p></div>';
        return;
      }

      // Create grid layout for configs
      let html = '<div class="configs-grid">';

      configs.forEach(config => {
        html += `
        <div class="config-card">
          <div class="config-header">
            <div class="config-title">${config.name}</div>
            <div class="config-actions-top">
                <button class="btn-small btn-danger" onclick="deleteSavedConfig('${config.id}')" title="Delete">✕</button>
            </div>
          </div>
          <div class="config-desc">${config.description || 'No description'}</div>
          <div class="config-meta">
            <span class="badge">${config.filters.length} Filters</span>
            <span class="badge">${config.aggregation?.length || 0} Aggregations</span>
          </div>
          <div class="config-actions">
            <button class="btn-small btn-load" style="width:100%" onclick="loadSavedConfig('${config.name.replace(/'/g, "\\'")}')">Load Configuration</button>
          </div>
        </div>
      `;
      });

      html += '</div>';
      content.innerHTML = html;
    })
    .catch(err => {
      console.error(err);
      document.getElementById("savedConfigsContent").innerHTML = '<p class="error">Error loading saved queries</p>';
    });
}

/**
 * Helper: Display Results
 */
function displayResultsInTables(response) {
  const detailedContainer = document.getElementById("detailedTableContainer");
  const aggregationContainer = document.getElementById("aggregationTableContainer");

  detailedContainer.innerHTML = "";
  aggregationContainer.innerHTML = "";

  if (response.type === 'both' || (response.detailed_data && response.aggregation_data)) {
    if (response.detailed_data && response.detailed_data.length > 0) {
      createTable(detailedContainer, response.detailed_data, "Detailed Records");
    } else {
      detailedContainer.innerHTML = '<div class="no-results">No detailed records found</div>';
    }

    if (response.aggregation_data && response.aggregation_data.length > 0) {
      createTable(aggregationContainer, response.aggregation_data, "Summary Data");
    } else {
      aggregationContainer.innerHTML = '<div class="no-results">No aggregation results found</div>';
    }
  } else if (response.type === 'regular' || response.data) {
    const data = response.data || response.detailed_data;
    if (data && data.length > 0) {
      createTable(detailedContainer, data, "Results");
    } else {
      detailedContainer.innerHTML = '<div class="no-results">No results found</div>';
    }
    aggregationContainer.innerHTML = '<div class="empty-state" style="padding:20px"><p>No aggregations applied</p></div>';
  } else {
    detailedContainer.innerHTML = '<div class="no-results">No data returned</div>';
  }
}

/**
 * Helper: Create Table
 */
function createTable(container, data, title) {
  const wrapper = document.createElement("div");
  wrapper.className = "table-container";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  // Get headers
  const keys = new Set();
  data.forEach(item => {
    Object.keys(item).forEach(k => {
      if (k !== '_id' && k !== 'id' && !k.endsWith('_id') && typeof item[k] !== 'object') {
        keys.add(k);
      }
      // Handle objects like dates or nulls? 
      // Logic from original file to handle name resolution:
      if (k.endsWith('_name')) keys.add(k);
    });
    // Also add aggregation keys
    if (item.count !== undefined) keys.add('count');
    Object.keys(item).forEach(k => {
      if (k.startsWith('sum_') || k.startsWith('avg_') || k.startsWith('min_') || k.startsWith('max_')) {
        keys.add(k);
      }
    });
  });

  const headerRow = document.createElement("tr");
  Array.from(keys).forEach(k => {
    const th = document.createElement("th");
    th.textContent = formatHeader(k);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  data.forEach(item => {
    const tr = document.createElement("tr");
    Array.from(keys).forEach(k => {
      const td = document.createElement("td");
      const val = item[k];

      if (val === null || val === undefined) {
        td.textContent = "-";
        td.style.color = "#ccc";
      } else if (typeof val === 'number') {
        td.textContent = val.toLocaleString(undefined, { maximumFractionDigits: 2 });
        td.style.fontFamily = "monospace";
        td.style.textAlign = "right";
      } else if (k.includes('date') && !isNaN(Date.parse(val))) {
        td.textContent = new Date(val).toLocaleDateString();
      } else {
        td.textContent = val;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  wrapper.appendChild(table);
  container.appendChild(wrapper);
}

function formatHeader(key) {
  if (key.includes('_name')) return key.replace('_name', ' Name').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  if (key.startsWith('sum_')) return 'Total ' + key.replace('sum_', '').replace(/_/g, ' ');
  if (key.startsWith('avg_')) return 'Avg ' + key.replace('avg_', '').replace(/_/g, ' ');
  if (key === 'count') return 'Count';
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}


/**
 * Helper: Notification
 */
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transform = "translateX(100%)";
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  loadFields();
  loadSavedConfigsList();

  // Attach Event Listeners
  document.getElementById("btn-add-filter")?.addEventListener("click", addRow);
  document.getElementById("btn-add-aggregation")?.addEventListener("click", addAggregationRow);
  document.getElementById("btn-run-query")?.addEventListener("click", run);
  document.getElementById("btn-save-config")?.addEventListener("click", saveQueryConfig);
  document.getElementById("btn-clear-all")?.addEventListener("click", clearAll);

  // Keyboard Shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  });

  // Setup Real-time Preview
  setupRealTimePreview();
});

function setupRealTimePreview() {
  const filtersContainer = document.getElementById("filters");
  const aggregationsContainer = document.getElementById("aggregations");

  const update = () => {
    updateQueryPreview();
  };

  // Event Delegation for inputs
  if (filtersContainer) {
    filtersContainer.addEventListener('change', update);
    filtersContainer.addEventListener('input', update);
    filtersContainer.addEventListener('click', (e) => {
      // Update on remove button click (delegated)
      if (e.target.closest('.btn-danger')) {
        setTimeout(update, 250); // Wait for animation/removal
      }
    });
  }

  if (aggregationsContainer) {
    aggregationsContainer.addEventListener('change', update);
    aggregationsContainer.addEventListener('input', update);
    aggregationsContainer.addEventListener('click', (e) => {
      // Update on remove button click (delegated)
      if (e.target.closest('.btn-danger')) {
        setTimeout(update, 250); // Wait for animation/removal
      }
    });
  }

  // Mutation Helper (for when rows are added via Add buttons)
  // We can attach to the add buttons directly instead of mutation observer for simplicity
  document.getElementById("btn-add-filter")?.addEventListener("click", () => setTimeout(update, 50));
  document.getElementById("btn-add-aggregation")?.addEventListener("click", () => setTimeout(update, 50));
  document.getElementById("btn-clear-all")?.addEventListener("click", () => setTimeout(update, 50));

  // Initial update
  update();
}

/**
 * Setup auto-suggestions for an input field
 */
function setupSuggestions(input, fieldSelect) {
  let debounceTimer;
  const wrapper = input.parentElement; // .suggestions-container

  // Create suggestion list element
  const list = document.createElement("ul");
  list.className = "suggestions-list";
  list.style.display = "none";
  wrapper.appendChild(list);

  // Handler to fetch and show suggestions
  const fetchSuggestions = async (val) => {
    // Get current collection and field
    const fieldOpt = fieldSelect.selectedOptions[0];
    if (!fieldOpt || !fieldOpt.dataset.collection || !fieldOpt.dataset.field) return;

    const collection = fieldOpt.dataset.collection;
    const field = fieldOpt.dataset.field;

    // Minimum 3 characters required
    if (!val || val.length < 3) {
      list.style.display = 'none';
      return;
    }

    try {
      // Clean up previous list
      list.innerHTML = '';

      const queryParams = new URLSearchParams({
        database: DATABASE,
        collection: collection,
        field: field,
        query: val || ''
      });

      const res = await fetch(`/suggestions?${queryParams}`);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();

      if (data.suggestions && data.suggestions.length > 0) {
        data.suggestions.forEach(suggestion => {
          const li = document.createElement("li");
          li.className = "suggestion-item";
          li.textContent = suggestion;

          li.onclick = () => {
            const currentVal = input.value;
            if (currentVal.includes(',')) {
              // List mode
              const parts = currentVal.split(',');
              parts.pop(); // Remove partial
              parts.push(suggestion);
              input.value = parts.join(', ') + ', ';
            } else {
              input.value = suggestion;
            }
            list.style.display = 'none';
          };

          list.appendChild(li);
        });
        list.style.display = 'block';
      } else {
        list.style.display = 'none';
      }
    } catch (e) {
      console.error("Error fetching suggestions:", e);
    }
  };

  // Input event with debounce
  input.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    const val = e.target.value;
    const lastPart = val.split(',').pop().trim();

    debounceTimer = setTimeout(() => {
      fetchSuggestions(lastPart);
    }, 300);
  });

  // Focus event
  input.addEventListener("focus", (e) => {
    const val = e.target.value;
    const lastPart = val.split(',').pop().trim();
    fetchSuggestions(lastPart);
  });

  // Hide on click outside
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      list.style.display = 'none';
    }
  });

  // Update suggestions when field changes
  fieldSelect.addEventListener("change", () => {
    input.value = ''; // Clear value on field change
    list.style.display = 'none';
  });
}
