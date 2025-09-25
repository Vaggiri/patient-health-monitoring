// netlify/functions/send-alert.js

const sendgrid = require('@sendgrid/mail');

// Your secret API key is stored in an environment variable.
// NEVER hardcode your API key in the code.
sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async function (event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    const msg = {
      to: 'hdaprojectofficial@gmail.com', // The recipient
      from: 'girirubiv2007@gmail.com', // Your verified sender email in SendGrid
      subject: `URGENT: Health Alert for Patient ${data.patientName}`,
      html: `
        <h2>HealthTracker Automated Alert</h2>
        <p>This is an automated alert regarding a critical health reading.</p>
        <ul>
          <li><strong>Patient:</strong> ${data.patientName}</li>
          <li><strong>Alert Type:</strong> ${data.alertType}</li>
          <li><strong>Recent Readings:</strong> ${data.readings.join(' bpm, ')} bpm</li>
        </ul>
        <p>Please review the patient's dashboard immediately.</p>
      `,
    };

    // Await the email send
    await sendgrid.send(msg);

    // Return a success response
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Alert email sent successfully!' }),
    };
  } catch (error) {
    console.error(error);
    // Return an error response
    return {
      statusCode: error.code || 500,
      body: JSON.stringify({ error: 'There was an error sending the email.' }),
    };
  }
};