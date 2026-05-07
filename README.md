# Virtual Hand Gesture Mouse (IIoT Control Terminal)

A web-based Virtual Mouse and Industrial IoT (IIoT) control dashboard built with Python (Flask) and MediaPipe for computer vision hand-tracking.

## Setup Instructions

1. Make sure you have Python 3 installed.
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the application locally:
   ```bash
   python app.py
   ```
4. Open your browser and navigate to `http://localhost:5000`

## Deployment on Render

This project is configured to be deployed easily using Render's free tier. 

1. Create a new "Web Service" on your Render dashboard.
2. Connect your GitHub repository containing this project.
3. Configure the following settings for the web service:
   - **Environment:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
4. Click deploy and your app will be live. Ensure that you grant camera permissions on the deployed HTTPS site.
