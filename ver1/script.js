// --- App State & Config ---
const firebaseConfig = {
    databaseURL: "https://patient-health-monitor-20846-default-rtdb.firebaseio.com"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const users = {
    'patient@demo.com': { password: '123456', name: 'Mr. Kumar', role: 'patient' },
    'doctor@demo.com': { password: '123456', name: 'Dr. Tamil', role: 'doctor' }
};
let currentUser = null;
let vitalsChartInstance = null;
let reportChartInstance = null;

// --- DOM Elements ---
const loginSection = document.getElementById('loginSection');
const dashboard = document.getElementById('dashboard');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');
const mainNav = document.getElementById('mainNav');
const mobileNav = document.getElementById('mobileNav');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mainContent = document.getElementById('mainContent');
const notificationModal = document.getElementById('notificationModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');

// --- Navigation ---
const routes = {
    doctor: [
        { name: 'Dashboard', icon: 'home' },
        { name: 'Patients', icon: 'users' },
        { name: 'Reports', icon: 'file-text' }
    ],
    patient: [
        { name: 'Dashboard', icon: 'home' },
        { name: 'Reports', icon: 'file-text' }
    ]
};

mobileMenuBtn.addEventListener('click', () => {
    mobileNav.classList.toggle('hidden');
});

function setupNavigation(role) {
    mainNav.innerHTML = '';
    mobileNav.innerHTML = '';
    const navLinks = routes[role];
    navLinks.forEach((link, index) => {
        // Desktop nav link
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = link.name;
        a.className = 'nav-link py-2 px-3 font-medium text-slate-600';
        if (index === 0) a.classList.add('active');
        a.addEventListener('click', (e) => handleNavClick(e, a, link.name));
        mainNav.appendChild(a);

        // Mobile nav link
        const mobileA = document.createElement('a');
        mobileA.href = '#';
        mobileA.textContent = link.name;
        mobileA.className = 'mobile-nav-link text-slate-700';
        if (index === 0) mobileA.classList.add('active');
        mobileA.addEventListener('click', (e) => handleNavClick(e, mobileA, link.name));
        mobileNav.appendChild(mobileA);
    });
    navigate(navLinks[0].name);
}

function handleNavClick(event, element, pageName) {
    event.preventDefault();
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(el => el.classList.remove('active'));
    
    // Add active class to all corresponding links (desktop and mobile)
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(el => {
        if (el.textContent === pageName) {
            el.classList.add('active');
        }
    });

    mobileNav.classList.add('hidden'); // Hide mobile nav on click
    navigate(pageName);
}

function navigate(page) {
    if (vitalsChartInstance) vitalsChartInstance.destroy();
    if (reportChartInstance) reportChartInstance.destroy();

    if (currentUser.role === 'doctor') {
        switch (page) {
            case 'Dashboard': renderDoctorDashboard(); break;
            case 'Patients': renderPatientList(); break;
            case 'Reports': renderDoctorReportPatientSelection(); break;
        }
    } else if (currentUser.role === 'patient') {
        switch (page) {
            case 'Dashboard': renderPatientDashboard(); break;
            case 'Reports': renderPatientReportView(currentUser.name.replace('Mr. ', '')); break;
        }
    }
}

// --- Authentication ---
loginBtn.addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const isDoctor = document.getElementById('doctorLogin').checked;
    const role = isDoctor ? 'doctor' : 'patient';
    
    if (!email || !password) {
        showNotification('Error', 'Please enter both email and password.');
        return;
    }
    
    if (users[email] && users[email].password === password && users[email].role === role) {
        currentUser = users[email];
        loginSection.classList.add('hidden');
        dashboard.classList.remove('hidden');
        userName.textContent = currentUser.name;
        setupNavigation(currentUser.role);
    } else {
        showNotification('Login Failed', 'Invalid credentials or role selection. Please try again.');
    }
});

logoutBtn.addEventListener('click', () => {
    currentUser = null;
    dashboard.classList.add('hidden');
    loginSection.classList.remove('hidden');
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    document.getElementById('doctorLogin').checked = false;
    if(vitalsChartInstance) vitalsChartInstance.destroy();
    if(reportChartInstance) reportChartInstance.destroy();
});

