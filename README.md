AGK AI - Full Stack AI Assistant

AGK AI is a robust, full-stack AI chat application built to mimic the experience of modern interfaces like ChatGPT. It features real-time streaming responses, secure authentication, persistent chat history, and voice input support, powered by Google's Gemini 2.5 Flash model.

🚀 Features

⚡ Real-time Streaming: Responses appear word-by-word (typewriter effect) for a snappy user experience.

🔐 Secure Authentication: Full Login/Signup system using JWT (JSON Web Tokens) and password hashing.

🗄️ Persistent History: All conversations are stored securely in MongoDB and organized by date (Today, Yesterday, Older).

🎤 Voice Input: Integrated Speech-to-Text allows users to speak prompts directly to the AI.

💻 Code Highlighting: Automatic syntax highlighting for code blocks using Prism.js.

📱 Fully Responsive: A clean, mobile-first UI that adapts perfectly to desktop and mobile screens (ChatGPT-like aesthetic).

✏️ Chat Management: Rename, delete, and switch between multiple chat sessions instantly.

📸 Multimodal Support: (Future roadmap) Prepare to upload images for AI analysis.

🛠️ Tech Stack

Frontend:

HTML5 & Vanilla JavaScript (ES6+)

Tailwind CSS (via CDN) for styling

Lucide Icons for UI elements


Backend:

Node.js & Express.js

MongoDB (Mongoose) for database

JWT & Bcryptjs for auth security

Google Generative AI API (Gemini 2.5 Flash)

📋 Prerequisites

Before you begin, ensure you have the following installed:

Node.js (v16 or higher)

MongoDB (Local) or a MongoDB Atlas account (Cloud)

⚙️ Installation & Setup


Install Dependencies

npm install


Configure Environment Variables
Create a .env file in the root directory and add your secrets.
(You can use .env.example as a reference)

# .env
PORT=3000
MONGO_URI=mongodb://localhost:27017/ Or your Atlas Connection String
JWT_SECRET="Your Choice"
GEMINI_API_KEY=your_google_gemini_api_key


Start the Server

npm start


Access the App
Open your browser and go to: http://localhost:3000

📂 Project Structure

/agk-ai
  ├── public/              # Frontend Static Files
  │   ├── index.html       # Main UI Structure
  │   ├── styles.css       # Custom Styling & Tailwind Overrides
  │   └── script.js        # Frontend Logic (Auth, Chat, UI)
  ├── server.js            # Backend API & Database Logic
  ├── package.json         # Project Dependencies
  ├── .env                 # Environment Variables (Not committed)
  └── README.md            # Project Documentation


🔒 Security Highlights

Environment Variables: API keys and Database URIs are never hardcoded.

Password Hashing: User passwords are hashed with bcryptjs before storage.

Protected Routes: API endpoints verify JWT tokens before processing requests.

Safe Content: Frontend sanitizes inputs to prevent XSS attacks.


🤝 Contributing

Contributions are welcome! Please fork the repository and create a pull request for any feature updates.

Fork the Project

Create your Feature Branch (git checkout -b feature/AmazingFeature)

Commit your Changes (git commit -m 'Add some AmazingFeature')

Push to the Branch (git push origin feature/AmazingFeature)

Open a Pull Request
