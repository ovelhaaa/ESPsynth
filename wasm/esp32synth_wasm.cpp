/**
 * ESP32Synth WebAssembly Bridge
 * 1:1 Mirror of Danilo Gabriel's ESP32Synth C++ engine
 * Freestanding, 100% integer/fixed-point DSP preservation
 */

#include "wasm_compat.h"

// Define standard types for non-Arduino
#define CONFIG_IDF_TARGET_GENERIC 1
#define ENABLE_MP3 0

// Math and memory primitives for freestanding WASM
extern "C" {

int __cxa_atexit(void (*func)(void*), void* arg, void* dso) {
    return 0;
}

int atexit(void (*func)(void)) {
    return 0;
}

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

int abs(int j) {
    return (j < 0) ? -j : j;
}

double sin(double x) {
    const double PI = 3.14159265358979323846;
    const double TWO_PI = 6.28318530717958647692;
    while (x > PI) x -= TWO_PI;
    while (x < -PI) x += TWO_PI;
    double x2 = x * x;
    double x3 = x * x2;
    double x5 = x3 * x2;
    double x7 = x5 * x2;
    double x9 = x7 * x2;
    return x - (x3 / 6.0) + (x5 / 120.0) - (x7 / 5040.0) + (x9 / 362880.0);
}

double cos(double x) {
    const double HALF_PI = 1.57079632679489661923;
    return sin(x + HALF_PI);
}

double pow(double base, double exp) {
    // Basic integer exponent approximation or fallback
    if (exp == 0.0) return 1.0;
    if (base <= 0.0) return 0.0;
    // Fast 2^(exp) using lookup/series if base is 2
    if (base == 2.0) {
        int i = (int)exp;
        double f = exp - i;
        double r = (i >= 0) ? (double)(1ULL << (i > 30 ? 30 : i)) : 1.0 / (double)(1ULL << (-i > 30 ? 30 : -i));
        // linear/quadratic approx for fractional part 2^f ~= 1 + f * 0.693147 + f^2 * 0.24
        double frac_val = 1.0 + f * (0.69314718 + f * 0.2402265);
        return r * frac_val;
    }
    return 1.0;
}

float powf(float base, float exp) { return (float)pow(base, exp); }
float expf(float x) { return (float)pow(2.718281828459045, x); }
float logf(float x) { return 0.0f; }

// Simple static heap for wavetable baking & buffer allocations
static uint8_t s_heap[1024 * 1024]; // 1MB static pool
static size_t s_heap_offset = 0;

void* malloc(size_t size) {
    size = (size + 15) & ~15; // 16-byte align
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
    // Bump allocator: no-op for individual frees, can reset all if needed
}

} // extern "C"

#define IRAM_ATTR

// Include the actual ESP32Synth codebase
#include "ESP32Synth.h"
#include "ESP32SynthNotes.h"
#include "ESP32Synth_Patches.hpp"

// Single global synth instance
static ESP32Synth synth;

// Audio buffer for WebAssembly export (up to 2048 stereo sample frames = 4096 int16)
static int16_t s_outBufferStereo[4096];
static int16_t s_outBufferMono[2048];

