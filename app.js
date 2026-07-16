// app.js - Retentio Churn Analytics Dashboard Logic

document.addEventListener("DOMContentLoaded", () => {
    // -------------------------------------------------------------
    // 1. Initial State & Navigation Setup
    // -------------------------------------------------------------
    let activeSection = "overview-page";
    let chartContract = null;
    let chartInternet = null;
    let chartTenure = null;
    
    // Check if dataset is available
    if (!window.cleanedCustomerData || !window.rawCustomerData) {
        console.error("Data arrays not loaded. Check data.js path and generation.");
        return;
    }
    
    // Update Header Time
    function updateHeaderTime() {
        const timeBadge = document.getElementById("current-time");
        if (timeBadge) {
            const now = new Date();
            let hours = now.getHours();
            let minutes = now.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            minutes = minutes < 10 ? '0' + minutes : minutes;
            timeBadge.textContent = `${hours}:${minutes} ${ampm}`;
        }
    }
    updateHeaderTime();
    setInterval(updateHeaderTime, 30000);

    // Sidebar Page Toggling
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const target = item.getAttribute("data-target");
            if (!target) return;
            
            // Toggle active menu class
            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");
            
            // Toggle active section
            document.querySelectorAll(".page-section").forEach(sec => sec.classList.remove("active"));
            const targetSection = document.getElementById(target);
            targetSection.classList.add("active");
            
            // Update Page Header Info
            const title = document.getElementById("page-title");
            const subtitle = document.getElementById("page-subtitle");
            
            if (target === "overview-page") {
                title.textContent = "Dashboard Overview";
                subtitle.textContent = "Real-time customer churn analysis & predictive monitoring";
                // Trigger charts redraw in case viewport changed
                updateDashboard();
            } else if (target === "python-etl-page") {
                title.textContent = "Python ETL Pipeline";
                subtitle.textContent = "Pandas & NumPy raw dataset cleaning demonstration";
            } else if (target === "sql-playground-page") {
                title.textContent = "SQL Analysis Playground";
                subtitle.textContent = "Execute SQL analytics templates on database schema";
                // Trigger query setup
                setupSQLPlayground();
            } else if (target === "insights-page") {
                title.textContent = "Retention Insights";
                subtitle.textContent = "Segment-based risk profiles and action items";
                updateInsightsPage();
            }
        });
    });

    // -------------------------------------------------------------
    // 2. Dashboard Slicers & Filtering Logic
    // -------------------------------------------------------------
    const filterGender = document.getElementById("filter-gender");
    const filterContract = document.getElementById("filter-contract");
    const filterInternet = document.getElementById("filter-internet");
    const filterPayment = document.getElementById("filter-payment");
    const filterTenureRange = document.getElementById("filter-tenure");
    const tenureValLabel = document.getElementById("tenure-val");
    const btnResetFilters = document.getElementById("reset-filters");
    
    let filteredData = [...window.cleanedCustomerData];
    
    function handleFilterChange() {
        const gender = filterGender.value;
        const contract = filterContract.value;
        const internet = filterInternet.value;
        const payment = filterPayment.value;
        const maxTenure = parseInt(filterTenureRange.value);
        
        tenureValLabel.textContent = `0 - ${maxTenure} mos`;
        
        filteredData = window.cleanedCustomerData.filter(customer => {
            const genderMatch = (gender === "all" || customer.gender === gender);
            const contractMatch = (contract === "all" || customer.Contract === contract);
            const internetMatch = (internet === "all" || customer.InternetService === internet);
            const paymentMatch = (payment === "all" || customer.PaymentMethod === payment);
            const tenureMatch = (customer.tenure <= maxTenure);
            
            return genderMatch && contractMatch && internetMatch && paymentMatch && tenureMatch;
        });
        
        updateDashboard();
    }
    
    [filterGender, filterContract, filterInternet, filterPayment, filterTenureRange].forEach(elem => {
        elem.addEventListener("change", handleFilterChange);
        elem.addEventListener("input", handleFilterChange); // for smooth range slider updates
    });
    
    btnResetFilters.addEventListener("click", () => {
        filterGender.value = "all";
        filterContract.value = "all";
        filterInternet.value = "all";
        filterPayment.value = "all";
        filterTenureRange.value = 72;
        tenureValLabel.textContent = "0 - 72 mos";
        
        filteredData = [...window.cleanedCustomerData];
        updateDashboard();
    });

    // -------------------------------------------------------------
    // 3. Dashboard KPI Ribbon Update
    // -------------------------------------------------------------
    function updateKPIs() {
        const total = filteredData.length;
        const active = filteredData.filter(c => c.Churn === "No").length;
        const churned = total - active;
        const churnRate = total > 0 ? (churned / total) * 100 : 0;
        
        // Sum MRR (Monthly Charges of active customers)
        const mrr = filteredData
            .filter(c => c.Churn === "No")
            .reduce((sum, c) => sum + parseFloat(c.MonthlyCharges), 0);
            
        // Sum revenue at risk (Monthly charges of churned customers in selected segment)
        const revRisk = filteredData
            .filter(c => c.Churn === "Yes")
            .reduce((sum, c) => sum + parseFloat(c.MonthlyCharges), 0);
            
        // Render KPIs
        document.getElementById("kpi-total-customers").textContent = total.toLocaleString();
        document.getElementById("kpi-active-customers").textContent = active.toLocaleString();
        document.getElementById("kpi-churn-rate").textContent = `${churnRate.toFixed(1)}%`;
        document.getElementById("kpi-mrr").textContent = `$${Math.round(mrr).toLocaleString()}`;
        document.getElementById("kpi-revenue-risk").textContent = `$${Math.round(revRisk).toLocaleString()}`;
        
        // Dynamic KPI adjustments
        const riskRatio = document.getElementById("kpi-risk-ratio");
        const ratio = mrr > 0 ? (revRisk / mrr) * 100 : 0;
        riskRatio.textContent = `${ratio.toFixed(1)}% of MRR`;
        
        const churnTrend = document.getElementById("kpi-churn-trend");
        if (churnRate > 25.0) {
            churnTrend.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> High`;
            churnTrend.className = "trend negative";
        } else if (churnRate < 15.0) {
            churnTrend.innerHTML = `<i class="fa-solid fa-arrow-trend-down"></i> Low`;
            churnTrend.className = "trend positive";
        } else {
            churnTrend.innerHTML = `<i class="fa-solid fa-arrows-left-right"></i> Stable`;
            churnTrend.className = "trend neutral";
        }
    }

    // -------------------------------------------------------------
    // 4. Chart.js Visualization Builders
    // -------------------------------------------------------------
    function renderContractChurnChart() {
        const ctx = document.getElementById("chart-contract-churn").getContext("2d");
        
        // Group by contract: calculate churn rate
        const contracts = ["Month-to-month", "One year", "Two year"];
        const churnRates = contracts.map(contract => {
            const segment = filteredData.filter(c => c.Contract === contract);
            const total = segment.length;
            const churned = segment.filter(c => c.Churn === "Yes").length;
            return total > 0 ? parseFloat(((churned / total) * 100).toFixed(1)) : 0.0;
        });
        
        if (chartContract) chartContract.destroy();
        
        chartContract = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: contracts,
                datasets: [{
                    label: 'Churn Rate %',
                    data: churnRates,
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.75)',  // Red
                        'rgba(245, 158, 11, 0.75)',  // Amber
                        'rgba(16, 185, 129, 0.75)'   // Emerald
                    ],
                    borderColor: [
                        '#ef4444',
                        '#f59e0b',
                        '#10b981'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Churn Rate: ${context.parsed.y}%`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { family: 'Inter' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { family: 'Inter' } }
                    }
                }
            }
        });
    }

    function renderInternetChurnChart() {
        const ctx = document.getElementById("chart-internet-churn").getContext("2d");
        
        const services = ["DSL", "Fiber optic", "No"];
        const churnedCounts = services.map(srv => {
            return filteredData.filter(c => c.InternetService === srv && c.Churn === "Yes").length;
        });
        const activeCounts = services.map(srv => {
            return filteredData.filter(c => c.InternetService === srv && c.Churn === "No").length;
        });
        
        if (chartInternet) chartInternet.destroy();
        
        chartInternet = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ["DSL Churn", "Fiber Optic Churn", "No Internet Churn", "DSL Retained", "Fiber Retained", "No Internet Retained"],
                datasets: [
                    {
                        label: 'Churn Status',
                        data: [...churnedCounts, ...activeCounts],
                        backgroundColor: [
                            'rgba(239, 68, 68, 0.85)', // DSL Churn
                            'rgba(239, 68, 68, 0.6)',  // Fiber Churn
                            'rgba(239, 68, 68, 0.4)',  // No Internet Churn
                            'rgba(16, 185, 129, 0.85)', // DSL Retained
                            'rgba(16, 185, 129, 0.6)',  // Fiber Retained
                            'rgba(16, 185, 129, 0.4)'   // No Internet Retained
                        ],
                        borderWidth: 2,
                        borderColor: '#111726',
                        hoverOffset: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#94a3b8',
                            boxWidth: 12,
                            font: { family: 'Inter', size: 10 }
                        }
                    }
                }
            }
        });
    }

    function renderTenureChurnChart() {
        const ctx = document.getElementById("chart-tenure-churn").getContext("2d");
        
        // Group into cohorts: 1-6m, 7-12m, 13-24m, 25-48m, 49+m
        const cohorts = [
            { label: "1-6 Mo", filter: c => c.tenure > 0 && c.tenure <= 6 },
            { label: "7-12 Mo", filter: c => c.tenure > 6 && c.tenure <= 12 },
            { label: "13-24 Mo", filter: c => c.tenure > 12 && c.tenure <= 24 },
            { label: "25-48 Mo", filter: c => c.tenure > 24 && c.tenure <= 48 },
            { label: "49+ Mo", filter: c => c.tenure > 48 }
        ];
        
        const labels = cohorts.map(c => c.label);
        const counts = cohorts.map(c => filteredData.filter(c.filter).length);
        const churnRates = cohorts.map(c => {
            const sub = filteredData.filter(c.filter);
            const total = sub.length;
            const churned = sub.filter(cust => cust.Churn === "Yes").length;
            return total > 0 ? parseFloat(((churned / total) * 100).toFixed(1)) : 0.0;
        });
        
        if (chartTenure) chartTenure.destroy();
        
        chartTenure = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Total Customers',
                        data: counts,
                        backgroundColor: 'rgba(6, 182, 212, 0.4)',
                        borderColor: '#06b6d4',
                        borderWidth: 1.5,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: 'Churn Rate %',
                        data: churnRates,
                        borderColor: '#ef4444',
                        borderWidth: 2.5,
                        pointBackgroundColor: '#ef4444',
                        pointBorderColor: '#090d16',
                        pointBorderWidth: 1.5,
                        pointRadius: 4,
                        fill: false,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#94a3b8', font: { family: 'Inter' } }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        max: 100,
                        grid: { drawOnChartArea: false }, // only want grid lines for LHS
                        ticks: { color: '#ef4444', callback: value => `${value}%` }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }

    // -------------------------------------------------------------
    // 5. Customer Transaction Table Paginated View
    // -------------------------------------------------------------
    const tableBody = document.getElementById("customer-table-body");
    const tableSearch = document.getElementById("table-search");
    const rowCountLabel = document.getElementById("table-row-count");
    const btnPrevPage = document.getElementById("prev-page");
    const btnNextPage = document.getElementById("next-page");
    const pageNumDisplay = document.getElementById("page-num-display");
    
    let currentPage = 1;
    const rowsPerPage = 10;
    let tableData = [...filteredData];
    
    function filterTableData() {
        const query = tableSearch.value.trim().toLowerCase();
        tableData = filteredData.filter(customer => {
            return customer.customerID.toLowerCase().includes(query);
        });
        currentPage = 1;
        renderTable();
    }
    
    tableSearch.addEventListener("input", filterTableData);
    
    function renderTable() {
        const totalRows = tableData.length;
        rowCountLabel.textContent = `Showing ${totalRows.toLocaleString()} customers`;
        
        const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
        if (currentPage > totalPages) currentPage = totalPages;
        
        pageNumDisplay.textContent = `Page ${currentPage} of ${totalPages}`;
        btnPrevPage.disabled = currentPage === 1;
        btnNextPage.disabled = currentPage === totalPages;
        
        tableBody.innerHTML = "";
        
        if (totalRows === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching records found.</td></tr>`;
            return;
        }
        
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
        
        for (let i = startIndex; i < endIndex; i++) {
            const customer = tableData[i];
            const row = document.createElement("tr");
            
            const badgeClass = customer.Churn === "Yes" ? "churn-yes" : "churn-no";
            const churnText = customer.Churn === "Yes" ? "Churned" : "Active";
            
            // Format monetary values
            const monthly = parseFloat(customer.MonthlyCharges).toFixed(2);
            const total = parseFloat(customer.TotalCharges).toFixed(2);
            
            row.innerHTML = `
                <td style="font-family: var(--font-mono); color: var(--color-primary);">${customer.customerID}</td>
                <td>${customer.gender}</td>
                <td>${customer.tenure} mos</td>
                <td>${customer.Contract}</td>
                <td>${customer.InternetService}</td>
                <td>${customer.PaymentMethod}</td>
                <td>$${monthly}</td>
                <td>$${total}</td>
                <td><span class="badge ${badgeClass}">${churnText}</span></td>
            `;
            tableBody.appendChild(row);
        }
    }
    
    btnPrevPage.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });
    
    btnNextPage.addEventListener("click", () => {
        const totalPages = Math.ceil(tableData.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    // -------------------------------------------------------------
    // 6. Python ETL Pipeline Simulation
    // -------------------------------------------------------------
    const btnRunPipeline = document.getElementById("btn-run-pipeline");
    const etlConsole = document.getElementById("etl-console");
    const diffSection = document.getElementById("diff-section");
    const diffTableBody = document.getElementById("diff-table-body");
    
    btnRunPipeline.addEventListener("click", () => {
        btnRunPipeline.disabled = true;
        btnRunPipeline.classList.remove("animate-pulse");
        btnRunPipeline.textContent = "Pipeline Running...";
        
        etlConsole.innerHTML = "";
        diffSection.style.display = "none";
        
        const logs = [
            { type: "system", text: "[SYS] Initializing data cleaning environment..." },
            { type: "log", text: "[LOG] Importing libraries: pandas as pd, numpy as np..." },
            { type: "info", text: "[INFO] Reading input file: C:/Users/Deepshikha/customer_churn_raw.csv" },
            { type: "log", text: "[LOG] Loaded raw dataset. Dimensions: (1000, 21)" },
            { type: "info", text: "[INFO] Standardizing inconsistent text values..." },
            { type: "success", text: "[SUCCESS] Standardized casing for 'gender' field. Capitalized 102 rows ('female'/'FEMALE' -> 'Female')." },
            { type: "info", text: "[INFO] Parsing numeric column 'TotalCharges'..." },
            { type: "success", text: "[SUCCESS] Converted 20 empty text fields (' ') to NaN." },
            { type: "info", text: "[INFO] Performing data imputation checks..." },
            { type: "log", text: "[LOG] Found 8 records where tenure == 0 and TotalCharges is null. Imputing TotalCharges = 0.0" },
            { type: "success", text: "[SUCCESS] Successfully imputed 8 new customer rows." },
            { type: "log", text: "[LOG] Found 20 records where tenure > 0 and TotalCharges is null. Imputing via MonthlyCharges * tenure." },
            { type: "success", text: "[SUCCESS] Successfully imputed 20 active customer rows." },
            { type: "info", text: "[INFO] Dropping duplicate subscriber accounts based on 'customerID'..." },
            { type: "log", text: "[LOG] Scanned 1,000 records. No duplicate entries detected." },
            { type: "info", text: "[INFO] Exporting cleaned file to target CSV: C:/Users/Deepshikha/customer_churn_clean.csv" },
            { type: "success", text: "[SUCCESS] Export complete. Ready for database serialization." },
            { type: "system", text: "[SYS] Pipeline executed successfully (Process status code 0)." }
        ];
        
        let index = 0;
        function printLogLine() {
            if (index < logs.length) {
                const item = logs[index];
                const span = document.createElement("span");
                span.className = `${item.type}-line`;
                span.textContent = item.text;
                etlConsole.appendChild(span);
                
                // Scroll console to bottom
                etlConsole.parentElement.scrollTop = etlConsole.parentElement.scrollHeight;
                
                index++;
                setTimeout(printLogLine, 250);
            } else {
                btnRunPipeline.disabled = false;
                btnRunPipeline.innerHTML = `<i class="fa-solid fa-play"></i> Run ETL Pipeline`;
                // Show diff table
                showDiffTable();
            }
        }
        
        printLogLine();
    });
    
    function showDiffTable() {
        diffSection.style.display = "block";
        diffTableBody.innerHTML = "";
        
        // Find a few instances of fixed rows
        // 1. Gender was fixed (e.g., gender lowercase in raw)
        // 2. Missing charges imputed
        const fixedRows = [];
        
        for (let i = 0; i < window.rawCustomerData.length; i++) {
            const raw = window.rawCustomerData[i];
            const clean = window.cleanedCustomerData[i];
            
            const genderDiff = raw.gender !== clean.gender;
            const chargesDiff = raw.TotalCharges.toString().trim() !== clean.TotalCharges.toString().trim();
            
            if (genderDiff || chargesDiff) {
                let imputationType = "No Change";
                if (genderDiff && chargesDiff) imputationType = "Casing Standardized & Imputed Charges";
                else if (genderDiff) imputationType = "Casing Standardized";
                else {
                    imputationType = clean.tenure === 0 ? "New Customer Imputed (0.0)" : "Missing Charges Imputed";
                }
                
                fixedRows.push({
                    id: clean.customerID,
                    tenure: clean.tenure,
                    rawGender: raw.gender,
                    cleanGender: clean.gender,
                    rawCharges: raw.TotalCharges === "" ? "<i>[empty string]</i>" : raw.TotalCharges,
                    cleanCharges: clean.TotalCharges,
                    type: imputationType,
                    genderDiff,
                    chargesDiff
                });
            }
            if (fixedRows.length >= 5) break;
        }
        
        fixedRows.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-family: var(--font-mono); color: var(--color-primary);">${row.id}</td>
                <td>${row.tenure} mos</td>
                <td class="${row.genderDiff ? 'highlight-cell' : ''}">${row.rawGender}</td>
                <td class="${row.genderDiff ? 'fixed-cell' : ''}">${row.cleanGender}</td>
                <td class="${row.chargesDiff ? 'highlight-cell' : ''}">${row.rawCharges}</td>
                <td class="${row.chargesDiff ? 'fixed-cell' : ''}">$${parseFloat(row.cleanCharges).toFixed(2)}</td>
                <td><span style="font-weight:600; font-size: 0.7rem; color: var(--color-primary);">${row.type}</span></td>
            `;
            diffTableBody.appendChild(tr);
        });
    }

    // -------------------------------------------------------------
    // 7. SQL Analysis Playground Simulation
    // -------------------------------------------------------------
    let selectedQueryKey = "q-overall";
    const sqlCodeViewer = document.getElementById("sql-code-viewer");
    const btnRunQuery = document.getElementById("btn-run-query");
    const sqlResultHead = document.getElementById("sql-result-head");
    const sqlResultBody = document.getElementById("sql-result-body");
    const sqlSpeedDisplay = document.getElementById("sql-speed-display");
    
    const sqlQueries = {
        "q-overall": {
            sql: `-- Overall Churn Rate & Customer Count
SELECT 
    COUNT(customerID) as total_customers,
    SUM(CASE WHEN Churn = 'Yes' THEN 1 ELSE 0 END) as churned_customers,
    ROUND((SUM(CASE WHEN Churn = 'Yes' THEN 1.0 ELSE 0.0 END) / COUNT(customerID)) * 100.0, 2) as churn_rate_pct
FROM customers;`,
            execute: () => {
                const total = window.cleanedCustomerData.length;
                const churned = window.cleanedCustomerData.filter(c => c.Churn === "Yes").length;
                const rate = total > 0 ? (churned / total) * 100 : 0;
                return {
                    headers: ["total_customers", "churned_customers", "churn_rate_pct"],
                    rows: [[total.toLocaleString(), churned.toLocaleString(), `${rate.toFixed(2)}%`]]
                };
            }
        },
        "q-contract": {
            sql: `-- Churn Rate by Contract Type
SELECT 
    Contract,
    COUNT(customerID) as total_customers,
    SUM(CASE WHEN Churn = 'Yes' THEN 1 ELSE 0 END) as churned_customers,
    ROUND((SUM(CASE WHEN Churn = 'Yes' THEN 1.0 ELSE 0.0 END) / COUNT(customerID)) * 100.0, 2) as churn_rate_pct
FROM customers
GROUP BY Contract
ORDER BY churn_rate_pct DESC;`,
            execute: () => {
                const contracts = ["Month-to-month", "One year", "Two year"];
                const results = contracts.map(contract => {
                    const seg = window.cleanedCustomerData.filter(c => c.Contract === contract);
                    const total = seg.length;
                    const churned = seg.filter(c => c.Churn === "Yes").length;
                    const rate = total > 0 ? (churned / total) * 100 : 0;
                    return [contract, total, churned, `${rate.toFixed(2)}%`];
                });
                
                // Sort by churn rate desc
                results.sort((a, b) => parseFloat(b[3]) - parseFloat(a[3]));
                
                return {
                    headers: ["Contract", "total_customers", "churned_customers", "churn_rate_pct"],
                    rows: results
                };
            }
        },
        "q-internet": {
            sql: `-- Churn Analysis by Internet Service Type
SELECT 
    InternetService,
    COUNT(customerID) as total_customers,
    SUM(CASE WHEN Churn = 'Yes' THEN 1 ELSE 0 END) as churned_customers,
    ROUND((SUM(CASE WHEN Churn = 'Yes' THEN 1.0 ELSE 0.0 END) / COUNT(customerID)) * 100.0, 2) as churn_rate_pct,
    ROUND(AVG(MonthlyCharges), 2) as avg_monthly_charges
FROM customers
GROUP BY InternetService
ORDER BY churn_rate_pct DESC;`,
            execute: () => {
                const services = ["Fiber optic", "DSL", "No"];
                const results = services.map(srv => {
                    const seg = window.cleanedCustomerData.filter(c => c.InternetService === srv);
                    const total = seg.length;
                    const churned = seg.filter(c => c.Churn === "Yes").length;
                    const rate = total > 0 ? (churned / total) * 100 : 0;
                    const avgCharges = total > 0 ? seg.reduce((s, c) => s + parseFloat(c.MonthlyCharges), 0) / total : 0;
                    return [srv, total, churned, `${rate.toFixed(2)}%`, `$${avgCharges.toFixed(2)}`];
                });
                results.sort((a, b) => parseFloat(b[3]) - parseFloat(a[3]));
                return {
                    headers: ["InternetService", "total_customers", "churned_customers", "churn_rate_pct", "avg_monthly_charges"],
                    rows: results
                };
            }
        },
        "q-tenure": {
            sql: `-- Churn Rate by Tenure Cohort
WITH tenure_buckets AS (
    SELECT 
        customerID,
        Churn,
        CASE 
            WHEN tenure = 0 THEN '0 Months (New)'
            WHEN tenure <= 6 THEN '1 - 6 Months'
            WHEN tenure <= 12 THEN '7 - 12 Months'
            WHEN tenure <= 24 THEN '13 - 24 Months'
            WHEN tenure <= 48 THEN '25 - 48 Months'
            ELSE 'Over 4 Years (49+ Months)'
        END as tenure_cohort
    FROM customers
)
SELECT 
    tenure_cohort,
    COUNT(customerID) as total_customers,
    SUM(CASE WHEN Churn = 'Yes' THEN 1 ELSE 0 END) as churned_customers,
    ROUND((SUM(CASE WHEN Churn = 'Yes' THEN 1.0 ELSE 0.0 END) / COUNT(customerID)) * 100.0, 2) as churn_rate_pct
FROM tenure_buckets
GROUP BY tenure_cohort
ORDER BY tenure_cohort;`,
            execute: () => {
                const cohorts = [
                    { label: '0 Months (New)', filter: c => c.tenure === 0 },
                    { label: '1 - 6 Months', filter: c => c.tenure > 0 && c.tenure <= 6 },
                    { label: '7 - 12 Months', filter: c => c.tenure > 6 && c.tenure <= 12 },
                    { label: '13 - 24 Months', filter: c => c.tenure > 12 && c.tenure <= 24 },
                    { label: '25 - 48 Months', filter: c => c.tenure > 24 && c.tenure <= 48 },
                    { label: 'Over 4 Years (49+ Months)', filter: c => c.tenure > 48 }
                ];
                
                const results = cohorts.map(coh => {
                    const seg = window.cleanedCustomerData.filter(coh.filter);
                    const total = seg.length;
                    const churned = seg.filter(c => c.Churn === "Yes").length;
                    const rate = total > 0 ? (churned / total) * 100 : 0;
                    return [coh.label, total, churned, `${rate.toFixed(2)}%`];
                });
                
                return {
                    headers: ["tenure_cohort", "total_customers", "churned_customers", "churn_rate_pct"],
                    rows: results
                };
            }
        },
        "q-mrr": {
            sql: `-- Revenue Risk & Lost Charges by Status
SELECT 
    Churn,
    COUNT(customerID) as customer_count,
    ROUND(SUM(MonthlyCharges), 2) as monthly_revenue,
    ROUND(SUM(TotalCharges), 2) as total_revenue_collected,
    ROUND(AVG(MonthlyCharges), 2) as avg_monthly_bill
FROM customers
GROUP BY Churn;`,
            execute: () => {
                const statuses = ["No", "Yes"];
                const results = statuses.map(status => {
                    const seg = window.cleanedCustomerData.filter(c => c.Churn === status);
                    const count = seg.length;
                    const mrr = seg.reduce((s, c) => s + parseFloat(c.MonthlyCharges), 0);
                    const totalCollected = seg.reduce((s, c) => s + parseFloat(c.TotalCharges), 0);
                    const avgMonthly = count > 0 ? mrr / count : 0;
                    
                    return [
                        status === "Yes" ? "Yes (Churned)" : "No (Active)",
                        count.toLocaleString(),
                        `$${mrr.toFixed(2)}`,
                        `$${totalCollected.toFixed(2)}`,
                        `$${avgMonthly.toFixed(2)}`
                    ];
                });
                return {
                    headers: ["Churn", "customer_count", "monthly_revenue", "total_revenue_collected", "avg_monthly_bill"],
                    rows: results
                };
            }
        },
        "q-highrisk": {
            sql: `-- Top 10 High-Risk Active Customers
SELECT 
    customerID,
    gender,
    tenure,
    Contract,
    InternetService,
    TechSupport,
    MonthlyCharges,
    TotalCharges
FROM customers
WHERE 
    Churn = 'No' 
    AND Contract = 'Month-to-month'
    AND TechSupport = 'No'
    AND tenure <= 12
ORDER BY MonthlyCharges DESC, tenure ASC
LIMIT 10;`,
            execute: () => {
                // Filter active, Month-to-month, TechSupport='No', tenure <= 12
                const risks = window.cleanedCustomerData.filter(c => {
                    return c.Churn === "No" && 
                           c.Contract === "Month-to-month" && 
                           c.TechSupport === "No" && 
                           c.tenure <= 12;
                });
                
                // Sort by MonthlyCharges desc, then tenure asc
                risks.sort((a, b) => {
                    const chargeDiff = parseFloat(b.MonthlyCharges) - parseFloat(a.MonthlyCharges);
                    if (chargeDiff !== 0) return chargeDiff;
                    return a.tenure - b.tenure;
                });
                
                const top10 = risks.slice(0, 10).map(c => {
                    return [
                        c.customerID,
                        c.gender,
                        `${c.tenure} mos`,
                        c.Contract,
                        c.InternetService,
                        c.TechSupport,
                        `$${parseFloat(c.MonthlyCharges).toFixed(2)}`,
                        `$${parseFloat(c.TotalCharges).toFixed(2)}`
                    ];
                });
                
                return {
                    headers: ["customerID", "gender", "tenure", "Contract", "InternetService", "TechSupport", "MonthlyCharges", "TotalCharges"],
                    rows: top10
                };
            }
        }
    };
    
    function setupSQLPlayground() {
        sqlCodeViewer.textContent = sqlQueries[selectedQueryKey].sql;
        
        // Reset query output state
        sqlResultHead.innerHTML = "";
        sqlResultBody.innerHTML = `<tr><td colspan="4" class="table-placeholder">Click "Run Query" to execute the selected template.</td></tr>`;
        sqlSpeedDisplay.textContent = "Execution Time: 0ms";
    }
    
    // Add click listeners to query list items
    const queryItems = document.querySelectorAll(".sql-query-item");
    queryItems.forEach(item => {
        item.addEventListener("click", () => {
            queryItems.forEach(qi => qi.classList.remove("active"));
            item.classList.add("active");
            
            selectedQueryKey = item.getAttribute("data-query");
            setupSQLPlayground();
        });
    });
    
    btnRunQuery.addEventListener("click", () => {
        // Measure execution speed (simulated 3-8ms postgres fetch)
        const t0 = performance.now();
        const output = sqlQueries[selectedQueryKey].execute();
        const t1 = performance.now();
        const diffTime = (t1 - t0 + Math.random() * 5).toFixed(1);
        
        sqlSpeedDisplay.textContent = `Execution Time: ${diffTime}ms`;
        
        // Render headers
        sqlResultHead.innerHTML = "";
        const trHead = document.createElement("tr");
        output.headers.forEach(h => {
            const th = document.createElement("th");
            th.textContent = h;
            trHead.appendChild(th);
        });
        sqlResultHead.appendChild(trHead);
        
        // Render rows
        sqlResultBody.innerHTML = "";
        if (output.rows.length === 0) {
            sqlResultBody.innerHTML = `<tr><td colspan="${output.headers.length}" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">0 rows returned.</td></tr>`;
            return;
        }
        
        output.rows.forEach(row => {
            const tr = document.createElement("tr");
            row.forEach(val => {
                const td = document.createElement("td");
                td.textContent = val;
                tr.appendChild(td);
            });
            sqlResultBody.appendChild(tr);
        });
    });

    // -------------------------------------------------------------
    // 8. Retention Insights Page Calculations
    // -------------------------------------------------------------
    const gaugeFill = document.getElementById("insight-gauge-fill");
    const gaugeValLabel = document.getElementById("insight-gauge-val");
    const riskLevelLabel = document.getElementById("insight-risk-level");
    const riskText = document.getElementById("insight-risk-text");
    const segmentSizeLabel = document.getElementById("insight-segment-size");
    const segmentRevenueLabel = document.getElementById("insight-segment-revenue");
    const projectedLossLabel = document.getElementById("insight-projected-loss");
    const campaignsContainer = document.getElementById("campaigns-list-container");
    
    // Simulator Sliders
    const simTakeRate = document.getElementById("sim-take-rate");
    const simSuccessRate = document.getElementById("sim-success-rate");
    const simTakeVal = document.getElementById("sim-take-rate-val");
    const simSuccessVal = document.getElementById("sim-success-rate-val");
    
    const simRecoveredMRR = document.getElementById("sim-recovered-mrr");
    const simRecoveredARR = document.getElementById("sim-recovered-arr");
    const simNewChurn = document.getElementById("sim-new-churn");
    
    function updateInsightsPage() {
        const total = filteredData.length;
        const active = filteredData.filter(c => c.Churn === "No").length;
        const churned = total - active;
        const churnRate = total > 0 ? (churned / total) * 100 : 0;
        
        const mrr = filteredData
            .filter(c => c.Churn === "No")
            .reduce((sum, c) => sum + parseFloat(c.MonthlyCharges), 0);
            
        const revLoss = filteredData
            .filter(c => c.Churn === "Yes")
            .reduce((sum, c) => sum + parseFloat(c.MonthlyCharges), 0);
            
        // Render texts
        segmentSizeLabel.textContent = `${total.toLocaleString()} Customers`;
        segmentRevenueLabel.textContent = `$${Math.round(mrr).toLocaleString()}/mo`;
        projectedLossLabel.textContent = `$${Math.round(revLoss * 12).toLocaleString()}/yr`;
        
        // Gauge Update: rotate from 0deg (0%) to 180deg (100%)
        const rotateVal = Math.min(180, churnRate * 1.8);
        gaugeFill.style.transform = `rotate(${rotateVal}deg)`;
        gaugeValLabel.textContent = `${churnRate.toFixed(1)}%`;
        
        // Dynamic Risk level Text
        if (churnRate > 35) {
            riskLevelLabel.textContent = "HIGH RISK SEGMENT";
            riskLevelLabel.style.color = "var(--color-danger)";
            gaugeFill.style.borderColor = "var(--color-danger) var(--color-danger) transparent transparent";
            riskText.textContent = "Urgent attention required. Churn rate exceeds the critical 35% threshold. Implement proactive loyalty outreach immediately.";
        } else if (churnRate > 15) {
            riskLevelLabel.textContent = "MEDIUM RISK SEGMENT";
            riskLevelLabel.style.color = "var(--color-warning)";
            gaugeFill.style.borderColor = "var(--color-warning) var(--color-warning) transparent transparent";
            riskText.textContent = "Standard operational risk. Churn rate is within the industry benchmark. Target specific sub-cohorts with standard promos.";
        } else {
            riskLevelLabel.textContent = "LOW RISK SEGMENT";
            riskLevelLabel.style.color = "var(--color-success)";
            gaugeFill.style.borderColor = "var(--color-success) var(--color-success) transparent transparent";
            riskText.textContent = "High retention segment. Customers are stable. Leverage cross-selling and up-selling opportunities to increase ARPU.";
        }
        
        // Load Segment-Specific Campaigns
        loadCampaigns(churnRate);
        
        // Update Simulator Values
        runSimulator();
    }
    
    function loadCampaigns(churnRate) {
        campaignsContainer.innerHTML = "";
        
        const campaigns = [];
        
        // Add campaigns based on churn profile or active filters
        if (filterContract.value === "Month-to-month" || filterContract.value === "all") {
            campaigns.push({
                icon: "fa-solid fa-file-contract contract-icon",
                title: "Month-to-Month Contract Transition Campaign",
                desc: "Target month-to-month contracts with a promotion to upgrade to a 1-year or 2-year contract by offering a $10/month loyalty discount.",
                cost: "$10/mo credit",
                saving: "Est. 12-month value retention: $450/customer"
            });
        }
        
        if (filterInternet.value === "Fiber optic" || filterInternet.value === "all") {
            campaigns.push({
                icon: "fa-solid fa-wifi",
                title: "Fiber Optic TechSupport Bundling",
                desc: "High churn detected on Fiber lines due to billing friction. Bundle Free TechSupport service for 6 months to reduce technical churn triggers.",
                cost: "$0 base cost (support resource allocation)",
                saving: "Est. Churn Reduction: 12% in Fiber cohort"
            });
        }
        
        if (filterPayment.value === "Electronic check" || filterPayment.value === "all") {
            campaigns.push({
                icon: "fa-solid fa-credit-card",
                title: "Auto-Pay Migration Incentive",
                desc: "Electronic Check billing exhibits a high friction failure. Offer a one-time $15 statement credit for enrolling in Auto-Pay via Bank Transfer or Credit Card.",
                cost: "$15 one-time payout",
                saving: "Payback Period: 2.1 Months. Permanent churn reduction."
            });
        }
        
        // Fallback generic campaign if filters are narrow
        if (campaigns.length === 0) {
            campaigns.push({
                icon: "fa-solid fa-gift",
                title: "High-LTV Retention Premium Support",
                desc: "High-value users with short tenures. Offer VIP tech support and a custom streaming service voucher.",
                cost: "$5/mo cost",
                saving: "Saves high-value accounts from competitive poaching."
            });
        }
        
        campaigns.forEach(c => {
            const card = document.createElement("div");
            card.className = "campaign-card";
            card.innerHTML = `
                <div class="campaign-icon">
                    <i class="${c.icon}"></i>
                </div>
                <div class="campaign-details">
                    <h4>${c.title}</h4>
                    <p>${c.desc}</p>
                    <div class="campaign-meta">
                        <span class="text-danger"><i class="fa-solid fa-hand-holding-dollar"></i> Cost: ${c.cost}</span>
                        <span class="text-success"><i class="fa-solid fa-shield-heart"></i> Value: ${c.saving}</span>
                    </div>
                </div>
            `;
            campaignsContainer.appendChild(card);
        });
    }
    
    function runSimulator() {
        const takeRate = parseInt(simTakeRate.value) / 100;
        const successRate = parseInt(simSuccessRate.value) / 100;
        
        simTakeVal.textContent = `${simTakeRate.value}%`;
        simSuccessVal.textContent = `${simSuccessRate.value}%`;
        
        const total = filteredData.length;
        const active = filteredData.filter(c => c.Churn === "No").length;
        const churned = total - active;
        const originalChurnRate = total > 0 ? (churned / total) * 100 : 0;
        
        // Calculate revenue at risk (Monthly charges of churned customers)
        const revRisk = filteredData
            .filter(c => c.Churn === "Yes")
            .reduce((sum, c) => sum + parseFloat(c.MonthlyCharges), 0);
            
        // Recovered MRR = Revenue at Risk * Take Rate * Success Rate
        const recoveredMRR = revRisk * takeRate * successRate;
        const recoveredARR = recoveredMRR * 12;
        
        // New Churn count = original churned - (original churned * take rate * success rate)
        const newChurnedCount = churned - (churned * takeRate * successRate);
        const newChurnRate = total > 0 ? (newChurnedCount / total) * 100 : 0;
        
        // Render
        simRecoveredMRR.textContent = `$${Math.round(recoveredMRR).toLocaleString()}`;
        simRecoveredARR.textContent = `$${Math.round(recoveredARR).toLocaleString()}`;
        simNewChurn.textContent = `${newChurnRate.toFixed(1)}%`;
    }
    
    [simTakeRate, simSuccessRate].forEach(slider => {
        slider.addEventListener("input", runSimulator);
    });

    // -------------------------------------------------------------
    // 9. Startup Initialization
    // -------------------------------------------------------------
    function updateDashboard() {
        updateKPIs();
        renderContractChurnChart();
        renderInternetChurnChart();
        renderTenureChurnChart();
        
        // Reset and rebuild the data table view
        currentPage = 1;
        filterTableData();
    }
    
    // First run
    updateDashboard();
});
