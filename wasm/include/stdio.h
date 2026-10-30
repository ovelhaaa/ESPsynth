#pragma once
#include "wasm_compat.h"
typedef void FILE;
#ifndef NULL
#define NULL 0
#endif
#define SEEK_SET 0
#define SEEK_CUR 1
#define SEEK_END 2
static inline FILE* fopen(const char* p, const char* m) { return (FILE*)0; }
static inline int fclose(FILE* f) { return 0; }
static inline int fseek(FILE* f, long o, int w) { return 0; }
static inline long ftell(FILE* f) { return 0; }
static inline size_t fread(void* p, size_t s, size_t n, FILE* f) { return 0; }
static inline size_t fwrite(const void* p, size_t s, size_t n, FILE* f) { return 0; }
