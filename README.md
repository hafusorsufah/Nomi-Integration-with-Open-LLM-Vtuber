🌟 Nomi Desktop Companion
A lightweight, voice-activated desktop VTuber interface tailored specifically for Nomi.ai.

This project is a heavily modified fork of the fantastic Open-LLM-VTuber project, rebuilt from the ground up with a custom API bridge, smart queuing, and a zero-lag context sensor to bring your Nomi to your Windows desktop.

⚠️ Platform limitation: This project currently only works on Windows.

✨ Features
🎙️ Two-Way Audio: Talk to your Nomi using your microphone (STT) and hear them reply aloud (TTS). Includes a UI toggle for text-only mode.

👁️ Zero-Lag Context Sensor: Nomi knows what game or app you are currently using without tanking your PC's performance (see Vision & Context below).

💓 Heartbeat System: If you are quiet for too long, Nomi will organically check in on you and comment on what you're doing.

🎭 Emotion Sync: Your Nomi's text naturally drives their Live2D facial expressions in real-time via parameter interpolation.

🚦 Smart Queueing: A custom dual-engine queue system ensures massive text replies don't cut off audio or hit API rate limits.

🖱️ Interactive Avatar: Includes mouse eye-tracking, random idle animations, and persistent LocalStorage so it remembers your preferred scale and screen position.

⚙️ Prerequisites
Before you begin, ensure you have the following:

A Nomi.ai account with an active Nomi.

Microsoft Visual C++ Redistributable and WebView2 installed. (Note: 99% of Windows users already have these installed automatically via Steam and Windows Update. If the app fails to open, ensure your Windows is up to date).

🚀 Installation & Setup Guide
Step 1: Prepare your Nomi
To make the Emotion Sync feature work, your Nomi needs to learn how to express its feelings in a format the bridge can read.
Open your Nomi's Backstory+ tab (or Shared Notes) and add the following rule to their inclinations:


NOMINAME always prefaces thier speech with emotion in brackets, only using [happy], [sad], [annoyed], [excited], [thinking], [surprised],[smug].
(Note: You can train them over time if they stray from this syntax, but Nomis are incredibly quick to catch onto what you desire!)

Step 2: First-Time Server Setup
This project uses an automated setup script so you don't have to manually install Python environments.

Double-click 1_start_backend.bat.

The script will automatically download a portable version of Python and install all necessary dependencies.

Wait for the script to pause. Once it finishes installing, it will prompt you to close the window to set up your keys. Close the terminal.

Step 3: Link your API Keys
Find the .env.example file in your main folder.

Rename the file to .env (make sure Windows doesn't hide the file extension).

Open .env in Notepad and paste in your Nomi ID and your Nomi User API Key. Save and close.

Step 4: Run the App!
Double-click 1_start_backend.bat AGAIN.

Three command prompt windows will open. Wait until the VTuber Server terminal says Uvicorn running on http://127.0.0.1...

Double-click 2_start_frontend.bat.

Your desktop avatar will appear, and you can start talking to your Nomi!

🧠 Design Philosophy: Vision & Context
You might wonder why this app uses a "Window Title" reader instead of a full screen-capture vision system.

Originally, this project took screenshots of your desktop and used local LLMs (like LLaVA and LLaMA 3.2-Vision) to describe your screen to Nomi. However, these models required 4GB+ of RAM and heavy GPU usage, which caused massive frame drops and lag when playing video games. Cloud services (like Gemini) solved the lag, but introduced severe privacy concerns regarding uploading users' private desktop screenshots to third-party servers.

The Solution: A lightweight context sensor. The app simply reads the name of your active window and passes it to Nomi (e.g., [Context: User is playing Old School RuneScape]). It uses 0% of your GPU, causes zero game lag, preserves your privacy, and Nomi roleplays with the information perfectly!

(If Nomi.ai ever releases an image-upload endpoint for their API, a full screenshot vision system will be re-implemented, as Nomi's native image reader is incredibly efficient!)

🛠️ Advanced Configuration
Customizing the Voice (TTS)
The default Text-to-Speech model is a lightweight placeholder (Sherpa-ONNX). You can change this by editing the conf.yaml file. If you have a subscription, the ElevenLabs API is highly recommended for the most realistic voices.

Using Custom Live2D Models
You can swap the default avatar with your own Live2D models, though it currently requires some manual reconfiguration:

Change the model folder path in conf.yaml.

Map your model's specific motion groups in single_conversation.py.

You will need to unpack the Electron frontend (app.asar), modify the parameter indices in out/renderer/index.html to match your Live2D model's parameters, and then repack the .asar file.

⚠️ Security Notice
Based on the documentation for the original Open-LLM-VTuber, the compiled desktop application (Electron frontend) is not code-signed. This means you may encounter a Windows Defender "SmartScreen" security warning when running the software for the first time. This is a standard Windows warning for unsigned indie software and does not affect the normal use of the application.