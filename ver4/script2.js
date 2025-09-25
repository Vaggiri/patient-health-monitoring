// --- App State & Config ---
const firebaseConfig = {
    databaseURL: "https://patient-health-monitor-20846-default-rtdb.firebaseio.com"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// MODIFIED: Added a 'details' object to store personal info
const users = {
    'patient@demo.com': { 
        password: '123456', 
        name: 'Mr. Kumar', 
        role: 'patient',
        details: { age: 45, sex: 'Male', weight: 78, height: 175, blood: 'O+', dob: '1980-05-20', medical: 'None' }
    },
    'doctor@demo.com': { 
        password: '123456', 
        name: 'Dr. Tamil', 
        role: 'doctor' 
    }
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
// MODIFIED: Added 'Settings' route
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
        a.href = '#'; a.textContent = link.name; a.className = 'nav-link py-2 px-3 font-medium text-slate-600';
        if (index === 0) a.classList.add('active');
        a.addEventListener('click', (e) => handleNavClick(e, a, link.name));
        mainNav.appendChild(a);
        const mobileA = document.createElement('a');
        mobileA.href = '#'; mobileA.textContent = link.name; mobileA.className = 'mobile-nav-link text-slate-700';
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
        if (el.textContent === pageName) { el.classList.add('active'); }
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
            case 'Settings': renderSettingsView(); break; // NEW
        }
    } else if (currentUser.role === 'patient') {
        switch (page) {
            case 'Dashboard': renderPatientDashboard(); break;
            case 'Reports': renderPatientReportView(currentUser.name.replace('Mr. ', '')); break;
            case 'Nutrition': renderNutritionView(); break;
            case 'Settings': renderSettingsView(); break; // NEW
        }
    }
}

// --- Authentication ---
// MODIFIED: Loads user details from Firebase on login
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
        // NEW: Load user details from Firebase on login
        loadUserDetails(currentUser.name.replace('Mr. ', '')).then(details => {
            currentUser.details = details || users[email].details; // Fallback to local default
            setupNavigation(currentUser.role);
        });
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

// --- AI Simulation & Calculation Functions ---

