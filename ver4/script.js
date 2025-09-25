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
        { name: 'Reports', icon: 'file-text' },
        { name: 'Settings', icon: 'settings' }
    ],
    patient: [
        { name: 'Dashboard', icon: 'home' },
        { name: 'Reports', icon: 'file-text' },
        { name: 'Nutrition', icon: 'leaf' },
        { name: 'Settings', icon: 'settings' }
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
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = link.name;
        a.className = 'nav-link py-2 px-3 font-medium text-slate-600';
        if (index === 0) a.classList.add('active');
        a.addEventListener('click', (e) => handleNavClick(e, a, link.name));
        mainNav.appendChild(a);

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
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(el => {
        if (el.textContent === pageName) {
            el.classList.add('active');
        }
    });
    mobileNav.classList.add('hidden');
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
            case 'Settings': renderDoctorSettings(); break;
        }
    } else if (currentUser.role === 'patient') {
        switch (page) {
            case 'Dashboard': renderPatientDashboard(); break;
            case 'Reports': renderPatientReportView(currentUser.name.replace('Mr. ', '').toLowerCase()); break;
            case 'Nutrition': renderNutritionView(); break;
            case 'Settings': renderPatientSettings(); break;
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
    if (vitalsChartInstance) vitalsChartInstance.destroy();
    if (reportChartInstance) reportChartInstance.destroy();
});

// --- AI Simulation Functions ---

function predictDischargeDate(patientData) {
    const dates = Object.keys(patientData).sort();
    if (dates.length === 0) return "Evaluation needed";

    const latestDateData = patientData[dates[dates.length - 1]];
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
    const allReadings = Object.keys(patientData)
        .filter(key => key !== 'feedback')
        .sort()
        .flatMap(date =>
            Object.keys(patientData[date])
            .sort()
            .map(time => ({ ...patientData[date][time], date, time }))
        );

    if (allReadings.length < 3) {
        return { text: "More data is needed for a comprehensive recommendation. Continue monitoring.", color: 'slate' };
    }

    const recentReadings = allReadings.slice(-12);
    const latestReading = recentReadings[recentReadings.length - 1];
    const avgBpm = recentReadings.reduce((sum, r) => sum + r.bpm, 0) / recentReadings.length;
    const avgSpo2 = recentReadings.reduce((sum, r) => sum + r.spo2, 0) / recentReadings.length;
		
		// --- Sleep Quality Estimation Formula ---
	// Helper function to calculate standard deviation for heart rate stability
	const getStandardDeviation = (array) => {
		const n = array.length;
		if (n === 0) return 0;
		const mean = array.reduce((a, b) => a + b) / n;
		return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
	};

	// Extract vitals from recent readings
	const bpms = recentReadings.map(r => r.bpm);
	const spo2s = recentReadings.map(r => r.spo2);
	const temps = recentReadings.map(r => r.temp);

	// 1. Calculate key metrics for the sleep period
	
	const stdDevBpm = getStandardDeviation(bpms); // Measures heart rate stability
	const minSpo2 = Math.min(...spo2s); // Checks for oxygen dips
	const avgTemp = temps.reduce((sum, val) => sum + val, 0) / temps.length;

	// 2. Start with a perfect score (10) and apply penalties
	let estimatedSleepScore = 10.0;

	// Penalty for high average heart rate (ideal sleep HR is lower)
	if (avgBpm > 70) {
		estimatedSleepScore -= Math.min(2.5, (avgBpm - 70) * 0.2);
	}

	// Penalty for heart rate instability (restlessness)
	if (stdDevBpm > 4) {
		estimatedSleepScore -= Math.min(2.0, (stdDevBpm - 4) * 0.5);
	}

	// Severe penalty for any blood oxygen dips
	if (minSpo2 < 95) {
		estimatedSleepScore -= Math.min(3.5, (95 - minSpo2) * 1.5);
	}

	// Penalty for high temperature (fever/illness disrupts sleep)
	if (avgTemp > 37.2) {
		estimatedSleepScore -= Math.min(2.0, (avgTemp - 37.2) * 2);
	}

// 3. Finalize the score and assign it to the variable the rest of the code uses
const avgSleepQuality = parseFloat(Math.max(1, Math.min(10, estimatedSleepScore)).toFixed(1));
// --- End of Estimation Formula ---
	
    if (latestReading.spo2 < 92) {
        return { text: "Critical: Oxygen saturation is very low. Immediate medical attention may be required. Focus on deep, controlled breathing.", color: 'red' };
    }
    if (avgBpm > 110) {
        return { text: "Attention: Heart rate has been consistently elevated. Avoid stimulants like caffeine, ensure proper hydration, and prioritize rest.", color: 'yellow' };
    }
    if (avgSleepQuality && avgSleepQuality < 5) {
        return { text: "Observation: Your recent sleep quality has been low. Poor sleep can affect recovery. Try to maintain a consistent sleep schedule and avoid screens before bed.", color: 'yellow' };
    }

    const isStable = latestReading.bpm > 60 && latestReading.bpm < 100 && latestReading.spo2 > 95;
    if (isStable) {
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek % 3 === 0) {
            return { text: "Rehab Focus: Vitals are stable. Let's work on breathing. Try 5 minutes of deep belly breathing to improve lung capacity.", color: 'blue' };
        } else if (dayOfWeek % 3 === 1) {
            return { text: "Rehab Focus: Your condition is stable. It's a good time for light activity. Try a slow, 5-minute walk indoors to promote circulation.", color: 'blue' };
        } else {
            return { text: "Rehab Focus: Vitals look good. Gentle movement is key. Try some simple seated leg raises (10 per leg) to maintain muscle tone.", color: 'blue' };
        }
    }

    if (avgSpo2 > 96 && avgBpm < 90) {
        return { text: "Positive Progress: Vitals are stable and in a healthy range. Your current care plan is effective. Keep up the great work!", color: 'green' };
    }

    return { text: "Vitals are stable. Continue to follow your care plan, stay hydrated, and get adequate rest.", color: 'green' };
}


