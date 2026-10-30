#!/bin/bash
set -e
mkdir -p wasm public
clang++ -c --target=wasm32 -O3 -fno-exceptions -fno-rtti -fno-use-cxa-atexit \
  -isystem /usr/lib/llvm-14/lib/clang/14.0.6/include \
  -I wasm/include -I esp32synth-src \
  -DENABLE_MP3=0 \
  esp32synth-src/ESP32Synth.cpp -o wasm/ESP32Synth.o

clang++ -c --target=wasm32 -O3 -fno-exceptions -fno-rtti -fno-use-cxa-atexit \
  -isystem /usr/lib/llvm-14/lib/clang/14.0.6/include \
  -I wasm/include -I esp32synth-src \
  -DENABLE_MP3=0 \
  wasm/esp32synth_wasm.cpp -o wasm/esp32synth_wasm.o

wasm-ld wasm/esp32synth_wasm.o wasm/ESP32Synth.o \
  -o public/esp32synth.wasm \
  --no-entry --export-all

echo "Successfully built public/esp32synth.wasm ($(stat -c%s public/esp32synth.wasm) bytes)"
