# 🏥 Patient Health Monitoring System

A comprehensive web-based application for real-time patient health monitoring with AI-powered insights, designed for healthcare professionals and patients.

![HealthTracker](https://img.shields.io/badge/HealthTracker-Patient%20Monitoring-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)
![Firebase](https://img.shields.io/badge/Firebase-Realtime%20Database-orange)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-Responsive-teal)

## 🌟 Features

### For Healthcare Professionals (Doctors)
- **Real-time Dashboard**: Monitor all patients at a glance with vital statistics
- **Patient Management**: View detailed patient lists with current vital signs
- **Critical Alerts**: Immediate identification of patients requiring attention
- **AI Discharge Prediction**: Machine learning-powered discharge date estimation
- **Comprehensive Reports**: Historical data analysis with interactive charts
- **Multi-patient Monitoring**: Simultaneous tracking of multiple patients

### For Patients
- **Personal Health Dashboard**: Real-time view of vital signs and health trends
- **Vital Signs Tracking**: Monitor heart rate, blood oxygen, and temperature
- **AI Health Recommendations**: Personalized health advice based on current vitals
- **Historical Reports**: Access to personal health data and trends
- **Medicine Reminders**: Automated medication alerts

### Core Monitoring Capabilities
- **Heart Rate (BPM)**: Continuous cardiac monitoring
- **Blood Oxygen Saturation (SpO2)**: Respiratory health tracking
- **Body Temperature**: Fever and health status monitoring
- **Trend Analysis**: Historical data visualization and pattern recognition
- **Real-time Alerts**: Instant notifications for critical health changes

## 🚀 Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS Framework
- **Database**: Firebase Realtime Database
- **Charts**: Chart.js for data visualization
- **Icons**: Feather Icons
- **Fonts**: Inter (Google Fonts)
- **Responsive Design**: Mobile-first approach

## 📋 Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for Firebase and CDN resources)
- Web server (for local development)

## 🛠️ Installation & Setup

### Option 1: Quick Start (Recommended)
1. **Clone the repository**:
   ```bash
   git clone https://github.com/Vaggiri/patient-health-monitoring.git
   cd patient-health-monitoring
   ```

2. **Start a local web server**:
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Using Python 2
   python -m SimpleHTTPServer 8000
   
   # Using Node.js (if you have it installed)
   npx http-server
   ```

3. **Open your browser** and navigate to:
   ```
   http://localhost:8000
   ```

### Option 2: Direct File Opening
Simply open `index.html` in your web browser (some features may be limited due to CORS restrictions).

## 🎯 Usage Guide

### Demo Access
The application includes demo accounts for testing:

**Patient Account**:
- Email: `patient@demo.com`
- Password: `123456`
- Role: Uncheck "Log in as a healthcare professional"

**Doctor Account**:
- Email: `doctor@demo.com`
- Password: `123456`
- Role: Check "Log in as a healthcare professional"

### Getting Started

1. **Launch the Application**: Open the web application in your browser
2. **Choose Your Role**: Select either patient or healthcare professional login
3. **Enter Credentials**: Use the demo accounts or your assigned credentials
4. **Navigate the Dashboard**: Explore the intuitive interface designed for your role

### Patient Workflow
1. Log in with patient credentials
2. View your current vital signs on the dashboard
3. Monitor health trends with interactive charts
4. Read AI-generated health recommendations
5. Access historical health reports

### Doctor Workflow
1. Log in with healthcare professional credentials
2. Review the overview dashboard for all patients
3. Identify critical patients requiring immediate attention
4. Access detailed patient reports and trends
5. Utilize AI discharge predictions for patient management

## 📱 Interface Overview

### Login Screen
- Clean, professional interface
- Role-based authentication
- Demo credentials display
- Responsive design for all devices

### Doctor Dashboard
- **Overview Panel**: Total patients, stable/critical counts
- **Patient List**: Real-time vital signs for all patients
- **Critical Alerts**: High-priority patient notifications
- **AI Insights**: Discharge predictions and recommendations

### Patient Dashboard
- **Vital Signs Display**: Current heart rate, SpO2, and temperature
- **Trend Charts**: Historical data visualization
- **AI Recommendations**: Personalized health advice
- **Report Access**: Historical health data

## 📊 Data Management

### Real-time Monitoring
- Live vital sign updates via Firebase
- Automatic data synchronization
- Cross-platform data accessibility

### Data Structure
```javascript
patients: {
  "PatientName": {
    "YYYY-MM-DD": {
      "HH:MM": {
        bpm: 72,
        spo2: 98,
        temp: 36.5
      }
    }
  }
}
```

## 🧠 AI Features

### Discharge Prediction Algorithm
The system uses trend analysis to predict optimal discharge dates based on:
- Recent vital sign stability
- Improvement trends
- Clinical thresholds
- Historical patterns

### Health Recommendations
AI-powered suggestions based on:
- Current vital sign readings
- Threshold analysis
- Best practice guidelines
- Personalized health profiles

## 🗂️ Project Structure

```
patient-health-monitoring/
├── index.html          # Main application file
├── script.js           # Core JavaScript functionality
├── style.css           # Custom styles and animations
└── README.md           # Project documentation
```

### File Descriptions

- **`index.html`**: Contains the complete HTML structure including login interface, dashboard layouts, and modal components
- **`script.js`**: Comprehensive JavaScript application with Firebase integration, AI algorithms, charting functionality, and user interface logic
- **`style.css`**: Custom CSS for enhanced styling, animations, and responsive design elements

## 🔧 Configuration

### Firebase Setup
The application is pre-configured with a Firebase Realtime Database. To use your own Firebase instance:

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Realtime Database
3. Update the `firebaseConfig` object in `script.js`:
   ```javascript
   const firebaseConfig = {
       databaseURL: "YOUR_FIREBASE_DATABASE_URL"
   };
   ```

### Customization Options

- **Styling**: Modify `style.css` for custom themes
- **User Management**: Update the `users` object in `script.js`
- **AI Thresholds**: Adjust health parameters in the AI functions
- **Branding**: Update application name and styling

## 🌐 Browser Compatibility

- Chrome 70+
- Firefox 60+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🔒 Security Considerations

- Demo application with basic authentication
- Real deployment requires proper user management
- HTTPS recommended for production use
- Firebase security rules should be implemented

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

## 📄 License

This project is available for educational and demonstration purposes. Please check with the repository owner for commercial use guidelines.

## 📞 Support

For questions, issues, or feature requests, please open an issue in the GitHub repository.

---

**Made with ❤️ for better healthcare monitoring**