function getGeminiFoodRecommendation(symptom) {
    const s = symptom.toLowerCase();
    let result = {
        title: "Recommendation",
        message: `Based on your query for "${symptom}", here are some food suggestions:`,
        foods: []
    };
    if (s.includes('fatigue') || s.includes('tired')) {
        result.title = "Foods to Boost Energy";
        result.message = "For fatigue, focus on iron-rich foods and complex carbohydrates for sustained energy.";
        result.foods = ["Spinach", "Lentils", "Oats", "Bananas", "Nuts and Seeds"];
    } else if (s.includes('fever')) {
        result.title = "Foods for Fever";
        result.message = "Focus on hydration and easy-to-digest, nutrient-rich foods to help your body recover.";
        result.foods = ["Clear Broths", "Herbal Tea", "Citrus Fruits", "Ginger", "Coconut Water"];
    } else if (s.includes('hypertension') || s.includes('high blood pressure')) {
        result.title = "Foods for Hypertension (DASH Diet)";
        result.message = "Focus on foods rich in potassium, calcium, and magnesium, while limiting sodium.";
        result.foods = ["Bananas", "Spinach", "Beets", "Oats", "Fatty Fish (Salmon)", "Seeds"];
    } else {
        result.title = "General Well-being";
        result.message = "For general health, a balanced diet is key. Here are some nutrient-dense foods:";
        result.foods = ["Leafy Greens", "Lean Protein (Chicken, Fish)", "Whole Grains", "Fruits", "Vegetables"];
    }
    return result;
}

// --- Email Alert Functions ---

function checkHeartRateAndTriggerAlert(patientData, patientName) {
    const allReadings = Object.values(patientData)
        .filter(val => typeof val === 'object')
        .flatMap(dailyData => Object.values(dailyData))
        .slice(-4);

    if (allReadings.length < 4) return;

    const highThreshold = 120;
    const lowThreshold = 55;
    const lastFourBPM = allReadings.map(r => r.bpm);
    const isConsistentlyHigh = lastFourBPM.every(bpm => bpm > highThreshold);
    const isConsistentlyLow = lastFourBPM.every(bpm => bpm < lowThreshold);
    const lastAlertKey = `alert_${patientName}`;

    if (isConsistentlyHigh) {
        const lastAlert = sessionStorage.getItem(lastAlertKey);
        if (lastAlert !== 'high') {
            sendEmailAlert(patientName, 'High Heart Rate', lastFourBPM);
            sessionStorage.setItem(lastAlertKey, 'high');
        }
    } else if (isConsistentlyLow) {
        const lastAlert = sessionStorage.getItem(lastAlertKey);
        if (lastAlert !== 'low') {
            sendEmailAlert(patientName, 'Low Heart Rate', lastFourBPM);
            sessionStorage.setItem(lastAlertKey, 'low');
        }
    } else {
        sessionStorage.removeItem(lastAlertKey);
    }
}


