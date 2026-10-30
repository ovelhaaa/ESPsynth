#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// Memory allocations
void* malloc(size_t size);
void* calloc(size_t nmemb, size_t size);
void free(void* ptr);
void* memcpy(void* dest, const void* src, size_t n);
void* memset(void* s, int c, size_t n);
void* memmove(void* dest, const void* src, size_t n);
int memcmp(const void* s1, const void* s2, size_t n);
int strncmp(const char* s1, const char* s2, size_t n);
double sin(double x);
double cos(double x);
double pow(double base, double exp);
float powf(float base, float exp);
float expf(float x);
float logf(float x);
int abs(int j);

#ifdef __cplusplus
}
#endif

#define IRAM_ATTR
#define CONFIG_IDF_TARGET_GENERIC 1

// File abstractions for WASM
#define SYNTH_FILE void*
#define SYNTH_FILE_REF void*
#define SYNTH_STREAM_OPEN() ((void*)0)
#define SYNTH_FILE_CLOSE(f) ((void)0)
#define SYNTH_FILE_SEEK(f, pos) 0
#define SYNTH_FILE_READ(f, b, s) 0
#define SYNTH_FILE_POS(f) 0
#define SYNTH_FILE_AVAILABLE(f) 0
#define SYNTH_FILE_SIZE(f) 0
#define SYNTH_FILE_VALID(f) (f != nullptr)
#define SYNTH_FILE_WRITE(f, b, s) 0
static inline void* fopen(const char* p, const char* m) { return nullptr; }

// FreeRTOS Mocks
typedef void* TaskHandle_t;
typedef void* SemaphoreHandle_t;
typedef int BaseType_t;
typedef uint32_t TickType_t;
#define pdTRUE 1
#define pdFALSE 0
#define pdPASS 1
#define pdFAIL 0
#define portMAX_DELAY 0xFFFFFFFFUL
#define configMAX_PRIORITIES 25
#define pdMS_TO_TICKS(ms) (ms)
#define portYIELD_FROM_ISR() ((void)0)

static inline void vTaskDelay(TickType_t ticks) {}
static inline void vTaskDelete(TaskHandle_t task) {}
static inline BaseType_t xTaskCreatePinnedToCore(void (*task)(void*), const char* name, uint32_t stack, void* param, int prio, TaskHandle_t* handle, int core) {
    if (handle) *handle = (void*)1;
    return pdPASS;
}
static inline BaseType_t xSemaphoreTake(SemaphoreHandle_t s, TickType_t wait) { return pdTRUE; }
static inline BaseType_t xSemaphoreGive(SemaphoreHandle_t s) { return pdTRUE; }
static inline void xSemaphoreGiveFromISR(SemaphoreHandle_t s, BaseType_t* awoken) { if (awoken) *awoken = pdFALSE; }
static inline void vSemaphoreDelete(SemaphoreHandle_t s) {}
static inline SemaphoreHandle_t xSemaphoreCreateBinary() { return (SemaphoreHandle_t)1; }

// ESP Heap Caps Mocks
#define MALLOC_CAP_INTERNAL 1
#define MALLOC_CAP_8BIT     2
#define MALLOC_CAP_32BIT    4

static inline void* heap_caps_malloc(size_t size, uint32_t caps) {
    return malloc(size);
}
static inline void* heap_caps_calloc(size_t n, size_t size, uint32_t caps) {
    return calloc(n, size);
}
static inline void* heap_caps_aligned_alloc(size_t alignment, size_t size, uint32_t caps) {
    return malloc(size);
}
static inline void heap_caps_free(void* ptr) {
    free(ptr);
}

// ESP System / Timer / Clock Mocks
#ifndef SYNTH_GET_CPU_FREQ_MHZ
#define SYNTH_GET_CPU_FREQ_MHZ() 240
#endif
#ifndef SYNTH_MICROS
#define SYNTH_MICROS()           0
#endif
#ifndef SYNTH_DELAY_US
#define SYNTH_DELAY_US(us)       ((void)0)
#endif

static inline uint32_t esp_timer_get_time() { return 0; }
static inline void esp_rom_delay_us(uint32_t us) {}
static inline uint32_t esp_clk_cpu_freq() { return 240000000; }
static inline uint32_t esp_cpu_get_cycle_count() { return 0; }

// Driver mocks
typedef void* i2s_chan_handle_t;
typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1