function predictDischargeDate(patientData) {
    const dates = Object.keys(patientData).sort(); if (dates.length === 0) return "Evaluation needed";
    const latestDateData = patientData[dates[dates.length-1]]; const times = Object.keys(latestDateData).sort();
    if (times.length < 3) return "Monitoring"; const recentReadings = times.slice(-3).map(t => latestDateData[t]);
    const avgBpm = recentReadings.reduce((sum, r) => sum + r.bpm, 0) / recentReadings.length;
    const avgSpo2 = recentReadings.reduce((sum, r) => sum + r.spo2, 0) / recentReadings.length;
    const isStable = avgBpm > 60 && avgBpm < 100 && avgSpo2 > 95;
    const trendImproving = recentReadings[2].bpm <= recentReadings[0].bpm && recentReadings[2].spo2 >= recentReadings[0].spo2;
    let daysToAdd = 7; if (isStable && trendImproving) daysToAdd = 3; else if (isStable) daysToAdd = 5;
    else if (!isStable && !trendImproving) daysToAdd = 10; const dischargeDate = new Date();
    dischargeDate.setDate(dischargeDate.getDate() + daysToAdd);
    return dischargeDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function getAIRecommendation(patientData) {
    const allReadings = Object.keys(patientData).sort().flatMap(date => Object.keys(patientData[date]).sort().map(time => ({ ...patientData[date][time], date, time })));
    if (allReadings.length < 3) return { text: "More data is needed for a comprehensive recommendation. Continue monitoring.", color: 'slate' };
    const recentReadings = allReadings.slice(-12); const latestReading = recentReadings[recentReadings.length - 1];
    const avgBpm = recentReadings.reduce((sum, r) => sum + r.bpm, 0) / recentReadings.length;
    const avgSpo2 = recentReadings.reduce((sum, r) => sum + r.spo2, 0) / recentReadings.length;
    const avgTemp = recentReadings.reduce((sum, r) => sum + r.temp, 0) / recentReadings.length;
    const halfIndex = Math.floor(recentReadings.length / 2); const firstHalf = recentReadings.slice(0, halfIndex);
    const secondHalf = recentReadings.slice(halfIndex);
    const avgBpmFirstHalf = firstHalf.reduce((sum, r) => sum + r.bpm, 0) / firstHalf.length;
    const avgBpmSecondHalf = secondHalf.reduce((sum, r) => sum + r.bpm, 0) / secondHalf.length;
    const avgSpo2FirstHalf = firstHalf.reduce((sum, r) => sum + r.spo2, 0) / firstHalf.length;
    const avgSpo2SecondHalf = secondHalf.reduce((sum, r) => sum + r.spo2, 0) / secondHalf.length;
    const bpmTrend = avgBpmSecondHalf - avgBpmFirstHalf; const spo2Trend = avgSpo2SecondHalf - avgSpo2FirstHalf;
    if (latestReading.spo2 < 92) return { text: "Critical: Oxygen saturation is very low. Immediate medical attention may be required. Focus on deep, controlled breathing.", color: 'red' };
    if (spo2Trend < -1.5) return { text: "Concern: Oxygen saturation shows a declining trend. Please ensure you are in a well-ventilated area and practice deep breathing exercises.", color: 'yellow' };
    if (avgSpo2 < 95) return { text: "Attention: Average oxygen saturation is consistently below the optimal 95%. Try sitting upright to improve lung expansion. Continue to monitor closely.", color: 'yellow' };
    if (avgBpm > 110) return { text: "Attention: Heart rate has been consistently elevated. Avoid stimulants like caffeine, ensure proper hydration, and prioritize rest.", color: 'yellow' };
    if (bpmTrend > 10) return { text: "Observation: Heart rate shows a notable increasing trend. Monitor for symptoms like palpitations or shortness of breath and report them.", color: 'yellow' };
    if (avgTemp > 37.8) return { text: "Fever detected. Average temperature is high. Ensure high fluid intake and get plenty of rest. A tepid sponge bath can help provide comfort.", color: 'yellow' };
    if (latestReading.bpm < 55) return { text: "Heart rate is low. Monitor for symptoms like dizziness, lightheadedness, or fatigue. Report any concerns to your healthcare provider.", color: 'blue' };
    if (spo2Trend > 0.5 && bpmTrend < -5) return { text: "Positive Progress: Vitals show excellent improvement, with oxygen levels rising and heart rate stabilizing. Keep up with the current care plan!", color: 'green' };
    return { text: "Vitals are stable and within the normal range. Continue to maintain a balanced diet, stay hydrated, and get adequate rest. Great job!", color: 'green' };
}

/**
 * MODIFIED: Gemini AI Food Recommendation Simulation with more options
 */
function getGeminiFoodRecommendation(symptom) {
    const s = symptom.toLowerCase();
    let result = { title: "Recommendation", message: `Based on your query for "${symptom}", here are some food suggestions:`, foods: [] };
    if (s.includes('fatigue') || s.includes('tired')) {
        result.title = "Foods to Boost Energy"; result.message = "For fatigue, focus on iron-rich foods and complex carbohydrates for sustained energy.";
        result.foods = ["Spinach", "Lentils", "Oats", "Bananas", "Nuts and Seeds"];
    } else if (s.includes('weak') && (s.includes('bone') || s.includes('joint'))) {
        result.title = "Foods for Bone Health"; result.message = "To support bone health, focus on foods rich in Calcium and Vitamin D.";
        result.foods = ["Milk", "Yogurt", "Cheese", "Fortified Cereals", "Fatty Fish (Salmon)"];
    } else if (s.includes('immunity') || s.includes('cold') || s.includes('sick')) {
        result.title = "Immunity Boosting Foods"; result.message = "To strengthen your immune system, incorporate foods high in Vitamin C and antioxidants.";
        result.foods = ["Citrus Fruits (Oranges, Lemons)", "Bell Peppers", "Broccoli", "Garlic", "Ginger", "Turmeric"];
    } else if (s.includes('skin') || s.includes('acne')) {
        result.title = "Foods for Healthy Skin"; result.message = "For clearer skin, focus on foods rich in antioxidants, healthy fats, and Vitamin E.";
        result.foods = ["Avocado", "Walnuts", "Tomatoes", "Green Tea", "Berries"];
    } else if (s.includes('blood pressure') || s.includes('hypertension')) {
        result.title = "Foods for Blood Pressure"; result.message = "To help manage blood pressure, focus on potassium-rich foods and limit sodium.";
        result.foods = ["Bananas", "Leafy Greens", "Beets", "Oats", "Berries", "Low-Fat Yogurt"];
    } else if (s.includes('diabet')) {
        result.title = "Foods for Blood Sugar Control"; result.message = "Focus on high-fiber, low-glycemic index foods to help manage blood sugar levels.";
        result.foods = ["Whole Grains", "Legumes", "Nuts", "Non-starchy Vegetables", "Lean Protein"];
    } else if (s.includes('digest') || s.includes('stomach')) {
        result.title = "Foods for Digestive Health"; result.message = "For better digestion, include probiotic and fiber-rich foods in your diet.";
        result.foods = ["Yogurt", "Kefir", "Ginger", "Whole Grains", "Papaya", "Peppermint Tea"];
    } else if (s.includes('headache') || s.includes('migraine')) {
        result.title = "Foods to Help with Headaches"; result.message = "Stay hydrated and consider foods rich in magnesium and riboflavin.";
        result.foods = ["Water", "Almonds", "Spinach", "Avocado", "Fatty Fish (Salmon)"];
    } else {
        result.title = "General Well-being"; result.message = "For general health, a balanced diet is key. Here are some nutrient-dense foods:";
        result.foods = ["Leafy Greens", "Lean Protein (Chicken, Fish)", "Whole Grains", "Fruits", "Vegetables"];
    }
    return result;
}

// --- NEW: Calculation Functions ---
/**
 * Calculates Basal Metabolic Rate (BMR).
 * BMR (men) = 10*W + 6.25*H - 5*A + 5
 * BMR (women) = 10*W + 6.25*H - 5*A - 161
 * @param {object} details - User details { weight, height, age, sex }.
 * @returns {string} The calculated BMR as a string or 'N/A'.
 */
function calculateBMR(details) {
    if (!details || !details.weight || !details.height || !details.age || !details.sex) return 'N/A';
    const W = parseFloat(details.weight);
    const H = parseFloat(details.height);
    const A = parseInt(details.age);
    let bmr = 0;
    if (details.sex === 'Male') {
        bmr = 10 * W + 6.25 * H - 5 * A + 5;
    } else if (details.sex === 'Female') {
        bmr = 10 * W + 6.25 * H - 5 * A - 161;
    }
    return bmr > 0 ? bmr.toFixed(0) : 'N/A';
}

/**
 * Calculates calories burned per minute.
 * Men: Calories/min = (-55.0969 + (0.6309*HR) + (0.1988*W) + (0.2017*A)) / 4.184
 * Women: Calories/min = (-20.4022 + (0.4472*HR) - (0.1263*W) + (0.074*A)) / 4.184
 * @param {object} details - User details { weight, age, sex }.
 * @param {number} hr - Current heart rate.
 * @returns {string} The calculated calories/min as a string or 'N/A'.
 */
function calculateCalories(details, hr) {
    if (!details || !details.weight || !details.age || !details.sex || !hr) return 'N/A';
    const W = parseFloat(details.weight);
    const A = parseInt(details.age);
    const HR = parseFloat(hr);
    let calories = 0;
    if (details.sex === 'Male') {
        calories = (-55.0969 + (0.6309 * HR) + (0.1988 * W) + (0.2017 * A)) / 4.184;
    } else if (details.sex === 'Female') {
        calories = (-20.4022 + (0.4472 * HR) - (0.1263 * W) + (0.074 * A)) / 4.184;
    }
    return calories > 0 ? calories.toFixed(2) : 'N/A';
}


// --- Email Alert Functions ---

/**
 * MODIFIED: Checks heart rate and gathers last 10 readings for the alert.
 */
function checkHeartRateAndTriggerAlert(patientData, patientName) {
    const allReadings = Object.values(patientData).flatMap(dailyData => Object.values(dailyData));
    if (allReadings.length < 4) return; 

    const lastFourReadings = allReadings.slice(-4);
    const historicalData = allReadings.slice(-10); // Get last 10 for context

    const highThreshold = 120;
    const lowThreshold = 55;
    const lastFourBPM = lastFourReadings.map(r => r.bpm);
    const isConsistentlyHigh = lastFourBPM.every(bpm => bpm > highThreshold);
    const isConsistentlyLow = lastFourBPM.every(bpm => bpm < lowThreshold);
    const lastAlertKey = `alert_${patientName}`;

    if (isConsistentlyHigh) {
        if (sessionStorage.getItem(lastAlertKey) !== 'high') {
            sendEmailAlert(patientName, 'High Heart Rate', lastFourBPM, historicalData);
            sessionStorage.setItem(lastAlertKey, 'high');
        }
    } else if (isConsistentlyLow) {
        if (sessionStorage.getItem(lastAlertKey) !== 'low') {
            sendEmailAlert(patientName, 'Low Heart Rate', lastFourBPM, historicalData);
            sessionStorage.setItem(lastAlertKey, 'low');
        }
    } else {
         sessionStorage.removeItem(lastAlertKey); 
    }
}

/**
 * MODIFIED: Simulates sending an email alert with historical data.
 */
function sendEmailAlert(patientName, alertType, readings, historicalData) {
    const doctorEmail = 'doctor@demo.com';
    const familyEmail = 'family@demo.com';
    const subject = `URGENT: Health Alert for Patient ${patientName}`;
    
    const historicalReadingsText = historicalData.map((data, index) => 
        `  ${index + 1}. HR: ${data.bpm} bpm, SpO2: ${data.spo2}%, Temp: ${data.temp}°C`
    ).join('\n');

    const body = `
        This is an automated alert from HealthTracker.
        
        Patient: ${patientName}
        Alert Type: ${alertType}
        
        The last four heart rate readings were consistently critical:
        Readings: ${readings.join(' bpm, ')} bpm.

        --- Past 10 Vital Readings for Context ---
        ${historicalReadingsText}
        
        Please review the patient's dashboard immediately.
    `;

    console.warn("--- 📧 EMAIL ALERT SIMULATION 📧 ---");
    console.log(`To: ${doctorEmail}, ${familyEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.warn("--- END OF SIMULATION ---");

    showNotification('Critical Alert Triggered', `An email alert for "${alertType}" has been sent to the care team for patient ${patientName}.`);
}

// --- Doctor Views ---
function renderDoctorDashboard() { /* ... No changes ... */ }
function renderPatientList() { /* ... No changes ... */ }
function loadDoctorStats() { /* ... No changes ... */ }
function loadHighPriorityList(allPatientsData) { /* ... No changes ... */ }
function loadPatientList() { /* ... No changes ... */ }
function createPatientListItem(name, data) { /* ... No changes ... */ }
function viewPatientReport(patientName) { /* ... No changes ... */ }

// --- Patient Views ---
// MODIFIED: Added placeholders for BMR and Calorie stats
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
                    <h3 class="text-lg font-semibold text-slate-800 mb-4">Health Metrics</h3>
                    <div class="space-y-4">
                        ${createVitalStat('Est. BMR', 'bmrStat', 'kcal/day', 'activity', 'yellow')}
                        ${createVitalStat('Calorie Burn', 'calorieStat', 'kcal/min', 'zap', 'purple')}
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

/**
 * MODIFIED: Nutrition view now has more vitamin guides.
 */
function renderNutritionView() {
    mainContent.innerHTML = `
        <h2 class="text-2xl md:text-3xl font-bold text-slate-800 mb-6">AI Nutrition Guide</h2>
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 class="text-lg font-semibold text-slate-800 mb-4">Get Food Recommendations</h3>
            <p class="text-slate-600 mb-4">Enter a symptom or health goal (e.g., "fatigue", "high blood pressure") to get personalized food suggestions from our AI.</p>
            <div class="flex flex-col sm:flex-row gap-2">
                <input type="text" id="symptomInput" placeholder="e.g., tired, headache, diabetes" class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                <button id="getFoodBtn" class="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">Get Suggestion</button>
            </div>
            <div id="foodResult" class="mt-6"></div>
        </div>
        <div class="bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-semibold text-slate-800 mb-4">Vitamin-Rich Food Guide</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${createVitaminCard('Vitamin C', 'Boosts immunity and skin health.', ['Oranges', 'Strawberries', 'Bell Peppers'])}
                ${createVitaminCard('Iron', 'Helps fight fatigue and anemia.', ['Spinach', 'Lentils', 'Red Meat'])}
                ${createVitaminCard('Calcium', 'Essential for strong bones and teeth.', ['Milk', 'Yogurt', 'Fortified Cereals'])}
                ${createVitaminCard('Vitamin D', 'Supports bone health and immune function.', ['Sunlight', 'Fatty Fish', 'Fortified Milk'])}
                ${createVitaminCard('Vitamin B12', 'Key for nerve function and energy production.', ['Meat', 'Fish', 'Eggs', 'Dairy'])}
                ${createVitaminCard('Potassium', 'Helps regulate blood pressure.', ['Bananas', 'Sweet Potatoes', 'Spinach'])}
            </div>
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
        foodResultEl.innerHTML = `<div class="bg-blue-50 border border-blue-200 rounded-lg p-4"><h4 class="font-bold text-blue-800">${recommendation.title}</h4><p class="text-blue-700 mb-3">${recommendation.message}</p><div class="flex flex-wrap gap-2">${recommendation.foods.map(food => `<span class="bg-blue-200 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">${food}</span>`).join('')}</div></div>`;
    });
}