function sendEmailAlert(patientName, alertType, readings) {
    const doctorEmail = 'doctor@demo.com';
    const familyEmail = 'family@demo.com';
    const subject = `URGENT: Health Alert for Patient ${patientName}`;
    const body = `This is an automated alert from HealthTracker.\n\nPatient: ${patientName}\nAlert Type: ${alertType}\n\nThe last four heart rate readings were consistently critical:\nReadings: ${readings.join(' bpm, ')} bpm.\n\nPlease review the patient's dashboard immediately.`;

    console.warn("--- 📧 EMAIL ALERT SIMULATION 📧 ---");
    console.log(`To: ${doctorEmail}, ${familyEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.warn("--- END OF SIMULATION ---");

    showNotification('Critical Alert Triggered', `An email alert for "${alertType}" has been sent to the care team for patient ${patientName}.`);
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
    patientsRef.on('value', (snapshot) => {
        const patients = snapshot.val() || {};
        const patientNames = Object.keys(patients);
        let stable = 0,
            needsAttention = 0,
            critical = 0;

        patientNames.forEach(name => {
            const dates = Object.keys(patients[name]).filter(k => k !== 'feedback').sort();
            if (!dates.length) return;
            const lastDateData = patients[name][dates.at(-1)];
            const lastReading = lastDateData[Object.keys(lastDateData).sort().at(-1)];
            if (lastReading.spo2 < 94 || lastReading.bpm > 110) critical++;
            else if (lastReading.spo2 < 96 || lastReading.bpm > 100) needsAttention++;
            else stable++;
        });

        const statsEl = document.getElementById('doctorStats');
        if (statsEl) {
            statsEl.innerHTML = `
                ${createStatCard('Total Patients', patientNames.length, 'users', 'blue')}
                ${createStatCard('Stable', stable, 'check-circle', 'green')}
                ${createStatCard('Needs Attention', needsAttention, 'alert-triangle', 'yellow')}
                ${createStatCard('Critical', critical, 'alert-octagon', 'red')}
            `;
            feather.replace();
        }
        loadHighPriorityList(patients);
    });
}

function loadHighPriorityList(allPatientsData) {
    const highPriorityList = document.getElementById('highPriorityList');
    if (!highPriorityList) return;

    highPriorityList.innerHTML = '';
    const criticalPatients = Object.entries(allPatientsData).filter(([name, data]) => {
        const dates = Object.keys(data).filter(k => k !== 'feedback').sort();
        if (!dates.length) return false;
        const lastDateData = data[dates.at(-1)];
        const lastReading = lastDateData[Object.keys(lastDateData).sort().at(-1)];
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
    patientsRef.on('value', (snapshot) => {
        const patients = snapshot.val();
        if(!patientList) return;
        patientList.innerHTML = '';

        if (patients) {
            Object.entries(patients).forEach(([patientName, patientData]) => {
                patientList.appendChild(createPatientListItem(patientName, patientData));
            });
        } else {
            patientList.innerHTML = '<div class="px-6 py-4 text-center text-slate-500">No patient data available</div>';
        }
        feather.replace();
    });
}

function createPatientListItem(name, data) {
    const discharge = predictDischargeDate(data);
    const dates = Object.keys(data).filter(k => k !== 'feedback').sort();
    const lastDate = dates.at(-1) || "N/A";
    const lastReadingTime = lastDate !== "N/A" ? Object.keys(data[lastDate]).sort().at(-1) || "" : "";
    const lastReading = lastDate !== "N/A" && lastReadingTime ? data[lastDate][lastReadingTime] : { bpm: 'N/A', spo2: 'N/A', temp: 'N/A' };

    const hasUnreadFeedback = data.feedback ? Object.values(data.feedback).some(fb => !fb.read) : false;

    const element = document.createElement('div');
    element.className = 'px-6 py-4 grid grid-cols-12 gap-y-4 md:gap-x-4 items-center hover:bg-slate-50 transition';
    element.innerHTML = `
        <div class="col-span-12 md:col-span-3 flex items-center">
            <div class="bg-blue-100 rounded-full p-3 mr-4 flex-shrink-0">
                <i data-feather="user" class="w-6 h-6 text-blue-600"></i>
            </div>
            <div>
                <p class="font-semibold text-slate-800 capitalize flex items-center">
                    ${name}
                    ${hasUnreadFeedback ? `<span class="ml-2 w-3 h-3 bg-red-500 rounded-full" title="New feedback"></span>` : ''}
                </p>
                <p class="text-sm text-slate-500">Last update: ${lastDate} ${lastReadingTime}</p>
            </div>
        </div>
        <div class="col-span-12 md:col-span-3 text-left md:text-center">
            <p class="text-sm font-medium text-slate-600">HR: <span class="text-slate-900 font-bold">${lastReading.bpm}</span> bpm</p>
            <p class="text-sm font-medium text-slate-600">SpO₂: <span class="text-slate-900 font-bold">${lastReading.spo2}</span>%</p>
            <p class="text-sm font-medium text-slate-600">Temp: <span class="text-slate-900 font-bold">${lastReading.temp}</span>°C</p>
        </div>
        <div class="col-span-12 md:col-span-3 text-left md:text-center">
            <p class="text-sm font-medium text-slate-600">AI Discharge Prediction</p>
            <p class="text-md font-bold text-blue-600">${discharge}</p>
        </div>
        <div class="col-span-12 md:col-span-3 flex flex-wrap gap-2 md:justify-end items-center">
             ${data.feedback ? `<button class="feedback-btn bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-200 transition" data-patient="${name}"><i data-feather="message-square" class="w-4 h-4 mr-1 inline-block"></i> View Feedback</button>` : ''}
             <button class="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition" onclick="viewPatientReport('${name}')">Details</button>
             <button class="bg-slate-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition" onclick="generateInsuranceReport('${name}')">Prepare Claim</button>
        </div>
    `;

    if (data.feedback) {
        element.querySelector('.feedback-btn').addEventListener('click', (e) => {
            showPatientFeedback(e.currentTarget.dataset.patient);
        });
    }

    return element;
}


function viewPatientReport(patientName) {
    handleNavClick({ preventDefault: () => {} }, null, 'Reports');
    renderPatientReportView(patientName);
}

// --- Patient Views ---
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
            <div id="right-column" class="space-y-6">
                <div class="bg-white rounded-xl shadow-lg p-6 health-card">
                    <h3 class="text-lg font-semibold text-slate-800 mb-4">Current Vitals</h3>
                    <div id="vitals-list" class="space-y-4">
                        ${createVitalStat('Heart Rate', 'currentBPM', 'BPM', 'heart', 'red')}
                        ${createVitalStat('Blood Oxygen', 'currentSpO2', '%', 'wind', 'blue')}
                        ${createVitalStat('Temperature', 'currentTemp', '°C', 'thermometer', 'green')}
                    </div>
                </div>
                <div id="calorieGoalContainer"></div>
                <div class="bg-white rounded-xl shadow-lg p-6 health-card">
                    <h3 class="text-lg font-semibold text-slate-800 mb-4">AI Health Recommendation</h3>
                    <div id="aiRecommendation" class="rounded-lg p-4"></div>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-lg p-6 health-card">
             <h3 class="text-lg font-semibold text-slate-800 mb-2">Continuous Feedback</h3>
             <p class="text-sm text-slate-500 mb-4">Report any new symptoms or side-effects to your doctor in real-time.</p>
             <textarea id="feedbackText" class="w-full p-2 border rounded-lg" placeholder="e.g., I'm feeling a slight headache..."></textarea>
             <button id="submitFeedbackBtn" class="mt-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition">Submit Feedback</button>
        </div>
    `;

    document.getElementById('submitFeedbackBtn').addEventListener('click', () => {
        const patientName = currentUser.name.replace('Mr. ', '').toLowerCase();
        submitPatientFeedback(patientName);
    });

    loadPatientDashboardData();
    feather.replace();
}


function renderNutritionView() {
    mainContent.innerHTML = `
        <h2 class="text-2xl md:text-3xl font-bold text-slate-800 mb-6">AI Nutrition Guide</h2>
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 class="text-lg font-semibold text-slate-800 mb-4">Get Food Recommendations</h3>
            <p class="text-slate-600 mb-4">Enter a symptom or health goal (e.g., "hypertension", "cough", "weight loss") to get personalized food suggestions from our AI.</p>
            <div class="flex flex-col sm:flex-row gap-2">
                <input type="text" id="symptomInput" placeholder="e.g., tired, weak bones, better skin" class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                <button id="getFoodBtn" class="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">Get Suggestion</button>
            </div>
            <div id="foodResult" class="mt-6"></div>
        </div>
    `;

    document.getElementById('getFoodBtn').addEventListener('click', () => {
        const symptom = document.getElementById('symptomInput').value;
        const foodResultEl = document.getElementById('foodResult');
        if (!symptom) {
            foodResultEl.innerHTML = `<p class="text-red-600">Please enter a symptom or goal.</p>`;
            return;
        }

        const recommendation = getGeminiFoodRecommendation(symptom);
        foodResultEl.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="font-bold text-blue-800">${recommendation.title}</h4>
                <p class="text-blue-700 mb-3">${recommendation.message}</p>
                <div class="flex flex-wrap gap-2">
                    ${recommendation.foods.map(food => `<span class="bg-blue-200 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">${food}</span>`).join('')}
                </div>
            </div>
        `;
    });
}


function loadPatientDashboardData() {
    const patientName = currentUser.name.replace('Mr. ', '').toLowerCase();
    
    // Listener for health vitals
    const patientRef = database.ref('patients/' + patientName);
    patientRef.on('value', (snapshot) => {
        const patientData = snapshot.val();
        if (patientData) {
            checkHeartRateAndTriggerAlert(patientData, patientName);
            checkForDoctorReplies(patientData.feedback, patientName);

            const dates = Object.keys(patientData).filter(k => k !== 'feedback').sort();
            if (!dates.length) return; // No vitals data yet

            const latestDate = dates.at(-1);
            const dailyReadings = patientData[latestDate];
            const times = Object.keys(dailyReadings).sort();
            const latestReading = dailyReadings[times.at(-1)];

            document.getElementById('currentBPM').textContent = latestReading.bpm;
            document.getElementById('currentSpO2').textContent = latestReading.spo2;
            document.getElementById('currentTemp').textContent = latestReading.temp;

            const vitalsList = document.getElementById('vitals-list');
            if (latestReading.sleepQuality && !document.getElementById('currentSleep')) {
                const sleepStat = createVitalStat('Sleep Quality', 'currentSleep', '/ 10', 'moon', 'purple');
                vitalsList.insertAdjacentHTML('beforeend', sleepStat);
                feather.replace();
            }
            if (document.getElementById('currentSleep')) {
                document.getElementById('currentSleep').textContent = latestReading.sleepQuality || '--';
            }


            const recommendation = getAIRecommendation(patientData);
            const recElement = document.getElementById('aiRecommendation');
            const colorClasses = { green: 'bg-green-100 text-green-800', yellow: 'bg-yellow-100 text-yellow-800', blue: 'bg-blue-100 text-blue-800', slate: 'bg-slate-100 text-slate-800', red: 'bg-red-100 text-red-800' };
            recElement.className = `rounded-lg p-4 text-sm sm:text-base ${colorClasses[recommendation.color]}`;
            recElement.textContent = recommendation.text;

            const chartData = {
                labels: times.map(t => t.substring(0, 5)),
                datasets: [
                    { label: 'Heart Rate (BPM)', data: times.map(t => dailyReadings[t].bpm), borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', yAxisID: 'y', tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: '#EF4444' },
                    { label: 'SpO2 (%)', data: times.map(t => dailyReadings[t].spo2), borderColor: '#22C55E', backgroundColor: 'rgba(34, 197, 94, 0.1)', yAxisID: 'y1', tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: '#22C55E' },
                ]
            };
            renderVitalsChart(chartData, 'patientVitalsChart');
        } else {
            mainContent.innerHTML = `<p class="text-center text-slate-500">No health data available.</p>`;
        }
    });

    // Listener for user personal details to update calorie goal
    const userDetailsRef = database.ref('user_details/' + patientName);
    userDetailsRef.on('value', (snapshot) => {
        const userDetails = snapshot.val();
        const container = document.getElementById('calorieGoalContainer');
        if (!container) return;

        if (userDetails && userDetails.weight && userDetails.height && userDetails.age) {
            const bmr = calculateBMR(userDetails.gender, userDetails.weight, userDetails.height, userDetails.age);
            const dailyCalories = calculateDailyCalories(bmr, userDetails.activityLevel || 1.2);
            
            container.innerHTML = `
                 <div class="bg-white rounded-xl shadow-lg p-6 health-card">
                    <h3 class="text-lg font-semibold text-slate-800 mb-4">Daily Calorie Goal</h3>
                    <div class="text-center">
                        <p class="text-3xl font-bold text-blue-600">${dailyCalories}</p>
                        <p class="text-sm text-slate-500">calories/day</p>
                        <p class="text-xs text-slate-400 mt-2">BMR: ${bmr} | Activity: ${getActivityLevelName(userDetails.activityLevel)}</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                 <div class="bg-white rounded-xl shadow-lg p-6 health-card text-center">
                     <h3 class="text-lg font-semibold text-slate-800 mb-2">Daily Calorie Goal</h3>
                     <p class="text-sm text-slate-500">Please update your personal details in the <strong>Settings</strong> page to see your goal.</p>
                 </div>
            `;
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
            patientItem.innerHTML = `<p class="font-medium text-slate-700 capitalize">${name}</p><i data-feather="chevron-right" class="text-slate-400"></i>`;
            patientItem.onclick = () => renderPatientReportView(name);
            patientListEl.appendChild(patientItem);
        });
        feather.replace();
    });
}

function renderPatientReportView(patientName) {
    mainContent.innerHTML = `
        <div class="flex justify-between items-center mb-6">
             <h2 class="text-2xl md:text-3xl font-bold text-slate-800 capitalize">Health Report: ${patientName}</h2>
             ${currentUser.role === 'doctor' ? `<button id="handoverBtn" class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition">Generate Handover Summary</button>` : ''}
        </div>
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

    if (currentUser.role === 'doctor') {
        document.getElementById('handoverBtn').addEventListener('click', () => generateHandoverSummary(patientName));
    }

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

        const dates = Object.keys(patientData).filter(k => k !== 'feedback').sort().reverse();
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
    const sleepQualities = readings.map(r => r.sleepQuality).filter(Boolean);

    const insights = {
        avgBpm: (bpms.reduce((a, b) => a + b, 0) / bpms.length).toFixed(1),
        minBpm: Math.min(...bpms),
        maxBpm: Math.max(...bpms),
        avgSpo2: (spo2s.reduce((a, b) => a + b, 0) / spo2s.length).toFixed(1),
        minSpo2: Math.min(...spo2s),
        maxSpo2: Math.max(...spo2s),
        avgTemp: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
        avgSleep: sleepQualities.length > 0 ? (sleepQualities.reduce((a, b) => a + b, 0) / sleepQualities.length).toFixed(1) : '4'
    };

    const reportContentEl = document.getElementById('report-content');
    reportContentEl.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 class="text-lg font-semibold text-slate-800 mb-4">Daily Summary: ${new Date(dateString).toDateString()}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                <div><p class="text-sm text-slate-500">Heart Rate (BPM)</p><p class="text-2xl font-bold text-slate-800">${insights.avgBpm}</p><p class="text-xs text-slate-500">Min: ${insights.minBpm} / Max: ${insights.maxBpm}</p></div>
                 <div><p class="text-sm text-slate-500">Blood Oxygen (SpO₂)</p><p class="text-2xl font-bold text-slate-800">${insights.avgSpo2}%</p><p class="text-xs text-slate-500">Min: ${insights.minSpo2}% / Max: ${insights.maxSpo2}%</p></div>
                 <div><p class="text-sm text-slate-500">Avg. Temperature</p><p class="text-2xl font-bold text-slate-800">${insights.avgTemp}°C</p><p class="text-xs text-slate-400">&nbsp;</p></div>
                 <div><p class="text-sm text-slate-500">Avg. Sleep Quality</p><p class="text-2xl font-bold text-slate-800">${insights.avgSleep}</p><p class="text-xs text-slate-400">/ 10</p></div>
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
                            <th class="p-4 text-sm font-semibold text-slate-600">Sleep Quality</th>
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
            <td class="p-4 text-slate-700">${reading.sleepQuality || 'N/A'}</td>
        `;
        reportTableBody.appendChild(row);
    });

    const chartData = {
        labels: times.map(t => t.substring(0, 5)),
        datasets: [
            { label: 'Heart Rate (BPM)', data: bpms, borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', yAxisID: 'y', tension: 0.3, fill: true, pointRadius: 3, pointBackgroundColor: '#EF4444' },
            { label: 'SpO2 (%)', data: spo2s, borderColor: '#22C55E', backgroundColor: 'rgba(34, 197, 94, 0.1)', yAxisID: 'y1', tension: 0.3, fill: true, pointRadius: 3, pointBackgroundColor: '#22C55E' }
        ]
    };
    renderReportChart(chartData, 'reportChart');
}


// --- SETTINGS VIEWS ---

function renderPatientSettings() {
    mainContent.innerHTML = `
        <h2 class="text-2xl md:text-3xl font-bold text-slate-800 mb-6">Personal Profile</h2>
        <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-semibold text-slate-800 mb-4">Your Details</h3>
            <p class="text-sm text-slate-500 mb-4">Keep your details updated for accurate BMR and calorie goal calculations on your dashboard.</p>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700">Gender</label>
                    <select id="gender" class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">Weight (kg)</label>
                    <input type="number" id="weight" class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 70">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">Height (cm)</label>
                    <input type="number" id="height" class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 175">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">Age</label>
                    <input type="number" id="age" class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., 30">
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700">Activity Level</label>
                    <select id="activityLevel" class="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                        <option value="1.2">Sedentary (little or no exercise)</option>
                        <option value="1.375">Lightly Active (1-3 days/week)</option>
                        <option value="1.55">Moderately Active (3-5 days/week)</option>
                        <option value="1.725">Very Active (6-7 days/week)</option>
                        <option value="1.9">Extra Active (very hard exercise/physical job)</option>
                    </select>
                </div>
            </div>
            <button id="saveDetailsBtn" class="mt-6 w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">Save Details</button>
        </div>
    `;

    document.getElementById('saveDetailsBtn').addEventListener('click', saveUserDetails);
    loadUserDetailsForSettings(); // Pre-fill the form with existing data
}

function renderDoctorSettings() {
    mainContent.innerHTML = `
        <h2 class="text-2xl md:text-3xl font-bold text-slate-800 mb-6">Settings</h2>
        <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-semibold text-slate-800 mb-4">Profile Information</h3>
            <p><strong>Name:</strong> ${currentUser.name}</p>
            <p><strong>Role:</strong> Healthcare Professional</p>
            <hr class="my-4">
            <h3 class="text-lg font-semibold text-slate-800 mb-4">Preferences</h3>
            <p class="text-slate-500">Notification settings and other preferences will be available here in a future update.</p>
        </div>
    `;
}


// --- Charting ---

function getSharedChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 20 } } },
        scales: {
            x: { grid: { display: false } },
            y: { position: 'left', title: { display: true, text: 'BPM' } },
            y1: { position: 'right', title: { display: true, text: 'SpO2 (%)' }, grid: { drawOnChartArea: false } },
        }
    };
}


function renderVitalsChart(data, canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (vitalsChartInstance) vitalsChartInstance.destroy();
    vitalsChartInstance = new Chart(ctx, { type: 'line', data, options: getSharedChartOptions() });
}


function renderReportChart(data, canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (reportChartInstance) reportChartInstance.destroy();
    reportChartInstance = new Chart(ctx, { type: 'line', data, options: getSharedChartOptions() });
}

// --- UI Helpers ---
function createStatCard(title, value, icon, color) {
    const colors = { blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', yellow: 'bg-yellow-100 text-yellow-600', red: 'bg-red-100 text-red-600' };
    return `<div class="bg-white rounded-xl shadow-lg p-6 health-card"><div class="flex items-center"><div class="rounded-full p-3 mr-4 ${colors[color]}"><i data-feather="${icon}" class="w-6 h-6"></i></div><div><p class="text-sm text-slate-500">${title}</p><p class="text-2xl font-bold text-slate-800">${value}</p></div></div></div>`;
}

function createVitalStat(label, id, unit, icon, color) {
    const colors = { red: 'bg-red-100 text-red-600', blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', purple: 'bg-purple-100 text-purple-600' }
    return `<div class="flex items-center justify-between"><div class="flex items-center"><div class="rounded-full p-2 mr-3 ${colors[color]}"><i data-feather="${icon}" class="w-5 h-5"></i></div><p class="font-medium text-slate-600">${label}</p></div><p class="text-xl font-bold text-slate-800"><span id="${id}">--</span> ${unit}</p></div>`;
}

// --- Notifications ---
function showNotification(title, message) {
    modalTitle.textContent = title;
    modalMessage.innerHTML = message;
    notificationModal.classList.remove('hidden');
}
closeModalBtn.addEventListener('click', () => notificationModal.classList.add('hidden'));

// --- NEW/MODIFIED FEATURE IMPLEMENTATIONS ---

// 1. User Details and Calorie Calculation Logic
function saveUserDetails() {
    const patientName = currentUser.name.replace('Mr. ', '').toLowerCase();
    const userDetailsRef = database.ref('user_details/' + patientName);

    const userDetails = {
        gender: document.getElementById('gender').value,
        weight: parseFloat(document.getElementById('weight').value),
        height: parseFloat(document.getElementById('height').value),
        age: parseInt(document.getElementById('age').value),
        activityLevel: document.getElementById('activityLevel').value,
    };

    if (!userDetails.weight || !userDetails.height || !userDetails.age) {
        showNotification('Error', 'Please fill in all fields: weight, height, and age.');
        return;
    }

    userDetailsRef.set(userDetails)
        .then(() => showNotification('Success', 'Your personal details have been saved.'))
        .catch(error => showNotification('Error', 'Could not save details. Please try again.'));
}

function loadUserDetailsForSettings() {
    const patientName = currentUser.name.replace('Mr. ', '').toLowerCase();
    const userDetailsRef = database.ref('user_details/' + patientName);
    userDetailsRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            document.getElementById('gender').value = data.gender || 'male';
            document.getElementById('weight').value = data.weight || '';
            document.getElementById('height').value = data.height || '';
            document.getElementById('age').value = data.age || '';
            document.getElementById('activityLevel').value = data.activityLevel || '1.2';
        }
    });
}

function calculateBMR(gender, weight, height, age) {
    // Mifflin-St Jeor Equation
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    if (gender === 'male') {
        bmr += 5;
    } else {
        bmr -= 161;
    }
    return Math.round(bmr);
}

function calculateDailyCalories(bmr, activityMultiplier) {
    return Math.round(bmr * parseFloat(activityMultiplier));
}

function getActivityLevelName(value) {
    const levels = {
        '1.2': 'Sedentary', '1.375': 'Lightly Active', '1.55': 'Moderately Active',
        '1.725': 'Very Active', '1.9': 'Extra Active'
    };
    return levels[value] || 'Unknown';
}

// 2. Continuous Feedback Loop (MODIFIED FOR 2-WAY COMMUNICATION)
function submitPatientFeedback(patientName) {
    const feedbackTextEl = document.getElementById('feedbackText');
    const text = feedbackTextEl.value.trim();
    if (text) {
        const timestamp = new Date().toISOString().replace(/\./g, '_'); // Firebase keys can't contain '.'
        const feedbackRef = database.ref(`patients/${patientName}/feedback/${timestamp}`);
        feedbackRef.set({ text: text, read: false })
            .then(() => {
                showNotification('Success', 'Your feedback has been sent to your doctor.');
                feedbackTextEl.value = '';
            })
            .catch(error => {
                showNotification('Error', 'Could not send feedback. Please try again.');
            });
    } else {
        showNotification('Info', 'Please enter a symptom or message before submitting.');
    }
}

function showPatientFeedback(patientName) {
    const feedbackRef = database.ref(`patients/${patientName}/feedback`);
    feedbackRef.once('value', (snapshot) => {
        const feedbackData = snapshot.val() || {};
        const unreadKeys = [];

        const feedbackHtml = Object.entries(feedbackData).reverse().map(([timestamp, data]) => {
            if (!data.read) {
                unreadKeys.push(timestamp);
            }
            const patientMsg = `<div class="bg-slate-100 p-3 rounded-lg mb-2">
                                  <p class="text-sm text-slate-800">${data.text}</p>
                                  <p class="text-xs text-slate-400 mt-1 text-right">${new Date(timestamp.replace(/_/g, '.')).toLocaleString()}</p>
                                </div>`;
            const doctorReply = data.reply ? `<div class="bg-blue-100 p-3 rounded-lg ml-6">
                                                <p class="text-sm text-blue-800"><strong class="font-semibold">Dr. Tamil's Reply:</strong> ${data.reply.text}</p>
                                                <p class="text-xs text-blue-400 mt-1 text-right">${new Date(data.reply.timestamp).toLocaleString()}</p>
                                              </div>` : '';
            return patientMsg + doctorReply;
        }).join('');

        const latestTimestamp = Object.keys(feedbackData).sort().pop();

        const replySection = `
            <hr class="my-4">
            <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Reply to Patient:</label>
                <textarea id="doctorReplyText" class="w-full p-2 border rounded-lg text-sm" placeholder="Type your response..."></textarea>
                <button id="sendReplyBtn" class="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition">Send Reply</button>
            </div>`;

        showNotification(
            `Feedback for ${patientName}`,
            `<div class="max-h-60 overflow-y-auto custom-scrollbar pr-2 mb-4">${feedbackHtml || 'No feedback submitted.'}</div> ${replySection}`
        );
        
        document.getElementById('sendReplyBtn').onclick = () => {
            const replyText = document.getElementById('doctorReplyText').value.trim();
            if (replyText && latestTimestamp) {
                sendDoctorReply(patientName, latestTimestamp, replyText);
            }
        };

        // Mark feedback as read
        if (unreadKeys.length > 0) {
            const updates = {};
            unreadKeys.forEach(key => {
                updates[`/${patientName}/feedback/${key}/read`] = true;
            });
            database.ref('patients').update(updates);
        }
    });
}

function sendDoctorReply(patientName, timestamp, text) {
    const replyRef = database.ref(`patients/${patientName}/feedback/${timestamp}/reply`);
    replyRef.set({
        text: text,
        timestamp: new Date().toISOString(),
        patientNotified: false
    }).then(() => {
        notificationModal.classList.add('hidden'); // Close the modal
        showNotification('Success', 'Your reply has been sent.');
    }).catch(error => {
        showNotification('Error', 'Failed to send reply.');
    });
}

function checkForDoctorReplies(feedbackData, patientName) {
    if (!feedbackData) return;
    
    const unnotifiedReplies = Object.entries(feedbackData).filter(([ts, data]) => 
        data.reply && !data.reply.patientNotified
    );

    if (unnotifiedReplies.length > 0) {
        // To avoid spamming, show only the latest unnotified reply
        const [timestamp, data] = unnotifiedReplies.pop();
        showNotification('A Reply From Your Doctor', data.reply.text);
        
        // Mark it as notified
        const replyNotifiedRef = database.ref(`patients/${patientName}/feedback/${timestamp}/reply/patientNotified`);
        replyNotifiedRef.set(true);
    }
}


// 3. Report Generation
function generateHandoverSummary(patientName) {
    const patientRef = database.ref('patients/' + patientName);
    patientRef.once('value', snapshot => {
        const data = snapshot.val();
        const dates = Object.keys(data).filter(k => k !== 'feedback').sort();
        const firstDate = dates[0];
        const lastDate = dates.at(-1);

        const allReadings = dates.flatMap(d => Object.values(data[d]));
        const avgBpm = (allReadings.reduce((sum, r) => sum + r.bpm, 0) / allReadings.length).toFixed(1);
        const maxSpo2 = Math.max(...allReadings.map(r => r.spo2));
        const minSpo2 = Math.min(...allReadings.map(r => r.spo2));
        const lastRecommendation = getAIRecommendation(data);
        const discharge = predictDischargeDate(data);

        const reportHtml = `<div class="text-left text-sm space-y-3"><p><strong>Patient:</strong> <span class="capitalize">${patientName}</span></p><p><strong>Monitoring Period:</strong> ${firstDate} to ${lastDate}</p><hr><p><strong>Overall Vitals Summary:</strong></p><ul class="list-disc list-inside"><li>Average Heart Rate: <strong>${avgBpm} BPM</strong></li><li>SpO₂ Range: <strong>${minSpo2}% - ${maxSpo2}%</strong></li></ul><hr><p><strong>Current Status:</strong></p><div class="p-2 rounded-lg ${lastRecommendation.color === 'green' ? 'bg-green-100' : 'bg-yellow-100'}"><p class="font-semibold">Latest AI Insight:</p><p>${lastRecommendation.text}</p></div><p>AI Predicted Discharge: <strong>${discharge}</strong></p></div>`;
        showNotification(`Handover Summary: ${patientName}`, reportHtml);
    });
}

function generateInsuranceReport(patientName) {
    const patientRef = database.ref('patients/' + patientName);
    patientRef.once('value', snapshot => {
        const data = snapshot.val();
        const dates = Object.keys(data).filter(k => k !== 'feedback').sort();
        const allReadings = dates.flatMap(d => Object.values(data[d]));

        const criticalEvents = allReadings.filter(r => r.spo2 < 94 || r.bpm > 110 || r.bpm < 55).length;

        const reportHtml = `<div class="text-left text-sm space-y-3 font-mono"><h4 class="text-base font-bold text-center">MEDICAL CLAIM SUMMARY</h4><p><strong>PATIENT ID:</strong> ${patientName.toUpperCase()}</p><p><strong>DATE OF REPORT:</strong> ${new Date().toLocaleDateString()}</p><p><strong>MONITORING PERIOD:</strong> ${dates[0]} to ${dates.at(-1)}</p><p>----------------------------------------</p><p><strong>TOTAL READINGS LOGGED:</strong> ${allReadings.length}</p><p><strong>CRITICAL EVENTS DETECTED:</strong> ${criticalEvents}</p><p><strong>DISCHARGE PREDICTION:</strong> ${predictDischargeDate(data)}</p><p>----------------------------------------</p><p>This document summarizes the IoT vitals data collected for the specified patient. The system confirms continuous monitoring during the stated period.</p><p class="text-center mt-4">-- END OF REPORT --</p></div>`;
        showNotification(`Insurance Claim Prep: ${patientName}`, reportHtml);
    });
}

// --- Initialization ---
function init() {
    feather.replace();
    setTimeout(() => {
        if (currentUser && currentUser.role === 'patient') {
            showNotification('Thanyou! For Using our Application');
        }
    }, 8000);
}
init();