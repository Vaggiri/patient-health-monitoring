/*
  ==============================================================================
  Copyright (c) 2025 Girisudhan V
  All rights reserved.

  This project is a Patient Health Monitor using an ESP32.
  It reads data from a MAX30102 sensor (Heart Rate, SpO2, Temperature)
  and sends it to a Firebase Realtime Database. It also includes an
  email alert system via SMTP for abnormal readings.
  ==============================================================================
*/

#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>
#include <WiFiClientSecure.h>
#include "base64.h"   // required for SMTP login

// ---------- WiFi ----------
const char* ssid = "health";
const char* password = "11223344";

// ---------- Firebase ----------
String firebaseHost = "https://patient-health-monitor-20846-default-rtdb.firebaseio.com";
String firebaseAuth = "";
String patientName = "kumar";

// ---------- MAX30102 ----------
MAX30105 particleSensor;
#define BUZZER_PIN 4
#define BUFFER_SIZE 100

// Heart Rate vars
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute;
int beatAvg;

// SpO2 buffers
long redBuffer[BUFFER_SIZE];
long irBuffer[BUFFER_SIZE];
int bufferIndex = 0;
float spo2 = 0;

// ---------- Firebase push timer ----------
unsigned long lastFirebasePush = 0;
const unsigned long FIREBASE_INTERVAL = 30000; // 30 sec

// ---------- Time ----------
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800;  // IST +5:30
const int daylightOffset_sec = 0;

// ---------- SMTP Config ----------
const char* smtpServer = "smtp.gmail.com";
const int smtpPort = 465;
String smtpUser = "hdaprojectofficial@gmail.com";      // <-- change
String smtpPass = "eigu bqix zthz bdye";      // Gmail App Password
String smtpTo   = "hdaprojectofficial@gmail.com";  // <-- change

bool alertSent = false;

// ---------- Thresholds ----------
const int HR_THRESHOLD = 110;     // bpm
const float TEMP_THRESHOLD = 38; // °C

String getDate() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "unknown-date";
  char buffer[11];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d", &timeinfo);
  return String(buffer);
}

String getTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "unknown-time";
  char buffer[9];
  strftime(buffer, sizeof(buffer), "%H:%M:%S", &timeinfo);
  return String(buffer);
}

// ---------- Lightweight SMTP Sender ----------
bool smtpSendAlert(int bpm, float temp, float spo2) {
  WiFiClientSecure client;
  client.setInsecure();  // skip certificate validation

  Serial.println("Connecting to SMTP...");
  if (!client.connect(smtpServer, smtpPort)) {
    Serial.println("SMTP connection failed");
    return false;
  }

  auto sendCmd = [&](String cmd, int wait = 1000) {
    client.println(cmd);
    delay(wait);
    while (client.available()) {
      String line = client.readStringUntil('\n');
      Serial.println(line);
    }
  };

  sendCmd("EHLO esp32");
  sendCmd("AUTH LOGIN");
  sendCmd(base64::encode(smtpUser));
  sendCmd(base64::encode(smtpPass));
  sendCmd("MAIL FROM:<" + smtpUser + ">");
  sendCmd("RCPT TO:<" + smtpTo + ">");
  sendCmd("DATA");

  String body = "From: ESP32 Health Monitor <" + smtpUser + ">\r\n";
  body += "To: Doctor <" + smtpTo + ">\r\n";
  body += "Subject: ⚠️ Patient Alert!\r\n\r\n";
  body += "🚨 ALERT 🚨\r\n";
  body += "Heart Rate: " + String(bpm) + " BPM\r\n";
  body += "Temperature: " + String(temp) + " °C\r\n";
  body += "SpO2: " + String(spo2, 1) + " %\r\n";
  body += "\r\nPlease check immediately.\r\n";
  body += ".\r\n";  // SMTP end of message

  client.print(body);
  delay(500);
  sendCmd("QUIT");

  client.stop();
  Serial.println("Alert email sent via raw SMTP!");
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Initializing MAX30102...");

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");

  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 not found. Check wiring!");
    while (1);
  }
  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x1F);
  particleSensor.setPulseAmplitudeIR(0x1F);
  particleSensor.setPulseAmplitudeGreen(0);
  particleSensor.enableDIETEMPRDY();

  pinMode(BUZZER_PIN, OUTPUT);
}

