# Ambient Memory Pendant — Companion PWA

[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Hardware](https://img.shields.io/badge/MCU-ESP32--S3%20Super%20Mini-E7352C?logo=espressif&logoColor=white)](https://www.espressif.com/)

A modern, local-first **Progressive Web App (PWA)** companion for the **Ambient Memory Pendant** — an unobtrusive wearable audio capture device powered by the **ESP32-S3 Super Mini with onboard battery charging circuitry**.

The system captures voice memos, ambient thoughts, lectures, and meetings offline to a microSD card, then synchronizes them to the companion interface over Bluetooth Low Energy (BLE) or high-speed Local Wi-Fi for AI transcription, structured summaries, key takeaways, and persistent action items.

---

## 🌟 Key Features

### 1. Software-First Development & Hardware Simulation
- **Zero-Hardware-Required Emulator**: A full mock hardware transport simulating the ESP32-S3 Super Mini, onboard charger states, battery drain/charging curves, physical privacy switch, and 4KB chunked audio streaming.
- **Resilient Transfer Protocol**: 4KB packet chunking with packet-level CRC32 verification, resumption from interruption, and microSD storage retention until verified confirmation ACK.
- **Hardware Fault Injection**: Built-in testbed to simulate packet loss, CRC corruption, transmission timeouts, and sudden disconnections to verify transfer recovery.

### 2. Battery & Telemetry Transparency
- **Honest Telemetry Contract**: Avoids fabricated percentages or fictitious battery monitoring GPIOs.
- Explicitly separates:
  - `chargingCircuitSupported` (Board-level onboard charging hardware flag)
  - `chargingStatusSignal` (`charging`, `charged`, `not_charging`, or `unknown` when STAT pin is unrouted)
  - `voltageMv` (Measured ADC voltage, or `null` if unmeasured)
  - `percentage` (Calibrated percentage, explicitly rendered as **"Uncalibrated / Unknown"** when unmeasured)
  - `estimatedRunMinutesRemaining` (Discharge-rate runtime estimate)

### 3. iOS Safari & Multi-Platform Compatibility
- **Transport Abstraction Layer**: Decoupled interface (`ITransport`) allowing seamless switching between:
  - **Mock Transport**: Instant testing without physical hardware.
  - **Web Bluetooth (Web BLE)**: Fast pairing on Chromium/Android.
  - **Local Wi-Fi SoftAP / HTTP REST**: Connects directly to the ESP32-S3 hotspot (`http://192.168.4.1/api`), providing full compatibility with **Apple Safari on iOS / iPadOS** (which lacks Web Bluetooth support) and ~50x faster audio transfers.

### 4. Interactive Audio Playback & Synchronized Transcripts
- **Waveform Scrubber & Speed Control**: 0.75x, 1x, 1.25x, 1.5x, and 2x playback rates with real-time waveform progress.
- **Click-to-Seek Transcripts**: Interactive speaker-labeled segments with active playback sync and auto-scroll.
- **Embedded Audio Synthesizer**: Generates authentic spoken-formant 16kHz WAV audio offline via the Web Audio API for immediate zero-asset testing.

### 5. AI Insights & Action Items Management
- **Executive Summaries & Topic Pills**: High-level digest of discussions with categorical tags.
- **Key Concepts & Study Questions**: Structured breakdown for review and learning.
- **Global Action Items Checklist**: Filterable cross-session task checklist with local persistence, completion tracking, direct audio timestamp jump, and Markdown export.

---

## 🛠️ Hardware Architecture & Pre-Flight Status

| Subsystem | Architecture Role | Pinout / Wiring | Verification Status |
|---|---|---|---|
| **Microcontroller** | ESP32-S3 Super Mini (Dual-Core Xtensa LX7, 240MHz) | Internal | Specified MCU |
| **Battery Charger** | Onboard LiPo Charging Circuitry | STAT Pin: TBD | Onboard Supported |
| **Voice Microphone** | External Peripheral (I2S / PDM) | BCLK, WS, DIN: TBD | TBD (Peripheral) |
| **MicroSD Storage** | External Peripheral (SPI / SDMMC) | CS, MOSI, MISO, SCK: TBD | TBD (Peripheral) |
| **Privacy Switch** | Hardware Interrupt (Halt recording) | GPIO: TBD | TBD (Peripheral) |
| **Battery Sensing** | ADC Voltage Divider | ADC1_CHx: TBD | Uncalibrated (Null) |

> **Hardware Design Rule**: Pinouts, GPIO assignments, and peripheral buses remain marked **TBD** until the physical board schematic and bench measurements confirm exact revisions.

---

## ⚡ Throughput Benchmark: BLE vs. Local Wi-Fi

A standard 1-minute 16kHz 16-bit mono uncompressed WAV recording requires **~1.92 MB (1,966,080 bytes)**:

- **Bluetooth Low Energy (Web BLE)**:
  - Browser throughput: **15–30 KB/s**
  - Transfer time for 1 minute of audio: **65 to 130 seconds** (slower than playback time).
- **Local Wi-Fi SoftAP / HTTP REST (`192.168.4.1`)**:
  - Measured throughput: **1,500–4,000 KB/s**
  - Transfer time for 1 minute of audio: **0.5 to 1.3 seconds** (~50x faster).
- **Recommended Strategy**: Use **BLE** for lightweight discovery, telemetry streaming, and session alerts; use **Local Wi-Fi** (or on-device Opus compression on the dual-core ESP32-S3) for fast audio file synchronization.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or 20+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/ASHxOnAIR-MEH/irfan-project.git
cd irfan-project

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building for Production

```bash
npm run build
```

Production assets are compiled into the `dist/` directory.

---

## 📱 PWA Installation
- **Desktop (Chrome/Edge/Brave)**: Click the **Install App** icon in the address bar or within the app header.
- **iOS Safari**: Tap the **Share** button $\rightarrow$ **Add to Home Screen**.
- **Android**: Tap the browser menu $\rightarrow$ **Install app / Add to Home screen**.

---

## 📄 License
MIT