extern "C" {

extern "C" void __wasm_call_ctors();

// --- Initialization & Engine Core ---
bool synth_init(uint32_t sampleRate) {
    __wasm_call_ctors();
    return synth.beginCustom(sampleRate, nullptr);
}

void synth_end() {
    synth.end();
}

void synth_setSampleRate(uint32_t rate) {
    synth.setSampleRate(rate);
}

int32_t synth_getSampleRate() {
    return synth.getSampleRate();
}

void synth_setControlRateHz(uint16_t hz) {
    synth.setControlRateHz(hz);
}

void synth_setMasterVolume(uint16_t volume) {
    synth.setMasterVolume(volume);
}

uint16_t synth_getMasterVolume() {
    return synth.getMasterVolume();
}

void synth_setVolDepthBase(uint8_t bits) {
    synth.setVolDepthBase(bits);
}

void synth_setMasterBitcrush(uint8_t bits) {
    synth.setMasterBitcrush(bits);
}

float synth_getCPULoad() {
    return synth.getCPULoad();
}

// --- Audio Rendering (Pull Mode for AudioWorklet) ---
int16_t* synth_renderStereo(int numFrames) {
    if (numFrames > 2048) numFrames = 2048;
    synth.generateSamplesStereo(s_outBufferStereo, numFrames);
    return s_outBufferStereo;
}

int16_t* synth_renderMono(int numSamples) {
    if (numSamples > 2048) numSamples = 2048;
    synth.generateSamples(s_outBufferMono, numSamples);
    return s_outBufferMono;
}

// Float32 block rendering for Web Audio API / AudioWorklet
void process_audio_block(float* output_left, float* output_right, int num_frames) {
    if (num_frames > 2048) num_frames = 2048;
    synth.generateSamplesStereo(s_outBufferStereo, num_frames);
    const float norm = 1.0f / 32768.0f;
    for (int i = 0; i < num_frames; ++i) {
        output_left[i] = (float)s_outBufferStereo[i * 2] * norm;
        output_right[i] = (float)s_outBufferStereo[i * 2 + 1] * norm;
    }
}

float* synth_alloc_float_buffer(int count) {
    return (float*)malloc(count * sizeof(float));
}

// --- Voice Control ---
void synth_noteOn(uint16_t voice, uint32_t freqCentiHz, uint16_t volume) {
    synth.noteOn(voice, freqCentiHz, volume);
}

void synth_noteOff(uint16_t voice) {
    synth.noteOff(voice);
}

void synth_setFrequency(uint16_t voice, uint32_t freqCentiHz) {
    synth.setFrequency(voice, freqCentiHz);
}

void synth_setVolume(uint16_t voice, uint16_t volume) {
    synth.setVolume(voice, volume);
}

void synth_setWave(uint16_t voice, int8_t type) {
    synth.setWave(voice, (WaveType)type);
}

void synth_setPulseWidthBitDepth(uint8_t bits) {
    synth.setPulseWidthBitDepth(bits);
}

void synth_setPulseWidth(uint16_t voice, uint32_t width) {
    synth.setPulseWidth(voice, width);
}

void synth_setEnv(uint16_t voice, uint16_t a, uint16_t d, uint8_t s, uint16_t r) {
    synth.setEnv(voice, a, d, s, r);
}

void synth_setSmoothEnv(uint16_t voice, bool enable) {
    synth.setSmoothEnv(voice, enable);
}

void synth_setStartPhase(uint16_t voice, uint16_t phaseDegrees) {
    synth.setStartPhase(voice, phaseDegrees);
}

void synth_setCurrentPhase(uint16_t voice, uint16_t phaseDegrees) {
    synth.setCurrentPhase(voice, phaseDegrees);
}

void synth_setVibrato(uint16_t voice, uint32_t rateCentiHz, uint32_t depthCentiHz) {
    synth.setVibrato(voice, rateCentiHz, depthCentiHz);
}

void synth_setVibratoPhase(uint16_t voice, uint16_t phaseDegrees) {
    synth.setVibratoPhase(voice, phaseDegrees);
}

void synth_setTremolo(uint16_t voice, uint32_t rateCentiHz, uint16_t depth) {
    synth.setTremolo(voice, rateCentiHz, depth);
}

void synth_setTremoloPhase(uint16_t voice, uint16_t phaseDegrees) {
    synth.setTremoloPhase(voice, phaseDegrees);
}

void synth_slideFreq(uint16_t voice, uint32_t startFreqCentiHz, uint32_t endFreqCentiHz, uint32_t durationMs) {
    synth.slideFreq(voice, startFreqCentiHz, endFreqCentiHz, durationMs);
}

void synth_slideFreqTo(uint16_t voice, uint32_t endFreqCentiHz, uint32_t durationMs) {
    synth.slideFreqTo(voice, endFreqCentiHz, durationMs);
}

void synth_slideVol(uint16_t voice, uint16_t startVol, uint16_t endVol, uint32_t durationMs) {
    synth.slideVol(voice, startVol, endVol, durationMs);
}

void synth_slideVolTo(uint16_t voice, uint16_t endVol, uint32_t durationMs) {
    synth.slideVolTo(voice, endVol, durationMs);
}

// --- Voice Custom Patches from ESP32Synth_Patches.hpp ---
// 0: None (revert to basic wave)
// 1: AA_Saw (PolyBLEP Saw)
// 2: AA_Pulse (PolyBLEP Pulse)
// 3: DSP_BiquadOscFast (Direct Form I resonant filter osc)
// 4: DSP_BiquadOsc (64-bit precision resonant biquad osc)
// 5: FM_Custom (2-Op FM Synthesis)
// 6: HammondB3 (Tonewheel Organ)
// 7: EKS_Guitar (Karplus-Strong Plucked String)
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

void synth_setCustomParam(uint16_t voice, uint8_t paramId, int16_t value) {
    synth.setCustomParam(voice, paramId, value);
}

// --- Modular Bus & FX Routing ---
void synth_setVoiceBus(uint16_t voice, uint8_t busId) {
    synth.setVoiceBus(voice, busId);
}

// fxPatchId:
// 0: None
// 1: FX_BiquadFilter
// 2: FX_BiquadFilterFast
void synth_setBusFXPatch(uint8_t busId, uint8_t slotId, int fxPatchId) {
    switch (fxPatchId) {
        case 1: synth.setBusFX(busId, slotId, FX_CUSTOM, ESP32Patches::FX_BiquadFilter); break;
        case 2: synth.setBusFX(busId, slotId, FX_CUSTOM, ESP32Patches::FX_BiquadFilterFast); break;
        default: synth.setBusFX(busId, slotId, FX_NONE, nullptr); break;
    }
}

void synth_setBusFXParam(uint8_t busId, uint8_t slotId, uint8_t paramId, int16_t value) {
    synth.setBusFXParam(busId, slotId, paramId, value);
}

void synth_setBusMix(uint8_t busId, uint8_t volume) {
    synth.setBusMix(busId, volume);
}

// --- Custom Global DSP ---
// dspPatchId:
// 0: None
// 1: DSP_HammondLeslie
// 2: DSP_Pedalboard
void synth_setCustomDSPPatch(int dspPatchId) {
    switch (dspPatchId) {
        case 1: synth.setCustomDSP(ESP32Patches::DSP_HammondLeslie); break;
        case 2: synth.setCustomDSP(ESP32Patches::DSP_Pedalboard); break;
        default: synth.setCustomDSP(nullptr); break;
    }
}

void synth_setDSPParam(uint8_t paramId, int16_t value) {
    synth.setDSPParam(paramId, value);
}

// --- Arpeggiator ---
void synth_setArpeggio(uint16_t voice, uint16_t durationMs, const uint32_t* notes, uint8_t count) {
    if (voice >= MAX_VOICES || count == 0) return;
    if (count > MAX_ARP_NOTES) count = MAX_ARP_NOTES;
    if (count == 1) synth.setArpeggio(voice, durationMs, notes[0]);
    else if (count == 2) synth.setArpeggio(voice, durationMs, notes[0], notes[1]);
    else if (count == 3) synth.setArpeggio(voice, durationMs, notes[0], notes[1], notes[2]);
    else if (count == 4) synth.setArpeggio(voice, durationMs, notes[0], notes[1], notes[2], notes[3]);
    else if (count == 5) synth.setArpeggio(voice, durationMs, notes[0], notes[1], notes[2], notes[3], notes[4]);
    else if (count == 6) synth.setArpeggio(voice, durationMs, notes[0], notes[1], notes[2], notes[3], notes[4], notes[5]);
    else if (count == 7) synth.setArpeggio(voice, durationMs, notes[0], notes[1], notes[2], notes[3], notes[4], notes[5], notes[6]);
    else if (count >= 8) synth.setArpeggio(voice, durationMs, notes[0], notes[1], notes[2], notes[3], notes[4], notes[5], notes[6], notes[7]);
}

void synth_detachArpeggio(uint16_t voice) {
    synth.detachArpeggio(voice);
}

// --- Voice State Getters ---
uint32_t synth_getFrequencyCentiHz(uint16_t voice) {
    return synth.getFrequencyCentiHz(voice);
}

uint16_t synth_getVolume(uint16_t voice) {
    return synth.getVolume(voice);
}

uint8_t synth_getVolume8Bit(uint16_t voice) {
    return synth.getVolume8Bit(voice);
}

uint8_t synth_getEnv8Bit(uint16_t voice) {
    return synth.getEnv8Bit(voice);
}

uint8_t synth_getOutput8Bit(uint16_t voice) {
    return synth.getOutput8Bit(voice);
}

bool synth_isVoiceActive(uint16_t voice) {
    return synth.isVoiceActive(voice);
}

uint8_t synth_getEnvState(uint16_t voice) {
    return (uint8_t)synth.getEnvState(voice);
}

int8_t synth_getWaveType(uint16_t voice) {
    return (int8_t)synth.getWaveType(voice);
}

uint32_t synth_getPhase(uint16_t voice) {
    return synth.getPhase(voice);
}

uint32_t synth_getPulseWidth(uint16_t voice) {
    return synth.getPulseWidth(voice);
}

} // extern "C"