// --- AI Simulation Functions ---
function predictDischargeDate(patientData) {
    const dates = Object.keys(patientData).sort();
    if (dates.length === 0) return "Evaluation needed";
    
    const latestDateData = patientData[dates[dates.length-1]];
    const times = Object.keys(latestDateData).sort();
    if (times.length < 3) return "Monitoring";
    
    const recentReadings = times.slice(-3).map(t => latestDateData[t]);
    
    const avgBpm = recentReadings.reduce((sum, r) => sum + r.bpm, 0) / recentReadings.length;
    const avgSpo2 = recentReadings.reduce((sum, r) => sum + r.spo2, 0) / recentReadings.length;

    const isStable = avgBpm > 60 && avgBpm < 100 && avgSpo2 > 95;
    const trendImproving = recentReadings[2].bpm <= recentReadings[0].bpm && recentReadings[2].spo2 >= recentReadings[0].spo2;

    let daysToAdd = 7;
    if (isStable && trendImproving) daysToAdd = 3;
    else if (isStable) daysToAdd = 5;
    else if (!isStable && !trendImproving) daysToAdd = 10;
    
    const dischargeDate = new Date();
    dischargeDate.setDate(dischargeDate.getDate() + daysToAdd);
    return dischargeDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function getAIRecommendation(patientData) {
    const dates = Object.keys(patientData).sort();
    if (!dates.length) return { text: "No data available for recommendations.", color: 'slate' };
    
    const latestDate = dates[dates.length - 1];
    const times = Object.keys(patientData[latestDate]).sort();
    const latestReading = patientData[latestDate][times[times.length - 1]];

    const { bpm, spo2, temp } = latestReading;
    
    if (bpm > 100) return { text: "Heart rate is elevated. Recommend rest, hydration, and deep breathing exercises. Avoid caffeine.", color: 'yellow' };
    if (spo2 < 95) return { text: "Oxygen saturation is slightly low. Encourage sitting upright and practicing calm, deep breaths. Monitor closely.", color: 'yellow' };
    if (temp > 37.5) return { text: "Body temperature is slightly high. Ensure adequate fluid intake and rest. Consider a tepid sponge bath if uncomfortable.", color: 'yellow' };
    if (bpm < 60) return { text: "Heart rate is low. Please monitor for symptoms like dizziness or fatigue and report if they occur.", color: 'blue' };

    return { text: "Vitals are stable. A balanced, low-sodium diet with lean protein and vegetables is recommended. Continue to stay hydrated and rest.", color: 'green' };
}

// --- Doctor Views ---
function renderDoctorDashboard() {
    mainContent.innerHTML = `
        <h2 class="text-2xl md:text-3xl font-bold text-slate-800 mb-6">At a Glance</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" id="doctorStats">
            <div class="bg-white rounded-xl shadow-lg p-6 text-center text-slate-500">Loading stats...</div>
        </div>
        <div class="bg-white rounded-xl shadow-lg">
             <div class="px-6 py-4 border-b border-slate-200">
                <h3 class="text-lg font-semibold text-slate-800">High Priority Patients</h3>
            </div>
            <div class="custom-scrollbar divide-y divide-slate-100" id="highPriorityList">
                <div class="px-6 py-4 text-center text-slate-500">Loading patient data...</div>
            </div>
        </div>
    `;
    loadDoctorStats();
}

function renderPatientList() {
    mainContent.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg">
            <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 class="text-lg font-semibold text-slate-800">All Active Patients</h3>
            </div>
            <div class="custom-scrollbar max-h-[60vh] overflow-y-auto divide-y divide-slate-100" id="patientList">
                 <div class="px-6 py-4 text-center text-slate-500">Loading patient list...</div>
            </div>
        </div>
    `;
    loadPatientList();
}

function loadDoctorStats() {
    const patientsRef = database.ref('patients');
    patientsRef.once('value', (snapshot) => {
        const patients = snapshot.val() || {};
        const patientNames = Object.keys(patients);
        let stable = 0, needsAttention = 0, critical = 0;
        
        patientNames.forEach(name => {
            const dates = Object.keys(patients[name]).sort();
            if (!dates.length) return;
            const lastReading = patients[name][dates.at(-1)][Object.keys(patients[name][dates.at(-1)]).sort().at(-1)];
            if (lastReading.spo2 < 94 || lastReading.bpm > 110) critical++;
            else if (lastReading.spo2 < 96 || lastReading.bpm > 100) needsAttention++;
            else stable++;
        });

        document.getElementById('doctorStats').innerHTML = `
            ${createStatCard('Total Patients', patientNames.length, 'users', 'blue')}
            ${createStatCard('Stable', stable, 'check-circle', 'green')}
            ${createStatCard('Needs Attention', needsAttention, 'alert-triangle', 'yellow')}
            ${createStatCard('Critical', critical, 'alert-octagon', 'red')}
        `;
        feather.replace();
        loadHighPriorityList(patients);
    });
}

function loadHighPriorityList(allPatientsData) {
    const highPriorityList = document.getElementById('highPriorityList');
    highPriorityList.innerHTML = '';
    const criticalPatients = Object.entries(allPatientsData).filter(([name, data]) => {
         const dates = Object.keys(data).sort();
         if (!dates.length) return false;
         const lastReading = data[dates.at(-1)][Object.keys(data[dates.at(-1)]).sort().at(-1)];
         return lastReading.spo2 < 94 || lastReading.bpm > 110;
    });

    if (criticalPatients.length > 0) {
         criticalPatients.forEach(([name, data]) => {
            highPriorityList.appendChild(createPatientListItem(name, data));
        });
    } else {
         highPriorityList.innerHTML = '<div class="px-6 py-4 text-center text-slate-500">No patients in critical condition.</div>';
    }
    feather.replace();
}

function loadPatientList() {
    const patientList = document.getElementById('patientList');
    const patientsRef = database.ref('patients');
    patientsRef.once('value', (snapshot) => {
        const patients = snapshot.val();
        patientList.innerHTML = '';
        
        if (patients) {
            const uniquePatientNames = [...new Set(Object.keys(patients))]; 
            uniquePatientNames.forEach(patientName => {
                patientList.appendChild(createPatientListItem(patientName, patients[patientName]));
            });
        } else {
            patientList.innerHTML = '<div class="px-6 py-4 text-center text-slate-500">No patient data available</div>';
        }
        feather.replace();
    });
}

function createPatientListItem(name, data) {
    const discharge = predictDischargeDate(data);
    const dates = Object.keys(data).sort();
    const lastDate = dates.at(-1) || "N/A";
    const lastReadingTime = lastDate !== "N/A" ? Object.keys(data[lastDate]).sort().at(-1) || "" : "";
    const lastReading = lastDate !== "N/A" && lastReadingTime ? data[lastDate][lastReadingTime] : { bpm: 'N/A', spo2: 'N/A', temp: 'N/A' };

    const element = document.createElement('div');
    element.className = 'px-6 py-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center hover:bg-slate-50 transition';
    element.innerHTML = `
        <div class="flex items-center col-span-1 md:col-span-1">
            <div class="bg-blue-100 rounded-full p-3 mr-4 flex-shrink-0">
                <i data-feather="user" class="w-6 h-6 text-blue-600"></i>
            </div>
            <div>
                <p class="font-semibold text-slate-800">${name}</p>
                <p class="text-sm text-slate-500">Last update: ${lastDate} ${lastReadingTime}</p>
            </div>
        </div>
        <div class="text-sm text-left md:text-center">
            <p class="font-medium text-slate-600">HR: <span class="text-slate-900 font-bold">${lastReading.bpm}</span> bpm</p>
            <p class="font-medium text-slate-600">SpO₂: <span class="text-slate-900 font-bold">${lastReading.spo2}</span>%</p>
            <p class="font-medium text-slate-600">Temp: <span class="text-slate-900 font-bold">${lastReading.temp}</span>°C</p>
        </div>
        <div class="text-sm text-left md:text-center">
            <p class="font-medium text-slate-600">AI Discharge Prediction</p>
            <p class="text-md font-bold text-blue-600">${discharge}</p>
        </div>
        <div class="flex justify-start md:justify-end items-center">
             <button class="bg-blue-500 w-full md:w-auto text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition" onclick="viewPatientReport('${name}')">View Details</button>
        </div>
    `;
    return element;
}

function viewPatientReport(patientName) {
    handleNavClick({ preventDefault: () => {} }, null, 'Reports');
    renderPatientReportView(patientName);
}

// --- Patient Dashboard View ---
function renderPatientDashboard() {
    mainContent.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div>
                <h2 class="text-2xl md:text-3xl font-bold text-slate-800">Your Health Dashboard</h2>
                <p class="text-slate-600 mt-1">Hello, ${currentUser.name}</p>
            </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div class="lg:col-span-2 bg-white rounded-xl shadow-lg p-4 sm:p-6 health-card">
                <h3 class="text-lg font-semibold text-slate-800 mb-4">Vitals Trend (Latest Day)</h3>
                <div class="h-80"><canvas id="patientVitalsChart"></canvas></div>
            </div>
            <div class="space-y-6">
                <div class="bg-white rounded-xl shadow-lg p-6 health-card">
                    <h3 class="text-lg font-semibold text-slate-800 mb-4">Current Vitals</h3>
                    <div class="space-y-4">
                        ${createVitalStat('Heart Rate', 'currentBPM', 'BPM', 'heart', 'red')}
                        ${createVitalStat('Blood Oxygen', 'currentSpO2', '%', 'wind', 'blue')}
                        ${createVitalStat('Temperature', 'currentTemp', '°C', 'thermometer', 'green')}
                    </div>
                </div>
                <div class="bg-white rounded-xl shadow-lg p-6 health-card">
                    <h3 class="text-lg font-semibold text-slate-800 mb-4">AI Health Recommendation</h3>
                    <div id="aiRecommendation" class="rounded-lg p-4"></div>
                </div>
            </div>
        </div>`;
    loadPatientDashboardData();
    feather.replace();
}

function loadPatientDashboardData() {
    const patientName = currentUser.name.replace('Mr. ', '');
    const patientRef = database.ref('patients/' + patientName);
    patientRef.on('value', (snapshot) => {
        const patientData = snapshot.val();
        if (patientData) {
            const dates = Object.keys(patientData).sort();
            const latestDate = dates.at(-1);
            const dailyReadings = patientData[latestDate];
            const times = Object.keys(dailyReadings).sort();
            const latestReading = dailyReadings[times.at(-1)];
            
            document.getElementById('currentBPM').textContent = latestReading.bpm;
            document.getElementById('currentSpO2').textContent = latestReading.spo2;
            document.getElementById('currentTemp').textContent = latestReading.temp;
            
            const recommendation = getAIRecommendation(patientData);
            const recElement = document.getElementById('aiRecommendation');
            const colorClasses = { green: 'bg-green-100 text-green-800', yellow: 'bg-yellow-100 text-yellow-800', blue: 'bg-blue-100 text-blue-800', slate: 'bg-slate-100 text-slate-800' };
            recElement.className = `rounded-lg p-4 text-sm sm:text-base ${colorClasses[recommendation.color]}`;
            recElement.textContent = recommendation.text;

            const chartData = {
                labels: times.map(t => t.substring(0, 5)),
                datasets: [
                    { label: 'Heart Rate (BPM)', data: times.map(t => dailyReadings[t].bpm), borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', yAxisID: 'y', tension: 0.4, fill: true },
                    { label: 'SpO2 (%)', data: times.map(t => dailyReadings[t].spo2), borderColor: '#22C55E', backgroundColor: 'rgba(34, 197, 94, 0.2)', yAxisID: 'y1', tension: 0.4, fill: true },
                ]
            };
            renderVitalsChart(chartData, 'patientVitalsChart');
        } else {
             mainContent.innerHTML = `<p class="text-center text-slate-500">No health data available.</p>`;
        }
    });
}

// --- Reports Views ---
function renderDoctorReportPatientSelection() {
    mainContent.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg">
            <div class="px-6 py-4 border-b border-slate-200">
                <h3 class="text-lg font-semibold text-slate-800">Select a Patient to View Reports</h3>
            </div>
            <div id="reportPatientList" class="divide-y divide-slate-100">
                 <div class="px-6 py-4 text-center text-slate-500">Loading patients...</div>
            </div>
        </div>
    `;
    const patientsRef = database.ref('patients');
    patientsRef.once('value', (snapshot) => {
        const patients = snapshot.val() || {};
        const patientListEl = document.getElementById('reportPatientList');
        patientListEl.innerHTML = '';
        Object.keys(patients).forEach(name => {
            const patientItem = document.createElement('div');
            patientItem.className = 'px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition';
            patientItem.innerHTML = `<p class="font-medium text-slate-700">${name}</p><i data-feather="chevron-right" class="text-slate-400"></i>`;
            patientItem.onclick = () => renderPatientReportView(name);
            patientListEl.appendChild(patientItem);
        });
        feather.replace();
    });
}

function renderPatientReportView(patientName) {
    mainContent.innerHTML = `
        <h2 class="text-2xl md:text-3xl font-bold text-slate-800 mb-2">Health Report: ${patientName}</h2>
        <p class="text-slate-500 mb-6">Select a date to view detailed insights.</p>
        <div class="flex flex-col lg:flex-row gap-8">
            <div class="w-full lg:w-1/4">
                <div class="bg-white rounded-xl shadow-lg p-4">
                     <h3 class="font-semibold text-slate-700 mb-3 border-b pb-3">Available Dates</h3>
                     <div id="date-list" class="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2"></div>
                </div>
            </div>
            <div id="report-content" class="w-full lg:w-3/4">
                <div class="bg-white rounded-xl shadow-lg p-8 text-center text-slate-500">
                    <p>Please select a date from the list to view the report.</p>
                </div>
            </div>
        </div>
    `;
    loadAndDisplayReportData(patientName);
}

function loadAndDisplayReportData(patientName) {
    const patientRef = database.ref('patients/' + patientName);
    patientRef.once('value', (snapshot) => {
        const patientData = snapshot.val();
        const dateListEl = document.getElementById('date-list');
        dateListEl.innerHTML = '';

        if (!patientData) {
            document.getElementById('report-content').innerHTML = '<div class="bg-white rounded-xl shadow-lg p-8 text-center text-slate-500"><p>No data available for this patient.</p></div>';
            return;
        }

        const dates = Object.keys(patientData).sort().reverse();
        dates.forEach((date, index) => {
            const dateBtn = document.createElement('button');
            dateBtn.textContent = new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
            dateBtn.className = 'w-full text-left px-4 py-2 rounded-lg date-selector-btn text-slate-600 hover:bg-slate-100 text-sm';
            if (index === 0) dateBtn.classList.add('active');
            
            dateBtn.onclick = () => {
                document.querySelectorAll('.date-selector-btn').forEach(btn => btn.classList.remove('active'));
                dateBtn.classList.add('active');
                displayDailyReport(patientData[date], date);
            };
            dateListEl.appendChild(dateBtn);
        });

        if (dates.length > 0) {
            displayDailyReport(patientData[dates[0]], dates[0]);
        } else {
             dateListEl.innerHTML = '<p class="text-slate-500 p-2">No records found.</p>';
        }
    });
}

function displayDailyReport(dayData, dateString) {
    const readings = Object.values(dayData);
    const times = Object.keys(dayData).sort();

    const bpms = readings.map(r => r.bpm);
    const spo2s = readings.map(r => r.spo2);
    const temps = readings.map(r => r.temp);

    const insights = {
        avgBpm: (bpms.reduce((a, b) => a + b, 0) / bpms.length).toFixed(1),
        minBpm: Math.min(...bpms),
        maxBpm: Math.max(...bpms),
        avgSpo2: (spo2s.reduce((a, b) => a + b, 0) / spo2s.length).toFixed(1),
        minSpo2: Math.min(...spo2s),
        maxSpo2: Math.max(...spo2s),
        avgTemp: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)
    };
    
    const reportContentEl = document.getElementById('report-content');
    reportContentEl.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 class="text-lg font-semibold text-slate-800 mb-4">Daily Summary: ${new Date(dateString).toDateString()}</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                    <p class="text-sm text-slate-500">Heart Rate (BPM)</p>
                    <p class="text-2xl font-bold text-slate-800">${insights.avgBpm}</p>
                    <p class="text-xs text-slate-500">Min: ${insights.minBpm} / Max: ${insights.maxBpm}</p>
                </div>
                 <div>
                    <p class="text-sm text-slate-500">Blood Oxygen (SpO₂)</p>
                    <p class="text-2xl font-bold text-slate-800">${insights.avgSpo2}%</p>
                    <p class="text-xs text-slate-500">Min: ${insights.minSpo2}% / Max: ${insights.maxSpo2}%</p>
                </div>
                 <div>
                    <p class="text-sm text-slate-500">Avg. Temperature</p>
                    <p class="text-2xl font-bold text-slate-800">${insights.avgTemp}°C</p>
                    <p class="text-xs text-slate-400">&nbsp;</p>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 class="text-lg font-semibold text-slate-800 mb-4">Daily Trend</h3>
            <div class="h-64"><canvas id="reportChart"></canvas></div>
        </div>
        <div class="bg-white rounded-xl shadow-lg">
            <h3 class="text-lg font-semibold text-slate-800 p-6 border-b">All Readings for ${new Date(dateString).toDateString()}</h3>
            <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-left min-w-[600px]">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="p-4 text-sm font-semibold text-slate-600">Time</th>
                            <th class="p-4 text-sm font-semibold text-slate-600">Heart Rate</th>
                            <th class="p-4 text-sm font-semibold text-slate-600">Blood Oxygen</th>
                            <th class="p-4 text-sm font-semibold text-slate-600">Temperature</th>
                        </tr>
                    </thead>
                    <tbody id="report-table-body" class="divide-y divide-slate-100"></tbody>
                </table>
            </div>
        </div>
    `;

    const reportTableBody = document.getElementById('report-table-body');
    times.forEach(time => {
        const reading = dayData[time];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-4 text-slate-700">${time}</td>
            <td class="p-4 text-slate-700">${reading.bpm} BPM</td>
            <td class="p-4 text-slate-700">${reading.spo2}%</td>
            <td class="p-4 text-slate-700">${reading.temp}°C</td>
        `;
        reportTableBody.appendChild(row);
    });
    
    const chartData = {
        labels: times.map(t => t.substring(0, 5)),
        datasets: [
            { label: 'Heart Rate (BPM)', data: bpms, borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', yAxisID: 'y', tension: 0.3, fill: true },
            { label: 'SpO2 (%)', data: spo2s, borderColor: '#22C55E', backgroundColor: 'rgba(34, 197, 94, 0.2)', yAxisID: 'y1', tension: 0.3, fill: true }
        ]
    };
    renderReportChart(chartData, 'reportChart');
}

// --- Charting ---
function renderVitalsChart(data, canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (vitalsChartInstance) vitalsChartInstance.destroy();
    vitalsChartInstance = new Chart(ctx, {
        type: 'line', data, options: {
            responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
            scales: {
                y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'BPM' }},
                y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'SpO2 (%)' }, grid: { drawOnChartArea: false }},
            }
        }
    });
}

 function renderReportChart(data, canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (reportChartInstance) reportChartInstance.destroy();
    reportChartInstance = new Chart(ctx, {
        type: 'line', data, options: {
            responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
            scales: {
                y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'BPM' }},
                y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'SpO2 (%)' }, grid: { drawOnChartArea: false }},
            }
        }
    });
}

// --- UI Helpers ---
function createStatCard(title, value, icon, color) {
    const colors = { blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', yellow: 'bg-yellow-100 text-yellow-600', red: 'bg-red-100 text-red-600' };
    return `<div class="bg-white rounded-xl shadow-lg p-6 health-card"><div class="flex items-center"><div class="rounded-full p-3 mr-4 ${colors[color]}"><i data-feather="${icon}" class="w-6 h-6"></i></div><div><p class="text-sm text-slate-500">${title}</p><p class="text-2xl font-bold text-slate-800">${value}</p></div></div></div>`;
}

function createVitalStat(label, id, unit, icon, color) {
    const colors = { red: 'bg-red-100 text-red-600', blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600' }
    return `<div class="flex items-center justify-between"><div class="flex items-center"><div class="rounded-full p-2 mr-3 ${colors[color]}"><i data-feather="${icon}" class="w-5 h-5"></i></div><p class="font-medium text-slate-600">${label}</p></div><p class="text-xl font-bold text-slate-800"><span id="${id}">--</span> ${unit}</p></div>`;
}

// --- Notifications ---
function showNotification(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    notificationModal.classList.remove('hidden');
}
closeModalBtn.addEventListener('click', () => notificationModal.classList.add('hidden'));

// --- Initialization ---
function init() {
    feather.replace();
     setTimeout(() => {
        if (currentUser && currentUser.role === 'patient') {
             showNotification('Medicine Reminder', 'Please take your BP tablet (Amlodipine 5mg) with water.');
        }
    }, 8000);
}
init();