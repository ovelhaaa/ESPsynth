/**
 * ============================================================================
 * wasm_bridge.cpp - ESP32Synth WebAssembly Bridge & Bindings
 * ============================================================================
 * Wrapper 1:1 completo para a biblioteca C++ ESP32Synth de Danilo Gabriel.
 * Permite execução freestanding no navegador (via Emscripten ou clang -target wasm32)
 * a 48 kHz preservando 100% dos algoritmos de síntese inteira e ponto fixo (Q28).
 *
 * COMANDO EMCC (Emscripten) COMPLETO:
 * emcc -O3 -fno-exceptions -fno-rtti \
 *   -s WASM=1 \
 *   -s ENVIRONMENT=worker \
 *   -s ALLOW_MEMORY_GROWTH=1 \
 *   -s INITIAL_MEMORY=33554432 \
 *   -s EXPORTED_FUNCTIONS="['_malloc','_free','_process_audio_block','_synth_alloc_float_buffer','_synth_init','_synth_end','_synth_setSampleRate','_synth_getSampleRate','_synth_setControlRateHz','_synth_setMasterVolume','_synth_getMasterVolume','_synth_setVolDepthBase','_synth_setMasterBitcrush','_synth_getCPULoad','_synth_renderStereo','_synth_renderMono','_synth_noteOn','_synth_noteOff','_synth_setFrequency','_synth_setVolume','_synth_setWave','_synth_setPulseWidthBitDepth','_synth_setPulseWidth','_synth_setEnv','_synth_setSmoothEnv','_synth_setStartPhase','_synth_setCurrentPhase','_synth_setVibrato','_synth_setVibratoPhase','_synth_setTremolo','_synth_setTremoloPhase','_synth_slideFreq','_synth_slideFreqTo','_synth_slideVol','_synth_slideVolTo','_synth_setCustomWavePatch','_synth_setCustomParam','_synth_setVoiceBus','_synth_setBusFXPatch','_synth_setBusFXParam','_synth_setBusMix','_synth_setCustomDSPPatch','_synth_setDSPParam','_synth_setArpeggio','_synth_detachArpeggio','_synth_setWavetable','_synth_getWavetableBuffer','_synth_getFrequencyCentiHz','_synth_getVolume','_synth_getVolume8Bit','_synth_getEnv8Bit','_synth_getOutput8Bit','_synth_isVoiceActive','_synth_getEnvState','_synth_getWaveType','_synth_getPhase','_synth_getPulseWidth']" \
 *   -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap','HEAPF32','HEAP16','HEAPU8']" \
 *   -I wasm/include -I esp32synth-src \
 *   -DENABLE_MP3=0 \
 *   wasm/wasm_bridge.cpp esp32synth-src/ESP32Synth.cpp \
 *   -o public/esp32synth.js
 * ============================================================================
 */

#if defined(__EMSCRIPTEN__)
  #include <emscripten/emscripten.h>
#else
  #ifndef EMSCRIPTEN_KEEPALIVE
    #define EMSCRIPTEN_KEEPALIVE __attribute__((used)) __attribute__((visibility("default")))
  #endif
#endif

// Definições vazias para qualificadores específicos do ESP-IDF / FreeRTOS / Arduino
#if defined(__EMSCRIPTEN__) || defined(__wasm__)
  #ifndef IRAM_ATTR
    #define IRAM_ATTR
  #endif
  #ifndef DRAM_ATTR
    #define DRAM_ATTR
  #endif
  #ifndef PROGMEM
    #define PROGMEM
  #endif
  #ifndef ICACHE_RAM_ATTR
    #define ICACHE_RAM_ATTR
  #endif
  #ifndef ESP_INTR_FLAG_IRAM
    #define ESP_INTR_FLAG_IRAM 0
  #endif
  #define CONFIG_IDF_TARGET_GENERIC 1
  #define ENABLE_MP3 0
#endif

// Inclusão dos headers de compatibilidade e da biblioteca ESP32Synth
#include "wasm_compat.h"
#include "ESP32Synth.h"
#include "ESP32SynthNotes.h"
#include "ESP32Synth_Patches.hpp"

// Instância única global do sintetizador
static ESP32Synth synth;

// Buffers internos de extração de áudio
static int16_t s_outBufferStereo[4096];
static int16_t s_outBufferMono[2048];

