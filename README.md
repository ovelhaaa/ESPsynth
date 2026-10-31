# ESP32Synth WebAssembly Studio

> **Ambiente Interativo de Síntese DSP e Design de Timbres para ESP32 e ESP32-S3**  
> Port fiel 1:1 em **WebAssembly** e **AudioWorklet** da biblioteca C++ de alta performance [ESP32Synth](https://github.com/danilogcrf2-oss/ESP32Synth) criada por **Danilo Gabriel**.

[![Deploy to GitHub Pages](https://github.com/danilogcrf2-oss/ESP32Synth/actions/workflows/deploy.yml/badge.svg)](https://github.com/danilogcrf2-oss/ESP32Synth/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Audio: AudioWorklet + WASM](https://img.shields.io/badge/Audio-AudioWorklet%20%2B%20WASM-blue.svg)](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)

---

## 🎯 Sobre o Projeto

O **ESP32Synth WebAssembly Studio** roda exatamente o motor de áudio C++ da biblioteca **ESP32Synth** compilado diretamente para WebAssembly em uma thread dedicada via `AudioWorklet`.

Permite explorar timbres, ajustar envelopes analógicos em ponto fixo Q28, experimentar síntese FM, modelagem física Karplus-Strong, filtros biquad ressonantes e pedaleiras de efeitos globais diretamente no navegador — com osciloscópio em tempo real, telemetria de vozes e **exportação instantânea de sketches C++ (`.ino`) prontos para compilar no Arduino IDE ou PlatformIO**.

---

## ⚡ Principais Funcionalidades

### 1. Motor de Síntese e Formas de Onda (Oscillator Core)
* **Ponto Fixo Q28 e Resolução CentiHz:** Afinação em centésimos de Hertz (`1 Hz = 100 CentiHz`) para microtonalidade e zero floating-point overhead.
* **Formas de Onda Clássicas:** Sawtooth, Pulse (largura de pulso ajustável de 0 a 255), Sine interpolada por LUT de alta resolução, Triangle e PRNG Linear Noise.
* **Algoritmos Avançados C++ (`ESP32Synth_Patches.hpp`):**
  * `ESP32Patches::AA_Saw` e `AA_Pulse`: Osciladores antialiasing com PolyBLEP de zero branches.
  * `ESP32Patches::DSP_BiquadOsc` (TDF-II Q28) e `DSP_BiquadOscFast` (Direct Form I): Osciladores com filtro ressonante integrado.
  * `ESP32Patches::FM_Custom`: Síntese FM linear de 2 operadores seno (modulador $\to$ portadora).
  * `ESP32Patches::HammondB3`: Simulação de órgão tonewheel de 9 drawbars clássicos.
  * `ESP32Patches::EKS_Guitar`: Modelagem física de corda dedilhada por Karplus-Strong estendido.
* **Polifonia Configurável:** 1 (Monofônico), 4, 8 ou 16 vozes simultâneas com gerenciamento dinâmico.

### 2. Envelopes e Modulações
* **Envelope ADSR Q28:** Controle preciso de Attack, Decay, Sustain (0-255) e Release por voz com visualizador interativo em tempo real.
* **Modo Smooth Env:** Filtro RC analógico opcional para eliminação de cliques no início e término de transientes.
* **LFOs Dedicados:** Vibrato em CentiHz e Tremolo com taxa e profundidade independentes.
* **Portamento / Pitch Glide:** Deslize contínuo de frequência (`slideFreq`) com transição suave entre notas.

### 3. Roteamento de Bus e Efeitos Modulares
* **Barramento Modular (Bus 1):** Roteamento por voz para sub-barramentos de processamento.
* **Filtro Ressonante Modular (`FX_BiquadFilter` / `FX_BiquadFilterFast`):**
  * Modos: Low-Pass (LPF), High-Pass (HPF), Band-Pass (BPF) e Notch.
  * Controle de Ressonância em fator de qualidade $Q \times 100$ ou largura de banda em Hz (Bandwidth Mode).
  * Mix Dry/Wet e ganho do bus independentes.

### 4. Processamento Master e DSP Global
* **`DSP_HammondLeslie`:** Emulador de caixa rotativa Leslie com 3 estados de rotação (`0: Stop`, `1: Chorale/Lento`, `2: Tremolo/Rápido`) e reverb de mola/sala integrado.
* **`DSP_Pedalboard`:** Cadeia de pedais analógicos acionáveis independentemente:
  * `dp[0]`: Overdrive + Compressor + Simulação de Gabinete (3x LPF).
  * `dp[1]`: Modulated Stereo Chorus.
  * `dp[2]`: Slapback Delay de 16k amostras.
* **Bitcrusher Master:** Máscara de truncamento de bits para timbres lo-fi e chiptune estilo 8-bit.

### 5. Exportador de Código C++ Arduino (.ino)
* Gera com um clique o sketch completo para ESP32 configurado com os parâmetros exatos criados na interface.
* Inicialização oficial de hardware via `synth.begin(I2S_BCK_PIN, I2S_WS_PIN, I2S_DOUT_PIN, I2S_16BIT)`.

---

## 🎛️ Guia de Mapeamento dos Parâmetros C++ (1:1)

Para garantir fidelidade absoluta aos algoritmos do arquivo `ESP32Synth_Patches.hpp`, a interface adota a seguinte convenção de índices:

### Parâmetros de Voz (`vo->cp[]`)

| Algoritmo | `cp[0]` | `cp[1]` | `cp[2]` | `cp[3]` |
| :--- | :--- | :--- | :--- | :--- |
| **`DSP_BiquadOsc` / `Fast`** | **Wave Type** (`0=Saw, 1=Pulse, 2=Tri`) | **Cutoff Frequency (Hz)** (`20..16000`) | **Resonance / Q** ($Q \times 100$) | **Filter Mode** (`0=LPF, 1=HPF, 2=BPF, 3=Notch`) |
| **`FM_Custom`** | **Ratio Integer** (`1..16`) | **Ratio Fractional** (`0..99%`) | **Mod Index Base** (Brilho FM) | **Mod Decay Step** (Decaimento do envelope FM) |
| **`HammondB3`** | **Drawbar Preset** (`0..4`) | — | — | — |

### Efeitos de Barramento Modular (`ep[]`) — `FX_BiquadFilter`

* **`ep[0]`**: Frequência de corte (Hz) `[20..20000]`
* **`ep[1]`**: Modo do filtro (`0 = LPF`, `1 = HPF`, `2 = BPF`, `3 = Notch`)
* **`ep[2]`**: Ressonância ($Q \times 100$) ou Largura de Banda (Hz)
* **`ep[3]`**: Modo de Unidade (`0 = Q Mode`, `1 = Bandwidth Hz Mode`)
* **`ep[4]`**: Mix Dry/Wet `[1..255]`

### DSP Master Global (`dp[]`)

* **`DSP_HammondLeslie`:**
  * **`dp[0]`**: Rotor Speed State discreto (`0 = Stop`, `1 = Chorale`, `2 = Tremolo`)
  * **`dp[1]`**: Reverb Mix `[1..255]`
* **`DSP_Pedalboard`:**
  * **`dp[0]`**: Chave Overdrive / Amp / Cab Sim (`0 = Bypass`, `1 = Active`)
  * **`dp[1]`**: Chave Modulated Chorus (`0 = Bypass`, `1 = Active`)
  * **`dp[2]`**: Chave Slapback Delay (`0 = Bypass`, `1 = Active`)

---

## 📂 Estrutura do Repositório

```text
ESPsynth/
├── .github/workflows/deploy.yml     # Workflow de CI/CD para deploy no GitHub Pages
├── esp32synth-src/                  # Código-fonte original C++ do ESP32Synth (Danilo Gabriel)
│   ├── ESP32Synth.h                 # Header principal da biblioteca
│   ├── ESP32Synth.cpp               # Implementação do motor de áudio
│   ├── ESP32Synth_Patches.hpp       # Patches DSP (Biquad, FM, Hammond, Pedalboard, etc.)
│   └── ESP32SynthNotes.h            # Tabela de notas em CentiHz
├── esp32synth-examples/             # Exemplos originais para Arduino / ESP32
├── wasm/                            # Fontes C++ e scripts de compilação Emscripten/WASM
│   ├── esp32synth_wasm.cpp          # Wrapper de exportação C para WebAssembly
│   └── build.sh                     # Script de compilação emcc
├── public/                          # Binários estáticos WASM e worklet
│   └── esp32synth.wasm              # Binário WebAssembly compilado
├── src/
│   ├── audio/                       # Ponte de áudio Web Audio / AudioWorklet
│   │   ├── ESP32SynthEngine.ts      # Singleton do motor com fallback e bridge
│   │   ├── worklet_source.ts        # Código do AudioWorkletProcessor embutido
│   │   ├── types.ts                 # Enums e interfaces TypeScript 1:1
│   │   └── notes.ts                 # Frequências em CentiHz de todas as notas
│   ├── components/                  # Interface do estúdio em React
│   │   ├── VoicePanel.tsx           # Painel de osciladores, ADSR e cp[0..3]
│   │   ├── MasterPanel.tsx          # Painel master, Bus FX e DSP global
│   │   ├── Oscilloscope.tsx         # Osciloscópio e analisador FFT
│   │   ├── VoiceTelemetryGrid.tsx   # Visualizador de atividade de cada voz
│   │   ├── VirtualKeyboard.tsx      # Teclado virtual com mapeamento de teclado físico
│   │   ├── EnvelopeVisualizer.tsx   # Gráfico de curvas do envelope ADSR
│   │   └── CodeExportModal.tsx      # Gerador de código .ino para hardware
│   └── App.tsx                      # Componente raiz e gerenciador de presets
└── vite.config.ts                   # Configuração do Vite com suporte a GitHub Pages
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* [Node.js](https://nodejs.org/) versão 20 ou superior
* Gerenciador de pacotes `npm`

### Passos

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/danilogcrf2-oss/ESP32Synth.git
   cd ESPsynth
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Abra seu navegador em `http://localhost:3000`.

4. **Para gerar a build de produção:**
   ```bash
   npm run build
   ```

---

## 🌐 Deploy Automático no GitHub Pages

O projeto já inclui o workflow de GitHub Actions em [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

Para habilitar a publicação automática:
1. No seu repositório no GitHub, vá em **Settings** > **Pages**.
2. Na seção **Build and deployment**, em **Source**, selecione **GitHub Actions**.
3. A cada push na branch `main`, o workflow executará a compilação e o deploy automático na URL pública do seu repositório.

---

## 🔌 Ligação no Hardware (ESP32 / ESP32-S3)

Para rodar os timbres exportados pelo estúdio em uma placa física, você precisará de uma placa ESP32 e um módulo DAC I2S como **PCM5102A** ou **MAX98357A**.

### Esquema de Conexão Recomendado

| Sinal I2S | Pino ESP32 Padrão | Pino ESP32-S3 Típico | Módulo DAC (PCM5102A / MAX98357A) |
| :--- | :--- | :--- | :--- |
| **BCK** (Bit Clock) | `GPIO 26` | `GPIO 15` | `BCK` |
| **WS / LRC** (Word Select) | `GPIO 25` | `GPIO 16` | `LCK` / `WS` |
| **DOUT** (Data Out) | `GPIO 22` | `GPIO 7` | `DIN` / `DATA` |
| **VCC** | `5V` ou `3.3V` | `5V` ou `3.3V` | `VCC` |
| **GND** | `GND` | `GND` | `GND` |

---

## 📜 Licença e Créditos

* **Motor C++ ESP32Synth:** Desenvolvido originalmente por **Danilo Gabriel** ([github.com/danilogcrf2-oss/ESP32Synth](https://github.com/danilogcrf2-oss/ESP32Synth)).
* **Interface WebAssembly Studio:** Distribuído sob a licença [MIT](LICENSE).