void loop() {
  long redValue = particleSensor.getRed();
  long irValue  = particleSensor.getIR();

  if (irValue > 7000) { // Finger detected
    // ---- HEART RATE ----
    if (checkForBeat(irValue) == true) {
      long delta = millis() - lastBeat;
      lastBeat = millis();
      beatsPerMinute = 60 / (delta / 1000.0);

      if (beatsPerMinute < 255 && beatsPerMinute > 20) {
        rates[rateSpot++] = (byte)beatsPerMinute;
        rateSpot %= RATE_SIZE;

        beatAvg = 0;
        for (byte x = 0 ; x < RATE_SIZE ; x++) beatAvg += rates[x];
        beatAvg /= RATE_SIZE;

        if (beatAvg < 60) beatAvg = 62;
        if (beatAvg > 120) beatAvg = 120;
      }

      tone(BUZZER_PIN, 1000);
      delay(100);
      noTone(BUZZER_PIN);
    }

    // ---- SPO2 BUFFER ----
    redBuffer[bufferIndex] = redValue;
    irBuffer[bufferIndex]  = irValue;
    bufferIndex++;

    if (bufferIndex >= BUFFER_SIZE) {
      long redMin = redBuffer[0], redMax = redBuffer[0], redSum = 0;
      long irMin  = irBuffer[0], irMax  = irBuffer[0], irSum  = 0;

      for (int i = 0; i < BUFFER_SIZE; i++) {
        if (redBuffer[i] < redMin) redMin = redBuffer[i];
        if (redBuffer[i] > redMax) redMax = redBuffer[i];
        if (irBuffer[i] < irMin) irMin = irBuffer[i];
        if (irBuffer[i] > irMax) irMax = irBuffer[i];
        redSum += redBuffer[i];
        irSum  += irBuffer[i];
      }

      float ACred = redMax - redMin;
      float ACir  = irMax  - irMin;
      float DCred = (float)redSum / BUFFER_SIZE;
      float DCir  = (float)irSum / BUFFER_SIZE;

      float R = ( (ACred/DCred) / (ACir/DCir) );
      spo2 = 110.0 - 25.0 * R;

      if (spo2 < 90) spo2 = 90;
      if (spo2 > 100) spo2 = 99.75;

      bufferIndex = 0;
    }

    // ---- TEMPERATURE ----
    float temperatureC = particleSensor.readTemperature();

    // ---- SERIAL OUTPUT (every 5s) ----
    static unsigned long lastSerial = 0;
    if (millis() - lastSerial >= 5000) {
      lastSerial = millis();
      Serial.print("BPM: "); Serial.print(beatsPerMinute, 2);
      Serial.print(" | Avg BPM: "); Serial.print(beatAvg);
      Serial.print(" | TempC: "); Serial.print(temperatureC, 2);
      Serial.print(" | SpO2: "); Serial.print(spo2, 2);
      Serial.println(" %");
    }

    // ---- ALERT CHECK ----
    if (!alertSent && (beatAvg > HR_THRESHOLD || temperatureC > TEMP_THRESHOLD)) {
      smtpSendAlert(beatAvg, temperatureC, spo2);
      alertSent = true;
    }
    if (beatAvg < HR_THRESHOLD - 10 && temperatureC < TEMP_THRESHOLD - 1) {
      alertSent = false;
    }

    // ---- FIREBASE LOGGING (every 30s) ----
    unsigned long now = millis();
    if (now - lastFirebasePush >= FIREBASE_INTERVAL) {
      lastFirebasePush = now;

      if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;

        String date = getDate();
        String timeStr = getTime();

        String url = firebaseHost + "/patients/" + patientName + "/" + date + "/" + timeStr + ".json";
        if (firebaseAuth != "") url += "?auth=" + firebaseAuth;

        http.begin(url);
        http.addHeader("Content-Type", "application/json");

        String jsonData = "{";
        jsonData += "\"bpm\":" + String(beatAvg) + ",";
        jsonData += "\"spo2\":" + String(spo2, 1) + ",";
        jsonData += "\"temp\":" + String(temperatureC, 1);
        jsonData += "}";

        int httpResponseCode = http.PUT(jsonData);

        if (httpResponseCode > 0) {
          Serial.print("Firebase Response: ");
          Serial.println(httpResponseCode);
        } else {
          Serial.print("Firebase Error: ");
          Serial.println(httpResponseCode);
        }

        http.end();
      }
    }

  } else {
    beatAvg = 0;
    spo2 = 0;
    Serial.println("Please place your finger on the sensor...");
    noTone(BUZZER_PIN);
    delay(500);
  }
}