// Static pool de memória e rotinas freestanding (quando compilado com clang wasm32 sem libc)
#if !defined(__EMSCRIPTEN__)
extern "C" {
int __cxa_atexit(void (*func)(void*), void* arg, void* dso) { return 0; }
int atexit(void (*func)(void)) { return 0; }

void* memset(void* dest, int val, size_t len) {
    unsigned char* ptr = (unsigned char*)dest;
    while (len-- > 0) *ptr++ = (unsigned char)val;
    return dest;
}

void* memcpy(void* dest, const void* src, size_t len) {
    char* d = (char*)dest;
    const char* s = (const char*)src;
    while (len-- > 0) *d++ = *s++;
    return dest;
}

void* memmove(void* dest, const void* src, size_t len) {
    char* d = (char*)dest;
    const char* s = (const char*)src;
    if (d < s) {
        while (len-- > 0) *d++ = *s++;
    } else {
        d += len;
        s += len;
        while (len-- > 0) *--d = *--s;
    }
    return dest;
}

int memcmp(const void* s1, const void* s2, size_t n) {
    const unsigned char* p1 = (const unsigned char*)s1;
    const unsigned char* p2 = (const unsigned char*)s2;
    while (n--) {
        if (*p1 != *p2) return *p1 - *p2;
        p1++; p2++;
    }
    return 0;
}

int strncmp(const char* s1, const char* s2, size_t n) {
    while (n && *s1 && (*s1 == *s2)) {
        s1++; s2++; n--;
    }
    if (n == 0) return 0;
    return *(const unsigned char*)s1 - *(const unsigned char*)s2;
}

int abs(int j) { return (j < 0) ? -j : j; }

double sin(double x) {
    const double kPI = 3.14159265358979323846;
    const double kTWO_PI = 6.28318530717958647692;
    while (x > kPI) x -= kTWO_PI;
    while (x < -kPI) x += kTWO_PI;
    double x2 = x * x;
    double x3 = x * x2;
    double x5 = x3 * x2;
    double x7 = x5 * x2;
    double x9 = x7 * x2;
    return x - (x3 / 6.0) + (x5 / 120.0) - (x7 / 5040.0) + (x9 / 362880.0);
}

double cos(double x) {
    const double kHALF_PI = 1.57079632679489661923;
    return sin(x + kHALF_PI);
}

double pow(double base, double exp) {
    if (exp == 0.0) return 1.0;
    if (base <= 0.0) return 0.0;
    if (base == 2.0) {
        int i = (int)exp;
        double f = exp - i;
        double r = (i >= 0) ? (double)(1ULL << (i > 30 ? 30 : i)) : 1.0 / (double)(1ULL << (-i > 30 ? 30 : -i));
        double frac_val = 1.0 + f * (0.69314718 + f * 0.2402265);
        return r * frac_val;
    }
    return 1.0;
}

float powf(float base, float exp) { return (float)pow(base, exp); }
float expf(float x) { return (float)pow(2.718281828459045, x); }
float logf(float x) { return 0.0f; }

static uint8_t s_heap[1024 * 1024];
static size_t s_heap_offset = 0;

void* malloc(size_t size) {
    size = (size + 15) & ~15;
    if (s_heap_offset + size > sizeof(s_heap)) return nullptr;
    void* ptr = &s_heap[s_heap_offset];
    s_heap_offset += size;
    return ptr;
}

void* calloc(size_t nmemb, size_t size) {
    size_t total = nmemb * size;
    void* ptr = malloc(total);
    if (ptr) memset(ptr, 0, total);
    return ptr;
}

void free(void* ptr) {
    // Bump allocator: sem custo em WASM single-thread
}
}
#endif