typedef int gpio_num_t;
static inline esp_err_t gpio_reset_pin(gpio_num_t pin) { return ESP_OK; }
static inline esp_err_t i2s_channel_disable(i2s_chan_handle_t handle) { return ESP_OK; }
static inline esp_err_t i2s_del_channel(i2s_chan_handle_t handle) { return ESP_OK; }
static inline esp_err_t i2s_channel_write(i2s_chan_handle_t handle, const void* src, size_t size, size_t* bytes_written, TickType_t timeout) {
    if (bytes_written) *bytes_written = size;
    return ESP_OK;
}
static inline esp_err_t i2s_channel_enable(i2s_chan_handle_t handle) { return ESP_OK; }
static inline esp_err_t i2s_channel_init_pdm_tx_mode(i2s_chan_handle_t handle, const void* cfg) { return ESP_OK; }
static inline esp_err_t i2s_channel_init_std_mode(i2s_chan_handle_t handle, const void* cfg) { return ESP_OK; }
static inline esp_err_t i2s_new_channel(const void* chan_cfg, i2s_chan_handle_t* tx_handle, void* rx_handle) {
    if (tx_handle) *tx_handle = (void*)1;
    return ESP_OK;
}
typedef void* intr_handle_t;
static inline esp_err_t esp_intr_free(intr_handle_t handle) { return ESP_OK; }
static inline esp_err_t esp_intr_alloc(int s, int f, void (*isr)(void*), void* arg, intr_handle_t* h) { return ESP_OK; }

#define LEDC_TIMER0_OVF_INT_ST 1
#define LEDC_TIMER0_OVF_INT_CLR 1
#define LEDC_TIMER0_OVF_INT_ENA 1
#define LEDC_LOW_SPEED_MODE 0
#define LEDC_TIMER_10_BIT 10
#define LEDC_TIMER_0 0
#define LEDC_AUTO_CLK 0
#define LEDC_CHANNEL_0 0
#define LEDC_INTR_DISABLE 0
#define ETS_LEDC_INTR_SOURCE 0
#define ESP_INTR_FLAG_IRAM 0

typedef struct {
    int speed_mode;
    int duty_resolution;
    int timer_num;
    uint32_t freq_hz;
    int clk_cfg;
} ledc_timer_config_t;

typedef struct {
    int gpio_num;
    int speed_mode;
    int channel;
    int intr_type;
    int timer_sel;
    int duty;
    int hpoint;
} ledc_channel_config_t;

static inline esp_err_t ledc_timer_config(const ledc_timer_config_t* c) { return ESP_OK; }
static inline esp_err_t ledc_channel_config(const ledc_channel_config_t* c) { return ESP_OK; }

typedef int i2s_port_t;
#define I2S_NUM_0 0
#define I2S_NUM_AUTO 0
#define I2S_ROLE_MASTER 0

typedef struct {
    int id;
    int role;
    int dma_desc_num;
    int dma_frame_num;
    bool auto_clear;
} i2s_chan_config_t;
#define I2S_CHANNEL_DEFAULT_CONFIG(p, r) {p, r, 6, 512, true}

typedef struct {
    struct {
        int mclk_multiple;
        uint32_t sample_rate_hz;
        int clk_src;
    } clk_cfg;
    struct {
        int data_bit_width;
        int slot_mode;
        int slot_mask;
    } slot_cfg;
    struct {
        gpio_num_t mclk;
        gpio_num_t bclk;
        gpio_num_t ws;
        gpio_num_t dout;
    } gpio_cfg;
} i2s_std_config_t;

#define I2S_SLOT_MODE_MONO 0
#define I2S_SLOT_MODE_STEREO 1
#define I2S_DATA_BIT_WIDTH_16BIT 16
#define I2S_DATA_BIT_WIDTH_32BIT 32
#define I2S_STD_SLOT_BOTH 0
#define I2S_STD_CLK_DEFAULT_CONFIG(r) {{0, r, 0}, {0, 0, 0}, {-1, -1, -1, -1}}
#define I2S_STD_SLOT_DEFAULT_CONFIG(w, m) {{0, 0, 0}, {w, m, 0}, {-1, -1, -1, -1}}

typedef struct {
    struct {
        uint32_t sample_rate_hz;
        int clk_src;
        int mclk_multiple;
        uint32_t max_sample_rate_hz;
    } clk_cfg;
    struct {
        int slot_mode;
        int data_bit_width;
        int slot_mask;
    } slot_cfg;
    struct {
        gpio_num_t clk;
        gpio_num_t dout;
    } gpio_cfg;
} i2s_pdm_tx_config_t;

#define I2S_PDM_TX_CLK_DEFAULT_CONFIG(r) {{r, 0, 0, 0}, {0, 0, 0}, {-1, -1}}
#define I2S_PDM_TX_SLOT_DEFAULT_CONFIG(w, m) {{0, 0, 0, 0}, {m, w, 0}, {-1, -1}}
