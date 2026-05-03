# AutoYT - YouTube Clips Automation 🚀

AutoYT is a complete and automated solution for transforming long videos (podcasts, lives, vlogs) into viral clips ready for YouTube Shorts and long-form videos. Using cutting-edge Artificial Intelligence, the system analyzes transcripts, identifies the best moments, performs automatic editing with word-by-word subtitles, and uploads them to your channel.

## ✨ Features

- 🤖 **AI Analysis**: Uses OpenAI (GPT-4o) or local models (Llama-cpp) to identify viral, funny, or impactful moments.
- 🗣️ **Accurate Transcription**: Integrated with OpenAI Whisper to generate word-by-word synchronized subtitles.
- 🎨 **AI Thumbnails**: Automatic generation of impactful thumbnails using DALL-E 3.
- 🎬 **Automatic Editing**: Precise clipping and subtitle burn-in using FFmpeg.
- ☁️ **S3 Storage**: Full integration with MinIO/S3 for managing video files and metadata.
- 📈 **Web Dashboard**: Modern React interface to manage channels, edit prompts, and monitor clip status.
- 📅 **Smart Scheduling**: Integrated cron system to automatically process channels and perform daily uploads.
- 🔐 **Integrated OAuth2**: Simplified YouTube authorization directly through the browser.
- 🌍 **Multi-language**: Full support for Portuguese (BR) and English across the entire interface.

## 📸 Screenshots

Here are some previews of the AutoYT interface:

| Dashboard | Channels |
|:---:|:---:|
| ![Dashboard](imagens/00.png) | ![Channels](imagens/01.png) |

| Clips | LLM Prompt |
|:---:|:---:|
| ![Clips](imagens/02.png) | ![Prompt](imagens/03.png) |

| Settings | Logs |
|:---:|:---:|
| ![Settings](imagens/04.png) | ![Logs](imagens/05.png) |

## 🛠️ Tech Stack

- **Backend**: Python (FastAPI, Motor, MongoDB, APScheduler)
- **Frontend**: React (Vite, TypeScript, Tailwind CSS, Lucide Icons)
- **Video Processing**: FFmpeg, yt-dlp
- **AI/ML**: OpenAI API, Whisper, Llama-cpp-python
- **Storage**: MinIO (S3 Compatible)

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- Docker and Docker Compose (for Database and Storage)
- FFmpeg installed on the system

### Installation and Setup

1. Clone the repository:
```bash
git clone https://github.com/israelfds/youtube-automation-share.git
cd youtube-automation-share
```

2. Run the setup script:
The `setup.sh` script will configure the virtual environment, install system dependencies, set up the `.env` file, build the frontend, and start the necessary Docker containers automatically.
```bash
chmod +x setup.sh
./setup.sh
```

3. Start the application:
After the setup, use the start script to launch both the backend and frontend:
```bash
chmod +x start.sh
./start.sh
```

4. Access the dashboard:
The system will be available at `http://localhost:7070`

## ⚙️ Google Cloud Configuration (YouTube API)

To enable automatic uploads, you will need a Google Cloud Console account:
1. Create a project and enable the **YouTube Data API v3**.
2. Go to **Credentials** and create an **OAuth 2.0 Client ID** of type "Desktop App".
3. Add the Redirect URI: `http://localhost:7070/api/settings/youtube/callback`
4. Copy the Client ID and Client Secret into the **Settings** tab in the AutoYT dashboard.

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---
Developed by Israel Feitosa.