extern "C" {

#if !defined(__EMSCRIPTEN__)
extern void __wasm_call_ctors();
#endif

// ============================================================================
// 1. Inicialização e Controle do Motor
// Neutraliza I2S/FreeRTOS e opera em modo pull síncrono via beginCustom
// ============================================================================

EMSCRIPTEN_KEEPALIVE
bool synth_init(uint32_t sampleRate) {
#if !defined(__EMSCRIPTEN__)
    __wasm_call_ctors();
#endif
    // beginCustom(sampleRate, nullptr) inicia o sintetizador no modo PULL (sem criar tasks de FreeRTOS nem hardware I2S)
    return synth.beginCustom(sampleRate, nullptr);
}

EMSCRIPTEN_KEEPALIVE
void synth_end() {
    synth.end();
}

EMSCRIPTEN_KEEPALIVE
void synth_setSampleRate(uint32_t rate) {
    synth.setSampleRate(rate);
}

EMSCRIPTEN_KEEPALIVE
int32_t synth_getSampleRate() {
    return synth.getSampleRate();
}

EMSCRIPTEN_KEEPALIVE
void synth_setControlRateHz(uint16_t hz) {
    synth.setControlRateHz(hz);
}

EMSCRIPTEN_KEEPALIVE
void synth_setMasterVolume(uint16_t volume) {
    synth.setMasterVolume(volume);
}

EMSCRIPTEN_KEEPALIVE
uint16_t synth_getMasterVolume() {
    return synth.getMasterVolume();
}

EMSCRIPTEN_KEEPALIVE
void synth_setVolDepthBase(uint8_t bits) {
    synth.setVolDepthBase(bits);
}

EMSCRIPTEN_KEEPALIVE
void synth_setMasterBitcrush(uint8_t bits) {
    synth.setMasterBitcrush(bits);
}

EMSCRIPTEN_KEEPALIVE
float synth_getCPULoad() {
    return synth.getCPULoad();
}

// ============================================================================
// 2. Renderização de Áudio Síncrona (AudioWorklet Callback)
// ============================================================================

/**
 * Renderiza um bloco estéreo diretamente para dois buffers float32 (-1.0f a 1.0f).
 * Extrai os samples gerados pelo ESP32Synth (16-bit com saturação ou 32-bit normalizados)
 * e grava em output_left e output_right.
 */
EMSCRIPTEN_KEEPALIVE
void process_audio_block(float* output_left, float* output_right, int num_frames) {
    if (num_frames > 2048) num_frames = 2048;
    synth.generateSamplesStereo(s_outBufferStereo, num_frames);
    const float norm = 1.0f / 32768.0f;
    for (int i = 0; i < num_frames; ++i) {
        output_left[i] = (float)s_outBufferStereo[i * 2] * norm;
        output_right[i] = (float)s_outBufferStereo[i * 2 + 1] * norm;
    }
}

EMSCRIPTEN_KEEPALIVE
int16_t* synth_renderStereo(int numFrames) {
    if (numFrames > 2048) numFrames = 2048;
    synth.generateSamplesStereo(s_outBufferStereo, numFrames);
    return s_outBufferStereo;
}

EMSCRIPTEN_KEEPALIVE
int16_t* synth_renderMono(int numSamples) {
    if (numSamples > 2048) numSamples = 2048;
    synth.generateSamples(s_outBufferMono, numSamples);
    return s_outBufferMono;
}

EMSCRIPTEN_KEEPALIVE
float* synth_alloc_float_buffer(int count) {
    return (float*)malloc(count * sizeof(float));
}

// ============================================================================
// 3. Controle de Vozes 1:1
// ============================================================================

EMSCRIPTEN_KEEPALIVE
void synth_noteOn(uint16_t voice, uint32_t freqCentiHz, uint16_t volume) {
    synth.noteOn(voice, freqCentiHz, volume);
}

EMSCRIPTEN_KEEPALIVE
void synth_noteOff(uint16_t voice) {
    synth.noteOff(voice);
}

EMSCRIPTEN_KEEPALIVE
void synth_setFrequency(uint16_t voice, uint32_t freqCentiHz) {
    synth.setFrequency(voice, freqCentiHz);
}

EMSCRIPTEN_KEEPALIVE
void synth_setVolume(uint16_t voice, uint16_t volume) {
    synth.setVolume(voice, volume);
}

EMSCRIPTEN_KEEPALIVE
void synth_setWave(uint16_t voice, int8_t type) {
    synth.setWave(voice, (WaveType)type);
}

EMSCRIPTEN_KEEPALIVE
void synth_setPulseWidthBitDepth(uint8_t bits) {
    synth.setPulseWidthBitDepth(bits);
}

EMSCRIPTEN_KEEPALIVE
void synth_setPulseWidth(uint16_t voice, uint32_t width) {
    synth.setPulseWidth(voice, width);
}

EMSCRIPTEN_KEEPALIVE
void synth_setEnv(uint16_t voice, uint16_t a, uint16_t d, uint8_t s, uint16_t r) {
    synth.setEnv(voice, a, d, s, r);
}

EMSCRIPTEN_KEEPALIVE
void synth_setSmoothEnv(uint16_t voice, bool enable) {
    synth.setSmoothEnv(voice, enable);
}

EMSCRIPTEN_KEEPALIVE
void synth_setStartPhase(uint16_t voice, uint16_t phaseDegrees) {
    synth.setStartPhase(voice, phaseDegrees);
}

EMSCRIPTEN_KEEPALIVE
void synth_setCurrentPhase(uint16_t voice, uint16_t phaseDegrees) {
    synth.setCurrentPhase(voice, phaseDegrees);
}

EMSCRIPTEN_KEEPALIVE
void synth_setVibrato(uint16_t voice, uint32_t rateCentiHz, uint32_t depthCentiHz) {
    synth.setVibrato(voice, rateCentiHz, depthCentiHz);
}

EMSCRIPTEN_KEEPALIVE
void synth_setVibratoPhase(uint16_t voice, uint16_t phaseDegrees) {
    synth.setVibratoPhase(voice, phaseDegrees);
}

EMSCRIPTEN_KEEPALIVE
void synth_setTremolo(uint16_t voice, uint32_t rateCentiHz, uint16_t depth) {
    synth.setTremolo(voice, rateCentiHz, depth);
}

EMSCRIPTEN_KEEPALIVE
void synth_setTremoloPhase(uint16_t voice, uint16_t phaseDegrees) {
    synth.setTremoloPhase(voice, phaseDegrees);
}

EMSCRIPTEN_KEEPALIVE
void synth_slideFreq(uint16_t voice, uint32_t startFreqCentiHz, uint32_t endFreqCentiHz, uint32_t durationMs) {
    synth.slideFreq(voice, startFreqCentiHz, endFreqCentiHz, durationMs);
}

EMSCRIPTEN_KEEPALIVE
void synth_slideFreqTo(uint16_t voice, uint32_t endFreqCentiHz, uint32_t durationMs) {
    synth.slideFreqTo(voice, endFreqCentiHz, durationMs);
}

EMSCRIPTEN_KEEPALIVE
void synth_slideVol(uint16_t voice, uint16_t startVol, uint16_t endVol, uint32_t durationMs) {
    synth.slideVol(voice, startVol, endVol, durationMs);
}

EMSCRIPTEN_KEEPALIVE
void synth_slideVolTo(uint16_t voice, uint16_t endVol, uint32_t durationMs) {
    synth.slideVolTo(voice, endVol, durationMs);
}

// ============================================================================
// 4. Patches Customizados (PolyBLEP, BiquadOsc, FM, HammondB3, Karplus-Strong)
// ============================================================================

EMSCRIPTEN_KEEPALIVE
void synth_setCustomWavePatch(uint16_t voice, int patchId) {
    switch (patchId) {
        case 1: synth.setCustomWave(voice, ESP32Patches::AA_Saw); break;
        case 2: synth.setCustomWave(voice, ESP32Patches::AA_Pulse); break;
        case 3: synth.setCustomWave(voice, ESP32Patches::DSP_BiquadOscFast); break;
        case 4: synth.setCustomWave(voice, ESP32Patches::DSP_BiquadOsc); break;
        case 5: synth.setCustomWave(voice, ESP32Patches::FM_Custom); break;
        case 6: synth.setCustomWave(voice, ESP32Patches::HammondB3); break;
        case 7: synth.setCustomWave(voice, ESP32Patches::EKS_Guitar); break;
        default:
            synth.setCustomWave(voice, nullptr);
            synth.setWave(voice, WAVE_SINE);
            break;
    }
}

EMSCRIPTEN_KEEPALIVE
void synth_setCustomParam(uint16_t voice, uint8_t paramId, int16_t value) {
    synth.setCustomParam(voice, paramId, value);
}

// ============================================================================
// 5. Roteamento de Bus e Efeitos (Biquad Filter, Biquad Filter Fast)
// ============================================================================

EMSCRIPTEN_KEEPALIVE
void synth_setVoiceBus(uint16_t voice, uint8_t busId) {
    synth.setVoiceBus(voice, busId);
}

EMSCRIPTEN_KEEPALIVE
void synth_setBusFXPatch(uint8_t busId, uint8_t slotId, int fxPatchId) {
    switch (fxPatchId) {
        case 1: synth.setBusFX(busId, slotId, FX_CUSTOM, ESP32Patches::FX_BiquadFilter); break;
        case 2: synth.setBusFX(busId, slotId, FX_CUSTOM, ESP32Patches::FX_BiquadFilterFast); break;
        default: synth.setBusFX(busId, slotId, FX_NONE, nullptr); break;
    }
}

EMSCRIPTEN_KEEPALIVE
void synth_setBusFXParam(uint8_t busId, uint8_t slotId, uint8_t paramId, int16_t value) {
    synth.setBusFXParam(busId, slotId, paramId, value);
}

EMSCRIPTEN_KEEPALIVE
void synth_setBusMix(uint8_t busId, uint8_t volume) {
    synth.setBusMix(busId, volume);
}

// ============================================================================
// 6. Efeitos Globais DSP (Leslie Rotary, Pedalboard Overdrive/Delay)
// ============================================================================

EMSCRIPTEN_KEEPALIVE
void synth_setCustomDSPPatch(int dspPatchId) {
    switch (dspPatchId) {
        case 1: synth.setCustomDSP(ESP32Patches::DSP_HammondLeslie); break;
        case 2: synth.setCustomDSP(ESP32Patches::DSP_Pedalboard); break;
        default: synth.setCustomDSP(nullptr); break;
    }
}

EMSCRIPTEN_KEEPALIVE
void synth_setDSPParam(uint8_t paramId, int16_t value) {
    synth.setDSPParam(paramId, value);
}

// ============================================================================
// 7. Arpeggiador de Hardware
// ============================================================================

EMSCRIPTEN_KEEPALIVE
void synth_setArpeggio(uint16_t voice, uint16_t durationMs, const uint32_t* notes, uint8_t count) {
    if (voice >= MAX_VOICES || count == 0 || !notes) return;
    if (count > MAX_ARP_NOTES) count = MAX_ARP_NOTES;
    synth.setArpeggioRaw(voice, durationMs, notes, count);
}

// Wavetable
static uint8_t s_voiceWavetableBuffers[MAX_VOICES][4096];

EMSCRIPTEN_KEEPALIVE
uint8_t* synth_getWavetableBuffer(uint16_t voice) {
    if (voice >= MAX_VOICES) return nullptr;
    return s_voiceWavetableBuffers[voice];
}

EMSCRIPTEN_KEEPALIVE
void synth_setWavetable(uint16_t voice, const void* data, uint32_t size, uint8_t depth) {
    if (voice >= MAX_VOICES) return;
    if (!data) data = s_voiceWavetableBuffers[voice];
    synth.setWavetable(voice, data, size, (BitDepth)depth);
    synth.setWave(voice, WAVE_WAVETABLE);
}

EMSCRIPTEN_KEEPALIVE
void synth_detachArpeggio(uint16_t voice) {
    synth.detachArpeggio(voice);
}

// ============================================================================
// 8. Getters de Estado e Telemetria (Live Monitoring)
// ============================================================================

EMSCRIPTEN_KEEPALIVE
uint32_t synth_getFrequencyCentiHz(uint16_t voice) {
    return synth.getFrequencyCentiHz(voice);
}

EMSCRIPTEN_KEEPALIVE
uint16_t synth_getVolume(uint16_t voice) {
    return synth.getVolume(voice);
}

EMSCRIPTEN_KEEPALIVE
uint8_t synth_getVolume8Bit(uint16_t voice) {
    return synth.getVolume8Bit(voice);
}

EMSCRIPTEN_KEEPALIVE
uint8_t synth_getEnv8Bit(uint16_t voice) {
    return synth.getEnv8Bit(voice);
}

EMSCRIPTEN_KEEPALIVE
uint8_t synth_getOutput8Bit(uint16_t voice) {
    return synth.getOutput8Bit(voice);
}

EMSCRIPTEN_KEEPALIVE
bool synth_isVoiceActive(uint16_t voice) {
    return synth.isVoiceActive(voice);
}

EMSCRIPTEN_KEEPALIVE
uint8_t synth_getEnvState(uint16_t voice) {
    return (uint8_t)synth.getEnvState(voice);
}

EMSCRIPTEN_KEEPALIVE
int8_t synth_getWaveType(uint16_t voice) {
    return (int8_t)synth.getWaveType(voice);
}

EMSCRIPTEN_KEEPALIVE
uint32_t synth_getPhase(uint16_t voice) {
    return synth.getPhase(voice);
}

EMSCRIPTEN_KEEPALIVE
uint32_t synth_getPulseWidth(uint16_t voice) {
    return synth.getPulseWidth(voice);
}

} // extern "C"