function createVitaminCard(name, desc, foods) { /* ... No changes ... */ }

// MODIFIED: Now also calculates and displays BMR and Calories.
function loadPatientDashboardData() {
    const patientName = currentUser.name.replace('Mr. ', '');
    const patientRef = database.ref('patients/' + patientName);
    patientRef.on('value', (snapshot) => {
        const patientData = snapshot.val();
        if (patientData) {
            checkHeartRateAndTriggerAlert(patientData, patientName);
            const dates = Object.keys(patientData).sort();
            const latestDate = dates.at(-1);
            const dailyReadings = patientData[latestDate];
            const times = Object.keys(dailyReadings).sort();
            const latestReading = dailyReadings[times.at(-1)];
            
            document.getElementById('currentBPM').textContent = latestReading.bpm;
            document.getElementById('currentSpO2').textContent = latestReading.spo2;
            document.getElementById('currentTemp').textContent = latestReading.temp;
            
            // NEW: Calculate and display BMR and Calories
            const userDetails = currentUser.details;
            const bmr = calculateBMR(userDetails);
            const calories = calculateCalories(userDetails, latestReading.bpm);
            document.getElementById('bmrStat').textContent = bmr;
            document.getElementById('calorieStat').textContent = calories;
            if(bmr === 'N/A' || calories === 'N/A') {
                showNotification('Update Profile', 'Please complete your personal details in the Settings tab for accurate BMR and calorie calculations.');
            }

            const recommendation = getAIRecommendation(patientData);
            const recElement = document.getElementById('aiRecommendation');
            const colorClasses = { green: 'bg-green-100 text-green-800', yellow: 'bg-yellow-100 text-yellow-800', blue: 'bg-blue-100 text-blue-800', slate: 'bg-slate-100 text-slate-800', red: 'bg-red-100 text-red-800' };
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

// --- NEW: Settings View and related functions ---
function renderSettingsView() {
    const isPatient = currentUser.role === 'patient';
    const name = isPatient ? currentUser.name.replace('Mr. ', '') : '';

    mainContent.innerHTML = `
        <h2 class="text-2xl md:text-3xl font-bold text-slate-800 mb-6">User Settings</h2>
        <div class="bg-white rounded-xl shadow-lg p-6 md:p-8">
            <form id="settingsForm">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label for="name" class="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input type="text" id="name" value="${currentUser.name}" disabled class="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg">
                    </div>
                     <div>
                        <label for="dob" class="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                        <input type="date" id="dob" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="age" class="block text-sm font-medium text-slate-700 mb-1">Age</label>
                        <input type="number" id="age" placeholder="e.g., 45" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="sex" class="block text-sm font-medium text-slate-700 mb-1">Sex</label>
                        <select id="sex" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Select...</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>
                     <div>
                        <label for="weight" class="block text-sm font-medium text-slate-700 mb-1">Weight (kg)</label>
                        <input type="number" step="0.1" id="weight" placeholder="e.g., 78.5" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="height" class="block text-sm font-medium text-slate-700 mb-1">Height (cm)</label>
                        <input type="number" id="height" placeholder="e.g., 175" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="blood" class="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
                        <input type="text" id="blood" placeholder="e.g., O+" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div class="md:col-span-2">
                        <label for="medical" class="block text-sm font-medium text-slate-700 mb-1">Other Medical Info (Allergies, etc.)</label>
                        <textarea id="medical" rows="3" placeholder="e.g., Allergic to penicillin" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                    </div>
                </div>
                <div class="mt-8 text-right">
                    <button type="submit" class="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">Save Changes</button>
                </div>
            </form>
        </div>
    `;

    if (isPatient) {
        populateSettingsForm(name);
        document.getElementById('settingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            saveUserSettings(name);
        });
    } else {
         document.querySelectorAll('#settingsForm input, #settingsForm select, #settingsForm textarea, #settingsForm button').forEach(el => el.disabled = true);
         showNotification('Doctor View', 'This is a patient-specific settings page. Select a patient from the "Patients" tab to manage their details.');
    }
}

function populateSettingsForm(patientName) {
    loadUserDetails(patientName).then(details => {
        const userDetails = details || currentUser.details || {};
        document.getElementById('age').value = userDetails.age || '';
        document.getElementById('sex').value = userDetails.sex || '';
        document.getElementById('dob').value = userDetails.dob || '';
        document.getElementById('blood').value = userDetails.blood || '';
        document.getElementById('height').value = userDetails.height || '';
        document.getElementById('weight').value = userDetails.weight || '';
        document.getElementById('medical').value = userDetails.medical || '';
    });
}

async function loadUserDetails(patientName) {
    if (!patientName) return null;
    const detailsRef = database.ref('user_details/' + patientName);
    const snapshot = await detailsRef.once('value');
    return snapshot.val();
}

function saveUserSettings(patientName) {
    const userDetails = {
        age: document.getElementById('age').value,
        sex: document.getElementById('sex').value,
        dob: document.getElementById('dob').value,
        blood: document.getElementById('blood').value,
        height: document.getElementById('height').value,
        weight: document.getElementById('weight').value,
        medical: document.getElementById('medical').value,
    };

    const detailsRef = database.ref('user_details/' + patientName);
    detailsRef.set(userDetails)
        .then(() => {
            currentUser.details = userDetails;
            showNotification('Success', 'Your details have been saved successfully.');
            if(document.querySelector('.nav-link.active').textContent === 'Dashboard'){
                renderPatientDashboard();
            }
        })
        .catch(error => {
            showNotification('Error', 'Failed to save details. ' + error.message);
        });
}


// --- Reports Views ---
function renderDoctorReportPatientSelection() { /* ... No changes ... */ }
function renderPatientReportView(patientName) { /* ... No changes ... */ }
function loadAndDisplayReportData(patientName) { /* ... No changes ... */ }
function displayDailyReport(dayData, dateString) { /* ... No changes ... */ }

// --- Charting ---
function renderVitalsChart(data, canvasId) { /* ... No changes ... */ }
function renderReportChart(data, canvasId) { /* ... No changes ... */ }

// --- UI Helpers ---
function createStatCard(title, value, icon, color) { /* ... No changes ... */ }
// MODIFIED: Added a 'purple' color for the calorie stat
function createVitalStat(label, id, unit, icon, color) {
    const colors = { red: 'bg-red-100 text-red-600', blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', yellow: 'bg-yellow-100 text-yellow-600', purple: 'bg-purple-100 text-purple-600' }
    return `<div class="flex items-center justify-between"><div class="flex items-center"><div class="rounded-full p-2 mr-3 ${colors[color]}"><i data-feather="${icon}" class="w-5 h-5"></i></div><p class="font-medium text-slate-600">${label}</p></div><p class="text-xl font-bold text-slate-800"><span id="${id}">--</span> ${unit}</p></div>`;
}

// --- Notifications ---
function showNotification(title, message) { /* ... No changes ... */ }
closeModalBtn.addEventListener('click', () => notificationModal.classList.add('hidden'));

// --- Initialization ---
function init() { /* ... No changes ... */ }
init();